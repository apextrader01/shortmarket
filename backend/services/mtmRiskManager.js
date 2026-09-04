const db = require('../database/db');
const LedgerService = require('./ledgerService');
const { sendPushNotification } = require('./pushService');

class MTMRiskManager {
    constructor(priceCache) {
        this.priceCache = priceCache;
        this.isRunning = false;
        this.isChecking = false;
        this.lastLiquidationTime = {}; // debounce auto-exit per user to prevent duplicate runs
        console.log('MTM & Risk Guardian Auto-Exit Manager Initialized.');
    }

    start() {
        if (this.isRunning) return;
        this.isRunning = true;
        // Run the MTM & Risk Guardian evaluation every 2.5 seconds
        setInterval(() => this.evaluateMTM(), 2500);
        console.log('🛡️  MTM & Risk Guardian Auto-Exit Manager active (evaluating every 2.5s).');
    }

    async evaluateMTM() {
        if (this.isChecking) return;
        this.isChecking = true;
        try {
            const now = Date.now();
            // Cache positions for 2 seconds to reduce DB pressure while keeping checks fast
            if (!this.cachedPositions || now - (this.lastCacheTime || 0) > 2000) {
                this.cachedPositions = await db('positions')
                    .whereNot({ quantity: 0 });
                this.lastCacheTime = now;
            }
            
            const openPositions = this.cachedPositions;
            if (!openPositions || openPositions.length === 0) {
                this.isChecking = false;
                return;
            }

            const userPositions = {};
            openPositions.forEach(pos => {
                const uid = pos.user_id;
                if (!userPositions[uid]) userPositions[uid] = [];
                userPositions[uid].push(pos);
            });

            const userIdsWithPositions = Object.keys(userPositions).map(Number);
            if (userIdsWithPositions.length === 0) {
                this.isChecking = false;
                return;
            }

            // Fetch user configurations in a single batched query
            const users = await db('users')
                .whereIn('id', userIdsWithPositions)
                .select('id', 'balance', 'risk_guardian_active', 'max_daily_loss');

            const todayStart = new Date();
            todayStart.setHours(0, 0, 0, 0);

            // Fetch today's executed orders to calculate today's realized P&L for Risk Guardian users
            const todayOrders = await db('orders')
                .whereIn('user_id', userIdsWithPositions)
                .where('created_at', '>=', todayStart)
                .whereIn('status', ['COMPLETED', 'COMPLETE', 'EXECUTED'])
                .select('user_id', 'realized_pnl');

            const userRealizedPnl = {};
            todayOrders.forEach(ord => {
                if (ord.realized_pnl !== null && ord.realized_pnl !== undefined) {
                    userRealizedPnl[ord.user_id] = (userRealizedPnl[ord.user_id] || 0) + parseFloat(ord.realized_pnl);
                }
            });

            for (const user of users) {
                const uid = user.id;
                const positions = userPositions[uid] || [];
                if (positions.length === 0) continue;

                // Debounce to prevent multiple liquidation triggers in rapid succession
                if (this.lastLiquidationTime[uid] && (now - this.lastLiquidationTime[uid] < 8000)) {
                    continue;
                }

                let totalUnrealizedPnl = 0;
                let intradayMtmLoss = 0;

                for (const pos of positions) {
                    const ltp = this.priceCache[pos.symbol]?.ltp || parseFloat(pos.average_price) || 0;
                    if (ltp <= 0) continue;

                    const qty = parseFloat(pos.quantity) || 0;
                    const avg = parseFloat(pos.average_price) || 0;
                    let pnl = 0;
                    if (qty > 0) {
                        pnl = (ltp - avg) * qty;
                    } else if (qty < 0) {
                        pnl = (avg - ltp) * Math.abs(qty);
                    }

                    totalUnrealizedPnl += pnl;

                    if (pos.product_type !== 'DEL' && pnl < 0) {
                        intradayMtmLoss += Math.abs(pnl);
                    }
                }

                const todayRealized = userRealizedPnl[uid] || 0;
                const totalDailyPnl = todayRealized + totalUnrealizedPnl;
                const availableBalance = Number(user.balance) || 0;

                // ── CHECK 1: 🛡️ Risk Guardian Max Daily Loss Auto-Exit ──
                if (user.risk_guardian_active && user.max_daily_loss && Number(user.max_daily_loss) > 0) {
                    const maxLossLimit = parseFloat(user.max_daily_loss);
                    if (totalDailyPnl < 0 && Math.abs(totalDailyPnl) >= maxLossLimit) {
                        console.log(`[RISK GUARDIAN AUTO-EXIT] User ${uid} hit Max Daily Loss Limit (Total Loss: ₹${Math.abs(totalDailyPnl).toFixed(2)} >= Limit: ₹${maxLossLimit}). Auto-squaring off all open positions!`);
                        this.lastLiquidationTime[uid] = now;
                        await this.liquidateUser(uid, positions, `Risk Guardian: Daily loss limit ₹${maxLossLimit.toLocaleString('en-IN')} reached`, false);
                        continue;
                    }
                }

                // ── CHECK 2: ⚡ RMS 95% Account Balance Loss Liquidation (Intraday) ──
                const intradayPositions = positions.filter(p => p.product_type !== 'DEL');
                if (intradayPositions.length > 0 && availableBalance > 0) {
                    if (intradayMtmLoss >= (availableBalance * 0.95)) {
                        console.log(`[RMS ALERT] User ${uid} hit 95% MTM Loss (${intradayMtmLoss} >= ${availableBalance * 0.95}). Liquidating intraday positions!`);
                        this.lastLiquidationTime[uid] = now;
                        await this.liquidateUser(uid, intradayPositions, 'RMS 95% Margin Call Liquidation', true);
                    }
                }
            }
        } catch (err) {
            console.error('MTM Risk Manager Error:', err);
        } finally {
            this.isChecking = false;
        }
    }

    async liquidateUser(userId, positions, reason = 'Auto-Square-Off', isRMSPenalty = false) {
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
                            description: `${reason}: margin refunded for cancelled order ${ord.quantity} ${ord.symbol}`
                        });
                    }
                    await trx('orders').where({ id: ord.id }).update({ status: 'CANCELLED', updated_at: new Date() });
                    cancelledOrders.push(ord);
                }

                // 2. Liquidate / Auto-exit all positions
                for (const pos of positions) {
                    const ltp = this.priceCache[pos.symbol]?.ltp || Number(pos.average_price) || 0;
                    if (ltp <= 0) continue;

                    await LedgerService.closePosition(trx, userId, pos.id, ltp, isRMSPenalty, isRMSPenalty ? 'Auto-Square-Off (RMS)' : 'Risk Guardian Auto-Exit');
                    console.log(`[AUTO-EXIT EXECUTED] Closed ${pos.symbol} for user ${userId} at ₹${ltp} (${reason})`);
                }
            });

            // Outside transaction: clean Redis triggers for all cancelled orders
            const triggerEngine = require('./triggerEngine');
            for (const ord of cancelledOrders) {
                triggerEngine.removeOrderFromMemory(ord.id, ord.symbol);
            }

            // Invalidate cached positions
            this.cachedPositions = null;

            // Send push notification / alert
            try {
                await sendPushNotification(userId, {
                    title: '🛡️ Risk Guardian: Auto-Exit Executed',
                    body: `${reason}. All open positions have been automatically squared off to protect your capital.`,
                    url: '/positions'
                });
            } catch (pushErr) {}

        } catch (err) {
            console.error(`[AUTO-EXIT ERROR] Failed to auto-square off positions for user ${userId}:`, err);
        }
    }
}

module.exports = MTMRiskManager;
