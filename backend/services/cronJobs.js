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

    // ─── PHASE 2: Order Sweep (15:19 Eq / 22:59 Com) ──────────────────────────
    const phase2Sweep = async (assetType) => {
        console.log(`[CRON] Phase 2 (${assetType}): Sweeping pending Intraday/CO/BO entry orders...`);
        try {
            await db.transaction(async (trx) => {
                let query = trx('orders').whereIn('status', ['PENDING']);
                if (assetType === 'EQ') {
                    query = query.whereNot('symbol', 'like', '%MCX%');
                } else {
                    query = query.where('symbol', 'like', '%MCX%');
                }
                
                const pendingOrders = await query;
                
                for (const order of pendingOrders) {
                    if (order.product_type === 'INT' || order.trigger_type !== 'REGULAR') {
                        // Cancel and refund margin
                        await trx('orders').where({ id: order.id }).update({ status: 'CANCELLED' });
                        await LedgerService.releaseMargin(trx, order.user_id, order.margin, `Phase 2 Sweep Cancelled: ${order.symbol}`);
                        triggerEngine.removeOrderFromMemory(order.id, order.symbol);
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
        console.log(`[CRON] Phase 3 (${assetType}): Forcing Auto Square-Off for all open Intraday positions...`);
        try {
            await db.transaction(async (trx) => {
                let posQuery = trx('positions').where({ product_type: 'INT' }).whereNot({ quantity: 0 });
                if (assetType === 'EQ') {
                    posQuery = posQuery.whereNot('symbol', 'like', '%MCX%');
                } else {
                    posQuery = posQuery.where('symbol', 'like', '%MCX%');
                }
                
                const positions = await posQuery;

                for (const pos of positions) {
                    const ltp = priceCache[pos.symbol]?.ltp;
                    if (!ltp) continue;

                    // Close position with RMS penalty
                    await LedgerService.closePosition(trx, pos.user_id, pos.id, ltp, true);
                    
                    // Cancel all PENDING_TRIGGER brackets for this symbol
                    const triggers = await trx('orders').where({ user_id: pos.user_id, symbol: pos.symbol, status: 'PENDING_TRIGGER' });
                    for (const t of triggers) {
                        await trx('orders').where({ id: t.id }).update({ status: 'CANCELLED' });
                        triggerEngine.removeOrderFromMemory(t.id, t.symbol);
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
    cron.schedule('0 8 * * *', async () => {
        console.log('[CRON] 08:00 AM T+1 Reset: Migrating delivery positions to Holdings...');
        try {
            await db.transaction(async (trx) => {
                // 1. Get all positions with quantity > 0 and product_type DEL
                const delPositions = await trx('positions').where({ product_type: 'DEL' }).whereNot({ quantity: 0 });
                
                // 2. Migrate to holdings
                for (const pos of delPositions) {
                    const existingHold = await trx('holdings').where({ user_id: pos.user_id, symbol: pos.symbol }).first();
                    if (existingHold) {
                        const currentTotal = existingHold.quantity * existingHold.average_price;
                        const newTotal = pos.quantity * pos.average_price;
                        const totalQty = existingHold.quantity + pos.quantity;
                        const newAvg = (currentTotal + newTotal) / totalQty;
                        
                        await trx('holdings').where({ id: existingHold.id }).update({
                            quantity: totalQty,
                            average_price: newAvg
                        });
                    } else {
                        await trx('holdings').insert({
                            user_id: pos.user_id,
                            symbol: pos.symbol,
                            quantity: pos.quantity,
                            average_price: pos.average_price
                        });
                    }
                }

                // 3. WIPE Positions & Orders Tables
                await trx('positions').del();
                await trx('orders').del();
                console.log('[CRON] T+1 Reset complete. Positions and Orders wiped and migrated.');
            });
        } catch (err) {
            console.error('T+1 Reset Error:', err);
        }
    }, TZ);

    // ─── EXPIRY DAY SETTLEMENT (03:25 PM / 07:00 PM) ─────────────────────────
    // DISABLED: Handled exclusively in positionsEngine.js to avoid race conditions.
    // cron.schedule('25 15 * * *', () => expirySquareOff(false), TZ);
    // cron.schedule('0 19 * * *', () => expirySquareOff(true), TZ);
}

module.exports = { initCronJobs, isIntradayBlocked: () => isIntradayBlocked };
