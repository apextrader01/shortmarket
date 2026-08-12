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

    // Helper: Check if a symbol is a commodity
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
                    
                    // Sweep all intraday-type orders: INT, BO, CO
                    if (order.product_type === 'INT' || order.product_type === 'BO' || order.product_type === 'CO') {
                        await trx('orders').where({ id: order.id }).update({ status: 'CANCELLED' });
                        if (parseFloat(order.margin) > 0) {
                            await LedgerService.releaseMargin(trx, order.user_id, order.margin, `Phase 2 Sweep Cancelled: ${order.symbol}`);
                        }
                        triggerEngine.removeOrderFromMemory(order.id, order.symbol);
                        console.log(`[CRON] Phase 2: Cancelled pending ${order.product_type} order ${order.id} for ${order.symbol}`);
                    }
                }
            });
        } catch (err) {
            console.error('Phase 2 Sweep Error:', err);
        }
    };

    cron.schedule('19 15 * * *', () => phase2Sweep('EQ'), TZ);
    cron.schedule('59 22 * * *', () => phase2Sweep('COM'), TZ);

    // ─── PHASE 3: Auto Square-Off (15:50 Eq / 23:00 Com) ──────────────────────
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
                    if (!ltp) {
                        console.warn(`[CRON] Phase 3: No LTP for ${pos.symbol}, skipping square-off.`);
                        continue;
                    }

                    // Close position with RMS penalty
                    await LedgerService.closePosition(trx, pos.user_id, pos.id, ltp, true);
                    console.log(`[CRON] Phase 3: Squared off ${pos.product_type} position ${pos.id} for ${pos.symbol} at LTP ${ltp}`);
                    
                    // Cancel all PENDING_TRIGGER brackets for this user+symbol
                    const triggers = await trx('orders').where({ user_id: pos.user_id, symbol: pos.symbol, status: 'PENDING_TRIGGER' });
                    for (const t of triggers) {
                        await trx('orders').where({ id: t.id }).update({ status: 'CANCELLED' });
                        triggerEngine.removeOrderFromMemory(t.id, t.symbol);
                    }
                    
                    // Also cancel any remaining PENDING orders for this user+symbol
                    const pendingOrders = await trx('orders').where({ user_id: pos.user_id, symbol: pos.symbol, status: 'PENDING' });
                    for (const o of pendingOrders) {
                        await trx('orders').where({ id: o.id }).update({ status: 'CANCELLED' });
                        if (parseFloat(o.margin) > 0) {
                            await LedgerService.releaseMargin(trx, pos.user_id, o.margin, `Phase 3 Cancelled: ${o.symbol}`);
                        }
                        triggerEngine.removeOrderFromMemory(o.id, o.symbol);
                    }
                }
            });
        } catch (err) {
            console.error('Phase 3 Square-Off Error:', err);
        }
    };

    cron.schedule('20 15 * * *', () => phase3SquareOff('EQ'), TZ);
    cron.schedule('0 23 * * *', () => phase3SquareOff('COM'), TZ);

    // ─── T+1 RESET: WIPE & MIGRATE TO HOLDINGS (08:00 AM) ──────────────────────
    // REMOVED: This logic is now handled in `backend/services/positionsEngine.js`
    // to prevent duplicate executions and data corruption.

    // ─── EXPIRY DAY SETTLEMENT (03:25 PM / 07:00 PM) ─────────────────────────
    // DISABLED: Handled exclusively in positionsEngine.js to avoid race conditions.
    // cron.schedule('25 15 * * *', () => expirySquareOff(false), TZ);
    // cron.schedule('0 19 * * *', () => expirySquareOff(true), TZ);
}

module.exports = { initCronJobs, isIntradayBlocked: () => isIntradayBlocked };
