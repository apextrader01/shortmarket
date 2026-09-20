const db = require('../database/db');
const LedgerService = require('./ledgerService');
const { sendPushNotification } = require('./pushService');

function isAnyMarketOpen() {
    const now = new Date();
    const istTime = new Date(now.getTime() + (5.5 * 60 * 60 * 1000));
    const day = istTime.getUTCDay(); // 0 = Sun, 6 = Sat
    if (day === 0 || day === 6) return false;
    const hours = istTime.getUTCHours();
    const minutes = istTime.getUTCMinutes();
    const currentMins = hours * 60 + minutes;
    // Active trading window covering Equities & MCX (09:00 AM to 23:45 PM IST)
    return currentMins >= 540 && currentMins <= 1425;
}

const istDateFormatter = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata', year: 'numeric', month: '2-digit', day: '2-digit' });

class MTMRiskManager {
    constructor(priceCache, marketChecker = null) {
        this.priceCache = priceCache;
        this.marketChecker = marketChecker;
        this.isRunning = false;
        this.isChecking = false;
        this.lastLiquidationTime = {}; // debounce auto-exit per user to prevent duplicate runs
        console.log('MTM & Risk Guardian Auto-Exit Manager Initialized.');
    }

    start() {
        if (this.isRunning) return;
        this.isRunning = true;
        this.scheduleNextEvaluation();
        console.log('🛡️  MTM & Risk Guardian Auto-Exit Manager active (evaluating every 1 minute / 60s).');
    }

    scheduleNextEvaluation() {
        if (!this.isRunning) return;
        const isMarketActive = this.marketChecker ? this.marketChecker() : isAnyMarketOpen();
        const nextDelay = isMarketActive ? 60000 : 600000; // 1 min during market hours, 10 min sleep off-hours
        this.evalTimer = setTimeout(async () => {
            try {
                if (isMarketActive) {
                    await this.evaluateMTM();
                }
            } catch (err) {
                console.error('MTM Evaluation error:', err);
            } finally {
                this.scheduleNextEvaluation();
            }
        }, nextDelay);
    }

    invalidateCache() {
        this.cachedPositions = null;
        this.lastCacheTime = 0;
    }

    async evaluateMTM() {
        if (this.isChecking) return;
        // Check if market is active (respects Admin manual override OPEN/CLOSED and exchange hours)
        const isMarketActive = this.marketChecker ? this.marketChecker() : isAnyMarketOpen();
        if (!isMarketActive) return;
        this.isChecking = true;
        try {
            const now = Date.now();
            // Prune stale debounce entries older than 5 minutes to prevent RAM growth
            for (const uid in this.lastLiquidationTime) {
                if (now - this.lastLiquidationTime[uid] > 300000) {
                    delete this.lastLiquidationTime[uid];
                }
            }

            // Cache positions for 5 seconds to reduce DB pressure while staying responsive to order closes
            if (!this.cachedPositions || now - (this.lastCacheTime || 0) > 5000) {
                this.cachedPositions = await db('positions')
                    .whereNot({ quantity: 0 });
                this.lastCacheTime = now;
            }
            
            const openPositions = (this.cachedPositions || []).filter(pos => Number(pos.quantity) !== 0);
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

            const istDateStr = istDateFormatter.format(new Date()); // "YYYY-MM-DD"
            const todayStart = new Date(`${istDateStr}T00:00:00+05:30`);

            // Fetch today's executed orders ONLY for users with active Risk Guardian (aggregated in SQL)
            const rgUsers = users.filter(u => u.risk_guardian_active && Number(u.max_daily_loss) > 0);
            const userRealizedPnl = {};
            if (rgUsers.length > 0) {
                const rgUserIds = rgUsers.map(u => u.id);
                const todayOrders = await db('orders')
                    .whereIn('user_id', rgUserIds)
                    .where('created_at', '>=', todayStart)
                    .whereIn('status', ['COMPLETED', 'COMPLETE', 'EXECUTED'])
                    .groupBy('user_id')
                    .select('user_id', db.raw('COALESCE(SUM(realized_pnl), 0) as total_pnl'));

                todayOrders.forEach(ord => {
                    userRealizedPnl[ord.user_id] = parseFloat(ord.total_pnl) || 0;
                });
            }

            for (const user of users) {
                const uid = user.id;
                const positions = userPositions[uid] || [];
                if (positions.length === 0) continue;

                // Debounce to prevent multiple liquidation triggers in rapid succession
                if (this.lastLiquidationTime[uid] && (now - this.lastLiquidationTime[uid] < 8000)) {
                    continue;
                }

                let totalUnrealizedPnl = 0;
                let netIntradayMtm = 0;
                let totalMarginBlocked = 0;

                for (const pos of positions) {
                    const ltp = this.priceCache[pos.symbol]?.ltp || Math.abs(parseFloat(pos.average_price)) || 0;
                    totalMarginBlocked += (parseFloat(pos.margin) || 0);
                    if (ltp <= 0) continue;

                    const qty = parseFloat(pos.quantity) || 0;
                    const avg = Math.abs(parseFloat(pos.average_price) || 0);
                    let pnl = 0;
                    if (qty > 0) {
                        pnl = (ltp - avg) * qty;
                    } else if (qty < 0) {
                        pnl = (avg - ltp) * Math.abs(qty);
                    }

                    totalUnrealizedPnl += pnl;

                    if (pos.product_type !== 'DEL') {
                        netIntradayMtm += pnl;
                    }
                }

                const todayRealized = userRealizedPnl[uid] || 0;
                const totalDailyPnl = todayRealized + totalUnrealizedPnl;
                const availableBalance = Number(user.balance) || 0;
                const totalCapital = availableBalance + totalMarginBlocked;

                // ── CHECK 1: 🛡️ Risk Guardian Max Daily Loss Auto-Exit ──
                if (user.risk_guardian_active && user.max_daily_loss && Number(user.max_daily_loss) > 0) {
                    const maxLossLimit = parseFloat(user.max_daily_loss);
                    if (totalDailyPnl < 0 && Math.abs(totalDailyPnl) >= maxLossLimit) {
                        const auditReason = `Risk Guardian: Daily loss limit ₹${maxLossLimit.toLocaleString('en-IN')} reached (Realized: ₹${todayRealized.toFixed(2)}, Open P&L: ₹${totalUnrealizedPnl.toFixed(2)}, Total Daily P&L: ₹${totalDailyPnl.toFixed(2)})`;
                        console.log(`[RISK GUARDIAN AUTO-EXIT] User ${uid} hit Max Daily Loss Limit. ${auditReason}. Auto-squaring off all open positions!`);
                        this.lastLiquidationTime[uid] = now;
                        await this.liquidateUser(uid, positions, auditReason, false);
                        continue;
                    }
                }

                // ── CHECK 2: ⚡ RMS 95% Account Capital Loss Liquidation (Intraday) ──
                const intradayPositions = positions.filter(p => !['DEL', 'CNC', 'DELIVERY'].includes(p.product_type));
                if (intradayPositions.length > 0 && totalCapital > 0) {
                    if (netIntradayMtm < 0 && Math.abs(netIntradayMtm) >= (totalCapital * 0.95)) {
                        const auditReason = `RMS 95% Margin Call Liquidation (Net Intraday Loss: ₹${Math.abs(netIntradayMtm).toFixed(2)} reached 95% of ₹${totalCapital.toFixed(2)} capital)`;
                        console.log(`[RMS ALERT] User ${uid} hit 95% MTM Loss. ${auditReason}. Liquidating intraday positions!`);
                        this.lastLiquidationTime[uid] = now;
                        await this.liquidateUser(uid, intradayPositions, auditReason, true);
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
                // Acquire exclusive advisory lock for user to prevent race conditions with concurrent orders/ticks
                await trx.raw('SELECT pg_advisory_xact_lock(?)', [userId]);

                // 1. Cancel all pending entry, trigger, AMO, and partially-filled orders for the user and refund margin
                const pendingOrders = await trx('orders')
                    .where({ user_id: userId })
                    .whereIn('status', ['PENDING', 'PENDING_TRIGGER', 'AMO_PENDING', 'PARTIAL_FILLED']);

                for (const ord of pendingOrders) {
                    const totalMargin = parseFloat(ord.margin) || 0;
                    const totalQty = parseFloat(ord.quantity) || 1;
                    const pendingQty = (ord.pending_quantity !== null && ord.pending_quantity !== undefined)
                        ? parseFloat(ord.pending_quantity)
                        : (ord.status === 'PARTIAL_FILLED' ? Math.max(0, totalQty - parseFloat(ord.filled_quantity || 0)) : totalQty);
                    const refund = totalQty > 0
                        ? Math.round(((pendingQty / totalQty) * totalMargin + Number.EPSILON) * 100) / 100
                        : totalMargin;

                    if (refund > 0) {
                        await LedgerService.releaseMargin(trx, userId, refund, `${reason}: margin refunded for cancelled order ${ord.quantity} ${ord.symbol}`);
                    }
                    await trx('orders').where({ id: ord.id }).update({ status: 'CANCELLED', pending_quantity: 0, updated_at: new Date() });
                    cancelledOrders.push(ord);
                }

                // 2. Liquidate / Auto-exit all positions with full audit detail
                const auditTag = isRMSPenalty ? `Auto-Square-Off (RMS: ${reason})` : `Risk Guardian Auto-Exit (${reason})`;
                for (const pos of positions) {
                    const freshPos = await trx('positions').where({ id: pos.id }).first();
                    if (!freshPos || Number(freshPos.quantity) === 0) continue;

                    let ltp = this.priceCache[freshPos.symbol]?.ltp;
                    if (ltp === undefined || ltp === null || isNaN(Number(ltp)) || Number(ltp) <= 0) {
                        ltp = Number(this.priceCache[freshPos.symbol]?.close) || 0;
                    }
                    if (!ltp || ltp <= 0) {
                        const lastOrder = await trx('orders')
                            .where({ symbol: freshPos.symbol })
                            .whereIn('status', ['COMPLETED', 'COMPLETE', 'EXECUTED'])
                            .orderBy('id', 'desc')
                            .first();
                        ltp = Number(lastOrder?.price || lastOrder?.average_price) || 0;
                    }
                    if (ltp <= 0) {
                        console.warn(`[MTM Risk] Skipping liquidation for ${freshPos.symbol} - no market price available; not falling back to average_price.`);
                        continue;
                    }

                    await LedgerService.closePosition(trx, userId, freshPos.id, ltp, isRMSPenalty, auditTag);
                    console.log(`[AUTO-EXIT EXECUTED] Closed ${freshPos.symbol} for user ${userId} at ₹${ltp} (${reason})`);
                }
            });

            // Outside transaction: clean Redis triggers and volume matching queue for all cancelled orders
            const triggerEngine = require('./triggerEngine');
            let volumeMatchingEngine = null;
            try { volumeMatchingEngine = require('./volumeMatchingEngine'); } catch(e) {}

            for (const ord of cancelledOrders) {
                triggerEngine.removeOrderFromMemory(ord.id, ord.symbol);
                if (volumeMatchingEngine && typeof volumeMatchingEngine.dequeueOrder === 'function') {
                    volumeMatchingEngine.dequeueOrder(ord.id, ord.symbol);
                }
            }
            try {
                const { pubClient } = require('./redisClient');
                if (pubClient) pubClient.publish('reload_triggers', '1').catch(() => {});
            } catch(e) {}

            // Invalidate cached positions
            this.cachedPositions = null;

            // ⚡ Real-Time Socket Sync: Instantly clear closed positions and update balance on the user's screen (<10ms)
            if (triggerEngine && triggerEngine.io) {
                triggerEngine.io.to(userId.toString()).emit('sync_user_data');
                triggerEngine.io.to(userId.toString()).emit('trade_alert', {
                    event: 'SL_HIT',
                    symbol: 'PORTFOLIO',
                    message: reason
                });
            }

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
