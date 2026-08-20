const db = require('../database/db');
const cron = require('node-cron');
const triggerEngine = require('./triggerEngine');

const COMMODITIES = ['CRUDEOIL', 'GOLD', 'SILVER', 'NATURALGAS', 'COPPER', 'ZINC', 'LEAD', 'ALUMINIUM', 'MENTHAOIL', 'COTTON'];

class PositionsEngine {
    constructor() {
        console.log('PositionsEngine Initialized (EOD Automation)');
        this.initCronJobs();
        // Run catchup migration on startup (in case the server was down at 8:00 AM)
        setTimeout(() => {
            if (process.env.NODE_APP_INSTANCE === '0' || !process.env.NODE_APP_INSTANCE) {
                this.runHoldingsMigration(true);
            }
        }, 15000);
    }

    initCronJobs() {
        // HOLDINGS MIGRATION (T+1)
        // Phase 0: The 8:00 AM Wipe - 08:00 AM IST
        cron.schedule('0 8 * * *', () => {
            this.runHoldingsMigration();
        }, { timezone: 'Asia/Kolkata' });

        // EQUITIES
        // Phase 2: The Order Sweep - 03:19 PM IST (15:19)
        cron.schedule('19 15 * * *', () => {
            this.sweepPendingOrders('EQUITY');
        }, { timezone: 'Asia/Kolkata' });

        // Phase 3: The Square-Off - 03:20 PM IST (15:20)
        cron.schedule('20 15 * * *', () => {
            this.forceSquareOff('EQUITY');
        }, { timezone: 'Asia/Kolkata' });

        // Condition 10: Expiry Day Settlement (Equities/Derivatives) - 03:25 PM
        cron.schedule('25 15 * * *', () => {
            this.settleExpiries(false); // false = Not Commodity
        }, { timezone: 'Asia/Kolkata' });

        // COMMODITIES
        // Phase 2: The Order Sweep - 10:59 PM IST (22:59)
        cron.schedule('59 22 * * *', () => {
            this.sweepPendingOrders('COMMODITY');
        }, { timezone: 'Asia/Kolkata' });

        // Phase 3: The Square-Off - 11:00 PM IST (23:00)
        cron.schedule('0 23 * * *', () => {
            this.forceSquareOff('COMMODITY');
        }, { timezone: 'Asia/Kolkata' });

        // Condition 10: Expiry Day Settlement (Commodities) - 07:00 PM (19:00)
        cron.schedule('0 19 * * *', () => {
            this.settleExpiries(true); // true = Commodity
        }, { timezone: 'Asia/Kolkata' });
    }

    async sweepPendingOrders(market) {
        console.log(`[EOD SWEEP] Starting Phase 2 Sweep for ${market}...`);
        try {
            // Step A: Cancel PENDING entry orders for INT/BO/CO
            const pendingEntryOrders = await db('orders')
                .where('status', 'PENDING')
                .whereIn('product_type', ['INT', 'BO', 'CO']);

            for (const order of pendingEntryOrders) {
                const isCommodity = COMMODITIES.some(c => order.symbol.startsWith(c));
                if ((market === 'EQUITY' && !isCommodity) || (market === 'COMMODITY' && isCommodity)) {
                    await db.transaction(async (trx) => {
                        // Refund Margin
                        if (order.margin > 0) {
                            const user = await trx('users').where({ id: order.user_id }).first();
                            await trx('users').where({ id: order.user_id }).update({ balance: Number(user.balance) + Number(order.margin) });
                            await trx('ledger').insert({
                                user_id: order.user_id, amount: Number(order.margin),
                                type: 'MARGIN_RELEASE', description: `EOD sweep: margin refunded for ${order.symbol} ${order.side}`
                            });
                        }
                        await trx('orders').where({ id: order.id }).update({ status: 'CANCELLED', updated_at: new Date() });
                        triggerEngine.removeOrderFromMemory(order.id, order.symbol);
                        console.log(`[EOD SWEEP] Cancelled PENDING Entry ${order.id} (${order.symbol})`);
                    });
                }
            }

            // BUG FIX 2: Also cancel PENDING_TRIGGER legs (BO/CO SL & Target orders).
            // Previously only PENDING was cancelled, leaving SL/Target legs alive overnight
            // which could fire incorrectly on the next morning's price gap.
            const pendingTriggerOrders = await db('orders')
                .where('status', 'PENDING_TRIGGER')
                .whereIn('product_type', ['INT', 'BO', 'CO']);

            for (const order of pendingTriggerOrders) {
                const isCommodity = COMMODITIES.some(c => order.symbol.startsWith(c));
                if ((market === 'EQUITY' && !isCommodity) || (market === 'COMMODITY' && isCommodity)) {
                    await db.transaction(async (trx) => {
                        // BO/CO legs usually have margin: 0 (margin held on parent) but check anyway
                        if (order.margin > 0) {
                            const user = await trx('users').where({ id: order.user_id }).first();
                            await trx('users').where({ id: order.user_id }).update({ balance: Number(user.balance) + Number(order.margin) });
                        }
                        await trx('orders').where({ id: order.id }).update({ status: 'CANCELLED', updated_at: new Date() });
                        triggerEngine.removeOrderFromMemory(order.id, order.symbol);
                        console.log(`[EOD SWEEP] Cancelled PENDING_TRIGGER Leg ${order.id} (${order.symbol})`);
                    });
                }
            }
        } catch (error) {
            console.error(`[EOD SWEEP ERROR] ${market}:`, error);
        }
    }

    async forceSquareOff(market) {
        console.log(`[EOD SQUARE-OFF] Starting Phase 3 Square-Off for ${market}...`);
        try {
            // BUG FIX 1: Load real LTP from price cache.
            // Previously called evaluateTick(symbol, 0) which caused ALL pending
            // buy limit orders to trigger (ZRANGEBYSCORE >= 0 matches everything).
            // Now we directly call executeOrder() with the actual price.
            const { getPriceFromCache } = require('./fyers');
            const priceCache = getPriceFromCache();

            // 1. Force Market Exit for Open Positions
            const positions = await db('positions')
                .whereNot('quantity', 0)
                .whereIn('product_type', ['INT', 'BO', 'CO']);

            for (const pos of positions) {
                const isCommodity = COMMODITIES.some(c => pos.symbol.startsWith(c));
                if ((market === 'EQUITY' && !isCommodity) || (market === 'COMMODITY' && isCommodity)) {
                    const exitSide = pos.quantity > 0 ? 'SELL' : 'BUY';
                    const exitQty = Math.abs(pos.quantity);
                    // Use real LTP; fall back to average price if no live price available
                    const ltp = priceCache[pos.symbol]?.ltp || Number(pos.average_price) || 0;

                    try {
                        const [orderId] = await db('orders').insert({
                            user_id: pos.user_id,
                            symbol: pos.symbol,
                            type: 'MARKET',
                            side: exitSide,
                            quantity: exitQty,
                            price: ltp || null,
                            status: 'PENDING',
                            product_type: pos.product_type,
                            margin: 0,
                            is_rms: true,
                            created_at: new Date(),
                            updated_at: new Date()
                        }).returning('id');

                        const orderIdVal = typeof orderId === 'object' ? orderId.id : orderId;
                        const orderRow = await db('orders').where({ id: orderIdVal }).first();
                        orderRow.is_rms = true;

                        // Directly execute the exit order — avoids touching other pending orders
                        await triggerEngine.executeOrder(orderRow, ltp || Number(pos.average_price));
                        console.log(`[EOD SQUARE-OFF] Forced exit for ${pos.symbol} qty=${exitQty} @ ${ltp}`);
                    } catch (execErr) {
                        console.error(`[EOD SQUARE-OFF] Failed to exit ${pos.symbol}:`, execErr.message);
                    }
                }
            }

            // 2. Safety net: cancel any remaining PENDING_TRIGGER legs that executeOrder may have missed
            // (executeOrder cancels siblings only when position reaches qty=0, partial closes may leave orphans)
            const pendingTriggers = await db('orders')
                .where('status', 'PENDING_TRIGGER')
                .whereIn('product_type', ['INT', 'BO', 'CO']);

            for (const leg of pendingTriggers) {
                const isCommodity = COMMODITIES.some(c => leg.symbol.startsWith(c));
                if ((market === 'EQUITY' && !isCommodity) || (market === 'COMMODITY' && isCommodity)) {
                    await db('orders').where({ id: leg.id }).update({ status: 'CANCELLED', updated_at: new Date() });
                    triggerEngine.removeOrderFromMemory(leg.id, leg.symbol);
                    console.log(`[EOD SQUARE-OFF] Cancelled orphan PENDING_TRIGGER leg ${leg.id} (${leg.symbol})`);
                }
            }
        } catch (error) {
            console.error(`[EOD SQUARE-OFF ERROR] ${market}:`, error);
        }
    }

    async settleExpiries(isCommodity) {
        console.log(`[CRON] Condition 10: Expiry Day Settlement triggered (Commodity: ${isCommodity}).`);
        try {
            const todayStr = new Date().toLocaleString('en-GB', { timeZone: 'Asia/Kolkata' }).split(',')[0].replace(/\//g, '-');
            const [d, m, y] = todayStr.split('-');
            const monthMap = { '01':'JAN', '02':'FEB', '03':'MAR', '04':'APR', '05':'MAY', '06':'JUN', '07':'JUL', '08':'AUG', '09':'SEP', '10':'OCT', '11':'NOV', '12':'DEC' };
            const monthCharMap = { '01': '1', '02': '2', '03': '3', '04': '4', '05': '5', '06': '6', '07': '7', '08': '8', '09': '9', '10': 'O', '11': 'N', '12': 'D' };
            
            const expiryToken1 = `${d}${monthMap[m]}${y.slice(-2)}`; // e.g. 13AUG26 (Standard)
            const expiryToken2 = `${y.slice(-2)}${monthCharMap[m]}${d}`; // e.g. 26813 (Fyers Weekly)

            const formatter = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata', year: 'numeric', month: '2-digit', day: '2-digit' });
            const parts = formatter.formatToParts(new Date());
            const yearPart = parts.find(p => p.type === 'year').value;
            const monthPart = parts.find(p => p.type === 'month').value;
            const dayPart = parts.find(p => p.type === 'day').value;
            const startOfToday = new Date(`${yearPart}-${monthPart}-${dayPart}T00:00:00+05:30`).getTime();
            const endOfToday = new Date(`${yearPart}-${monthPart}-${dayPart}T23:59:59.999+05:30`).getTime();
            
            const expiringInstruments = await db('instruments')
                .where('expiry_timestamp', '>=', startOfToday)
                .where('expiry_timestamp', '<=', endOfToday)
                .select('unique_symbol');
            const expiringUniqueSymbols = expiringInstruments.map(i => i.unique_symbol);

            // Find all expiring assets in Holdings OR Positions
            let posQuery = db('positions').whereNot({ quantity: 0 }).where(function() {
                this.where('symbol', 'like', `%${expiryToken1}%`)
                    .orWhere('symbol', 'like', `%${expiryToken2}%`)
                    .orWhereIn('symbol', expiringUniqueSymbols);
            });
            let holdQuery = db('holdings').whereNot({ quantity: 0 }).where(function() {
                this.where('symbol', 'like', `%${expiryToken1}%`)
                    .orWhere('symbol', 'like', `%${expiryToken2}%`)
                    .orWhereIn('symbol', expiringUniqueSymbols);
            });
            
            // Cancel ALL pending open orders for expiring symbols globally (even if user has no position)
            let orderQuery = db('orders').whereIn('status', ['PENDING', 'PENDING_TRIGGER']).where(function() {
                this.where('symbol', 'like', `%${expiryToken1}%`)
                    .orWhere('symbol', 'like', `%${expiryToken2}%`)
                    .orWhereIn('symbol', expiringUniqueSymbols);
            });
            
            if (isCommodity) {
                posQuery = posQuery.where('symbol', 'like', '%MCX%');
                holdQuery = holdQuery.where('symbol', 'like', '%MCX%');
                orderQuery = orderQuery.where('symbol', 'like', '%MCX%');
            } else {
                posQuery = posQuery.whereNot('symbol', 'like', '%MCX%');
                holdQuery = holdQuery.whereNot('symbol', 'like', '%MCX%');
                orderQuery = orderQuery.whereNot('symbol', 'like', '%MCX%');
            }

            const expiringPositions = await posQuery;
            const expiringHoldings = await holdQuery;
            const expiringOrders = await orderQuery;

            // Globally cancel all open orders for expiring contracts
            for (const stale of expiringOrders) {
                await db.transaction(async (trx) => {
                    if (stale.margin > 0) {
                        const user = await trx('users').where({ id: stale.user_id }).first();
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
                    await trx('orders').where({ id: stale.id }).update({ status: 'CANCELLED', updated_at: new Date() });
                    triggerEngine.removeOrderFromMemory(stale.id, stale.symbol);
                    console.log(`[EXPIRY SETTLE] Cancelled pending order ${stale.id} globally for expiring ${stale.symbol}`);
                });
            }

            const { getPriceFromCache } = require('./fyers');
            const priceCache = getPriceFromCache();
            
            // Helper to submit settlement order
            const submitSettlementOrder = async (item, isHolding) => {
                const ltp = priceCache[item.symbol]?.ltp || Number(item.average_price) || 0;
                const side = item.quantity > 0 ? 'SELL' : 'BUY';
                const orderQty = Math.abs(item.quantity);
                const prodType = isHolding ? 'DEL' : item.product_type;

                // BUG FIX 5: Store actual LTP in price field (not 0) so order history shows correct price
                const [orderId] = await db('orders').insert({
                    user_id: item.user_id,
                    symbol: item.symbol,
                    type: 'MARKET',
                    side: side,
                    quantity: orderQty,
                    price: ltp,
                    status: 'PENDING',
                    product_type: prodType,
                    is_rms: true,
                    created_at: new Date(),
                    updated_at: new Date()
                }).returning('id');

                const orderRow = await db('orders').where({ id: orderId.id || orderId }).first();
                orderRow.is_rms = true;
                await triggerEngine.executeOrder(orderRow, ltp);
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
        }
    }

    async runHoldingsMigration(onlyBeforeToday = false) {
        console.log(`[HOLDINGS MIGRATION] Starting T+1 Holdings Migration (Startup Catchup: ${onlyBeforeToday})...`);
        try {
            await db.transaction(async (trx) => {
                // 1. Fetch all Delivery positions with Qty > 0
                let query = trx('positions')
                    .whereIn('product_type', ['DEL', 'CNC'])
                    .where('quantity', '>', 0);
                    
                if (onlyBeforeToday) {
                    const formatter = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata', year: 'numeric', month: '2-digit', day: '2-digit' });
                    const parts = formatter.formatToParts(new Date());
                    const year = parts.find(p => p.type === 'year').value;
                    const month = parts.find(p => p.type === 'month').value;
                    const day = parts.find(p => p.type === 'day').value;
                    const startOfToday = new Date(`${year}-${month}-${day}T00:00:00+05:30`);
                    query = query.where('created_at', '<', startOfToday);
                }

                const deliveryPositions = await query;

                for (const pos of deliveryPositions) {
                    const isCommodity = COMMODITIES.some(c => pos.symbol.startsWith(c));
                    const assetClass = isCommodity ? 'COMMODITY' : 'STOCK';

                    // Check if holding already exists
                    const existingHolding = await trx('holdings')
                        .where({ user_id: pos.user_id, symbol: pos.symbol })
                        .first();

                    if (existingHolding) {
                        // Average the price
                        const existingQty = Number(existingHolding.quantity);
                        const posQty = Number(pos.quantity);
                        const existingAvgPrice = Number(existingHolding.average_price);
                        const posAvgPrice = Number(pos.average_price);

                        const newTotalQty = existingQty + posQty;
                        const totalCost = (existingQty * existingAvgPrice) + (posQty * posAvgPrice);
                        const newAvgPrice = newTotalQty === 0 ? 0 : totalCost / newTotalQty;

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

                // 2. Wipe the positions table to clear UI history
                // Wipe the DEL positions we successfully migrated
                const migratedIds = deliveryPositions.map(p => p.id);
                if (migratedIds.length > 0) {
                    await trx('positions').whereIn('id', migratedIds).del();
                }
                
                // Wipe ANY remaining closed/intraday positions from yesterday to clear UI
                const formatter = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata', year: 'numeric', month: '2-digit', day: '2-digit' });
                const parts = formatter.formatToParts(new Date());
                const year = parts.find(p => p.type === 'year').value;
                const month = parts.find(p => p.type === 'month').value;
                const day = parts.find(p => p.type === 'day').value;
                const startOfToday = new Date(`${year}-${month}-${day}T00:00:00+05:30`);
                await trx('positions').where('created_at', '<', startOfToday).del();
                
                console.log(`[HOLDINGS MIGRATION] Successfully migrated ${deliveryPositions.length} DEL positions and wiped old history.`);
            });
        } catch (error) {
            console.error(`[HOLDINGS MIGRATION ERROR]:`, error);
        }
    }
}

module.exports = new PositionsEngine();

