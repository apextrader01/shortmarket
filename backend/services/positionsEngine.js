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
        // EQUITIES
        // Phase 2: The Order Sweep - 03:19 PM IST (15:19)
        cron.schedule('19 15 * * *', () => {
            this.sweepPendingOrders('EQUITY');
        }, { timezone: 'Asia/Kolkata' });

        // Phase 3: The Square-Off - 03:20 PM IST (15:20)
        cron.schedule('20 15 * * *', () => {
            this.forceSquareOff('EQUITY');
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
                        await trx('orders').where({ id: order.id }).update({ status: 'CANCELLED' });
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
                        margin: 0 // No margin required to exit
                    }).returning('id');
                    
                    const orderIdVal = typeof orderId === 'object' ? orderId.id : orderId;

                    triggerEngine.addOrderToMemory({
                        id: orderIdVal, user_id: pos.user_id, symbol: pos.symbol, type: 'MARKET', side: exitSide,
                        quantity: exitQty, price: null, status: 'PENDING', product_type: pos.product_type, margin: 0
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
}

module.exports = new PositionsEngine();
