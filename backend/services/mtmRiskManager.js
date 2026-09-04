const db = require('../database/db');
const LedgerService = require('./ledgerService');

class MTMRiskManager {
    constructor(priceCache) {
        this.priceCache = priceCache;
        this.isRunning = false;
        this.isChecking = false;
        console.log('MTM Risk Manager Initialized.');
    }

    start() {
        if (this.isRunning) return;
        this.isRunning = true;
        // Run the MTM check every 2 seconds
        setInterval(() => this.evaluateMTM(), 600000);
        console.log('MTM Risk Manager started checking every 10 minutes.');
    }

    async evaluateMTM() {
        if (this.isChecking) return;
        this.isChecking = true;
        try {
            const now = Date.now();
            if (!this.cachedPositions || now - (this.lastCacheTime || 0) > 15000) {
                this.cachedPositions = await db('positions')
                    .whereNot({ quantity: 0 })
                    .whereNotIn('product_type', ['DEL']);
                this.lastCacheTime = now;
            }
            
            const openPositions = this.cachedPositions;
            if (openPositions.length === 0) {
                this.isChecking = false;
                return;
            }

            const userPositions = {};
            openPositions.forEach(pos => {
                if (!userPositions[pos.user_id]) userPositions[pos.user_id] = [];
                userPositions[pos.user_id].push(pos);
            });

            const userIdsInLoss = [];
            const userLossMap = {};

            // 1. Calculate P&L for everyone in memory (0 DB Queries)
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
                    userIdsInLoss.push(userId);
                    userLossMap[userId] = totalMtmLoss;
                }
            }

            // 2. Fetch ALL balances in ONE single trip to the DB! (The N+1 Fix)
            if (userIdsInLoss.length > 0) {
                const users = await db('users')
                    .whereIn('id', userIdsInLoss)
                    .select('id', 'balance');

                for (const user of users) {
                    const totalMtmLoss = userLossMap[user.id];
                    const availableBalance = Number(user.balance);

                    // 95% Threshold Check against Available Balance
                    if (totalMtmLoss >= (availableBalance * 0.95)) {
                        console.log(`[RMS ALERT] User ${user.id} hit 95% MTM Loss (${totalMtmLoss} >= ${availableBalance * 0.95}). Liquidating!`);
                        await this.liquidateUser(user.id, userPositions[user.id]);
                    }
                }
            }
        } catch (err) {
            console.error('MTM Risk Manager Error:', err);
        } finally {
            this.isChecking = false;
        }
    }

    async liquidateUser(userId, positions) {
        try {
            let cancelledOrders = [];

            await db.transaction(async (trx) => {
                // 1. Cancel all pending entry and trigger orders for the user and refund margin
                const pendingOrders = await trx('orders')
                    .where({ user_id: userId })
                    .whereIn('status', ['PENDING', 'PENDING_TRIGGER']);

                for (const ord of pendingOrders) {
                    const refund = parseFloat(ord.margin) || 0;
                    if (refund > 0) {
                        const user = await trx('users').where({ id: userId }).first();
                        await trx('users').where({ id: userId }).update({ balance: parseFloat(user.balance) + refund });
                        await trx('ledger').insert({
                            user_id: userId,
                            amount: refund,
                            type: 'MARGIN_RELEASE',
                            description: `RMS liquidation: margin refunded for cancelled order ${ord.quantity} ${ord.symbol}`
                        });
                    }
                    await trx('orders').where({ id: ord.id }).update({ status: 'CANCELLED', updated_at: new Date() });
                    cancelledOrders.push(ord);
                }

                // 2. Liquidate all positions
                for (const pos of positions) {
                    const ltp = this.priceCache[pos.symbol]?.ltp || Number(pos.average_price) || 0;
                    if (ltp <= 0) continue;

                    await LedgerService.closePosition(trx, userId, pos.id, ltp, true); // true = RMS Penalty
                    console.log(`[RMS EXECUTED] Closed ${pos.symbol} for user ${userId} at ${ltp}`);
                }
            });

            // Outside transaction: clean Redis triggers for all cancelled orders
            const triggerEngine = require('./triggerEngine');
            for (const ord of cancelledOrders) {
                triggerEngine.removeOrderFromMemory(ord.id, ord.symbol);
            }
        } catch (err) {
            console.error(`[RMS ALERT] Failed to liquidate user ${userId}:`, err);
        }
    }
}

module.exports = MTMRiskManager;
