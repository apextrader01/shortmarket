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
    const priceCache = getPriceFromCache();
    const missing = [...new Set(symbols)].filter(sym => !priceCache[sym]?.ltp);
    
    if (missing.length > 0) {
        console.log(`[EOD] Fetching live prices for ${missing.length} offline symbols via REST...`);
        try {
            const fetchedQuotes = await fetchBatchLTPs(missing);
            if (fetchedQuotes && typeof fetchedQuotes === 'object') {
                for (const [sym, data] of Object.entries(fetchedQuotes)) {
                    if (data && data.ltp) {
                        priceCache[sym] = { ltp: data.ltp };
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
                    console.log('⏰ [BOOT CATCHUP] Past 03:40 PM IST — running immediate catchup expiry settlement...');
                    this.settleExpiries(false).catch(e => console.error('Startup catchup expiry error:', e));
                }
            } catch(e) {}
        }, 20000);
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
            // Step A: Cancel PENDING entry orders for INT/BO/CO
            const pendingEntryOrders = await db('orders')
                .where('status', 'PENDING')
                .whereIn('product_type', ['INT', 'BO', 'CO']);

            for (const order of pendingEntryOrders) {
                const isCommodity = isCommoditySymbol(order.symbol);
                if ((market === 'EQUITY' && !isCommodity) || (market === 'COMMODITY' && isCommodity)) {
                    await db.transaction(async (trx) => {
                        const updated = await trx('orders')
                            .where({ id: order.id, status: 'PENDING' })
                            .update({ status: 'CANCELLED', updated_at: new Date() });

                        if (updated > 0) {
                            if (parseFloat(order.margin) > 0) {
                                await LedgerService.releaseMargin(trx, order.user_id, order.margin, `EOD sweep: margin refunded for ${order.symbol}`);
                            }
                            triggerEngine.removeOrderFromMemory(order.id, order.symbol);
                            console.log(`[EOD SWEEP] Cancelled PENDING Entry ${order.id} (${order.symbol})`);
                        }
                    });
                }
            }

            // Step B: Cancel PENDING_TRIGGER legs (BO/CO SL & Target orders)
            const pendingTriggerOrders = await db('orders')
                .where('status', 'PENDING_TRIGGER')
                .whereIn('product_type', ['INT', 'BO', 'CO']);

            for (const order of pendingTriggerOrders) {
                const isCommodity = isCommoditySymbol(order.symbol);
                if ((market === 'EQUITY' && !isCommodity) || (market === 'COMMODITY' && isCommodity)) {
                    await db.transaction(async (trx) => {
                        const updated = await trx('orders')
                            .where({ id: order.id, status: 'PENDING_TRIGGER' })
                            .update({ status: 'CANCELLED', updated_at: new Date() });

                        if (updated > 0) {
                            if (parseFloat(order.margin) > 0) {
                                await LedgerService.releaseMargin(trx, order.user_id, order.margin, `EOD sweep: margin refunded for ${order.symbol}`);
                            }
                            triggerEngine.removeOrderFromMemory(order.id, order.symbol);
                            console.log(`[EOD SWEEP] Cancelled PENDING_TRIGGER Leg ${order.id} (${order.symbol})`);
                        }
                    });
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
                    .whereIn('product_type', ['INT', 'BO', 'CO']);
                    
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
                    if (!ltp || ltp <= 0) {
                        ltp = Number(pos.average_price) || 0;
                    }
                    if (ltp <= 0) {
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
                    .whereIn('product_type', ['INT', 'BO', 'CO']);

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
            let posQuery = db('positions').whereNot({ quantity: 0 });
            let holdQuery = db('holdings').whereNot({ quantity: 0 });
            let orderQuery = db('orders').whereIn('status', ['PENDING', 'PENDING_TRIGGER']);
            
            if (isCommodity) {
                posQuery = posQuery.where('symbol', 'like', '%MCX%');
                holdQuery = holdQuery.where('symbol', 'like', '%MCX%');
                orderQuery = orderQuery.where('symbol', 'like', '%MCX%');
            } else {
                posQuery = posQuery.whereNot('symbol', 'like', '%MCX%');
                holdQuery = holdQuery.whereNot('symbol', 'like', '%MCX%');
                orderQuery = orderQuery.whereNot('symbol', 'like', '%MCX%');
            }

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

            const expiringPositions = (await posQuery).filter(p => isActuallyExpiringToday(p.symbol));
            const expiringHoldings = (await holdQuery).filter(h => isActuallyExpiringToday(h.symbol));
            const expiringOrders = (await orderQuery).filter(o => isActuallyExpiringToday(o.symbol));

            // Globally cancel all open orders for expiring contracts
            for (const stale of expiringOrders) {
                await db.transaction(async (trx) => {
                    if (stale.margin > 0) {
                        const user = await trx('users').where({ id: stale.user_id }).first();
                        if (user) {
                            await trx('users').where({ id: stale.user_id }).update({
                                balance: Number(user.balance) + Number(stale.margin)
                            });
                            await trx('ledger').insert({
                                user_id: stale.user_id,
                                amount: Number(stale.margin),
                                type: 'MARGIN_RELEASE',
                                description: `Margin refunded: expiry settlement cancelled open order for ${stale.symbol}`
                            });
                        }
                    }
                    await trx('orders').where({ id: stale.id }).update({ status: 'CANCELLED', updated_at: new Date() });
                    triggerEngine.removeOrderFromMemory(stale.id, stale.symbol);
                    console.log(`[EXPIRY SETTLE] Cancelled pending order ${stale.id} globally for expiring ${stale.symbol}`);
                });
            }

            const allSymbols = [...expiringPositions.map(p => p.symbol), ...expiringHoldings.map(h => h.symbol)];
            
            // Extract underlying symbols to ensure their spot closing prices are in cache for intrinsic value settlement
            const spotSymbolsToFetch = [];
            for (const sym of allSymbols) {
                const cleanSym = sym.replace(/^(NSE:|BSE:|MCX:)/i, '');
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

                if (isOpt) {
                    // Option cash settlement at intrinsic value
                    let optType = null;
                    let strike = 0;
                    let underlying = null;

                    const monthlyMatch = cleanSym.match(/^([A-Z0-9]+?)(\d{2})(JAN|FEB|MAR|APR|MAY|JUN|JUL|AUG|SEP|OCT|NOV|DEC)(\d+)(CE|PE)$/i);
                    if (monthlyMatch) {
                        underlying = monthlyMatch[1];
                        strike = parseFloat(monthlyMatch[4]);
                        optType = monthlyMatch[5].toUpperCase();
                    } else {
                        const weeklyMatch = cleanSym.match(/^([A-Z0-9]+?)(\d{2})([1-9OND])(\d{2})(\d+)(CE|PE)$/i);
                        if (weeklyMatch) {
                            underlying = weeklyMatch[1];
                            strike = parseFloat(weeklyMatch[5]);
                            optType = weeklyMatch[6].toUpperCase();
                        } else {
                            const genMatch = cleanSym.match(/([A-Z0-9]+).*?(\d{3,6})(CE|PE)$/i);
                            if (genMatch) {
                                underlying = genMatch[1];
                                strike = parseFloat(genMatch[2]);
                                optType = genMatch[3].toUpperCase();
                            }
                        }
                    }

                    let spotPrice = 0;
                    if (underlying) {
                        const candidates = [
                            underlying,
                            `${underlying}-NSE`,
                            `${underlying}-BSE`,
                            `NSE:${underlying}`,
                            `NSE:${underlying}-INDEX`,
                            `NSE:${underlying}50-INDEX`,
                            `NSE:${underlying}BANK-INDEX`,
                            `NSE:${underlying}-EQ`,
                            `BSE:${underlying}`,
                            `BSE:${underlying}-INDEX`
                        ];
                        for (const cand of candidates) {
                            if (priceCache[cand]?.ltp > 0) {
                                spotPrice = Number(priceCache[cand].ltp);
                                break;
                            }
                        }
                    }

                    if (spotPrice > 0 && strike > 0 && optType) {
                        if (optType === 'CE') {
                            ltp = Math.max(0, spotPrice - strike);
                        } else {
                            ltp = Math.max(0, strike - spotPrice);
                        }
                    } else {
                        const cachedLtp = priceCache[item.symbol]?.ltp;
                        ltp = (cachedLtp !== undefined && cachedLtp !== null) ? Number(cachedLtp) : 0;
                    }
                } else {
                    const cachedLtp = priceCache[item.symbol]?.ltp;
                    ltp = (cachedLtp !== undefined && cachedLtp !== null) ? Number(cachedLtp) : 0;
                }

                ltp = Math.max(0, parseFloat(Number(ltp).toFixed(2)));

                // Defect 32: Direct position lapse at ₹0 without creating synthetic orders or fees on worthless OTM options
                if (isOpt && ltp === 0) {
                    await db.transaction(async (trx) => {
                        await trx.raw('SELECT pg_advisory_xact_lock(?)', [item.user_id]);
                        if (isHolding) {
                            await trx('holdings').where({ id: item.id }).del();
                        } else {
                            const entryPrice = parseFloat(item.average_price) || 0;
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

                            if (marginBlocked > 0) {
                                const u = await trx('users').where({ id: item.user_id }).forUpdate().first();
                                if (u) {
                                    await trx('users').where({ id: item.user_id }).update({ balance: Math.round((parseFloat(u.balance) + marginBlocked + Number.EPSILON) * 100) / 100 });
                                    await trx('ledger').insert({
                                        user_id: item.user_id,
                                        amount: marginBlocked,
                                        type: 'MARGIN_RELEASE',
                                        description: `Margin released on expired worthless contract: ${item.symbol}`
                                    });
                                }
                            }
                            if (realizedPnl !== 0) {
                                await trx('ledger').insert({
                                    user_id: item.user_id,
                                    amount: realizedPnl,
                                    type: 'REALIZED_PNL',
                                    description: `Realized loss on expired worthless contract: ${item.symbol}`
                                });
                            }
                        }
                    });
                    console.log(`[EXPIRY LAPSED AT ₹0] ${item.symbol} lapsed without charges for User ${item.user_id}`);
                    return;
                }

                // Defect 31: SEBI physical delivery vs cash settlement segregation
                const isIndex = ['NIFTY', 'BANKNIFTY', 'FINNIFTY', 'MIDCPNIFTY', 'SENSEX', 'BANKEX'].includes(underlying?.toUpperCase());
                const settlementRemark = isIndex ? 'Cash Settlement at Expiry' : 'Physical Delivery Settlement at Expiry (SEBI)';

                const [orderId] = await db('orders').insert({
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
                }).returning('id');

                const orderRow = await db('orders').where({ id: orderId.id || orderId }).first();
                orderRow.is_rms = false;
                await triggerEngine.executeOrder(orderRow, ltp, { bypassVolumeMatching: true });
                console.log(`[EXPIRY SETTLED] ${item.symbol} (${side} ${orderQty} @ ${ltp}) for User ${item.user_id}`);
            };

            for (const pos of expiringPositions) {
                await submitSettlementOrder(pos, false);
            }
            for (const hold of expiringHoldings) {
                await submitSettlementOrder(hold, true);
            }
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
                    .whereIn('product_type', ['DEL', 'CNC'])
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
                    // Exclude derivative contracts from migrating into equity stock holdings
                    if (isDerivativeSymbol(pos.symbol)) continue;

                    const isCommodity = isCommoditySymbol(pos.symbol);
                    const assetClass = isCommodity ? 'COMMODITY' : 'STOCK';

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
                        const existingAvgPrice = Number(existingHolding.average_price);
                        const posAvgPrice = Number(pos.average_price);

                        const newTotalQty = existingQty + posQty;
                        const totalCost = (existingQty * existingAvgPrice) + (posQty * posAvgPrice);
                        const newAvgPrice = newTotalQty === 0 ? 0 : parseFloat((totalCost / newTotalQty).toFixed(2));

                        await trx('holdings')
                            .where({ id: existingHolding.id })
                            .update({ quantity: newTotalQty, average_price: newAvgPrice });
                    } else {
                        // Insert new holding
                        await trx('holdings').insert({
                            user_id: pos.user_id,
                            symbol: pos.symbol,
                            quantity: Number(pos.quantity),
                            average_price: Number(pos.average_price),
                            asset_class: assetClass
                        });
                    }
                }

                // 2. Mark migrated delivery positions as settled (quantity = 0) to preserve audit trails without data deletion
                const migratedIds = deliveryPositions.filter(p => !isDerivativeSymbol(p.symbol)).map(p => p.id);
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

