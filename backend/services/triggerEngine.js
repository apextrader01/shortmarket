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
                if (order.type === 'MARKET') {
                    shouldExecute = true;
                } else if (order.type === 'LIMIT') {
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
                    console.error('Execution Error:', err);
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
            const totalTaxes = await LedgerService.chargeExecutionTaxes(trx, order.user_id, order.symbol, order.product_type, order.side, Number(order.quantity), execPrice);
            
            await trx('orders').where({ id: order.id }).update({ 
                status: 'EXECUTED',
                price: execPrice,
                taxes: totalTaxes
            });

            // 2. Position Logic
            const existingPos = await trx('positions')
                .where({ user_id: order.user_id, symbol: order.symbol, product_type: order.product_type })
                .whereNot({ quantity: 0 }).first();
            
            const qtyChange = order.side === 'BUY' ? Number(order.quantity) : -Number(order.quantity);

            // Helper to handle inserting new positions or offsetting holdings
            const handleRemainingPos = async (trx, remainingQty, execPrice) => {
                if (order.product_type === 'DEL' && remainingQty < 0) {
                    const holding = await trx('holdings').where({ user_id: order.user_id, symbol: order.symbol }).first();
                    if (holding && holding.quantity > 0) {
                        const offsetQty = Math.min(Math.abs(remainingQty), holding.quantity);
                        
                        // Deduct from holding or remove row if sold out
                        const newHoldingQty = holding.quantity - offsetQty;
                        if (newHoldingQty <= 0) {
                            await trx('holdings').where({ id: holding.id }).del();
                        } else {
                            await trx('holdings').where({ id: holding.id }).update({ quantity: newHoldingQty });
                        }
                        
                        // Create a CLOSED position record for today
                        const realizedPnl = (execPrice - holding.average_price) * offsetQty;
                        await trx('positions').insert({
                            user_id: order.user_id,
                            symbol: order.symbol,
                            quantity: 0,
                            closed_quantity: offsetQty,
                            average_price: holding.average_price,
                            exit_price: execPrice,
                            realized_pnl: realizedPnl,
                            product_type: 'DEL',
                            updated_at: new Date()
                        });
                        
                        // Update Balance and Ledger with Realized P&L
                        if (realizedPnl !== 0) {
                            const user = await trx('users').where({ id: order.user_id }).first();
                            await trx('users').where({ id: order.user_id }).update({ balance: Number(user.balance) + realizedPnl });
                            await trx('ledger').insert({
                                user_id: order.user_id, amount: realizedPnl, type: 'REALIZED_PNL', description: `Realized P&L for exiting holding ${offsetQty} ${order.symbol}`
                            });
                        }
                        
                        remainingQty += offsetQty; // e.g. -15 + 10 = -5
                    }
                }
                
                // If there's still a remaining quantity, insert an OPEN position
                if (remainingQty !== 0) {
                    await trx('positions').insert({
                        user_id: order.user_id, symbol: order.symbol, quantity: remainingQty,
                        average_price: execPrice, product_type: order.product_type,
                        margin: Number(order.margin || 0), updated_at: new Date()
                    });
                }
            };

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
                        await handleRemainingPos(trx, remainingQty, execPrice);
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
                // Create new position (or offset holdings)
                await handleRemainingPos(trx, qtyChange, execPrice);
            }

            // 3. Bracket Order (CO/BO) Leg Generation
            await this.spawnBracketLegs(trx, order);

            // 4. OCO (One Cancels Other) Logic for BO
            if (order.parent_order_id) {
                const siblings = await trx('orders')
                    .where({ parent_order_id: order.parent_order_id, status: 'PENDING_TRIGGER' })
                    .whereNot({ id: order.id });
                
                for (const sibling of siblings) {
                    await trx('orders').where({ id: sibling.id }).update({ status: 'CANCELLED' });
                    this.removeOrderFromMemory(sibling.id, sibling.symbol);
                }
            }
            
            console.log(`[TRIGGER ENGINE] Executed Order ${order.id} for ${order.symbol} at ${execPrice}`);
            
            if (this.io) {
                this.io.to(order.user_id.toString()).emit('sync_user_data');
            }
        });
    }

    async spawnBracketLegs(trx, order) {
        const { spawnBracketOrders } = require('./orderExecutor');
        await spawnBracketOrders(trx, order);
    }
}

module.exports = new TriggerEngine();
