const cron = require('node-cron');
const db = require('../database/db');
const LedgerService = require('./ledgerService');
const { parseExpiryDate, formatDate } = require('./autoSquareOff');

// Timezone configured to Asia/Kolkata
const TZ = { timezone: "Asia/Kolkata" };

// Global system block flags
const { getAssetSubsegment } = require('./instrumentsCache');

// Global segment-specific intraday block flags
let isFnoEquityIntradayBlocked = false;
let isNonFnoEquityIntradayBlocked = false;
let isDerivativesIntradayBlocked = false;
let isCommodityIntradayBlocked = false;
let isEquityIntradayBlocked = false;

// Helper: Check if a symbol is a commodity
const isCommoditySymbol = (symbol) => {
    if (!symbol || typeof symbol !== 'string') return false;
    if (symbol.includes('MCX') || symbol.includes('NCDEX')) return true;
    const clean = symbol.replace(/^(NSE:|BSE:|MCX:)/i, '');
    return ['CRUDEOIL', 'GOLD', 'SILVER', 'NATURALGAS', 'COPPER', 'ZINC', 'LEAD', 'ALUMINIUM', 'MENTHAOIL', 'COTTON', 'NICKEL'].some(c => clean.startsWith(c));
};

function isIntradayBlocked(symbol) {
    if (!symbol) return isFnoEquityIntradayBlocked || isNonFnoEquityIntradayBlocked || isDerivativesIntradayBlocked || isCommodityIntradayBlocked || isEquityIntradayBlocked;
    const sub = getAssetSubsegment(symbol);
    if (sub === 'COMMODITY') return isCommodityIntradayBlocked;
    if (sub === 'DERIVATIVE') return isDerivativesIntradayBlocked;
    if (sub === 'FNO_EQ') return isFnoEquityIntradayBlocked;
    return isNonFnoEquityIntradayBlocked;
}

async function executeAmoOrders(segment = 'ALL', priceCache = {}, triggerEngine = null) {
    const volumeMatchingEngine = require('./volumeMatchingEngine');
    console.log(`⏰ [CRON] Sweeping AMO orders for segment: ${segment}...`);
    try {
        const amoOrders = await db('orders')
            .where({ status: 'AMO_PENDING' })
            .whereNot({ order_variety: 'CAS' })
            .orderBy('created_at', 'asc');

        if (amoOrders.length === 0) return;

        let hasRestingTriggers = false;
        for (const ord of amoOrders) {
            const isCom = isCommoditySymbol(ord.symbol);
            if (segment === 'COMMODITY' && !isCom) continue;
            if (segment === 'EQUITY' && isCom) continue;

            const clean = ord.symbol ? ord.symbol.replace(/^(NSE:|BSE:|MCX:)/i, '').replace(/-(EQ|A|B|T|X|XT|Z|P|M|SM|BE|BZ)$/i, '') : '';
            const ltp = priceCache[ord.symbol]?.ltp || (clean ? (priceCache[clean]?.ltp || priceCache[`NSE:${clean}`]?.ltp || priceCache[`NSE:${clean}-EQ`]?.ltp || priceCache[`BSE:${clean}`]?.ltp || priceCache[`BSE:${clean}-A`]?.ltp || priceCache[`MCX:${clean}`]?.ltp) : null) || Number(ord.price || 0);

            if (ord.type === 'MARKET') {
                await db('orders').where({ id: ord.id }).update({ status: 'PENDING', updated_at: new Date() });
                ord.status = 'PENDING';
                await volumeMatchingEngine.submitOrder(ord, ltp);
            } else if (ord.type === 'LIMIT') {
                const limitPrice = Number(ord.price);
                const isMarketable = (ord.side === 'BUY' && ltp <= limitPrice) || (ord.side === 'SELL' && ltp >= limitPrice);
                if (isMarketable) {
                    await db('orders').where({ id: ord.id }).update({ status: 'PENDING', updated_at: new Date() });
                    ord.status = 'PENDING';
                    await volumeMatchingEngine.submitOrder(ord, ltp);
                } else {
                    await db('orders').where({ id: ord.id }).update({ status: 'PENDING', updated_at: new Date() });
                    ord.status = 'PENDING';
                    if (triggerEngine) {
                        await triggerEngine.addOrderToMemory(ord).catch(() => {});
                        hasRestingTriggers = true;
                    }
                }
            } else {
                await db('orders').where({ id: ord.id }).update({ status: 'PENDING_TRIGGER', updated_at: new Date() });
                ord.status = 'PENDING_TRIGGER';
                if (triggerEngine) {
                    await triggerEngine.addOrderToMemory(ord).catch(() => {});
                    hasRestingTriggers = true;
                }
            }
        }

        if (hasRestingTriggers) {
            try {
                const { pubClient } = require('./redisClient');
                if (pubClient) pubClient.publish('reload_triggers', '1').catch(() => {});
            } catch(e) {}
        }
    } catch (err) {
        console.error(`[CRON] executeAmoOrders (${segment}) error:`, err.message);
    }
}

async function executeCasOpeningMatch(priceCache = {}, triggerEngine = null) {
    const volumeMatchingEngine = require('./volumeMatchingEngine');
    console.log(`⏰ [CRON 09:08 AM] Matching Pre-Market CAS orders at opening equilibrium price...`);
    try {
        const casOrders = await db('orders')
            .where({ status: 'AMO_PENDING', order_variety: 'CAS' })
            .orderBy('created_at', 'asc');

        if (casOrders.length === 0) return;

        let hasRestingTriggers = false;
        for (const ord of casOrders) {
            const ltp = priceCache[ord.symbol]?.open || priceCache[ord.symbol]?.ltp || Number(ord.price || 0);

            if (ord.type === 'LIMIT' && ord.price) {
                const limitPrice = Number(ord.price);
                const isCrossed = (ord.side === 'BUY' && ltp <= limitPrice) || (ord.side === 'SELL' && ltp >= limitPrice);
                if (!isCrossed) {
                    // Equilibrium open price is outside user limit. Transition to continuous trading session as PENDING
                    await db('orders').where({ id: ord.id }).update({ status: 'PENDING', order_variety: 'REGULAR', updated_at: new Date() });
                    ord.status = 'PENDING';
                    if (triggerEngine) {
                        await triggerEngine.addOrderToMemory(ord).catch(() => {});
                        hasRestingTriggers = true;
                    }
                    continue;
                }
            }

            await db('orders').where({ id: ord.id }).update({ status: 'PENDING', order_variety: 'REGULAR', updated_at: new Date() });
            ord.status = 'PENDING';
            ord.order_variety = 'REGULAR';
            await volumeMatchingEngine.submitOrder(ord, ltp);
        }

        if (hasRestingTriggers) {
            try {
                const { pubClient } = require('./redisClient');
                if (pubClient) pubClient.publish('reload_triggers', '1').catch(() => {});
            } catch(e) {}
        }
    } catch (err) {
        console.error(`[CRON] executeCasOpeningMatch error:`, err.message);
    }
}

async function executeClosingAuctionMatch(priceCache = {}, triggerEngine = null) {
    const volumeMatchingEngine = require('./volumeMatchingEngine');
    console.log(`⏰ [CRON 03:35 PM] Matching Closing Auction Session (CAS) orders for F&O Cash stocks...`);
    try {
        const casOrders = await db('orders')
            .where({ status: 'AMO_PENDING', order_variety: 'CAS' })
            .orderBy('created_at', 'asc');

        if (casOrders.length === 0) return;

        for (const ord of casOrders) {
            const clean = ord.symbol ? ord.symbol.replace(/^(NSE:|BSE:|MCX:)/i, '').replace(/-(EQ|A|B|T|X|XT|Z|P|M|SM|BE|BZ)$/i, '') : '';
            const closePrice = priceCache[ord.symbol]?.close || (clean ? (priceCache[clean]?.close || priceCache[`NSE:${clean}`]?.close) : null) || priceCache[ord.symbol]?.ltp || Number(ord.price || 0);

            if (ord.type === 'LIMIT' && ord.price) {
                const limitPrice = Number(ord.price);
                const isCrossed = (ord.side === 'BUY' && closePrice <= limitPrice) || (ord.side === 'SELL' && closePrice >= limitPrice);
                if (!isCrossed) {
                    await db('orders').where({ id: ord.id }).update({ status: 'CANCELLED', updated_at: new Date() });
                    if (parseFloat(ord.margin) > 0) {
                        await LedgerService.releaseMargin(db, ord.user_id, ord.margin, `CAS Unmatched Cancelled: ${ord.symbol}`);
                    }
                    continue;
                }
            }

            await db('orders').where({ id: ord.id }).update({ status: 'PENDING', order_variety: 'REGULAR', updated_at: new Date() });
            ord.status = 'PENDING';
            ord.order_variety = 'REGULAR';
            await volumeMatchingEngine.submitOrder(ord, closePrice);
        }
    } catch (err) {
        console.error(`[CRON] executeClosingAuctionMatch error:`, err.message);
    }
}

async function updateWeeklyCasStocksList(priceCache = {}) {
    console.log(`🔄 [CRON SUNDAY] Running Weekly CAS & Illiquid Securities Liquidity Review...`);
    try {
        const allInstruments = await db('instruments').select('unique_symbol', 'symbol').catch(() => []);
        let taggedCount = 0;
        for (const inst of allInstruments) {
            const sym = inst.unique_symbol || inst.symbol;
            if (!sym || isCommoditySymbol(sym) || sym.includes('-MF')) continue;

            const cached = priceCache[sym];
            const currentVol = cached ? Number(cached.volume || cached.vol_traded_today || 0) : 0;
            const isIlliquid = currentVol > 0 && currentVol < 1000;

            await db('instruments')
                .where({ unique_symbol: sym })
                .orWhere({ symbol: sym })
                .update({ is_cas_illiquid: isIlliquid, average_volume_5d: currentVol })
                .catch(() => {});

            if (isIlliquid) taggedCount++;
        }
        console.log(`✅ [CRON SUNDAY] Weekly CAS Liquidity Review complete: ${taggedCount} scrips classified as illiquid / periodic call auction.`);
    } catch (err) {
        console.error('[CRON SUNDAY] updateWeeklyCasStocksList error:', err.message);
    }
}

function initCronJobs(priceCache, triggerEngine) {
    console.log('Initializing Cron Jobs...');

    // ─── 09:00 AM IST: MCX Commodity AMO Sweep ──────────────────────────────────
    cron.schedule('0 9 * * 1-5', () => {
        executeAmoOrders('COMMODITY', priceCache, triggerEngine);
    }, TZ);

    // ─── 09:08 AM IST: Pre-Market CAS Opening Price Match ───────────────────────
    cron.schedule('8 9 * * 1-5', () => {
        executeCasOpeningMatch(priceCache, triggerEngine);
    }, TZ);

    // ─── 09:15 AM IST: Equity & F&O Market Open AMO Sweep ───────────────────────
    cron.schedule('15 9 * * 1-5', () => {
        executeAmoOrders('EQUITY', priceCache, triggerEngine);
    }, TZ);

    // ─── SUNDAY 00:00 AM IST: Weekly CAS & Illiquid Stock Review ────────────────
    cron.schedule('0 0 * * 0', () => {
        updateWeeklyCasStocksList(priceCache);
    }, TZ);

    // ─── PHASE 1: Segment-Wise Intraday Entry Blocks ────────────────────────
    // 1A. Equity Cash (F&O Eligible Stocks): 03:05 PM IST
    cron.schedule('5 15 * * 1-5', () => {
        console.log('[CRON 03:05 PM] Phase 1A: Blocking new Intraday placements for F&O Cash Stocks.');
        isFnoEquityIntradayBlocked = true;
    }, TZ);

    // 1B. Equity Cash (Non-F&O Stocks): 03:15 PM IST
    cron.schedule('15 15 * * 1-5', () => {
        console.log('[CRON 03:15 PM] Phase 1B: Blocking new Intraday placements for Non-F&O Cash Stocks.');
        isNonFnoEquityIntradayBlocked = true;
        isEquityIntradayBlocked = true;
    }, TZ);

    // 1C. Futures & Options (Derivatives): 03:25 PM IST
    cron.schedule('25 15 * * 1-5', () => {
        console.log('[CRON 03:25 PM] Phase 1C: Blocking new Intraday placements for Futures & Options.');
        isDerivativesIntradayBlocked = true;
    }, TZ);

    /**
     * Determines whether MCX is operating on Winter Session timings (ends 23:55 IST)
     * vs Summer Session timings (ends 23:30 IST) dynamically based on US DST.
     * US DST (Summer) runs from the 2nd Sunday of March to the 1st Sunday of November.
     * Winter session (Standard Time) is active from 1st Sunday of November to 2nd Sunday of March.
     */
    const isMCXWinterSession = (d = new Date()) => {
        const year = d.getFullYear();
        // Second Sunday of March
        const marchFirst = new Date(Date.UTC(year, 2, 1));
        const marchFirstDay = marchFirst.getUTCDay();
        const firstSunMarch = marchFirstDay === 0 ? 1 : (7 - marchFirstDay + 1);
        const secondSunMarch = firstSunMarch + 7;
        const dstStart = new Date(Date.UTC(year, 2, secondSunMarch, 7, 0, 0));

        // First Sunday of November
        const novFirst = new Date(Date.UTC(year, 10, 1));
        const novFirstDay = novFirst.getUTCDay();
        const firstSunNov = novFirstDay === 0 ? 1 : (7 - novFirstDay + 1);
        const dstEnd = new Date(Date.UTC(year, 10, firstSunNov, 6, 0, 0));

        const isDstSummer = d >= dstStart && d < dstEnd;
        return !isDstSummer;
    };

    cron.schedule('50 22 * * *', () => {
        if (!isMCXWinterSession()) {
            console.log('[CRON] Phase 1 (Commodities Summer): Blocking new Intraday placements.');
            isCommodityIntradayBlocked = true;
        }
    }, TZ);

    cron.schedule('30 23 * * *', () => {
        if (isMCXWinterSession()) {
            console.log('[CRON] Phase 1 (Commodities Winter): Blocking new Intraday placements.');
            isCommodityIntradayBlocked = true;
        }
    }, TZ);

    // Reset all blocks next day at midnight
    cron.schedule('0 0 * * *', () => {
        isFnoEquityIntradayBlocked = false;
        isNonFnoEquityIntradayBlocked = false;
        isDerivativesIntradayBlocked = false;
        isCommodityIntradayBlocked = false;
        isEquityIntradayBlocked = false;
    }, TZ);

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
        let connection = null;
        let isLocked = false;
        const lockKey = `cron_phase2_${assetType}`;
        try {
            if (db.client && db.client.acquireConnection) {
                connection = await db.client.acquireConnection();
                const lockRes = await connection.query('SELECT pg_try_advisory_lock(hashtext($1)) as locked', [lockKey]).catch(() => null);
                isLocked = Boolean(lockRes && lockRes.rows && lockRes.rows[0] && lockRes.rows[0].locked);
                if (!isLocked) {
                    console.log(`[CRON] Phase 2 (${assetType}) already running on another cluster worker. Skipping.`);
                    return;
                }
            }

            console.log(`[CRON] Phase 2 (${assetType}): Sweeping pending Intraday/CO/BO entry orders...`);
            const affectedUserIds = new Set();
            const ordersToCleanFromRedis = [];
            await db.transaction(async (trx) => {
                const pendingOrders = await trx('orders').whereIn('status', ['PENDING']);
                
                for (const order of pendingOrders) {
                    const isCom = isCommoditySymbol(order.symbol);
                    const sub = getAssetSubsegment(order.symbol);
                    if (assetType === 'FNO_EQ' && sub !== 'FNO_EQ') continue;
                    if (assetType === 'NON_FNO_EQ' && sub !== 'NON_FNO_EQ') continue;
                    if (assetType === 'DERIVATIVE' && sub !== 'DERIVATIVE') continue;
                    if (assetType === 'COM' && !isCom) continue;
                    if (assetType === 'EQ' && isCom) continue;
                    
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
                        affectedUserIds.add(order.user_id);
                        if (parseFloat(order.margin) > 0) {
                            await LedgerService.releaseMargin(trx, order.user_id, order.margin, `End of Day Sweep Cancelled: ${order.symbol}`);
                        }
                        ordersToCleanFromRedis.push({ id: order.id, symbol: order.symbol });
                        console.log(`[CRON] Phase 2: Cancelled pending ${order.product_type || 'DEL'} order ${order.id} for ${order.symbol}`);
                    }
                }

                // Also cancel PENDING_TRIGGER legs (BO/CO SL & Target orders) so they don't linger overnight
                const pendingTriggers = await trx('orders').whereIn('status', ['PENDING_TRIGGER']);
                for (const trigger of pendingTriggers) {
                    const isCom = isCommoditySymbol(trigger.symbol);
                    const sub = getAssetSubsegment(trigger.symbol);
                    if (assetType === 'FNO_EQ' && sub !== 'FNO_EQ') continue;
                    if (assetType === 'NON_FNO_EQ' && sub !== 'NON_FNO_EQ') continue;
                    if (assetType === 'DERIVATIVE' && sub !== 'DERIVATIVE') continue;
                    if (assetType === 'COM' && !isCom) continue;
                    if (assetType === 'EQ' && isCom) continue;

                    // If trigger order is DEL/CNC, do not cancel unless expiring today
                    if (trigger.product_type === 'DEL' || trigger.product_type === 'CNC' || trigger.product_type === 'DELIVERY') {
                        const isExpiring = isDerivativeSymbol(trigger.symbol) && isExpiringToday(trigger.symbol);
                        if (!isExpiring) continue;
                    }

                    const updated = await trx('orders')
                        .where({ id: trigger.id, status: 'PENDING_TRIGGER' })
                        .update({ status: 'CANCELLED', updated_at: new Date() });

                    if (updated > 0) {
                        affectedUserIds.add(trigger.user_id);
                        if (parseFloat(trigger.margin) > 0) {
                            await LedgerService.releaseMargin(trx, trigger.user_id, trigger.margin, `End of Day Sweep Cancelled: ${trigger.symbol}`);
                        }
                        ordersToCleanFromRedis.push({ id: trigger.id, symbol: trigger.symbol });
                        console.log(`[CRON] Phase 2: Cancelled pending trigger order ${trigger.id} for ${trigger.symbol}`);
                    }
                }
            });

            // Clean up memory and Redis caches outside transaction
            if (triggerEngine && ordersToCleanFromRedis.length > 0) {
                await Promise.allSettled(ordersToCleanFromRedis.map(o => triggerEngine.removeOrderFromMemory(o.id, o.symbol)));
            }

            // ⚡ Real-Time Socket Sync: Instantly refresh orders and balances on affected client screens
            if (triggerEngine && triggerEngine.io && affectedUserIds.size > 0) {
                for (const uid of affectedUserIds) {
                    triggerEngine.io.to(uid.toString()).emit('sync_user_data');
                }
            }
        } catch (err) {
            console.error('Phase 2 Sweep Error:', err);
        } finally {
            if (connection) {
                try {
                    if (isLocked) {
                        await connection.query('SELECT pg_advisory_unlock(hashtext($1))', [lockKey]).catch(() => {});
                    }
                } finally {
                    await db.client.releaseConnection(connection).catch(() => {});
                }
            }
        }
    };

    // Phase 2A: 03:09 PM - Sweep F&O Cash Stocks pending intraday
    cron.schedule('9 15 * * 1-5', () => phase2Sweep('FNO_EQ'), TZ);

    // Phase 2B: 03:19 PM - Sweep Non-F&O Cash Stocks pending intraday
    cron.schedule('19 15 * * 1-5', () => phase2Sweep('NON_FNO_EQ'), TZ);

    // Phase 2C: 03:29 PM - Sweep Derivatives pending intraday
    cron.schedule('29 15 * * 1-5', () => phase2Sweep('DERIVATIVE'), TZ);

    cron.schedule('59 22 * * *', () => {
        if (!isMCXWinterSession()) phase2Sweep('COM');
    }, TZ);
    cron.schedule('39 23 * * *', () => {
        if (isMCXWinterSession()) phase2Sweep('COM');
    }, TZ);

    // ─── PHASE 3: Auto Square-Off ─────────────────────────────────────────────
    const phase3SquareOff = async (assetType) => {
        let connection = null;
        let isLocked = false;
        const lockKey = `cron_phase3_${assetType}`;
        try {
            if (db.client && db.client.acquireConnection) {
                connection = await db.client.acquireConnection();
                const lockRes = await connection.query('SELECT pg_try_advisory_lock(hashtext($1)) as locked', [lockKey]).catch(() => null);
                isLocked = Boolean(lockRes && lockRes.rows && lockRes.rows[0] && lockRes.rows[0].locked);
                if (!isLocked) {
                    console.log(`[CRON] Phase 3 (${assetType}) already running on another cluster worker. Skipping.`);
                    return;
                }
            }

            console.log(`[CRON] Phase 3 (${assetType}): Forcing Auto Square-Off for all open Intraday/BO/CO positions...`);
            const affectedUserIds = new Set();
            const ordersToCleanFromRedis = [];
            try {
                await db.transaction(async (trx) => {
                    // Get ALL intraday-type positions (INT, BO, CO) that are still open
                    const positions = await trx('positions')
                        .whereIn('product_type', ['INT', 'BO', 'CO'])
                        .whereNot({ quantity: 0 });

                    for (const pos of positions) {
                        const isCom = isCommoditySymbol(pos.symbol);
                        const sub = getAssetSubsegment(pos.symbol);
                        if (assetType === 'FNO_EQ' && sub !== 'FNO_EQ') continue;
                        if (assetType === 'NON_FNO_EQ' && sub !== 'NON_FNO_EQ') continue;
                        if (assetType === 'DERIVATIVE' && sub !== 'DERIVATIVE') continue;
                        if (assetType === 'COM' && !isCom) continue;
                        if (assetType === 'EQ' && isCom) continue;
                        if (assetType === 'COM' && !isCom) continue;

                        let ltp = priceCache[pos.symbol]?.ltp;
                        if (!ltp || ltp <= 0) {
                            try {
                                const { fetchBatchLTPs } = require('./fyers');
                                if (fetchBatchLTPs) {
                                    const quotes = await fetchBatchLTPs([pos.symbol]);
                                    if (quotes && quotes[pos.symbol]?.ltp > 0) {
                                        ltp = quotes[pos.symbol].ltp;
                                        priceCache[pos.symbol] = quotes[pos.symbol];
                                    }
                                }
                            } catch(e) {}
                        }
                        if (!ltp || ltp <= 0) {
                            // 1. Check cached close or previous settlement price
                            const cleanSym = pos.symbol.includes(':') ? pos.symbol.split(':')[1] : pos.symbol;
                            const cached = priceCache[pos.symbol] || priceCache[cleanSym] || priceCache[`NSE:${cleanSym}`] || priceCache[`MCX:${cleanSym}`];
                            if (cached?.close > 0) {
                                ltp = Number(cached.close);
                            } else if (cached?.prev_close_price > 0) {
                                ltp = Number(cached.prev_close_price);
                            }
                        }
                        if (!ltp || ltp <= 0) {
                            // 2. Check latest executed market trade for this symbol
                            const lastOrder = await trx('orders')
                                .where({ symbol: pos.symbol, status: 'EXECUTED' })
                                .orderBy('created_at', 'desc')
                                .first();
                            if (lastOrder && Number(lastOrder.price) > 0) {
                                ltp = Number(lastOrder.price);
                            }
                        }
                        if (!ltp || ltp <= 0) {
                            // 3. Safe fallback so intraday positions are not abandoned overnight
                            ltp = Number(pos.average_price) || 0;
                        }

                        if (ltp <= 0) {
                            console.warn(`[CRON] Phase 3: No valid exit price for ${pos.symbol}, skipping.`);
                            continue;
                        }

                        // Close position with RMS penalty
                        await LedgerService.closePosition(trx, pos.user_id, pos.id, ltp, true);
                        affectedUserIds.add(pos.user_id);
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
                                ordersToCleanFromRedis.push({ id: t.id, symbol: t.symbol });
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
                                ordersToCleanFromRedis.push({ id: o.id, symbol: o.symbol });
                            }
                        }
                    }
                });

                // Clean up memory and Redis caches outside transaction
                if (triggerEngine && ordersToCleanFromRedis.length > 0) {
                    await Promise.allSettled(ordersToCleanFromRedis.map(o => triggerEngine.removeOrderFromMemory(o.id, o.symbol)));
                }

                // ⚡ Real-Time Socket Sync: Instantly refresh positions, orders, and balance on affected user screens
                if (triggerEngine && triggerEngine.io && affectedUserIds.size > 0) {
                    for (const uid of affectedUserIds) {
                        triggerEngine.io.to(uid.toString()).emit('sync_user_data');
                        triggerEngine.io.to(uid.toString()).emit('trade_alert', {
                            event: 'EXECUTED',
                            symbol: 'PORTFOLIO',
                            message: 'Intraday EOD auto square-off executed'
                        });
                    }
                }
            } catch (err) {
                console.error('Phase 3 Square-Off Error:', err);
            }
        } catch (err) {
            console.error('Phase 3 Lock Error:', err);
        } finally {
            if (connection) {
                try {
                    if (isLocked) {
                        await connection.query('SELECT pg_advisory_unlock(hashtext($1))', [lockKey]).catch(() => {});
                    }
                } finally {
                    await db.client.releaseConnection(connection).catch(() => {});
                }
            }
        }
    };

    // Phase 3A: 03:10 PM - Auto Square-Off F&O Cash Stocks open intraday positions
    cron.schedule('10 15 * * 1-5', () => phase3SquareOff('FNO_EQ'), TZ);

    // Phase 3B: 03:20 PM - Auto Square-Off Non-F&O Cash Stocks open intraday positions
    cron.schedule('20 15 * * 1-5', () => phase3SquareOff('NON_FNO_EQ'), TZ);

    // Phase 3C: 03:30 PM - Auto Square-Off Derivatives open intraday positions
    cron.schedule('30 15 * * 1-5', () => phase3SquareOff('DERIVATIVE'), TZ);

    // 03:35 PM: Closing Auction Session (CAS) matching for F&O Cash stocks
    cron.schedule('35 15 * * 1-5', () => {
        executeClosingAuctionMatch(priceCache, triggerEngine);
    }, TZ);

    cron.schedule('0 23 * * *', () => {
        if (!isMCXWinterSession()) phase3SquareOff('COM');
    }, TZ);
    cron.schedule('40 23 * * *', () => {
        if (isMCXWinterSession()) phase3SquareOff('COM');
    }, TZ);

    // Note: Daily/Weekly/Monthly SIP and Next-Day Mutual Fund settlement are authoritatively handled by sipEngine.js at 09:00 AM, 09:30 AM, 03:30 PM, and 10:30 PM

    // --- 1:00 AM Expired Watchlist Cleanup ---
    cron.schedule('0 1 * * *', async () => {
        const lockKey = 'cron_watchlist_cleanup';
        let connection = null;
        let isLocked = false;
        try {
            if (db.client && db.client.acquireConnection) {
                connection = await db.client.acquireConnection();
                const lockRes = await connection.query('SELECT pg_try_advisory_lock(hashtext($1)) as locked', [lockKey]).catch(() => null);
                isLocked = Boolean(lockRes && lockRes.rows && lockRes.rows[0] && lockRes.rows[0].locked);
                if (!isLocked) {
                    console.log('[CRON] 1:00 AM Watchlist cleanup already running on another cluster worker. Skipping.');
                    return;
                }
            }

            console.log('[CRON] 1:00 AM: Cleaning expired symbols from all user watchlists...');
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

            // Purge stale user sessions older than 30 days to prevent table bloat and protect DB indexes
            try {
                const thirtyDaysAgo = new Date(Date.now() - (30 * 24 * 60 * 60 * 1000));
                const purgedSessions = await db('user_sessions').where('created_at', '<', thirtyDaysAgo).del();
                if (purgedSessions > 0) {
                    console.log(`[CRON] Purged ${purgedSessions} stale user session(s) older than 30 days.`);
                }
            } catch (sessErr) {}
        } catch (err) {
            console.error('[CRON] Watchlist cleanup error:', err);
        } finally {
            if (connection) {
                try {
                    if (isLocked) {
                        await connection.query('SELECT pg_advisory_unlock(hashtext($1))', [lockKey]).catch(() => {});
                    }
                } finally {
                    await db.client.releaseConnection(connection).catch(() => {});
                }
            }
        }
    }, TZ);
}

module.exports = {
    initCronJobs,
    isIntradayBlocked,
    isEquityIntradayBlocked: () => isEquityIntradayBlocked,
    isCommodityIntradayBlocked: () => isCommodityIntradayBlocked,
    executeAmoOrders,
    executeCasOpeningMatch,
    updateWeeklyCasStocksList
};
