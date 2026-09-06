const { sendPushNotification } = require('./pushService');
const { sendTelegramAlert } = require('./telegramService');
const db = require('../database/db');
const LedgerService = require('./ledgerService');
const { calculateTaxes } = require('./taxCalculator');

class TriggerEngine {
    constructor() {
        this.activeTriggers = new Map(); // symbol -> [order_objects]
        this.activeTriggerSymbols = new Set(); // ⚡ In-memory active trigger symbols filter
        this.isProcessing = false;
        this.io = null;
        console.log('Real-Time WebSocket Trigger Engine Initialized.');
    }
    
    setSocketIo(ioInstance) {
        this.io = ioInstance;
    }

    /**
     * Load all PENDING and PENDING_TRIGGER orders from DB into Redis ZSETs.
     */
    async loadPendingOrders() {
        try {
            const orders = await db('orders').whereIn('status', ['PENDING', 'PENDING_TRIGGER']);
            
            // Clear existing triggers in Redis
            const { generalClient } = require('./redisClient');
            if (generalClient && generalClient.isReady) {
                const keys = await generalClient.keys('trigger:*');
                if (keys.length > 0) {
                    await generalClient.del(keys);
                }
            }
            
            this.activeTriggerSymbols.clear();
            for (const order of orders) {
                await this.addOrderToMemory(order);
                if (order.symbol) this.activeTriggerSymbols.add(order.symbol);
            }
            console.log(`Loaded ${orders.length} active triggers into Redis ZSETs across ${this.activeTriggerSymbols.size} symbols.`);
        } catch (err) {
            console.error('Failed to load pending orders into TriggerEngine:', err);
        }
    }

    async addOrderToMemory(order) {
        const { generalClient } = require('./redisClient');
        if (!generalClient || !generalClient.isReady || !order) return;
        
        let key = null;
        let score = null;
        
        if (order.status === 'PENDING') {
            if (order.type === 'LIMIT') {
                key = `trigger:${order.symbol}:${order.side}:LIMIT`;
                score = Number(order.price);
            } else if (order.type === 'MARKET') {
                // Market orders should execute immediately, they won't normally sit in PENDING for ticks.
                // But if they do, we can just give them a 0 (Buy) or Infinity (Sell) score to trigger instantly.
                key = `trigger:${order.symbol}:${order.side}:LIMIT`;
                score = order.side === 'BUY' ? 999999999 : 0;
            } else if (order.type && (order.type.startsWith('SL') || order.type === 'GTT' || order.type === 'TRAILING_STOP')) {
                const trigger = Number(order.trigger_price || order.price);
                let isGreaterOrEqual = false;
                if (order.side === 'BUY' && order.type.startsWith('SL')) isGreaterOrEqual = true;
                if (order.side === 'SELL' && order.type === 'LIMIT') isGreaterOrEqual = true;
                key = isGreaterOrEqual ? `trigger:${order.symbol}:GTE` : `trigger:${order.symbol}:LTE`;
                score = trigger;
            }
        } else if (order.status === 'PENDING_TRIGGER') {
            const trigger = Number(order.trigger_price || order.price);
            if (order.type && (order.type.startsWith('SL') || order.type === 'LIMIT' || order.type === 'GTT' || order.type === 'TRAILING_STOP')) {
                // Determine if this leg triggers on >= or <=
                // Buy SL triggers when LTP >= Trigger
                // Sell SL triggers when LTP <= Trigger
                // Buy Target (LIMIT) triggers when LTP <= Target
                // Sell Target (LIMIT) triggers when LTP >= Target
                let isGreaterOrEqual = false;
                if (order.side === 'BUY' && order.type.startsWith('SL')) isGreaterOrEqual = true;
                if (order.side === 'SELL' && order.type === 'LIMIT') isGreaterOrEqual = true;
                
                if (isGreaterOrEqual) {
                    key = `trigger:${order.symbol}:GTE`;
                } else {
                    key = `trigger:${order.symbol}:LTE`;
                }
                score = trigger;
            }
        }

        if (key && score !== null && !isNaN(score)) {
            // Remove from any other sets first to prevent duplicates
            await this.removeOrderFromMemory(order.id, order.symbol);
            await generalClient.zAdd(key, [{ score: score, value: order.id.toString() }]);
            if (order.symbol) this.activeTriggerSymbols.add(order.symbol);
        }
    }

    async removeOrderFromMemory(orderId, symbol) {
        const { generalClient } = require('./redisClient');
        if (!generalClient || !generalClient.isReady) return;
        
        // We just attempt to remove it from all 4 possible sets to be safe
        const keys = [
            `trigger:${symbol}:BUY:LIMIT`,
            `trigger:${symbol}:SELL:LIMIT`,
            `trigger:${symbol}:GTE`,
            `trigger:${symbol}:LTE`
        ];
        
        for (const key of keys) {
            await generalClient.zRem(key, orderId.toString());
        }
        let totalRem = 0;
        for (const key of keys) {
            totalRem += (await generalClient.zCard(key).catch(() => 0));
        }
        if (totalRem === 0) {
            this.activeTriggerSymbols.delete(symbol);
        }
    }

    /**
     * Evaluates a live LTP tick using a blazing fast O(log N) Redis Lua Script.
     * This atomically finds triggered orders and removes them from Redis.
     */
    async evaluateTick(symbol, ltp) {
        if (!ltp || !symbol) return;
        // ⚡ Blazing fast O(1) in-memory check: skip Redis if NO triggers exist for this symbol!
        if (!this.activeTriggerSymbols.has(symbol)) return;
        const { generalClient } = require('./redisClient');
        if (!generalClient || !generalClient.isReady) return;

        const luaScript = `
            local results = {}
            
            -- Buy Limit (Execute if LTP <= Target) -> Score >= LTP
            local buy_limits = redis.call('ZRANGEBYSCORE', KEYS[1], ARGV[1], '+inf')
            if #buy_limits > 0 then
                redis.call('ZREMRANGEBYSCORE', KEYS[1], ARGV[1], '+inf')
                for i=1, #buy_limits do table.insert(results, buy_limits[i]) end
            end
            
            -- Sell Limit (Execute if LTP >= Target) -> Score <= LTP
            local sell_limits = redis.call('ZRANGEBYSCORE', KEYS[2], '-inf', ARGV[1])
            if #sell_limits > 0 then
                redis.call('ZREMRANGEBYSCORE', KEYS[2], '-inf', ARGV[1])
                for i=1, #sell_limits do table.insert(results, sell_limits[i]) end
            end
            
            -- GTE Triggers (Execute if LTP >= Trigger) -> Score <= LTP
            local gte_triggers = redis.call('ZRANGEBYSCORE', KEYS[3], '-inf', ARGV[1])
            if #gte_triggers > 0 then
                redis.call('ZREMRANGEBYSCORE', KEYS[3], '-inf', ARGV[1])
                for i=1, #gte_triggers do table.insert(results, gte_triggers[i]) end
            end
            
            -- LTE Triggers (Execute if LTP <= Trigger) -> Score >= LTP
            local lte_triggers = redis.call('ZRANGEBYSCORE', KEYS[4], ARGV[1], '+inf')
            if #lte_triggers > 0 then
                redis.call('ZREMRANGEBYSCORE', KEYS[4], ARGV[1], '+inf')
                for i=1, #lte_triggers do table.insert(results, lte_triggers[i]) end
            end
            
            return results
        `;

        try {
            const keys = [
                `trigger:${symbol}:BUY:LIMIT`,
                `trigger:${symbol}:SELL:LIMIT`,
                `trigger:${symbol}:GTE`,
                `trigger:${symbol}:LTE`
            ];
            
            // eval(script, options) in node-redis v4
            const triggeredOrderIds = await generalClient.eval(luaScript, {
                keys: keys,
                arguments: [ltp.toString()]
            });

            if (triggeredOrderIds && triggeredOrderIds.length > 0) {
                // Check if symbol still has remaining triggers in Redis
                const remaining = (await generalClient.zCard(`trigger:${symbol}:BUY:LIMIT`).catch(()=>0)) +
                                  (await generalClient.zCard(`trigger:${symbol}:SELL:LIMIT`).catch(()=>0)) +
                                  (await generalClient.zCard(`trigger:${symbol}:GTE`).catch(()=>0)) +
                                  (await generalClient.zCard(`trigger:${symbol}:LTE`).catch(()=>0));
                if (remaining === 0) {
                    this.activeTriggerSymbols.delete(symbol);
                }

                for (const orderId of triggeredOrderIds) {
                    const order = await db('orders').where({ id: orderId }).first();
                    if (order) {
                        this.executeOrder(order, ltp).catch(err => {
                            console.error('Execution Error:', err);
                            // On failure, re-add to Redis to try again on next tick
                            this.addOrderToMemory(order);
                        });
                    }
                }
            }
        } catch (err) {
            console.error('Redis Lua Trigger Error:', err.message);
        }
    }



    async executeOrder(order, execPrice) {
        await db.transaction(async (trx) => {
            // Serialize order executions on a per-user basis to prevent position/ledger race conditions
            await trx.raw('SELECT pg_advisory_xact_lock(?)', [order.user_id]);

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
                taxes: totalTaxes,
                updated_at: new Date()
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
                        const principalAmount = holding.average_price * offsetQty;
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
                        
                        // Update Balance and Ledger with Principal, Realized P&L and RMS Penalty
                        const rmsPenalty = order.is_rms ? 59 : 0;
                        const user = await trx('users').where({ id: order.user_id }).first();
                        await trx('users').where({ id: order.user_id }).update({ balance: Number(user.balance) + principalAmount + realizedPnl - rmsPenalty });
                        
                        await trx('ledger').insert({
                            user_id: order.user_id, amount: principalAmount, type: 'HOLDING_RELEASE', description: `Holding value released for ${offsetQty} ${order.symbol}`
                        });
                        await trx('orders').where({ id: order.id }).update({ realized_pnl: realizedPnl });
                        if (realizedPnl !== 0) {
                            await trx('ledger').insert({
                                user_id: order.user_id, amount: realizedPnl, type: 'REALIZED_PNL', description: `Realized P&L for exiting holding ${offsetQty} ${order.symbol}`
                            });
                        }
                        if (rmsPenalty > 0) {
                            await trx('ledger').insert({
                                user_id: order.user_id, amount: -rmsPenalty, type: 'RMS_PENALTY', description: `Auto-Square-Off RMS Penalty for holding ${order.symbol}`
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
                // Ensure Postgres decimal strings are converted to numbers to prevent string concatenation bugs (e.g. "10.0000" + 1 = "10.00001")
                existingPos.quantity = Number(existingPos.quantity);
                existingPos.average_price = Number(existingPos.average_price);
                existingPos.margin = Number(existingPos.margin || 0);
                
                // Calculate if closing or averaging
                let isPartialClose = false;
                if ((existingPos.quantity > 0 && order.side === 'SELL') || (existingPos.quantity < 0 && order.side === 'BUY')) {
                    isPartialClose = true;
                }

                if (isPartialClose) {
                    const absQty = Math.abs(Number(order.quantity));
                    const absPosQty = Math.abs(existingPos.quantity);
                    const closeQty = Math.min(absQty, absPosQty);
                    
                    let realizedPnl = 0;
                    if (existingPos.quantity > 0) {
                        realizedPnl = (execPrice - existingPos.average_price) * closeQty;
                    } else {
                        realizedPnl = (existingPos.average_price - execPrice) * closeQty;
                    }
                    
                    const proportionClosed = closeQty / absPosQty;
                    const marginRefund = (existingPos.margin || 0) * proportionClosed;
                    const newMargin = (existingPos.margin || 0) - marginRefund;
                    
                    const newQty = existingPos.quantity + qtyChange;
                    
                    // Close the position
                    if (newQty === 0) {
                        await trx('positions').where({ id: existingPos.id }).update({ 
                           quantity: 0, 
                           closed_quantity: (parseFloat(existingPos.closed_quantity) || 0) + closeQty, 
                           exit_price: execPrice, 
                           margin: 0,
                           realized_pnl: (parseFloat(existingPos.realized_pnl) || 0) + realizedPnl,
                           updated_at: new Date()
                        });
                        // Cancel dangling pending and trigger orders for this specific product type
                        const danglingOrders = await trx('orders')
                            .where({ user_id: order.user_id, symbol: order.symbol, product_type: order.product_type })
                            .whereIn('status', ['PENDING', 'PENDING_TRIGGER']);
                            
                        for (const dangler of danglingOrders) {
                            await trx('orders').where({ id: dangler.id }).update({ status: 'CANCELLED', updated_at: new Date() });
                            const refundMargin = parseFloat(dangler.margin) || 0;
                            if (refundMargin > 0) {
                                const user = await trx('users').where({ id: order.user_id }).first();
                                if (user) {
                                    await trx('users').where({ id: order.user_id }).update({ balance: Number(user.balance) + refundMargin });
                                    await trx('ledger').insert({
                                        user_id: order.user_id,
                                        amount: refundMargin,
                                        type: 'MARGIN_RELEASE',
                                        description: `Margin released for cancelled dangling order ${dangler.symbol}`
                                    });
                                }
                            }
                            this.removeOrderFromMemory(dangler.id, dangler.symbol);
                        }
                    } else {
                        await trx('positions').where({ id: existingPos.id }).update({
                           quantity: newQty,
                           margin: newMargin,
                           closed_quantity: (parseFloat(existingPos.closed_quantity) || 0) + closeQty,
                           exit_price: execPrice,
                           realized_pnl: (parseFloat(existingPos.realized_pnl) || 0) + realizedPnl,
                           updated_at: new Date()
                        });
                    }

                    // Update Ledger for realized P&L and margin refund
                    const isRMS = order.is_rms || false;
                    const rmsPenalty = isRMS ? 59 : 0;
                    let balanceChange = realizedPnl + marginRefund - rmsPenalty;
                    
                    if (marginRefund > 0) {
                        await trx('ledger').insert({ user_id: order.user_id, amount: marginRefund, type: 'MARGIN_RELEASE', description: `Margin released for closing ${closeQty} ${order.symbol}` });
                    }
                    await trx('orders').where({ id: order.id }).update({ realized_pnl: realizedPnl });
                    if (realizedPnl !== 0) {
                        await trx('ledger').insert({ user_id: order.user_id, amount: realizedPnl, type: 'REALIZED_PNL', description: `Realized P&L for ${order.symbol}` });
                    }
                    if (rmsPenalty > 0) {
                        await trx('ledger').insert({ user_id: order.user_id, amount: -rmsPenalty, type: 'RMS_PENALTY', description: `RMS Penalty for ${order.symbol}` });
                    }
                    
                    const user = await trx('users').where({ id: order.user_id }).first();
                    await trx('users').where({ id: order.user_id }).update({ balance: Number(user.balance) + balanceChange });

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
                    await trx('orders').where({ id: sibling.id }).update({ status: 'CANCELLED', updated_at: new Date() });
                    this.removeOrderFromMemory(sibling.id, sibling.symbol);
                }
            }
            
            console.log(`[TRIGGER ENGINE] Executed Order ${order.id} for ${order.symbol} at ${execPrice}`);
            
            if (this.io) {
                this.io.to(order.user_id.toString()).emit('sync_user_data');
                const isSL = order.type === 'SL-M' || order.type === 'SL-L' || (order.remarks && (order.remarks.includes('SL') || order.remarks.includes('Stop Loss')));
                const isTgt = order.remarks && (order.remarks.includes('Target') || order.remarks.includes('TGT'));
                const alertEvent = isSL ? 'SL_HIT' : isTgt ? 'TARGET_HIT' : 'EXECUTED';
                
                this.io.to(order.user_id.toString()).emit('trade_alert', {
                    event: alertEvent,
                    symbol: order.symbol,
                    price: execPrice,
                    qty: order.quantity,
                    side: order.side
                });

                // Dispatch Telegram alert asynchronously
                const tgType = isSL ? 'STOPLOSS' : isTgt ? 'TARGET' : 'ORDER';
                sendTelegramAlert(order.user_id, tgType, {
                    symbol: order.symbol,
                    side: order.side,
                    quantity: order.quantity,
                    price: execPrice,
                    exit_price: execPrice,
                    product_type: order.product_type
                }).catch(() => {});
            }
            
        });
        
        // Broadcast to other PM2 workers to sync their trigger memory (AFTER transaction commits)
        try {
            const { pubClient } = require('./redisClient');
            if (pubClient) pubClient.publish('reload_triggers', '1').catch(e=>{});
        } catch (e) {}
    }

    async spawnBracketLegs(trx, order) {
        const { spawnBracketOrders } = require('./orderExecutor');
        await spawnBracketOrders(trx, order);
    }
}

module.exports = new TriggerEngine();
