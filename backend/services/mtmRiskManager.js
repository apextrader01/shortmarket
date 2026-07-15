const db = require('../database/db');
const LedgerService = require('./ledgerService');

class MTMRiskManager {
    constructor(priceCache) {
        this.priceCache = priceCache;
        this.isRunning = false;
        console.log('MTM Risk Manager Initialized.');
    }

    start() {
        if (this.isRunning) return;
        this.isRunning = true;
        // Run the MTM check every 2 seconds
        setInterval(() => this.evaluateMTM(), 2000);
        console.log('MTM Risk Manager started checking every 2 seconds.');
    }

    async evaluateMTM() {
        try {
            // Group active positions by user
            const openPositions = await db('positions').whereNot({ quantity: 0 });
            if (openPositions.length === 0) return;

            const userPositions = {};
            openPositions.forEach(pos => {
                if (!userPositions[pos.user_id]) userPositions[pos.user_id] = [];
                userPositions[pos.user_id].push(pos);
            });

            for (const [userId, positions] of Object.entries(userPositions)) {
                let totalMtmLoss = 0;

                for (const pos of positions) {
                    const ltp = this.priceCache[pos.symbol]?.ltp;
                    if (!ltp) continue; // Skip if no live price

                    let pnl = 0;
                    const absQty = Math.abs(pos.quantity);
                    if (pos.quantity > 0) {
                        pnl = (ltp - pos.average_price) * absQty;
                    } else {
                        pnl = (pos.average_price - ltp) * absQty;
                    }

                    if (pnl < 0) {
                        totalMtmLoss += Math.abs(pnl);
                    }
                }

                if (totalMtmLoss > 0) {
                    const user = await db('users').where({ id: userId }).first();
                    if (!user) continue;

                    // The total available balance (excluding blocked margin) is `user.balance`
                    const availableBalance = Number(user.balance);

                    // 95% Threshold Check against Available Balance
                    if (totalMtmLoss >= (availableBalance * 0.95)) {
                        console.log(`[RMS ALERT] User ${userId} hit 95% MTM Loss (${totalMtmLoss} >= ${availableBalance * 0.95}). Liquidating!`);
                        await this.liquidateUser(userId, positions);
                    }
                }
            }
        } catch (err) {
            console.error('MTM Risk Manager Error:', err);
        }
    }

    async liquidateUser(userId, positions) {
        try {
            await db.transaction(async (trx) => {
                // 1. Cancel all pending entry orders for the user
                await trx('orders')
                    .where({ user_id: userId })
                    .whereIn('status', ['PENDING', 'PENDING_TRIGGER'])
                    .update({ status: 'CANCELLED' });

                // 2. Liquidate all positions
                for (const pos of positions) {
                    const ltp = this.priceCache[pos.symbol]?.ltp;
                    if (!ltp) continue;

                    await LedgerService.closePosition(trx, userId, pos.id, ltp, true); // true = RMS Penalty
                    console.log(`[RMS EXECUTED] Closed ${pos.symbol} for user ${userId} at ${ltp}`);
                }
            });
        } catch (err) {
            console.error(`[RMS ALERT] Failed to liquidate user ${userId}:`, err);
        }
    }
}

module.exports = MTMRiskManager;
