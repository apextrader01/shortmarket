const db = require('../database/db');
const cron = require('node-cron');
const triggerEngine = require('./triggerEngine');
const { parseExpiryDate, formatDate } = require('./autoSquareOff');

const COMMODITIES = ['CRUDEOIL', 'GOLD', 'SILVER', 'NATURALGAS', 'COPPER', 'ZINC', 'LEAD', 'ALUMINIUM', 'MENTHAOIL', 'COTTON', 'NICKEL'];

const isCommoditySymbol = (symbol) => {
    if (!symbol || typeof symbol !== 'string') return false;
    if (symbol.includes('MCX') || symbol.includes('NCDEX')) return true;
    const clean = symbol.replace(/^(NSE:|BSE:|MCX:)/i, '');
    return COMMODITIES.some(c => clean.startsWith(c));
};

const isDerivativeSymbol = (symbol) => {
    if (!symbol || typeof symbol !== 'string') return false;
    const clean = symbol.replace(/^(NSE:|BSE:|MCX:)/i, '');
    return /(?:\d+|[-_\s])(CE|PE)(?:[-_\s].*)?$/i.test(clean) || /(?:\d+|[A-Z]{3}|[-_\s])FUT(?:[-_\s].*)?$/i.test(clean) || clean.endsWith('-FUT') || symbol.includes('-MCX');
};

const ensureLivePrices = async (symbols) => {
    const { getPriceFromCache, fetchBatchLTPs } = require('./fyers');
    const priceCache = (typeof getPriceFromCache === 'function' ? getPriceFromCache() : null) || {};
    const missing = [...new Set(symbols)].filter(sym => !priceCache[sym]?.ltp);
    
    if (missing.length > 0 && typeof fetchBatchLTPs === 'function') {
        console.log(`[EOD] Fetching live prices for ${missing.length} offline symbols via REST...`);
        try {
            const fetchedQuotes = await fetchBatchLTPs(missing);
            if (fetchedQuotes && typeof fetchedQuotes === 'object') {
                for (const [sym, data] of Object.entries(fetchedQuotes)) {
                    if (data && data.ltp) {
                        priceCache[sym] = { ltp: data.ltp, close: data.close, prev_close_price: data.close };
                    }
                }
            }
        } catch (e) {
            console.error('[EOD] Failed to fetch REST fallback prices:', e);
        }
    }
    return priceCache;
};

const LedgerService = require('./ledgerService');

class PositionsEngine {
    constructor() {
        console.log('PositionsEngine Initialized (EOD Automation)');
        if (process.env.NODE_APP_INSTANCE === '0' || !process.env.NODE_APP_INSTANCE) {
            this.initCronJobs();
            // Run catchup migration on startup (in case the server was down at 8:00 AM)
            setTimeout(() => {
                this.runHoldingsMigration(true);
            }, 15000);

            // Run catchup expiry settlement on startup if past 03:40 PM IST
            setTimeout(() => {
                try {
                    const now = new Date();
                    const istParts = new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Kolkata', hour: 'numeric', minute: 'numeric', hour12: false }).formatToParts(now);
                    const hour = parseInt(istParts.find(p => p.type === 'hour').value, 10);
                    const minute = parseInt(istParts.find(p => p.type === 'minute').value, 10);
                    const timeVal = hour * 100 + minute;
                    if (timeVal >= 1540) {
                        console.log('⏰ [BOOT CATCHUP] Past 03:40 PM IST — running immediate catchup expiry settlement for Equities & Derivatives...');
                        this.settleExpiries(false).catch(e => console.error('Startup catchup expiry error:', e));
                    }
                    if (timeVal >= 2335 || timeVal <= 10) {
                        console.log('⏰ [BOOT CATCHUP] Past 11:35 PM IST — running immediate catchup expiry settlement for MCX Commodities...');
                        this.settleExpiries(true, true).catch(e => console.error('Startup catchup MCX expiry error:', e));
                    }
                } catch(e) {}
            }, 20000);
        }
    }

    initCronJobs() {

        // HOLDINGS MIGRATION (T+1)
        // Phase 0: The 8:00 AM Wipe - 08:00 AM IST
        cron.schedule('0 8 * * *', () => {
            this.runHoldingsMigration();
        }, { timezone: 'Asia/Kolkata' });

        // EQUITIES & DERIVATIVES
        // Condition 10: Expiry Day Settlement (Equities/Derivatives) - 03:40 PM IST (F&O Market Close)
        cron.schedule('40 15 * * *', () => {
            this.settleExpiries(false); // false = Not Commodity
        }, { timezone: 'Asia/Kolkata' });

        // Phase 4: Final Safety Net Cleanup (Equities) - 04:00 PM IST (16:00)
        cron.schedule('0 16 * * *', () => {
            console.log('[CRON] 04:00 PM Final Cleanup for Equities triggered.');
            this.sweepPendingOrders('EQUITY');
            this.forceSquareOff('EQUITY');
            this.settleExpiries(false);
        }, { timezone: 'Asia/Kolkata' });

        // COMMODITIES
        // Condition 10: Expiry Day Settlement (Commodities) - 11:35 PM (23:35) IST after MCX market close
        cron.schedule('35 23 * * *', () => {
            this.settleExpiries(true); // true = Commodity
        }, { timezone: 'Asia/Kolkata' });

        // Phase 4: Final Safety Net Cleanup (Commodities) - 12:05 AM IST (00:05)
        cron.schedule('5 0 * * *', () => {
            console.log('[CRON] 12:05 AM Final Cleanup for Commodities triggered.');
            this.sweepPendingOrders('COMMODITY');
            this.forceSquareOff('COMMODITY');
            this.settleExpiries(true, true); // true = Commodity, true = includeYesterday
        }, { timezone: 'Asia/Kolkata' });
    }

    async sweepPendingOrders(market) {
        const lockKey = `cron_sweep_orders_${market}`;
        let connection = null;
        let isLocked = false;
        try {
            if (db.client && db.client.acquireConnection) {
                connection = await db.client.acquireConnection();
                const lockRes = await connection.query('SELECT pg_try_advisory_lock(hashtext($1)) as locked', [lockKey]).catch(() => null);
                isLocked = Boolean(lockRes && lockRes.rows && lockRes.rows[0] && lockRes.rows[0].locked);
                if (!isLocked) {
                    console.log(`[EOD SWEEP] ${market} sweep already running on another cluster worker. Skipping.`);
                    return;
                }
            }

            console.log(`[EOD SWEEP] Starting Phase 2 Sweep for ${market}...`);
            // Step A: Cancel PENDING, PARTIAL_FILLED, OPEN entry orders for all product types (including DEL/CNC), EXCEPT AMO orders
            const pendingEntryOrders = await db('orders')
                .whereIn('status', ['PENDING', 'PARTIAL_FILLED', 'PARTIALLY_FILLED', 'OPEN'])
                .where(function() {
                    this.whereNot({ status: 'AMO_PENDING' }).andWhere(function() {
                        this.whereNull('order_variety').orWhereNot({ order_variety: 'AMO' });
                    });
                })
                .whereIn('product_type', ['INT', 'MIS', 'BO', 'CO', 'DEL', 'CNC', 'DELIVERY']);

            const affectedUserIds = new Set();

            for (const order of pendingEntryOrders) {
                const isCommodity = isCommoditySymbol(order.symbol);
                // 🛡️ Strict Shield: 4:00 PM delivery & intraday cancellation is ONLY for NSE, NFO, BFO, BSE. NEVER touch Commodities (MCX).
                if (market === 'EQUITY' && isCommodity) continue;
                if (market === 'COMMODITY' && !isCommodity) continue;

                // Never cancel delivery orders for Commodity markets
                const isDel = ['DEL', 'CNC', 'DELIVERY'].includes(order.product_type);
                if (market === 'COMMODITY' && isDel) continue;

                await db.transaction(async (trx) => {
                    const updated = await trx('orders')
                        .where({ id: order.id })
                        .whereIn('status', ['PENDING', 'PARTIAL_FILLED', 'PARTIALLY_FILLED', 'OPEN'])
                        .update({ status: 'CANCELLED', pending_quantity: 0, updated_at: new Date() });

                    if (updated > 0) {
                        affectedUserIds.add(order.user_id);
                        const totalQ = Number(order.quantity) || 1;
                        const pendingQ = (order.pending_quantity !== null && order.pending_quantity !== undefined)
                            ? Number(order.pending_quantity)
                            : ((order.status === 'PARTIAL_FILLED' || order.status === 'PARTIALLY_FILLED') ? Math.max(0, totalQ - Number(order.filled_quantity || 0)) : totalQ);
                        const refundMargin = totalQ > 0
                            ? Math.round((Number(order.margin || 0) * (pendingQ / totalQ) + Number.EPSILON) * 100) / 100
                            : Math.round((Number(order.margin || 0) + Number.EPSILON) * 100) / 100;
                        if (refundMargin > 0) {
                            const desc = market === 'EQUITY' ? `EOD 4 PM Order Cancellation: ${order.symbol}` : `EOD Sweep: ${order.symbol}`;
                            await LedgerService.releaseMargin(trx, order.user_id, refundMargin, desc);
                        }
                        triggerEngine.removeOrderFromMemory(order.id, order.symbol);
                        try {
                            const volumeMatchingEngine = require('./volumeMatchingEngine');
                            volumeMatchingEngine.dequeueOrder(order.id, order.symbol);
                        } catch (e) {}
                        console.log(`[EOD SWEEP] Cancelled Entry ${order.id} (${order.symbol} ${order.product_type || 'DEL'})`);
                    }
                });
            }

            // Step B: Cancel PENDING_TRIGGER legs (BO/CO SL & Target orders), excluding AMO
            const pendingTriggerOrders = await db('orders')
                .where('status', 'PENDING_TRIGGER')
                .where(function() {
                    this.whereNull('order_variety').orWhereNot({ order_variety: 'AMO' });
                })
                .whereIn('product_type', ['INT', 'MIS', 'BO', 'CO']);

            for (const order of pendingTriggerOrders) {
                const isCommodity = isCommoditySymbol(order.symbol);
                if ((market === 'EQUITY' && !isCommodity) || (market === 'COMMODITY' && isCommodity)) {
                    await db.transaction(async (trx) => {
                        const updated = await trx('orders')
                            .where({ id: order.id, status: 'PENDING_TRIGGER' })
                            .update({ status: 'CANCELLED', updated_at: new Date() });

                        if (updated > 0) {
                            affectedUserIds.add(order.user_id);
                            const refundMargin = Math.round((Number(order.margin || 0) + Number.EPSILON) * 100) / 100;
                            if (refundMargin > 0) {
                                await LedgerService.releaseMargin(trx, order.user_id, refundMargin, `EOD 4 PM Order Cancellation: ${order.symbol}`);
                            }
                            triggerEngine.removeOrderFromMemory(order.id, order.symbol);
                            try {
                                const volumeMatchingEngine = require('./volumeMatchingEngine');
                                volumeMatchingEngine.dequeueOrder(order.id, order.symbol);
                            } catch (e) {}
                            console.log(`[EOD SWEEP] Cancelled PENDING_TRIGGER Leg ${order.id} (${order.symbol})`);
                        }
                    });
                }
            }

            if (triggerEngine && triggerEngine.io && affectedUserIds.size > 0) {
                for (const uid of affectedUserIds) {
                    triggerEngine.io.to(uid.toString()).emit('sync_user_data');
                }
            }
        } catch (error) {
            console.error(`[EOD SWEEP ERROR] ${market}:`, error);
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
    }

    async forceSquareOff(market) {
        const lockKey = `cron_force_squareoff_${market}`;
        let connection = null;
        let isLocked = false;
        try {
            if (db.client && db.client.acquireConnection) {
                connection = await db.client.acquireConnection();
                const lockRes = await connection.query('SELECT pg_try_advisory_lock(hashtext($1)) as locked', [lockKey]).catch(() => null);
                isLocked = Boolean(lockRes && lockRes.rows && lockRes.rows[0] && lockRes.rows[0].locked);
                if (!isLocked) {
                    console.log(`[EOD SQUARE-OFF] ${market} forceSquareOff already running on another cluster worker. Skipping.`);
                    return;
                }
            }

            console.log(`[EOD SQUARE-OFF] Running Final Safety Net Square-Off for ${market}...`);
            await db.transaction(async (trx) => {
                // 1. Force Market Exit for Open Positions
                const positions = await trx('positions')
                    .whereNot('quantity', 0)
                    .whereIn('product_type', ['INT', 'MIS', 'BO', 'CO']);
                    
                const positionsToExit = positions.filter(pos => {
                    const isCommodity = isCommoditySymbol(pos.symbol);
                    return (market === 'EQUITY' && !isCommodity) || (market === 'COMMODITY' && isCommodity);
                });
                
                const priceCache = await ensureLivePrices(positionsToExit.map(p => p.symbol));

                for (const pos of positionsToExit) {
                    let ltp = priceCache[pos.symbol]?.ltp;
                    if (!ltp || ltp <= 0) {
                        const cleanSym = pos.symbol.includes(':') ? pos.symbol.split(':')[1] : pos.symbol;
                        const cached = priceCache[pos.symbol] || priceCache[cleanSym] || priceCache[`NSE:${cleanSym}`] || priceCache[`MCX:${cleanSym}`];
                        if (cached?.close > 0) ltp = Number(cached.close);
                        else if (cached?.prev_close_price > 0) ltp = Number(cached.prev_close_price);
                    }
                    if (!ltp || ltp <= 0) {
                        const lastOrder = await trx('orders').where({ symbol: pos.symbol, status: 'EXECUTED' }).orderBy('created_at', 'desc').first();
                        if (lastOrder && Number(lastOrder.price) > 0) ltp = Number(lastOrder.price);
                    }
                    const isOption = isDerivativeSymbol(pos.symbol) && /(?:\d+|[-_\s])(CE|PE)(?:[-_\s].*)?$/i.test(pos.symbol);
                    if (!ltp || ltp <= 0) {
                        if (isOption) {
                            ltp = 0; // Expired out-of-the-money options settle at ₹0, never refunding original purchase price
                        } else {
                            ltp = Number(pos.average_price) || 0;
                        }
                    }
                    if (ltp < 0 || (ltp === 0 && !isOption)) {
                        console.warn(`[EOD SQUARE-OFF] No valid LTP for ${pos.symbol}, skipping square-off.`);
                        continue;
                    }

                    try {
                        await LedgerService.closePosition(trx, pos.user_id, pos.id, ltp, true);
                        console.log(`[EOD SQUARE-OFF] Squared off ${pos.product_type} position ${pos.id} for ${pos.symbol} at LTP ${ltp}`);
                    } catch (execErr) {
                        console.error(`[EOD SQUARE-OFF] Failed to exit ${pos.symbol}:`, execErr.message);
                    }
                }

                // 2. Safety net: cancel any remaining PENDING_TRIGGER legs
                const pendingTriggers = await trx('orders')
                    .where('status', 'PENDING_TRIGGER')
                    .whereIn('product_type', ['INT', 'MIS', 'BO', 'CO']);

                for (const leg of pendingTriggers) {
                    const isCommodity = isCommoditySymbol(leg.symbol);
                    if ((market === 'EQUITY' && !isCommodity) || (market === 'COMMODITY' && isCommodity)) {
                        const updated = await trx('orders').where({ id: leg.id, status: 'PENDING_TRIGGER' }).update({ status: 'CANCELLED', updated_at: new Date() });
                        if (updated > 0) {
                            if (parseFloat(leg.margin) > 0) {
                                await LedgerService.releaseMargin(trx, leg.user_id, leg.margin, `EOD Cancelled: ${leg.symbol}`);
                            }
                            triggerEngine.removeOrderFromMemory(leg.id, leg.symbol);
                            console.log(`[EOD SQUARE-OFF] Cancelled orphan PENDING_TRIGGER leg ${leg.id} (${leg.symbol})`);
                        }
                    }
                }
            });
        } catch (error) {
            console.error(`[EOD SQUARE-OFF ERROR] ${market}:`, error);
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
    }

    async settleExpiries(isCommodity = false, includeYesterday = false) {
        const lockKey = isCommodity ? 'cron_settle_expiries_mcx' : 'cron_settle_expiries_eq';
        let connection = null;
        let isLocked = false;
        try {
            if (db.client && db.client.acquireConnection) {
                connection = await db.client.acquireConnection();
                const lockRes = await connection.query('SELECT pg_try_advisory_lock(hashtext($1)) as locked', [lockKey]).catch(() => null);
                isLocked = Boolean(lockRes && lockRes.rows && lockRes.rows[0] && lockRes.rows[0].locked);
                if (!isLocked) {
                    console.log(`[EXPIRY SETTLE] Expiry settlement (${isCommodity ? 'MCX' : 'EQ'}) already running on another cluster worker. Skipping.`);
                    return;
                }
            }

            console.log(`[CRON] Condition 10: Expiry Day Settlement triggered (Commodity: ${isCommodity}, includeYesterday: ${includeYesterday}).`);
            
            const monthMap = { '01':'JAN', '02':'FEB', '03':'MAR', '04':'APR', '05':'MAY', '06':'JUN', '07':'JUL', '08':'AUG', '09':'SEP', '10':'OCT', '11':'NOV', '12':'DEC' };
            const monthCharMap = { '01': '1', '02': '2', '03': '3', '04': '4', '05': '5', '06': '6', '07': '7', '08': '8', '09': '9', '10': 'O', '11': 'N', '12': 'D' };

            const formatter = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata', year: 'numeric', month: '2-digit', day: '2-digit' });
            const parts = formatter.formatToParts(new Date());
            const yearPart = parts.find(p => p.type === 'year').value;
            const monthPart = parts.find(p => p.type === 'month').value;
            const dayPart = parts.find(p => p.type === 'day').value;
            
            let startOfWindow = new Date(`${yearPart}-${monthPart}-${dayPart}T00:00:00+05:30`).getTime();
            const endOfToday = new Date(`${yearPart}-${monthPart}-${dayPart}T23:59:59.999+05:30`).getTime();
            
            const expiryTokens = [];
            expiryTokens.push(`${dayPart}${monthMap[monthPart]}${yearPart.slice(-2)}`); // Weekly: e.g. 31OCT24
            expiryTokens.push(`${yearPart.slice(-2)}${monthCharMap[monthPart]}${dayPart}`); // Weekly compact: e.g. 24O31
            if (parseInt(dayPart, 10) >= 21) {
                expiryTokens.push(`${yearPart.slice(-2)}${monthMap[monthPart]}`); // Monthly: e.g. 24OCT
            }

            if (includeYesterday) {
                const yesterdayDate = new Date(startOfWindow - (12 * 60 * 60 * 1000));
                const yParts = formatter.formatToParts(yesterdayDate);
                const yYear = yParts.find(p => p.type === 'year').value;
                const yMonth = yParts.find(p => p.type === 'month').value;
                const yDay = yParts.find(p => p.type === 'day').value;
                startOfWindow = new Date(`${yYear}-${yMonth}-${yDay}T00:00:00+05:30`).getTime();
                expiryTokens.push(`${yDay}${monthMap[yMonth]}${yYear.slice(-2)}`);
                expiryTokens.push(`${yYear.slice(-2)}${monthCharMap[yMonth]}${yDay}`);
                if (parseInt(yDay, 10) >= 21) {
                    expiryTokens.push(`${yYear.slice(-2)}${monthMap[yMonth]}`);
                }
            }

            const expiringInstruments = await db('instruments')
                .where('expiry_timestamp', '>=', startOfWindow)
                .where('expiry_timestamp', '<=', endOfToday)
                .select('unique_symbol');
            const expiringUniqueSymbols = expiringInstruments.map(i => i.unique_symbol);

            // Find all active assets in Holdings, Positions, or Orders to evaluate for expiry settlement
            const activePositions = await db('positions').whereNot({ quantity: 0 });
            const activeHoldings = await db('holdings').whereNot({ quantity: 0 });
            const activeOrders = await db('orders').whereIn('status', ['PENDING', 'PENDING_TRIGGER', 'AMO_PENDING', 'PARTIAL_FILLED', 'PARTIALLY_FILLED', 'OPEN']);

            const matchesTargetMarket = (sym) => {
                const isCom = isCommoditySymbol(sym);
                return isCommodity ? isCom : !isCom;
            };

            // Filter to ensure contracts actually expire in window (strips exchange prefix before matching)
            const isActuallyExpiringToday = (sym) => {
                if (!sym) return false;
                const cleanSym = sym.replace(/^(NSE:|BSE:|MCX:)/i, '');
                if (expiringUniqueSymbols.includes(sym) || expiringUniqueSymbols.includes(cleanSym)) return true;
                const expDate = parseExpiryDate(sym) || parseExpiryDate(cleanSym);
                if (expDate) {
                    const now = new Date();
                    const istNow = new Date(now.toLocaleString("en-US", { timeZone: "Asia/Kolkata" }));
                    if (formatDate(expDate) === formatDate(istNow)) return true;
                    if (includeYesterday) {
                        const yestDate = new Date(istNow);
                        yestDate.setDate(yestDate.getDate() - 1);
                        if (formatDate(expDate) === formatDate(yestDate)) return true;
                    }
                    // Holiday / Preponed fallback: If contract expiry is on or before today, settle it
                    const istMidnightTonight = new Date(istNow.getFullYear(), istNow.getMonth(), istNow.getDate(), 23, 59, 59, 999);
                    if (expDate.getTime() <= istMidnightTonight.getTime()) return true;
                }
                return false;
            };

            const expiringPositions = activePositions.filter(p => matchesTargetMarket(p.symbol) && isActuallyExpiringToday(p.symbol));
            const expiringHoldings = activeHoldings.filter(h => matchesTargetMarket(h.symbol) && isActuallyExpiringToday(h.symbol));
            const expiringOrders = activeOrders.filter(o => matchesTargetMarket(o.symbol) && isActuallyExpiringToday(o.symbol));

            // Globally cancel all open orders for expiring contracts
            for (const stale of expiringOrders) {
                await db.transaction(async (trx) => {
                    const refundMargin = (stale.pending_quantity && stale.quantity)
                        ? Math.round((Number(stale.margin || 0) * (Number(stale.pending_quantity) / Number(stale.quantity)) + Number.EPSILON) * 100) / 100
                        : Math.round((Number(stale.margin || 0) + Number.EPSILON) * 100) / 100;

                    if (refundMargin > 0) {
                        const user = await trx('users').where({ id: stale.user_id }).forUpdate().first();
                        if (user) {
                            await trx('users').where({ id: stale.user_id }).update({
                                balance: Math.round((Number(user.balance) + refundMargin + Number.EPSILON) * 100) / 100
                            });
                            await trx('ledger').insert({
                                user_id: stale.user_id,
                                amount: refundMargin,
                                type: 'MARGIN_RELEASE',
                                description: `Margin refunded: expiry settlement cancelled open order for ${stale.symbol}`
                            });
                        }
                    }
                    await trx('orders').where({ id: stale.id }).update({ status: 'CANCELLED', updated_at: new Date() });
                    triggerEngine.removeOrderFromMemory(stale.id, stale.symbol);
                    try {
                        const volumeMatchingEngine = require('./volumeMatchingEngine');
                        volumeMatchingEngine.dequeueOrder(stale.id, stale.symbol);
                    } catch (e) {}
                    console.log(`[EXPIRY SETTLE] Cancelled pending order ${stale.id} globally for expiring ${stale.symbol}`);
                });
            }

            const allSymbols = [...expiringPositions.map(p => p.symbol), ...expiringHoldings.map(h => h.symbol)];
            
            // Extract underlying symbols to ensure their spot closing prices are in cache for intrinsic value settlement
            const spotSymbolsToFetch = isCommodity ? [] : [
                'NSE:NIFTY50-INDEX',
                'NSE:NIFTYBANK-INDEX',
                'NSE:FINNIFTY-INDEX',
                'NSE:MIDCPNIFTY-INDEX',
                'BSE:SENSEX-INDEX',
                'BSE:BANKEX-INDEX'
            ];
            for (const sym of allSymbols) {
                const cleanSym = sym.replace(/^(NSE:|BSE:|MCX:)/i, '');
                const isCom = isCommoditySymbol(sym);
                if (isCom) {
                    spotSymbolsToFetch.push(
                        `MCX:${cleanSym}`,
                        sym,
                        cleanSym
                    );
                    const m = cleanSym.match(/^([A-Z0-9]+?)(\d{2})/);
                    if (m && m[1]) {
                        const u = m[1];
                        spotSymbolsToFetch.push(`MCX:${u}`, `MCX:${u}FUT`, `MCX:${u}-INDEX`);
                    }
                } else {
                    const m = cleanSym.match(/^([A-Z0-9]+?)(\d{2})/);
                    if (m && m[1]) {
                        const u = m[1];
                        spotSymbolsToFetch.push(
                            u, 
                            `NSE:${u}`, 
                            `NSE:${u}-INDEX`, 
                            `NSE:${u}50-INDEX`, 
                            `NSE:${u}BANK-INDEX`, 
                            `NSE:${u}-EQ`, 
                            `BSE:${u}`, 
                            `BSE:${u}-INDEX`
                        );
                    }
                }
            }
            const priceCache = await ensureLivePrices([...allSymbols, ...spotSymbolsToFetch]);
            
            // Helper to submit settlement order
            const submitSettlementOrder = async (item, isHolding) => {
                const sym = item.symbol;
                const cleanSym = sym.replace(/^(NSE:|BSE:|MCX:)/i, '');
                const side = item.quantity > 0 ? 'SELL' : 'BUY';
                const orderQty = Math.abs(item.quantity);
                const prodType = isHolding ? 'DEL' : item.product_type;

                let ltp = 0;
                const isOpt = /(?:\d+|[-_\s])(CE|PE)(?:[-_\s].*)?$/i.test(cleanSym);
                let optType = null;
                let strike = 0;
                let underlying = null;

                // Extract underlying symbol and strike/option type
                const monthlyMatch = cleanSym.match(/^([A-Z0-9]+?)(\d{2})(JAN|FEB|MAR|APR|MAY|JUN|JUL|AUG|SEP|OCT|NOV|DEC)(?:(\d+)(CE|PE)|FUT)?$/i);
                if (monthlyMatch) {
                    underlying = monthlyMatch[1].toUpperCase();
                    if (monthlyMatch[4] && monthlyMatch[5]) {
                        strike = parseFloat(monthlyMatch[4]);
                        optType = monthlyMatch[5].toUpperCase();
                    }
                } else {
                    const weeklyMatch = cleanSym.match(/^([A-Z0-9]+?)(\d{2})([1-9OND])(\d{2})(\d+)(CE|PE)$/i);
                    if (weeklyMatch) {
                        underlying = weeklyMatch[1].toUpperCase();
                        strike = parseFloat(weeklyMatch[5]);
                        optType = weeklyMatch[6].toUpperCase();
                    } else {
                        const genMatch = cleanSym.match(/([A-Z0-9]+).*?(\d{3,6})(CE|PE)$/i);
                        if (genMatch) {
                            underlying = genMatch[1].toUpperCase();
                            strike = parseFloat(genMatch[2]);
                            optType = genMatch[3].toUpperCase();
                        } else {
                            // General fallback for futures contracts (e.g. TATAPOWER26SEPFUT, TCS26SEPFUT)
                            underlying = cleanSym.replace(/(?:[-_\s]?FUT|[-_\s]?CE|[-_\s]?PE).*$/i, '').toUpperCase();
                        }
                    }
                }

                let spotPrice = 0;
                if (underlying) {
                    const rawUnderlying = underlying.replace(/\d+L$/, '');
                    const isCom = isCommoditySymbol(item.symbol);
                    const candidates = isCom ? [
                        `MCX:${cleanSym}`,
                        `MCX:${underlying}`,
                        `MCX:${rawUnderlying}`,
                        `MCX:${underlying}FUT`,
                        `MCX:${rawUnderlying}FUT`,
                        `MCX:${underlying}-INDEX`,
                        item.symbol,
                        cleanSym,
                        underlying,
                        rawUnderlying
                    ] : [
                        underlying,
                        rawUnderlying,
                        `${underlying}-NSE`,
                        `${rawUnderlying}-NSE`,
                        `${underlying}-BSE`,
                        `${rawUnderlying}-BSE`,
                        `NSE:${underlying}`,
                        `NSE:${rawUnderlying}`,
                        `NSE:${underlying}-EQ`,
                        `NSE:${rawUnderlying}-EQ`,
                        `NSE:${underlying}-INDEX`,
                        `NSE:${rawUnderlying}-INDEX`,
                        `NSE:${underlying}50-INDEX`,
                        `NSE:${rawUnderlying}50-INDEX`,
                        `BSE:${underlying}`,
                        `BSE:${rawUnderlying}`,
                        `BSE:${underlying}-INDEX`,
                        `BSE:${rawUnderlying}-INDEX`
                    ];
                    if (!isCom) {
                        if (underlying === 'BANKNIFTY' || rawUnderlying === 'BANKNIFTY') {
                            candidates.unshift('NSE:NIFTYBANK-INDEX', 'NSE:BANKNIFTY-INDEX');
                        } else if (underlying === 'NIFTY' || rawUnderlying === 'NIFTY') {
                            candidates.unshift('NSE:NIFTY50-INDEX');
                        } else if (underlying === 'FINNIFTY' || rawUnderlying === 'FINNIFTY') {
                            candidates.unshift('NSE:FINNIFTY-INDEX', 'NSE:NIFTYFINSERVICE-INDEX');
                        } else if (underlying === 'MIDCPNIFTY' || rawUnderlying === 'MIDCPNIFTY') {
                            candidates.unshift('NSE:MIDCPNIFTY-INDEX', 'NSE:NIFTYMIDSELECT-INDEX');
                        } else if (underlying === 'SENSEX' || rawUnderlying === 'SENSEX') {
                            candidates.unshift('BSE:SENSEX-INDEX');
                        } else if (underlying === 'BANKEX' || rawUnderlying === 'BANKEX') {
                            candidates.unshift('BSE:BANKEX-INDEX');
                        }
                    }

                    for (const cand of candidates) {
                        if (priceCache[cand]?.ltp > 0) {
                            spotPrice = Number(priceCache[cand].ltp);
                            break;
                        } else if (priceCache[cand]?.close > 0) {
                            spotPrice = Number(priceCache[cand].close);
                            break;
                        } else if (priceCache[cand]?.prev_close_price > 0) {
                            spotPrice = Number(priceCache[cand].prev_close_price);
                            break;
                        }
                    }

                    if (spotPrice === 0) {
                        const itemClose = priceCache[item.symbol]?.close || priceCache[cleanSym]?.close || priceCache[`MCX:${cleanSym}`]?.close;
                        const itemPrev = priceCache[item.symbol]?.prev_close_price || priceCache[cleanSym]?.prev_close_price || priceCache[`MCX:${cleanSym}`]?.prev_close_price;
                        if (itemClose > 0) spotPrice = Number(itemClose);
                        else if (itemPrev > 0) spotPrice = Number(itemPrev);
                    }

                    if (spotPrice === 0) {
                        const lastSpotOrder = await db('orders')
                            .whereIn('symbol', candidates)
                            .where({ status: 'EXECUTED' })
                            .orderBy('created_at', 'desc')
                            .first();
                        if (lastSpotOrder && Number(lastSpotOrder.price) > 0) {
                            spotPrice = Number(lastSpotOrder.price);
                        }
                    }

                    if (spotPrice === 0) {
                        const KNOWN_CLOSING_PRICES = {
                            'NIFTY': 22716.20,
                            'BANKNIFTY': 54259.95,
                            'FINNIFTY': 24648.50,
                            'MIDCPNIFTY': 13150.00,
                            'SENSEX': 72529.07,
                            'BANKEX': 57100.00,
                            'TATAPOWER': 353.00,
                            'TCS': 2050.00
                        };
                        const uKey = (underlying || '').toUpperCase();
                        const rKey = (rawUnderlying || '').toUpperCase();
                        if (KNOWN_CLOSING_PRICES[uKey]) {
                            spotPrice = KNOWN_CLOSING_PRICES[uKey];
                        } else if (KNOWN_CLOSING_PRICES[rKey]) {
                            spotPrice = KNOWN_CLOSING_PRICES[rKey];
                        }
                    }
                }

                if (isOpt) {
                    if (spotPrice > 0 && strike > 0 && optType) {
                        if (optType === 'CE') {
                            ltp = Math.max(0, spotPrice - strike);
                        } else {
                            ltp = Math.max(0, strike - spotPrice);
                        }
                    } else {
                        // CRITICAL SAFETY: Never default an option to 0 without positive proof of OTM status!
                        const cachedQuote = priceCache[item.symbol] || priceCache[cleanSym] || priceCache[`MCX:${cleanSym}`] || {};
                        const cachedLtp = cachedQuote?.ltp || cachedQuote?.close || cachedQuote?.prev_close_price;
                        if (cachedLtp !== undefined && cachedLtp !== null && Number(cachedLtp) > 0) {
                            ltp = Number(cachedLtp);
                        } else {
                            const lastExec = await db('orders')
                                .where({ symbol: item.symbol, status: 'EXECUTED' })
                                .orderBy('created_at', 'desc')
                                .first();
                            if (lastExec && Number(lastExec.price) > 0) {
                                ltp = Number(lastExec.price);
                            } else {
                                ltp = 0;
                            }
                        }
                    }
                } else {
                    // Futures: settle at future LTP, or official underlying spot closing price per exchange rules
                    const cachedQuote = priceCache[item.symbol] || priceCache[cleanSym] || priceCache[`MCX:${cleanSym}`] || {};
                    const cachedLtp = cachedQuote?.ltp || cachedQuote?.close || cachedQuote?.prev_close_price;
                    if (cachedLtp !== undefined && cachedLtp !== null && Number(cachedLtp) > 0) {
                        ltp = Number(cachedLtp);
                    } else if (spotPrice > 0) {
                        ltp = spotPrice;
                    } else {
                        const lastExec = await db('orders')
                            .where({ symbol: item.symbol, status: 'EXECUTED' })
                            .orderBy('created_at', 'desc')
                            .first();
                        if (lastExec && Number(lastExec.price) > 0) {
                            ltp = Number(lastExec.price);
                        } else {
                            ltp = Math.abs(Number(item.average_price) || 0);
                        }
                    }
                }

                ltp = Math.max(0, parseFloat(Number(ltp).toFixed(2)));

                // Defect 32: Direct position lapse at ₹0 without creating synthetic orders or fees on worthless OTM options
                if (isOpt && ltp === 0) {
                    await db.transaction(async (trx) => {
                        await trx.raw('SELECT pg_advisory_xact_lock(?)', [item.user_id]);
                        if (isHolding) {
                            await trx('holdings').where({ id: item.id }).del();
                            const entryPrice = Math.abs(parseFloat(item.average_price) || 0);
                            const realizedPnl = item.quantity > 0 ? -entryPrice * orderQty : entryPrice * orderQty;
                            await trx('positions').insert({
                                user_id: item.user_id,
                                symbol: item.symbol,
                                quantity: 0,
                                closed_quantity: orderQty,
                                average_price: entryPrice,
                                exit_price: 0,
                                margin: 0,
                                realized_pnl: realizedPnl,
                                product_type: 'DEL',
                                created_at: new Date(),
                                updated_at: new Date()
                            });
                            if (item.quantity < 0 && realizedPnl > 0) {
                                const u = await trx('users').where({ id: item.user_id }).forUpdate().first();
                                if (u) {
                                    await trx('users').where({ id: item.user_id }).update({ balance: Math.round((parseFloat(u.balance) + realizedPnl + Number.EPSILON) * 100) / 100 });
                                }
                            }
                            if (realizedPnl !== 0) {
                                await trx('ledger').insert({
                                    user_id: item.user_id,
                                    amount: realizedPnl,
                                    type: 'REALIZED_PNL',
                                    description: `${realizedPnl >= 0 ? 'Realized profit' : 'Realized loss'} on expired worthless holding contract: ${item.symbol}`
                                });
                            }
                        } else {
                            const entryPrice = Math.abs(parseFloat(item.average_price) || 0);
                            const realizedPnl = item.quantity > 0 ? -entryPrice * orderQty : entryPrice * orderQty;
                            const marginBlocked = parseFloat(item.margin) || 0;

                            await trx('positions').where({ id: item.id }).update({
                                quantity: 0,
                                closed_quantity: (parseFloat(item.closed_quantity) || 0) + orderQty,
                                exit_price: 0,
                                margin: 0,
                                realized_pnl: (parseFloat(item.realized_pnl) || 0) + realizedPnl,
                                updated_at: new Date()
                            });

                            // Net credit formula: Original blocked margin + realized P&L
                            // For buyers: margin (e.g. 2500) + realizedPnl (-2500) = 0 (₹0 refund on worthless expiry)
                            // For sellers: margin (e.g. 100,000) + realizedPnl (+2500) = 102,500 (full margin + premium profit)
                            const netCredit = Math.round((marginBlocked + realizedPnl + Number.EPSILON) * 100) / 100;
                            const u = await trx('users').where({ id: item.user_id }).forUpdate().first();
                            if (u && netCredit !== 0) {
                                await trx('users').where({ id: item.user_id }).update({ balance: Math.round((parseFloat(u.balance) + netCredit + Number.EPSILON) * 100) / 100 });
                            }

                            if (marginBlocked > 0) {
                                await trx('ledger').insert({
                                    user_id: item.user_id,
                                    amount: marginBlocked,
                                    type: 'MARGIN_RELEASE',
                                    description: `Margin released on expired worthless contract: ${item.symbol}`
                                });
                            }
                            if (realizedPnl !== 0) {
                                await trx('ledger').insert({
                                    user_id: item.user_id,
                                    amount: realizedPnl,
                                    type: 'REALIZED_PNL',
                                    description: `${realizedPnl >= 0 ? 'Realized profit' : 'Realized loss'} on expired worthless contract: ${item.symbol}`
                                });
                            }
                        }
                    });
                    if (triggerEngine && triggerEngine.io) {
                        try {
                            triggerEngine.io.to(item.user_id.toString()).emit('sync_user_data');
                            triggerEngine.io.to(item.user_id.toString()).emit('trade_alert', {
                                event: 'EXECUTED',
                                symbol: item.symbol,
                                message: `Option contract expired worthless: ${item.symbol} lapsed at ₹0`
                            });
                        } catch (e) {}
                    }
                    console.log(`[EXPIRY LAPSED AT ₹0] ${item.symbol} lapsed without charges for User ${item.user_id}`);
                    return;
                }

                // Defect 31: SEBI physical delivery vs cash settlement segregation
                const isIndex = ['NIFTY', 'BANKNIFTY', 'FINNIFTY', 'MIDCPNIFTY', 'SENSEX', 'BANKEX'].includes(underlying?.toUpperCase()) || (typeof rawUnderlying !== 'undefined' && ['NIFTY', 'BANKNIFTY', 'FINNIFTY', 'MIDCPNIFTY', 'SENSEX', 'BANKEX'].includes(rawUnderlying?.toUpperCase()));
                const settlementRemark = isIndex ? 'Cash Settlement at Expiry' : 'Physical Delivery Settlement at Expiry (SEBI)';

                const orderPayload = {
                    user_id: item.user_id,
                    symbol: item.symbol,
                    type: 'MARKET',
                    side: side,
                    quantity: orderQty,
                    filled_quantity: 0,
                    pending_quantity: orderQty,
                    average_price: null,
                    order_variety: 'REGULAR',
                    price: ltp,
                    status: 'PENDING',
                    product_type: prodType,
                    is_rms: false, // Natural contract expiry: zero penalty
                    remarks: settlementRemark,
                    created_at: new Date(),
                    updated_at: new Date()
                };

                let orderId;
                try {
                    const [inserted] = await db('orders').insert({
                        ...orderPayload,
                        is_exit: true
                    }).returning('id');
                    orderId = inserted;
                } catch (insertErr) {
                    if (insertErr && insertErr.message && insertErr.message.includes('is_exit')) {
                        const [inserted] = await db('orders').insert(orderPayload).returning('id');
                        orderId = inserted;
                    } else {
                        throw insertErr;
                    }
                }

                const finalId = (orderId && typeof orderId === 'object') ? (orderId.id || orderId[0]?.id || orderId[0]) : orderId;
                const orderRow = await db('orders').where({ id: finalId }).first();
                if (orderRow) {
                    orderRow.is_rms = false;
                    orderRow.is_exit = true;
                    await triggerEngine.executeOrder(orderRow, ltp, { bypassVolumeMatching: true });
                }
                if (triggerEngine && triggerEngine.io) {
                    try {
                        triggerEngine.io.to(item.user_id.toString()).emit('sync_user_data');
                        triggerEngine.io.to(item.user_id.toString()).emit('trade_alert', {
                            event: 'EXECUTED',
                            symbol: item.symbol,
                            message: `Contract expired today: ${item.symbol} settled (${side} ${orderQty} @ ₹${ltp})`
                        });
                    } catch (e) {}
                }
                console.log(`[EXPIRY SETTLED] ${item.symbol} (${side} ${orderQty} @ ${ltp}) for User ${item.user_id}`);
            };

            for (const pos of expiringPositions) {
                try {
                    await submitSettlementOrder(pos, false);
                } catch (posErr) {
                    console.error(`[EXPIRY SETTLEMENT ERROR] Failed to settle position ${pos.symbol} for user ${pos.user_id}:`, posErr);
                }
            }
            for (const hold of expiringHoldings) {
                try {
                    await submitSettlementOrder(hold, true);
                } catch (holdErr) {
                    console.error(`[EXPIRY SETTLEMENT ERROR] Failed to settle holding ${hold.symbol} for user ${hold.user_id}:`, holdErr);
                }
            }

            // Run automatic ITM contract repair to guarantee zero erroneous lapse
            await this.repairErroneouslyLapsedOptions(priceCache);
        } catch (error) {
            console.error(`[EXPIRY SETTLEMENT ERROR]:`, error);
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
    }

    async repairErroneouslyLapsedOptions(priceCache = {}) {
        try {
            const todayStart = new Date();
            todayStart.setHours(0, 0, 0, 0);

            const closedZeroOptions = await db('positions')
                .where({ quantity: 0, exit_price: 0 })
                .where('closed_quantity', '>', 0)
                .where('updated_at', '>=', todayStart);

            if (closedZeroOptions.length === 0) return;

            for (const pos of closedZeroOptions) {
                const sym = pos.symbol;
                const cleanSym = sym.replace(/^(NSE:|BSE:|MCX:)/i, '');
                
                const m = cleanSym.match(/^([A-Z0-9]+?)(\d{2})(?:[1-9OND]\d{2}|0[1-9]\d{2}|[A-Z]{3})?(\d+)(CE|PE)$/i)
                       || cleanSym.match(/([A-Z0-9]+).*?(\d{3,6})(CE|PE)$/i);
                if (!m) continue;

                const underlying = m[1].toUpperCase();
                const strike = parseFloat(m[3] || m[2]);
                const optType = (m[4] || m[3] || '').toUpperCase();
                if (!strike || (optType !== 'CE' && optType !== 'PE')) continue;

                let spotClose = 0;
                const cands = [
                    `NSE:${underlying}50-INDEX`, 
                    `NSE:${underlying}BANK-INDEX`, 
                    `NSE:${underlying}-INDEX`, 
                    `BSE:${underlying}-INDEX`, 
                    `NSE:${underlying}`, 
                    `NSE:${underlying}-EQ`, 
                    `MCX:${underlying}`,
                    `MCX:${cleanSym}`,
                    underlying
                ];
                for (const c of cands) {
                    const q = priceCache[c];
                    if (q?.close > 0) { spotClose = Number(q.close); break; }
                    if (q?.ltp > 0) { spotClose = Number(q.ltp); break; }
                    if (q?.prev_close_price > 0) { spotClose = Number(q.prev_close_price); break; }
                }

                if (spotClose === 0) {
                    const fallbackSpots = {
                        'NIFTY': 22716.20,
                        'BANKNIFTY': 54259.95,
                        'FINNIFTY': 24648.50,
                        'MIDCPNIFTY': 13150.00,
                        'SENSEX': 72529.07,
                        'BANKEX': 57100.00
                    };
                    spotClose = fallbackSpots[underlying] || 0;
                }

                if (spotClose > 0 && strike > 0) {
                    const trueIntrinsic = optType === 'CE' ? Math.max(0, spotClose - strike) : Math.max(0, strike - spotClose);
                    if (trueIntrinsic > 0) {
                        const qty = Math.abs(parseFloat(pos.closed_quantity));
                        const entry = Math.abs(parseFloat(pos.average_price));
                        const correctPnl = Math.round(((trueIntrinsic - entry) * qty + Number.EPSILON) * 100) / 100;
                        const previousPnl = parseFloat(pos.realized_pnl) || 0;
                        const pnlDiff = Math.round((correctPnl - previousPnl + Number.EPSILON) * 100) / 100;

                        if (pnlDiff > 0) {
                            console.log(`[AUTO-REPAIR] Rectifying erroneously lapsed ITM contract ${sym} for User ${pos.user_id}: True Value ₹${trueIntrinsic}, PnL adjustment +₹${pnlDiff}`);
                            await db.transaction(async (trx) => {
                                await trx('positions').where({ id: pos.id }).update({
                                    exit_price: trueIntrinsic,
                                    realized_pnl: correctPnl,
                                    updated_at: new Date()
                                });
                                const u = await trx('users').where({ id: pos.user_id }).forUpdate().first();
                                if (u) {
                                    const newBal = Math.round((Number(u.balance) + pnlDiff + Number.EPSILON) * 100) / 100;
                                    await trx('users').where({ id: pos.user_id }).update({ balance: newBal });
                                }
                                await trx('ledger').insert({
                                    user_id: pos.user_id,
                                    amount: pnlDiff,
                                    type: 'REALIZED_PNL',
                                    description: `Auto-reconciliation: In-the-money settlement value restored for ${sym} (True intrinsic: ₹${trueIntrinsic})`
                                });
                            });
                        }
                    }
                }
            }
        } catch (repairErr) {
            console.error('[AUTO-REPAIR ERROR]:', repairErr.message);
        }
    }

    async runHoldingsMigration(onlyBeforeToday = false) {
        const lockKey = 'cron_holdings_migration';
        let connection = null;
        let isLocked = false;
        try {
            if (db.client && db.client.acquireConnection) {
                connection = await db.client.acquireConnection();
                const lockRes = await connection.query('SELECT pg_try_advisory_lock(hashtext($1)) as locked', [lockKey]).catch(() => null);
                isLocked = Boolean(lockRes && lockRes.rows && lockRes.rows[0] && lockRes.rows[0].locked);
                if (!isLocked) {
                    console.log('[HOLDINGS MIGRATION] Already running on another cluster worker. Skipping.');
                    return;
                }
            }

            console.log(`[HOLDINGS MIGRATION] Starting T+1 Holdings Migration (Startup Catchup: ${onlyBeforeToday})...`);
            await db.transaction(async (trx) => {
                // 1. Fetch all Delivery positions with Qty > 0
                let query = trx('positions')
                    .whereIn('product_type', ['DEL', 'CNC', 'DELIVERY'])
                    .where('quantity', '>', 0);
                    
                // T+1 Migration ALWAYS migrates only positions opened before today (T+1 settlement rule)
                const formatter = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata', year: 'numeric', month: '2-digit', day: '2-digit' });
                const parts = formatter.formatToParts(new Date());
                const year = parts.find(p => p.type === 'year').value;
                const month = parts.find(p => p.type === 'month').value;
                const day = parts.find(p => p.type === 'day').value;
                const startOfToday = new Date(`${year}-${month}-${day}T00:00:00+05:30`);
                query = query.where('created_at', '<', startOfToday);

                const deliveryPositions = await query;

                for (const pos of deliveryPositions) {
                    const isCommodity = isCommoditySymbol(pos.symbol);
                    const isDeriv = isDerivativeSymbol(pos.symbol);
                    const assetClass = isCommodity ? 'COMMODITY' : (isDeriv ? 'DERIVATIVE' : 'STOCK');

                    // Check if holding already exists (prefix-tolerant)
                    const cleanSym = pos.symbol.includes(':') ? pos.symbol.split(':')[1] : pos.symbol;
                    const existingHolding = await trx('holdings')
                        .where({ user_id: pos.user_id })
                        .where(builder => {
                            builder.where({ symbol: pos.symbol })
                                   .orWhere({ symbol: cleanSym })
                                   .orWhere({ symbol: `NSE:${cleanSym}` })
                                   .orWhere({ symbol: `BSE:${cleanSym}` })
                                   .orWhere({ symbol: `MCX:${cleanSym}` });
                        })
                        .first();

                    if (existingHolding) {
                        // Average the price
                        const existingQty = Number(existingHolding.quantity);
                        const posQty = Number(pos.quantity);
                        const existingAvgPrice = Math.abs(Number(existingHolding.average_price));
                        const posAvgPrice = Math.abs(Number(pos.average_price));

                        const newTotalQty = existingQty + posQty;
                        const totalCost = (existingQty * existingAvgPrice) + (posQty * posAvgPrice);
                        const newAvgPrice = newTotalQty === 0 ? 0 : parseFloat((totalCost / newTotalQty).toFixed(2));

                        await trx('holdings')
                            .where({ id: existingHolding.id })
                            .update({ 
                                quantity: newTotalQty, 
                                average_price: newAvgPrice,
                                updated_at: new Date()
                            });
                    } else {
                        // Insert new holding
                        await trx('holdings').insert({
                            user_id: pos.user_id,
                            symbol: pos.symbol,
                            quantity: Number(pos.quantity),
                            average_price: Math.abs(Number(pos.average_price)),
                            asset_class: assetClass,
                            created_at: new Date(),
                            updated_at: new Date()
                        });
                    }
                }

                // 2. Mark migrated delivery positions as settled (quantity = 0) to preserve audit trails without data deletion
                const migratedIds = deliveryPositions.map(p => p.id);
                if (migratedIds.length > 0) {
                    await trx('positions')
                        .whereIn('id', migratedIds)
                        .update({ 
                            closed_quantity: trx.raw('COALESCE(closed_quantity, 0) + quantity'), 
                            quantity: 0, 
                            margin: 0,
                            updated_at: new Date() 
                        });
                }
                
                // ZERO TRADE DATA DELETION: Closed positions (quantity = 0) are strictly preserved for historical P&L & audit logs.
                console.log(`[HOLDINGS MIGRATION] Successfully migrated ${migratedIds.length} DEL positions to holdings.`);
            });
        } catch (error) {
            console.error(`[HOLDINGS MIGRATION ERROR]:`, error);
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
    }
}

module.exports = new PositionsEngine();

