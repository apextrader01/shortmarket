const db = require('../database/db');
const LedgerService = require('./ledgerService');
const { calculateTaxes } = require('./taxCalculator');

class TriggerEngine {
    constructor() {
        this.activeTriggers = new Map(); // symbol -> [order_objects]
        this.isProcessing = false;
        this.io = null;
        console.log('Real-Time WebSocket Trigger Engine Initialized.');
    }
    
    setSocketIo(ioInstance) {
        this.io = ioInstance;
    }

    /**
     * Load all PENDING and PENDING_TRIGGER orders from DB into memory.
     */
    async loadPendingOrders() {
        try {
            const orders = await db('orders').whereIn('status', ['PENDING', 'PENDING_TRIGGER']);
            this.activeTriggers.clear();
            
            for (const order of orders) {
                this.addOrderToMemory(order);
            }
            console.log(`Loaded ${orders.length} active triggers into memory.`);
        } catch (err) {
            console.error('Failed to load pending orders into TriggerEngine:', err);
        }
    }

    addOrderToMemory(order) {
        const triggers = this.activeTriggers.get(order.symbol) || [];
        // Ensure no duplicates
        const existingIdx = triggers.findIndex(o => o.id === order.id);
        if (existingIdx >= 0) {
            triggers[existingIdx] = order;
        } else {
            triggers.push(order);
        }
        this.activeTriggers.set(order.symbol, triggers);
    }

    removeOrderFromMemory(orderId, symbol) {
        const triggers = this.activeTriggers.get(symbol);
        if (triggers) {
            const filtered = triggers.filter(o => o.id !== orderId);
            if (filtered.length === 0) {
                this.activeTriggers.delete(symbol);
            } else {
                this.activeTriggers.set(symbol, filtered);
            }
        }
    }

    /**
     * Evaluates a live LTP tick from the WebSocket.
     */
    async evaluateTick(symbol, ltp) {
        if (!ltp) return;
        const triggers = this.activeTriggers.get(symbol);
        if (!triggers || triggers.length === 0) return;

        for (const order of triggers) {
            let shouldExecute = false;

            if (order.status === 'PENDING') {
                // Limit Orders
                if (order.type === 'LIMIT') {
                    if (order.side === 'BUY' && ltp <= order.price) shouldExecute = true;
                    if (order.side === 'SELL' && ltp >= order.price) shouldExecute = true;
                }
            } else if (order.status === 'PENDING_TRIGGER') {
                // Stop Loss or Target legs for CO/BO
                const trigger = Number(order.trigger_price);
                if (order.side === 'BUY') {
                    if (order.type.startsWith('SL') && ltp >= trigger) shouldExecute = true; // Stop Loss Hit
                    if (order.type === 'LIMIT' && ltp <= trigger) shouldExecute = true; // Target Hit
                } else if (order.side === 'SELL') {
                    if (order.type.startsWith('SL') && ltp <= trigger) shouldExecute = true; // Stop Loss Hit
                    if (order.type === 'LIMIT' && ltp >= trigger) shouldExecute = true; // Target Hit
                }
            }

            if (shouldExecute) {
                // Remove from memory immediately to prevent double-execution while DB processes
                this.removeOrderFromMemory(order.id, symbol);
                this.executeOrder(order, ltp).catch(err => {
                    console.error(`Failed to execute triggered order ${order.id}:`, err);
                    // On failure, re-add to memory to try again on next tick
                    this.addOrderToMemory(order);
                });
            }
        }
    }

    async executeOrder(order, execPrice) {
        await db.transaction(async (trx) => {
            // Verify order is still pending in DB
            const dbOrder = await trx('orders').where({ id: order.id }).first();
            if (!dbOrder || (dbOrder.status !== 'PENDING' && dbOrder.status !== 'PENDING_TRIGGER')) {
                return; 
            }

            // 1. Mark Executed & Deduct Taxes
            const taxesObj = calculateTaxes(order.symbol, order.product_type, order.side, Number(order.quantity), execPrice);
            const totalTaxes = taxesObj.totalTaxes;
            
            await trx('orders').where({ id: order.id }).update({ 
                status: 'EXECUTED',
                price: execPrice,
                taxes: totalTaxes
            });

            // Update user balance and ledger for taxes
            const user = await trx('users').where({ id: order.user_id }).first();
            await trx('users').where({ id: order.user_id }).update({ balance: parseFloat(user.balance) - totalTaxes });
            await trx('ledger').insert({
                user_id: order.user_id,
                amount: -totalTaxes,
                type: 'TAXES',
                description: `Taxes & Charges for ${order.side} ${order.quantity} ${order.symbol}`
            });

            // 2. Position Logic
            const existingPos = await trx('positions')
                .where({ user_id: order.user_id, symbol: order.symbol, product_type: order.product_type })
                .whereNot({ quantity: 0 }).first();
            
            const qtyChange = order.side === 'BUY' ? Number(order.quantity) : -Number(order.quantity);

            if (existingPos) {
                // Calculate if closing or averaging
                let isPartialClose = false;
                if ((existingPos.quantity > 0 && order.side === 'SELL') || (existingPos.quantity < 0 && order.side === 'BUY')) {
                    isPartialClose = true;
                }

                if (isPartialClose) {
                    const absQty = Math.abs(Number(order.quantity));
                    const absPosQty = Math.abs(existingPos.quantity);
                    const closeQty = Math.min(absQty, absPosQty);
                    
                    // Close the position
                    const { realizedPnl, exitTaxes, rmsPenalty, netRelease } = await LedgerService.closePosition(trx, order.user_id, existingPos.id, execPrice, false);
                    await trx('orders').where({ id: order.id }).update({ realized_pnl: realizedPnl });

                    // If order quantity exceeds existing position (Reverse Position)
                    if (absQty > absPosQty) {
                        const remainingQty = order.side === 'BUY' ? (absQty - absPosQty) : -(absQty - absPosQty);
                        await trx('positions').insert({
                            user_id: order.user_id,
                            symbol: order.symbol,
                            quantity: remainingQty,
                            average_price: execPrice,
                            product_type: order.product_type,
                            margin: order.margin || 0,
                            updated_at: new Date()
                        });
                    }
                } else {
                    // Averaging
                    const currentTotal = Math.abs(existingPos.quantity) * existingPos.average_price;
                    const newTotal = Math.abs(Number(order.quantity)) * execPrice;
                    const newQty = existingPos.quantity + qtyChange;
                    const newAvgPrice = (currentTotal + newTotal) / Math.abs(newQty);
                    
                    await trx('positions').where({ id: existingPos.id }).update({
                        quantity: newQty,
                        average_price: newAvgPrice,
                        margin: parseFloat(existingPos.margin) + Number(order.margin || 0),
                        updated_at: new Date()
                    });
                }
            } else {
                // Create new position
                await trx('positions').insert({
                    user_id: order.user_id,
                    symbol: order.symbol,
                    quantity: qtyChange,
                    average_price: execPrice,
                    product_type: order.product_type,
                    margin: Number(order.margin || 0),
                    updated_at: new Date()
                });
            }

            // 3. Bracket Order (CO/BO) Leg Generation
            await this.spawnBracketLegs(trx, order);

            // 4. OCO (One Cancels Other) Logic for BO
            if (order.linked_order_id) {
                const sibling = await trx('orders').where({ id: order.linked_order_id, status: 'PENDING_TRIGGER' }).first();
                if (sibling) {
                    await trx('orders').where({ id: sibling.id }).update({ status: 'CANCELLED' });
                    this.removeOrderFromMemory(sibling.id, sibling.symbol);
                    // Free the margin blocked by the sibling (Wait, brackets don't block additional margin since they close)
                }
            }
            
            console.log(`[TRIGGER ENGINE] Executed Order ${order.id} for ${order.symbol} at ${execPrice}`);
            
            if (this.io) {
                this.io.to(order.user_id.toString()).emit('sync_user_data');
            }
        });
    }

    async spawnBracketLegs(trx, order) {
        const isCO = order.trigger_type === 'CO';
        const isBO = order.trigger_type === 'BO';
        if (!isCO && !isBO) return;

        const childSide = order.side === 'BUY' ? 'SELL' : 'BUY';
        let slOrderId = null;
        let tgtOrderId = null;

        // Generate Stop Loss Leg
        if (order.sl_price) {
            const [slId] = await trx('orders').insert({
                user_id: order.user_id,
                symbol: order.symbol,
                type: 'SL-M',
                side: childSide,
                quantity: order.quantity,
                status: 'PENDING_TRIGGER',
                trigger_price: order.sl_price,
                trail_amount: order.trail_amount,
                product_type: order.product_type,
                trigger_type: order.trigger_type,
                parent_order_id: order.id,
                margin: 0
            }).returning('*');
            slOrderId = slId;
            this.addOrderToMemory(slId);
        }

        // Generate Target Leg (BO only)
        if (isBO && order.tgt_price) {
            const [tgtId] = await trx('orders').insert({
                user_id: order.user_id,
                symbol: order.symbol,
                type: 'LIMIT',
                side: childSide,
                quantity: order.quantity,
                status: 'PENDING_TRIGGER',
                trigger_price: order.tgt_price, // Treating limit tgt as trigger
                product_type: order.product_type,
                trigger_type: order.trigger_type,
                parent_order_id: order.id,
                margin: 0
            }).returning('*');
            tgtOrderId = tgtId;
            this.addOrderToMemory(tgtId);
        }

        // Link OCO
        if (slOrderId && tgtOrderId) {
            await trx('orders').where({ id: slOrderId.id || slOrderId }).update({ linked_order_id: tgtOrderId.id || tgtOrderId });
            await trx('orders').where({ id: tgtOrderId.id || tgtOrderId }).update({ linked_order_id: slOrderId.id || slOrderId });
            this.addOrderToMemory(await trx('orders').where({ id: slOrderId.id || slOrderId }).first());
            this.addOrderToMemory(await trx('orders').where({ id: tgtOrderId.id || tgtOrderId }).first());
        }
    }
}

module.exports = new TriggerEngine();
