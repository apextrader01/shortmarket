const cron = require('node-cron');
const db = require('../database/db');
const LedgerService = require('./ledgerService');

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

    // Helper: Check if a symbol is a commodity by looking for the -MCX suffix
    const isCommoditySymbol = (symbol) => symbol && symbol.endsWith('-MCX');

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
                    
                    // Sweep ALL pending entry orders (INT, BO, CO, DEL, CNC) atomically
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

                    const ltp = priceCache[pos.symbol]?.ltp || Number(pos.average_price) || 0;
                    if (!ltp || ltp <= 0) {
                        console.warn(`[CRON] Phase 3: No LTP for ${pos.symbol}, skipping square-off.`);
                        continue;
                    }

                    // Close position with RMS penalty
                    await LedgerService.closePosition(trx, pos.user_id, pos.id, ltp, true);
                    console.log(`[CRON] Phase 3: Squared off ${pos.product_type} position ${pos.id} for ${pos.symbol} at LTP ${ltp}`);
                    
                    // Cancel all PENDING_TRIGGER brackets for this user+symbol
                    const triggers = await trx('orders').where({ user_id: pos.user_id, symbol: pos.symbol, status: 'PENDING_TRIGGER' });
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
                    
                    // Also cancel any remaining PENDING orders for this user+symbol
                    const pendingOrders = await trx('orders').where({ user_id: pos.user_id, symbol: pos.symbol, status: 'PENDING' });
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

    
    // --- 9:30 AM SIP Execution ---
    cron.schedule('30 9 * * 1-5', async () => {
        console.log('[CRON] 9:30 AM: Executing due SIPs...');
        try {
            await db.transaction(async (trx) => {
                const today = new Date();
                today.setHours(23, 59, 59, 999);
                
                const dueSips = await trx('sips')
                    .where('status', 'ACTIVE')
                    .where('next_execution_date', '<=', today);
                
                for (const sip of dueSips) {
                    try {
                        const user = await trx('users').where({ id: sip.user_id }).first();
                        const finalMargin = Number(sip.amount);
                        
                        const execPrice = priceCache[sip.symbol]?.ltp;
                          if (!execPrice || execPrice <= 0) {
                              console.log(`[SIP] Skipped ${sip.id} for user ${user.id} - Live price unavailable for ${sip.symbol}. Will retry tomorrow.`);
                              continue;
                          }

                          if (Number(user.balance) < finalMargin) {
                              console.log(`[SIP] Skipped ${sip.id} for user ${user.id} - Insufficient Funds`);
                              continue;
                          }
                          
                          // Deduct balance
                          const newBalance = Number(user.balance) - finalMargin;
                          await trx('users').where({ id: sip.user_id }).update({ balance: newBalance });
                          
                          await trx('ledger').insert({
                              user_id: sip.user_id,
                              amount: -finalMargin,
                              type: 'MARGIN_BLOCK',
                              description: `Auto SIP installment blocked for ${sip.symbol}`
                          });
                          
                          // Execute Market Order
                        const qty = parseFloat((finalMargin / execPrice).toFixed(4));
                        
                        const [id] = await trx('orders').insert({
                            user_id: sip.user_id, symbol: sip.symbol, type: 'MARKET', side: 'BUY', quantity: qty, price: execPrice,
                            status: 'PENDING', product_type: 'DEL', margin: finalMargin
                        }).returning('id');
                        const orderId = typeof id === 'object' ? id.id : id;
                        
                        triggerEngine.executeOrder({
                            id: orderId, user_id: sip.user_id, symbol: sip.symbol, type: 'MARKET', side: 'BUY', quantity: qty, price: execPrice,
                            status: 'PENDING', product_type: 'DEL', margin: finalMargin
                        }, execPrice).catch(e => console.error('SIP execution error:', e));
                        
                        // Calculate next date
                        let nextExecutionDate = new Date(sip.next_execution_date);
                        if (sip.frequency === 'DAILY') {
                            nextExecutionDate.setDate(nextExecutionDate.getDate() + 1);
                        } else if (sip.frequency === 'WEEKLY') {
                            nextExecutionDate.setDate(nextExecutionDate.getDate() + 7);
                        } else {
                            nextExecutionDate.setMonth(nextExecutionDate.getMonth() + 1);
                        }
                        while (nextExecutionDate.getDay() === 0 || nextExecutionDate.getDay() === 6) {
                            nextExecutionDate.setDate(nextExecutionDate.getDate() + 1);
                        }
                        
                        // Update Next Execution Date
                        await trx('sips').where({ id: sip.id }).update({ next_execution_date: nextExecutionDate });
                        
                    } catch (e) {
                        console.error(`[SIP] Error processing SIP ${sip.id}:`, e);
                    }
                }
            });
        } catch (err) {
            console.error('[CRON] SIP execution error:', err);
        }
    }, TZ);

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
