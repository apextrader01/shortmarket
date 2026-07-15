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
        
        // 95% MTM Liquidation Check (Asynchronous, decoupled from tick blocking)
        this.check95PercentMTMLiquidation(symbol, ltp).catch(err => console.error('MTM Check Error:', err));
    }

    async check95PercentMTMLiquidation(symbol, ltp) {
        // Find all users who have an open position in this symbol
        const affectedUsers = await db('positions')
            .where({ symbol })
            .whereNot({ quantity: 0 })
            .distinct('user_id')
            .pluck('user_id');

        for (const userId of affectedUsers) {
            // Get all open positions for this user
            const opens = await db('positions')
                .where({ user_id: userId })
                .whereNot({ quantity: 0 });

            let totalUnrealizedPnL = 0;
            for (const pos of opens) {
                const currentPrice = pos.symbol === symbol ? ltp : parseFloat(pos.average_price); // Approximation for other symbols without live tick
                const qty = pos.quantity;
                const entryPrice = parseFloat(pos.average_price);
                
                if (qty > 0) {
                    totalUnrealizedPnL += (currentPrice - entryPrice) * qty;
                } else if (qty < 0) {
                    totalUnrealizedPnL += (entryPrice - currentPrice) * Math.abs(qty);
                }
            }

            if (totalUnrealizedPnL < 0) {
                const user = await db('users').where({ id: userId }).first();
                const availableBalance = parseFloat(user.balance);
                const maxLossLimit = availableBalance * 0.95;

                if (Math.abs(totalUnrealizedPnL) >= maxLossLimit) {
                    console.error(`EMERGENCY 95% MARGIN CALL TRIGGERED FOR USER ${userId}`);
                    await this.triggerRMSSquareOff(userId);
                }
            }
        }
    }

    async triggerRMSSquareOff(userId) {
        await db.transaction(async (trx) => {
            // 1. Close all open positions with RMS penalty
            const opens = await trx('positions').where({ user_id: userId }).whereNot({ quantity: 0 });
            for (const pos of opens) {
                // To close long, sell at market. To close short, buy at market.
                // Since this is emergency, we assume exit price is current average price or tick price if we had it.
                // We'll just exit at average_price to avoid complex live price fetching here, but it triggers the RMS penalty.
                await LedgerService.closePosition(trx, userId, pos.id, parseFloat(pos.average_price), true);
            }

            // 2. Cancel all pending orders
            const pendings = await trx('orders')
                .where({ user_id: userId })
                .whereIn('status', ['PENDING', 'PENDING_TRIGGER']);

            for (const order of pendings) {
                await trx('orders').where({ id: order.id }).update({ status: 'CANCELLED' });
                this.removeOrderFromMemory(order.id, order.symbol);
                if (order.status === 'PENDING') {
                    await LedgerService.releaseMargin(trx, userId, parseFloat(order.margin || 0), `Margin released from RMS cancelled order ${order.symbol}`);
                }
            }
        });
        
        if (this.io) {
            this.io.to(userId.toString()).emit('rms_alert', { message: 'EMERGENCY 95% MARGIN CALL TRIGGERED. All positions squared off.' });
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
