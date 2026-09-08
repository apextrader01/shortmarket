const cron = require('node-cron');
const db = require('../database/db');
const LedgerService = require('./ledgerService');
const { parseExpiryDate, formatDate } = require('./autoSquareOff');

// Timezone configured to Asia/Kolkata
const TZ = { timezone: "Asia/Kolkata" };

// Global system block flag
let isIntradayBlocked = false;

function initCronJobs(priceCache, triggerEngine) {
    console.log('Initializing Cron Jobs...');

    // ─── PHASE 1: Intraday Block (15:15 Eq / 22:50 Com) ──────────────────────
    cron.schedule('15 15 * * *', () => {
        console.log('[CRON] Phase 1 (Equities): Blocking new Intraday placements.');
        isIntradayBlocked = true;
    }, TZ);

    cron.schedule('50 22 * * *', () => {
        console.log('[CRON] Phase 1 (Commodities): Blocking new Intraday placements.');
        isIntradayBlocked = true; // For commodities
    }, TZ);

    // Reset the block next day
    cron.schedule('0 0 * * *', () => {
        isIntradayBlocked = false;
    }, TZ);

    // Helper: Check if a symbol is a commodity
    const isCommoditySymbol = (symbol) => {
        if (!symbol || typeof symbol !== 'string') return false;
        if (symbol.includes('MCX') || symbol.includes('NCDEX')) return true;
        const clean = symbol.replace(/^(NSE:|BSE:|MCX:)/i, '');
        return ['CRUDEOIL', 'GOLD', 'SILVER', 'NATURALGAS', 'COPPER', 'ZINC', 'LEAD', 'ALUMINIUM', 'MENTHAOIL', 'COTTON', 'NICKEL'].some(c => clean.startsWith(c));
    };

    // Helper: Check if a symbol is an expiring derivative
    const isDerivativeSymbol = (symbol) => {
        if (!symbol || typeof symbol !== 'string') return false;
        const clean = symbol.replace(/^(NSE:|BSE:|MCX:)/i, '');
        return /(?:\d+|[-_\s])(CE|PE)(?:[-_\s].*)?$/i.test(clean) || /(?:\d+|[A-Z]{3}|[-_\s])FUT(?:[-_\s].*)?$/i.test(clean) || clean.endsWith('-FUT') || symbol.includes('-MCX');
    };

    // Helper: Check if symbol expires today
    const isExpiringToday = (symbol) => {
        try {
            const expDate = parseExpiryDate(symbol);
            if (!expDate) return false;
            const now = new Date();
            const istTime = new Date(now.toLocaleString("en-US", { timeZone: "Asia/Kolkata" }));
            return formatDate(expDate) === formatDate(istTime);
        } catch (e) {
            return false;
        }
    };

    // ─── PHASE 2: Order Sweep (15:19 Eq / 22:59 Com) ──────────────────────────
    const phase2Sweep = async (assetType) => {
        console.log(`[CRON] Phase 2 (${assetType}): Sweeping pending Intraday/CO/BO entry orders...`);
        try {
            await db.transaction(async (trx) => {
                const pendingOrders = await trx('orders').whereIn('status', ['PENDING']);
                
                for (const order of pendingOrders) {
                    const isCom = isCommoditySymbol(order.symbol);
                    if (assetType === 'EQ' && isCom) continue;  // Skip commodities during EQ sweep
                    if (assetType === 'COM' && !isCom) continue; // Skip equities during COM sweep
                    
                    // User Rule: Delivery (DEL/CNC) orders for regular cash equities stay open until 15:30.
                    // Only cancel DEL/CNC orders if the contract is an expiring derivative that expires TODAY.
                    if (order.product_type === 'DEL' || order.product_type === 'CNC' || order.product_type === 'DELIVERY') {
                        const isExpiring = isDerivativeSymbol(order.symbol) && isExpiringToday(order.symbol);
                        if (!isExpiring) {
                            continue; // Keep regular cash equity limit orders open until 15:30
                        }
                    }
                    
                    // Sweep pending intraday/BO/CO entry orders (or expiring derivative delivery orders) atomically
                    const updated = await trx('orders')
                        .where({ id: order.id, status: 'PENDING' })
                        .update({ status: 'CANCELLED', updated_at: new Date() });

                    if (updated > 0) {
                        if (parseFloat(order.margin) > 0) {
                            await LedgerService.releaseMargin(trx, order.user_id, order.margin, `End of Day Sweep Cancelled: ${order.symbol}`);
                        }
                        triggerEngine.removeOrderFromMemory(order.id, order.symbol);
                        console.log(`[CRON] Phase 2: Cancelled pending ${order.product_type || 'DEL'} order ${order.id} for ${order.symbol}`);
                    }
                }

                // Also cancel PENDING_TRIGGER legs (BO/CO SL & Target orders) so they don't linger overnight
                const pendingTriggers = await trx('orders').whereIn('status', ['PENDING_TRIGGER']);
                for (const trigger of pendingTriggers) {
                    const isCom = isCommoditySymbol(trigger.symbol);
                    if (assetType === 'EQ' && isCom) continue;
                    if (assetType === 'COM' && !isCom) continue;

                    // If trigger order is DEL/CNC, do not cancel unless expiring today
                    if (trigger.product_type === 'DEL' || trigger.product_type === 'CNC' || trigger.product_type === 'DELIVERY') {
                        const isExpiring = isDerivativeSymbol(trigger.symbol) && isExpiringToday(trigger.symbol);
                        if (!isExpiring) continue;
                    }

                    const updated = await trx('orders')
                        .where({ id: trigger.id, status: 'PENDING_TRIGGER' })
                        .update({ status: 'CANCELLED', updated_at: new Date() });

                    if (updated > 0) {
                        if (parseFloat(trigger.margin) > 0) {
                            await LedgerService.releaseMargin(trx, trigger.user_id, trigger.margin, `End of Day Sweep Cancelled: ${trigger.symbol}`);
                        }
                        triggerEngine.removeOrderFromMemory(trigger.id, trigger.symbol);
                        console.log(`[CRON] Phase 2: Cancelled pending trigger order ${trigger.id} for ${trigger.symbol}`);
                    }
                }
            });
        } catch (err) {
            console.error('Phase 2 Sweep Error:', err);
        }
    };

    cron.schedule('19 15 * * *', () => phase2Sweep('EQ'), TZ);
    cron.schedule('59 22 * * *', () => phase2Sweep('COM'), TZ);

    // ─── PHASE 3: Auto Square-Off (15:20 Eq / 23:00 Com) ──────────────────────
    const phase3SquareOff = async (assetType) => {
        console.log(`[CRON] Phase 3 (${assetType}): Forcing Auto Square-Off for all open Intraday/BO/CO positions...`);
        try {
            await db.transaction(async (trx) => {
                // Get ALL intraday-type positions (INT, BO, CO) that are still open
                const positions = await trx('positions')
                    .whereIn('product_type', ['INT', 'BO', 'CO'])
                    .whereNot({ quantity: 0 });

                for (const pos of positions) {
                    const isCom = isCommoditySymbol(pos.symbol);
                    if (assetType === 'EQ' && isCom) continue;
                    if (assetType === 'COM' && !isCom) continue;

                    const ltp = priceCache[pos.symbol]?.ltp;
                    if (!ltp || ltp <= 0) {
                        console.warn(`[CRON] Phase 3: No live LTP for ${pos.symbol}, skipping square-off to avoid artificial ₹0 PnL.`);
                        continue;
                    }

                    // Close position with RMS penalty
                    await LedgerService.closePosition(trx, pos.user_id, pos.id, ltp, true);
                    console.log(`[CRON] Phase 3: Squared off ${pos.product_type} position ${pos.id} for ${pos.symbol} at LTP ${ltp}`);
                    
                    // Cancel all PENDING_TRIGGER brackets for this user+symbol (only intraday types)
                    const triggers = await trx('orders')
                        .where({ user_id: pos.user_id, symbol: pos.symbol, status: 'PENDING_TRIGGER' })
                        .whereIn('product_type', ['INT', 'BO', 'CO']);
                    for (const t of triggers) {
                        const updated = await trx('orders')
                            .where({ id: t.id, status: 'PENDING_TRIGGER' })
                            .update({ status: 'CANCELLED', updated_at: new Date() });
                        if (updated > 0) {
                            if (parseFloat(t.margin) > 0) {
                                await LedgerService.releaseMargin(trx, pos.user_id, t.margin, `Phase 3 Cancelled: ${t.symbol}`);
                            }
                            triggerEngine.removeOrderFromMemory(t.id, t.symbol);
                        }
                    }
                    
                    // Also cancel any remaining PENDING orders for this user+symbol (only intraday types)
                    const pendingOrders = await trx('orders')
                        .where({ user_id: pos.user_id, symbol: pos.symbol, status: 'PENDING' })
                        .whereIn('product_type', ['INT', 'BO', 'CO']);
                    for (const o of pendingOrders) {
                        const updated = await trx('orders')
                            .where({ id: o.id, status: 'PENDING' })
                            .update({ status: 'CANCELLED', updated_at: new Date() });
                        if (updated > 0) {
                            if (parseFloat(o.margin) > 0) {
                                await LedgerService.releaseMargin(trx, pos.user_id, o.margin, `Phase 3 Cancelled: ${o.symbol}`);
                            }
                            triggerEngine.removeOrderFromMemory(o.id, o.symbol);
                        }
                    }
                }
            });
        } catch (err) {
            console.error('Phase 3 Square-Off Error:', err);
        }
    };

    cron.schedule('20 15 * * *', () => phase3SquareOff('EQ'), TZ);
    cron.schedule('0 23 * * *', () => phase3SquareOff('COM'), TZ);

    // Note: Daily/Weekly/Monthly SIP execution is authoritatively handled by sipEngine.js at 09:30 AM & 03:30 PM

    // --- 1:00 AM Expired Watchlist Cleanup ---
    cron.schedule('0 1 * * *', async () => {
        console.log('[CRON] 1:00 AM: Cleaning expired symbols from all user watchlists...');
        try {
            const db = require('../database/db');
            const now = new Date().getTime();
            const expiredInstruments = await db('instruments').whereNotNull('expiry_timestamp').where('expiry_timestamp', '<', now).select('unique_symbol');
            if (expiredInstruments.length === 0) return;
            const expiredSet = new Set(expiredInstruments.map(i => i.unique_symbol));
            let usersUpdated = 0;
            const users = await db('users').whereNotNull('watchlists');
            
            for (const user of users) {
                let changed = false;
                let watchlists = user.watchlists;
                if (typeof watchlists === 'string') { try { watchlists = JSON.parse(watchlists); } catch(e) { continue; } }
                
                if (Array.isArray(watchlists)) {
                    watchlists.forEach(wl => {
                        if (Array.isArray(wl.symbols)) {
                            const originalLen = wl.symbols.length;
                            wl.symbols = wl.symbols.filter(sym => !expiredSet.has(sym));
                            if (wl.symbols.length !== originalLen) changed = true;
                        }
                    });
                }
                if (changed) {
                    await db('users').where({ id: user.id }).update({ watchlists: typeof user.watchlists === 'string' ? JSON.stringify(watchlists) : watchlists });
                    usersUpdated++;
                }
            }
            console.log(`[CRON] Watchlist cleanup complete. Removed expired symbols for ${usersUpdated} users.`);
        } catch (err) {
            console.error('[CRON] Watchlist cleanup error:', err);
        }
    }, TZ);
}

module.exports = { initCronJobs, isIntradayBlocked: () => isIntradayBlocked };
