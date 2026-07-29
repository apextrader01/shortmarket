const db = require('../database/db');
const cron = require('node-cron');
const triggerEngine = require('./triggerEngine');

const COMMODITIES = ['CRUDEOIL', 'GOLD', 'SILVER', 'NATURALGAS', 'COPPER', 'ZINC', 'LEAD', 'ALUMINIUM', 'MENTHAOIL', 'COTTON'];

class PositionsEngine {
    constructor() {
        console.log('PositionsEngine Initialized (EOD Automation)');
        this.initCronJobs();
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
            const query = db('orders')
                .where('status', 'PENDING')
                .whereIn('product_type', ['INT', 'BO', 'CO']);

            const orders = await query;
            
            for (const order of orders) {
                const isCommodity = COMMODITIES.some(c => order.symbol.startsWith(c));
                if ((market === 'EQUITY' && !isCommodity) || (market === 'COMMODITY' && isCommodity)) {
                    await db.transaction(async (trx) => {
                        // Refund Margin
                        if (order.margin > 0) {
                            const user = await trx('users').where({ id: order.user_id }).first();
                            await trx('users').where({ id: order.user_id }).update({ balance: Number(user.balance) + Number(order.margin) });
                        }
                        await trx('orders').where({ id: order.id }).update({ status: 'CANCELLED', updated_at: new Date() });
                        triggerEngine.removeOrderFromMemory(order.id, order.symbol);
                        console.log(`[EOD SWEEP] Cancelled Pending Entry Order ${order.id} (${order.symbol})`);
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
            // 1. Force Market Exit for Open Positions
            const positions = await db('positions')
                .whereNot('quantity', 0)
                .whereIn('product_type', ['INT', 'BO', 'CO']);

            for (const pos of positions) {
                const isCommodity = COMMODITIES.some(c => pos.symbol.startsWith(c));
                if ((market === 'EQUITY' && !isCommodity) || (market === 'COMMODITY' && isCommodity)) {
                    const exitSide = pos.quantity > 0 ? 'SELL' : 'BUY';
                    const exitQty = Math.abs(pos.quantity);
                    
                    const [orderId] = await db('orders').insert({
                        user_id: pos.user_id,
                        symbol: pos.symbol,
                        type: 'MARKET',
                        side: exitSide,
                        quantity: exitQty,
                        price: null,
                        status: 'PENDING',
                        product_type: pos.product_type,
                        margin: 0, // No margin required to exit
                        is_rms: true // Flag for RMS penalty
                    }).returning('id');
                    
                    const orderIdVal = typeof orderId === 'object' ? orderId.id : orderId;

                    triggerEngine.addOrderToMemory({
                        id: orderIdVal, user_id: pos.user_id, symbol: pos.symbol, type: 'MARKET', side: exitSide,
                        quantity: exitQty, price: null, status: 'PENDING', product_type: pos.product_type, margin: 0, is_rms: true
                    });

                    // Kick evaluation immediately
                    triggerEngine.evaluateTick(pos.symbol, 0).catch(err => console.error(err));
                    console.log(`[EOD SQUARE-OFF] Forced Market Exit for ${pos.symbol} (${exitQty} Qty)`);
                }
            }

            // 2. Cancel Un-Triggered Legs in Pending Triggers
            const pendingTriggers = await db('orders')
                .where('status', 'PENDING_TRIGGER')
                .whereIn('product_type', ['INT', 'BO', 'CO']);

            for (const leg of pendingTriggers) {
                const isCommodity = COMMODITIES.some(c => leg.symbol.startsWith(c));
                if ((market === 'EQUITY' && !isCommodity) || (market === 'COMMODITY' && isCommodity)) {
                    await db('orders').where({ id: leg.id }).update({ status: 'CANCELLED' });
                    triggerEngine.removeOrderFromMemory(leg.id, leg.symbol);
                    console.log(`[EOD SQUARE-OFF] Cancelled Pending Trigger Leg ${leg.id} (${leg.symbol})`);
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
            const expiryToken = `${d}${monthMap[m]}${y.slice(-2)}`; // e.g. 14JUL26

            // Find all expiring assets in Holdings OR Positions
            let posQuery = db('positions').whereNot({ quantity: 0 }).where('symbol', 'like', `%${expiryToken}%`);
            let holdQuery = db('holdings').whereNot({ quantity: 0 }).where('symbol', 'like', `%${expiryToken}%`);
            
            if (isCommodity) {
                posQuery = posQuery.where('symbol', 'like', '%MCX%');
                holdQuery = holdQuery.where('symbol', 'like', '%MCX%');
            } else {
                posQuery = posQuery.whereNot('symbol', 'like', '%MCX%');
                holdQuery = holdQuery.whereNot('symbol', 'like', '%MCX%');
            }

            const expiringPositions = await posQuery;
            const expiringHoldings = await holdQuery;

            const triggerEngine = require('./triggerEngine');
            const { getPriceCache } = require('./angelOne');
            const priceCache = getPriceCache() || {}; 
            
            // Helper to submit market order
            const submitSettlementOrder = async (item, isHolding) => {
                const ltp = priceCache[item.symbol]?.ltp || item.average_price; 
                const side = item.quantity > 0 ? 'SELL' : 'BUY';
                const orderQty = Math.abs(item.quantity);
                const prodType = isHolding ? 'DEL' : item.product_type;

                const [orderId] = await db('orders').insert({
                    user_id: item.user_id,
                    symbol: item.symbol,
                    type: 'MARKET',
                    side: side,
                    quantity: orderQty,
                    price: 0,
                    status: 'PENDING',
                    product_type: prodType,
                    is_rms: true,
                    created_at: new Date(),
                    updated_at: new Date()
                }).returning('id');

                const orderRow = await db('orders').where({ id: orderId.id || orderId }).first();
                orderRow.is_rms = true; // Inject it into memory for triggerEngine
                await triggerEngine.executeOrder(orderRow, ltp);
                console.log(`[EXPIRY SETTLED] ${item.symbol} (${side} ${orderQty}) for User ${item.user_id}`);
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

    async runHoldingsMigration() {
        console.log(`[8:00 AM WIPE] Starting T+1 Holdings Migration...`);
        try {
            await db.transaction(async (trx) => {
                // 1. Fetch all Delivery positions with Qty > 0
                const deliveryPositions = await trx('positions')
                    .where('product_type', 'DEL')
                    .where('quantity', '>', 0);

                for (const pos of deliveryPositions) {
                    const isCommodity = COMMODITIES.some(c => pos.symbol.startsWith(c));
                    const assetClass = isCommodity ? 'COMMODITY' : 'STOCK';

                    // Check if holding already exists
                    const existingHolding = await trx('holdings')
                        .where({ user_id: pos.user_id, symbol: pos.symbol })
                        .first();

                    if (existingHolding) {
                        // Average the price
                        const newTotalQty = existingHolding.quantity + pos.quantity;
                        const totalCost = (existingHolding.quantity * existingHolding.average_price) + (pos.quantity * pos.average_price);
                        const newAvgPrice = totalCost / newTotalQty;

                        await trx('holdings')
                            .where({ id: existingHolding.id })
                            .update({ quantity: newTotalQty, average_price: newAvgPrice });
                    } else {
                        // Insert new holding
                        await trx('holdings').insert({
                            user_id: pos.user_id,
                            symbol: pos.symbol,
                            quantity: pos.quantity,
                            average_price: pos.average_price,
                            asset_class: assetClass
                        });
                    }
                }

                // 2. Completely wipe the positions table to clear UI history
                await trx('positions').del();
                console.log(`[8:00 AM WIPE] Successfully migrated ${deliveryPositions.length} DEL positions and wiped today's history.`);
            });
        } catch (error) {
            console.error(`[8:00 AM WIPE ERROR]:`, error);
        }
    }
}

module.exports = new PositionsEngine();
