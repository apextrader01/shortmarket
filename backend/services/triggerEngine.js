const { sendPushNotification } = require('./pushService');
const { sendTelegramAlert } = require('./telegramService');
const db = require('../database/db');
const LedgerService = require('./ledgerService');
const { calculateTaxes } = require('./taxCalculator');

function isDerivativeSymbol(symbol) {
    if (!symbol || typeof symbol !== 'string') return false;
    const clean = symbol.replace(/^(NSE:|BSE:|MCX:)/i, '');
    return /(?:\d+|[-_\s])(CE|PE)(?:[-_\s].*)?$/i.test(clean) || /(?:\d+|[A-Z]{3}|[-_\s])FUT(?:[-_\s].*)?$/i.test(clean) || clean.endsWith('-FUT') || symbol.includes('-MCX');
}

class TriggerEngine {
    constructor() {
        this.activeTriggers = new Map(); // symbol -> [order_objects]
        this.activeTriggerSymbols = new Set(); // ⚡ In-memory active trigger symbols filter
        this.trailingOrders = new Map(); // ⚡ orderId -> orderObj for real-time Trailing Stop Loss (TSL)
        this.trailingOrdersBySymbol = new Map(); // ⚡ symbol -> Map(orderId -> orderObj) for O(1) tick evaluation
        this.isProcessing = false;
        this.io = null;
        this.priceCache = {};
        console.log('Real-Time WebSocket Trigger Engine Initialized.');
    }
    
    setSocketIo(ioInstance) {
        this.io = ioInstance;
    }

    setPriceCache(cache) {
        this.priceCache = cache || {};
    }

    /**
     * Load all PENDING and PENDING_TRIGGER orders from DB into Redis ZSETs.
     */
    async loadPendingOrders() {
        try {
            const orders = await db('orders').whereIn('status', ['PENDING', 'PENDING_TRIGGER', 'PARTIAL_FILLED', 'PARTIALLY_FILLED', 'OPEN']);
            
            // Clear existing triggers in Redis
            const { generalClient } = require('./redisClient');
            if (generalClient && generalClient.isReady) {
                const triggerKeys = [];
                for await (const chunk of generalClient.scanIterator({ MATCH: 'trigger:*', COUNT: 100 })) {
                    const keys = Array.isArray(chunk) ? chunk : [chunk];
                    for (const k of keys) {
                        if (typeof k === 'string') triggerKeys.push(k);
                    }
                }
                if (triggerKeys.length > 0) {
                    await generalClient.del(triggerKeys);
                }
            }
            
            this.activeTriggerSymbols.clear();
            this.trailingOrders.clear();
            this.trailingOrdersBySymbol.clear();
            for (const order of orders) {
                await this.addOrderToMemory(order);
                if (order.symbol) this.activeTriggerSymbols.add(order.symbol);
            }
            console.log(`Loaded ${orders.length} active triggers into Redis ZSETs (${this.trailingOrders.size} trailing SL) across ${this.activeTriggerSymbols.size} symbols.`);
        } catch (err) {
            console.error('Failed to load pending orders into TriggerEngine:', err);
        }
    }

    async addOrderToMemory(order) {
        const { generalClient } = require('./redisClient');
        if (!generalClient || !generalClient.isReady || !order) return;
        
        if (Number(order.trail_amount) > 0 || order.is_trailing) {
            const ordCopy = { ...order };
            this.trailingOrders.set(order.id.toString(), ordCopy);
            if (order.symbol) {
                if (!this.trailingOrdersBySymbol.has(order.symbol)) {
                    this.trailingOrdersBySymbol.set(order.symbol, new Map());
                }
                this.trailingOrdersBySymbol.get(order.symbol).set(order.id.toString(), ordCopy);
            }
        }
        
        let key = null;
        let score = null;
        
        if (order.status === 'PENDING') {
            if (order.type === 'LIMIT') {
                key = `trigger:${order.symbol}:${order.side}:LIMIT`;
                score = Number(order.price);
            } else if (order.type === 'MARKET') {
                // Market orders flow directly through VolumeMatchingEngine, not Redis triggers
                return;
            } else if (order.type && (order.type.startsWith('SL') || order.type === 'TRAILING_STOP' || order.type === 'GTT')) {
                const trigger = Number(order.trigger_price || order.price);
                let isGreaterOrEqual = false;
                if (order.type === 'GTT') {
                    const curLtp = Number(this.priceCache?.[order.symbol]?.ltp || this.priceCache?.[order.symbol]?.close) || 0;
                    if (order.side === 'BUY') {
                        isGreaterOrEqual = curLtp > 0 ? (trigger >= curLtp) : true;
                    } else {
                        isGreaterOrEqual = curLtp > 0 ? (trigger >= curLtp) : false;
                    }
                } else {
                    if (order.side === 'BUY' && (order.type.startsWith('SL') || order.type === 'TRAILING_STOP')) isGreaterOrEqual = true;
                    if (order.side === 'SELL' && order.type === 'LIMIT') isGreaterOrEqual = true;
                }
                key = isGreaterOrEqual ? `trigger:${order.symbol}:GTE` : `trigger:${order.symbol}:LTE`;
                score = trigger;
            }
        } else if (order.status === 'PENDING_TRIGGER') {
            const trigger = Number(order.trigger_price || order.price);
            if (order.type && (order.type.startsWith('SL') || order.type === 'LIMIT' || order.type === 'TRAILING_STOP' || order.type === 'GTT')) {
                // Determine if this leg triggers on >= or <=
                let isGreaterOrEqual = false;
                if (order.type === 'GTT') {
                    const curLtp = Number(this.priceCache?.[order.symbol]?.ltp || this.priceCache?.[order.symbol]?.close) || 0;
                    if (order.side === 'BUY') {
                        isGreaterOrEqual = curLtp > 0 ? (trigger >= curLtp) : true;
                    } else {
                        isGreaterOrEqual = curLtp > 0 ? (trigger >= curLtp) : false;
                    }
                } else {
                    if (order.side === 'BUY' && (order.type.startsWith('SL') || order.type === 'TRAILING_STOP')) isGreaterOrEqual = true;
                    if (order.side === 'SELL' && order.type === 'LIMIT') isGreaterOrEqual = true;
                }
                
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
            if (Number(order.trail_amount) > 0 || order.is_trailing) {
                const ordCopy = { ...order };
                this.trailingOrders.set(order.id.toString(), ordCopy);
                if (order.symbol) {
                    const clean = order.symbol.includes(':') ? order.symbol.split(':')[1] : order.symbol;
                    if (!this.trailingOrdersBySymbol.has(order.symbol)) {
                        this.trailingOrdersBySymbol.set(order.symbol, new Map());
                    }
                    this.trailingOrdersBySymbol.get(order.symbol).set(order.id.toString(), ordCopy);
                    if (clean && clean !== order.symbol) {
                        if (!this.trailingOrdersBySymbol.has(clean)) {
                            this.trailingOrdersBySymbol.set(clean, new Map());
                        }
                        this.trailingOrdersBySymbol.get(clean).set(order.id.toString(), ordCopy);
                    }
                }
            }
            await generalClient.zAdd(key, [{ score: score, value: order.id.toString() }]);
            if (order.symbol) this.activeTriggerSymbols.add(order.symbol);
        }
    }

    async removeOrderFromMemory(orderId, symbol) {
        const { generalClient } = require('./redisClient');
        const existingTrailing = this.trailingOrders.get(orderId.toString());
        this.trailingOrders.delete(orderId.toString());
        const sym = symbol || existingTrailing?.symbol;
        if (sym) {
            const clean = sym.includes(':') ? sym.split(':')[1] : sym;
            [sym, clean].forEach(s => {
                if (this.trailingOrdersBySymbol.has(s)) {
                    const symMap = this.trailingOrdersBySymbol.get(s);
                    symMap.delete(orderId.toString());
                    if (symMap.size === 0) {
                        this.trailingOrdersBySymbol.delete(s);
                    }
                }
            });
        }
        if (!generalClient || !generalClient.isReady) return;
        
        // Parallelize removal across all 4 sets to minimize round-trip latency
        const targetSym = symbol || sym;
        const keys = targetSym ? [
            `trigger:${targetSym}:BUY:LIMIT`,
            `trigger:${targetSym}:SELL:LIMIT`,
            `trigger:${targetSym}:GTE`,
            `trigger:${targetSym}:LTE`
        ] : [];
        
        if (keys.length > 0) {
            await Promise.all(keys.map(key => generalClient.zRem(key, orderId.toString()).catch(() => {})));
            const cards = await Promise.all(keys.map(key => generalClient.zCard(key).catch(() => 0)));
            const totalRem = cards.reduce((sum, count) => sum + (Number(count) || 0), 0);
            if (totalRem === 0) {
                this.activeTriggerSymbols.delete(targetSym);
            }
        }
    }

    /**
     * Evaluates a live LTP tick using a blazing fast O(log N) Redis Lua Script.
     * Also ratchets in-memory Dynamic Trailing Stop Loss (TSL) orders in real-time.
     */
    async evaluateTick(symbol, ltp) {
        if (!ltp || !symbol) return;

        // ⚡ Ratchet Trailing Stop Loss (TSL) orders in-memory (O(1) indexed by symbol)
        const cleanSym = symbol && symbol.includes(':') ? symbol.split(':')[1] : symbol;
        const symMap = this.trailingOrdersBySymbol.get(symbol);
        const cleanMap = (cleanSym && cleanSym !== symbol) ? this.trailingOrdersBySymbol.get(cleanSym) : null;
        const targetTrailingMap = symMap || cleanMap;

        if (targetTrailingMap && targetTrailingMap.size > 0) {
            for (const [orderId, tOrder] of targetTrailingMap.entries()) {
                const trailAmount = Number(tOrder.trail_amount || 0);
                if (trailAmount <= 0) continue;

                let updated = false;
                let newTriggerPrice = Number(tOrder.trigger_price || tOrder.sl_price || tOrder.price);
                const step = Number(tOrder.trail_amount) || 0.5;

                if (tOrder.side === 'SELL') {
                    // Long position SL: trails upward as LTP increases
                    if (!tOrder.high_water_mark || Number(tOrder.high_water_mark) <= 0) {
                        tOrder.high_water_mark = Number(ltp);
                    }
                    const highWater = Number(tOrder.high_water_mark);
                    if (ltp > highWater) {
                        const gainPaise = Math.round((ltp - highWater) * 100);
                        const stepPaise = Math.max(1, Math.round(step * 100));
                        if (gainPaise >= stepPaise) {
                            const stepsCount = Math.floor(gainPaise / stepPaise);
                            const ratchet = (stepsCount * stepPaise) / 100;
                            tOrder.high_water_mark = Number((highWater + ratchet).toFixed(2));
                            newTriggerPrice = Number((newTriggerPrice + ratchet).toFixed(2));
                            tOrder.trigger_price = newTriggerPrice;
                            tOrder.sl_price = newTriggerPrice;
                            updated = true;
                        }
                    }
                } else if (tOrder.side === 'BUY') {
                    // Short position SL: trails downward as LTP decreases
                    if (!tOrder.low_water_mark || Number(tOrder.low_water_mark) <= 0) {
                        tOrder.low_water_mark = Number(ltp);
                    }
                    const lowWater = Number(tOrder.low_water_mark);
                    if (ltp < lowWater) {
                        const dropPaise = Math.round((lowWater - ltp) * 100);
                        const stepPaise = Math.max(1, Math.round(step * 100));
                        if (dropPaise >= stepPaise) {
                            const stepsCount = Math.floor(dropPaise / stepPaise);
                            const ratchet = (stepsCount * stepPaise) / 100;
                            tOrder.low_water_mark = Number((lowWater - ratchet).toFixed(2));
                            newTriggerPrice = Number((newTriggerPrice - ratchet).toFixed(2));
                            tOrder.trigger_price = newTriggerPrice;
                            tOrder.sl_price = newTriggerPrice;
                            updated = true;
                        }
                    }
                }

                if (updated) {
                    const { generalClient } = require('./redisClient');
                    if (generalClient && generalClient.isReady) {
                        const isGreaterOrEqual = (tOrder.side === 'BUY');
                        const zKey = isGreaterOrEqual ? `trigger:${tOrder.symbol}:GTE` : `trigger:${tOrder.symbol}:LTE`;
                        generalClient.zAdd(zKey, [{ score: newTriggerPrice, value: orderId.toString() }]).catch(() => {});
                    }
                    db('orders').where({ id: orderId }).update({
                        trigger_price: newTriggerPrice,
                        sl_price: newTriggerPrice,
                        high_water_mark: tOrder.high_water_mark,
                        low_water_mark: tOrder.low_water_mark,
                        updated_at: new Date()
                    }).catch(err => console.error('TSL DB update error:', err.message));

                    if (this.io) {
                        const targetUserRoom = tOrder.user_id ? tOrder.user_id.toString() : null;
                        const updatePayload = {
                            id: orderId,
                            trigger_price: newTriggerPrice,
                            sl_price: newTriggerPrice,
                            status: tOrder.status,
                            is_trailing: true
                        };
                        if (targetUserRoom) {
                            this.io.to(targetUserRoom).emit('order_update', updatePayload);
                        } else {
                            this.io.emit('order_update', updatePayload);
                        }
                    }
                }
            }
        }

        // ⚡ Blazing fast O(1) in-memory check: skip Redis if NO triggers exist for this symbol!
        const symbolsToCheck = [];
        if (this.activeTriggerSymbols.has(symbol)) symbolsToCheck.push(symbol);
        if (cleanSym && cleanSym !== symbol && this.activeTriggerSymbols.has(cleanSym)) symbolsToCheck.push(cleanSym);
        if (symbolsToCheck.length === 0) return;
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

        for (const targetSym of symbolsToCheck) {
            try {
                const keys = [
                    `trigger:${targetSym}:BUY:LIMIT`,
                    `trigger:${targetSym}:SELL:LIMIT`,
                    `trigger:${targetSym}:GTE`,
                    `trigger:${targetSym}:LTE`
                ];
                
                // eval(script, options) in node-redis v4
                const triggeredOrderIds = await generalClient.eval(luaScript, {
                    keys: keys,
                    arguments: [ltp.toString()]
                });

                if (triggeredOrderIds && triggeredOrderIds.length > 0) {
                    // Check if symbol still has remaining triggers in Redis
                    const remaining = (await generalClient.zCard(`trigger:${targetSym}:BUY:LIMIT`).catch(()=>0)) +
                                      (await generalClient.zCard(`trigger:${targetSym}:SELL:LIMIT`).catch(()=>0)) +
                                      (await generalClient.zCard(`trigger:${targetSym}:GTE`).catch(()=>0)) +
                                      (await generalClient.zCard(`trigger:${targetSym}:LTE`).catch(()=>0));
                    if (remaining === 0) {
                        this.activeTriggerSymbols.delete(targetSym);
                    }

                    // ⚡ Batch-fetch all triggered orders in a single database query
                    const triggeredOrders = await db('orders').whereIn('id', triggeredOrderIds);
                    if (triggeredOrders && triggeredOrders.length > 0) {
                        const volumeMatchingEngine = require('./volumeMatchingEngine');
                        for (const order of triggeredOrders) {
                            volumeMatchingEngine.submitOrder(order, ltp).catch(err => {
                                console.error('Execution Error:', err);
                                // On failure, re-add to Redis to try again on next tick
                                this.addOrderToMemory(order);
                            });
                        }
                    }
                }
            } catch (err) {
                console.error('Redis Lua Trigger Error for ' + targetSym + ':', err.message);
            }
        }
    }



    async executeOrder(order, execPrice, options = {}) {
        // ALL orders must flow through realistic volume matching engine
        // to respect real exchange volume. Only mutual funds and explicit bypasses skip this.
        if (!options || !options.bypassVolumeMatching) {
            const isMutualFund = order.symbol && (order.symbol.endsWith('-MF') || order.symbol.includes('MUTUALFUND'));
            if (!isMutualFund) {
                const volumeMatchingEngine = require('./volumeMatchingEngine');
                return volumeMatchingEngine.submitOrder(order, execPrice);
            }
        }

        await db.transaction(async (trx) => {
            // Serialize order executions on a per-user basis to prevent position/ledger race conditions
            await trx.raw('SELECT pg_advisory_xact_lock(?)', [order.user_id]);

            // Verify order is still pending in DB
            const dbOrder = await trx('orders').where({ id: order.id }).first();
            if (!dbOrder || (dbOrder.status !== 'PENDING' && dbOrder.status !== 'PENDING_TRIGGER')) {
                return; 
            }

            // SL-L & GTT Gap Protection: For Stop-Loss Limit / GTT orders with price, verify limit price constraint
            if (order.type === 'SL-L' || (order.type === 'SL' && order.price && Number(order.price) > 0) || (order.type === 'GTT' && order.price && Number(order.price) > 0)) {
                const limitPrice = Number(order.price);
                if (order.side === 'BUY' && execPrice > limitPrice) {
                    // Market gapped above limit price: keep as PENDING limit order at limit price
                    await trx('orders').where({ id: order.id }).update({ status: 'PENDING', type: 'LIMIT', updated_at: new Date() });
                    order.status = 'PENDING';
                    order.type = 'LIMIT';
                    this.addOrderToMemory(order);
                    return;
                } else if (order.side === 'SELL' && execPrice < limitPrice) {
                    // Market gapped below limit price: keep as PENDING limit order at limit price
                    await trx('orders').where({ id: order.id }).update({ status: 'PENDING', type: 'LIMIT', updated_at: new Date() });
                    order.status = 'PENDING';
                    order.type = 'LIMIT';
                    this.addOrderToMemory(order);
                    return;
                }
            }

            // 1. Mark Executed & Deduct Taxes
            const totalTaxes = await LedgerService.chargeExecutionTaxes(trx, order.user_id, order.symbol, order.product_type, order.side, Number(order.quantity), execPrice);
            
            await trx('orders').where({ id: order.id }).update({ 
                status: 'EXECUTED',
                price: execPrice,
                taxes: totalTaxes,
                updated_at: new Date()
            });
            order.status = 'EXECUTED';
            order.price = execPrice;
            order.taxes = totalTaxes;

            // 2. Position Logic
            const isIntradayProduct = (order.product_type === 'INT' || order.product_type === 'MIS' || order.product_type === 'BO' || order.product_type === 'CO');
            const isDeliveryProduct = (order.product_type === 'CNC' || order.product_type === 'DELIVERY' || order.product_type === 'DEL');
            const cleanSym = String(order.symbol).replace(/^(NSE:|BSE:|MCX:)/i, '');

            const existingPos = await trx('positions')
                .where({ user_id: order.user_id })
                .where(builder => {
                    if (isIntradayProduct) builder.whereIn('product_type', ['INT', 'MIS', 'BO', 'CO']);
                    else if (isDeliveryProduct) builder.whereIn('product_type', ['DEL', 'CNC', 'DELIVERY']);
                    else builder.where({ product_type: order.product_type });
                })
                .where(builder => {
                    builder.where({ symbol: order.symbol })
                           .orWhere({ symbol: cleanSym })
                           .orWhere({ symbol: `NSE:${cleanSym}` })
                           .orWhere({ symbol: `BSE:${cleanSym}` })
                           .orWhere({ symbol: `MCX:${cleanSym}` });
                })
                .whereNot({ quantity: 0 }).first();
            
            const qtyChange = order.side === 'BUY' ? Number(order.quantity) : -Number(order.quantity);

            // Helper to handle inserting new positions or offsetting holdings
            const handleRemainingPos = async (trx, remainingQty, execPrice, customMargin = undefined) => {
                const isDeriv = isDerivativeSymbol(order.symbol);

                if ((order.product_type === 'DEL' || order.product_type === 'CNC' || order.product_type === 'DELIVERY') && remainingQty < 0) {
                    const holding = await trx('holdings')
                        .where({ user_id: order.user_id })
                        .where(builder => {
                            builder.where({ symbol: order.symbol })
                                   .orWhere({ symbol: cleanSym })
                                   .orWhere({ symbol: `NSE:${cleanSym}` })
                                   .orWhere({ symbol: `BSE:${cleanSym}` })
                                   .orWhere({ symbol: `MCX:${cleanSym}` });
                        })
                        .first();
                    if (holding && Number(holding.quantity) > 0) {
                        const hQty = Number(holding.quantity);
                        const hAvg = Number(holding.average_price);
                        const offsetQty = Math.min(Math.abs(remainingQty), hQty);
                        
                        // Deduct from holding or remove row if sold out
                        const newHoldingQty = hQty - offsetQty;
                        if (newHoldingQty <= 0) {
                            await trx('holdings').where({ id: holding.id }).del();
                        } else {
                            await trx('holdings').where({ id: holding.id }).update({ quantity: newHoldingQty });
                        }
                        
                        // Create a CLOSED position record for today
                        const realizedPnl = Math.round(((execPrice - hAvg) * offsetQty + Number.EPSILON) * 100) / 100;
                        const principalAmount = Math.round(((hAvg * offsetQty) + Number.EPSILON) * 100) / 100;
                        await trx('positions').insert({
                            user_id: order.user_id,
                            symbol: order.symbol,
                            quantity: 0,
                            closed_quantity: offsetQty,
                            average_price: hAvg,
                            exit_price: execPrice,
                            realized_pnl: realizedPnl,
                            product_type: order.product_type || 'DEL',
                            created_at: new Date(),
                            updated_at: new Date()
                        });
                        
                        // Update Balance and Ledger with Principal, Realized P&L and RMS Penalty
                        const rmsPenalty = order.is_rms ? 59 : 0;
                        const user = await trx('users').where({ id: order.user_id }).forUpdate().first();
                        if (user) {
                            const updatedBalance = Math.round((Number(user.balance) + principalAmount + realizedPnl - rmsPenalty + Number.EPSILON) * 100) / 100;
                            await trx('users').where({ id: order.user_id }).update({ balance: updatedBalance });
                        }
                        
                        await trx('ledger').insert({
                            user_id: order.user_id, amount: principalAmount, type: 'MARGIN_RELEASE', description: `Holding principal value released for ${offsetQty} ${order.symbol}`
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
                    // SAFEGUARD: For Cash Equity Delivery (DEL/CNC), negative quantities (naked shorts) are strictly prohibited.
                    // Derivatives (Options and Futures) are permitted to have negative (short) quantities.
                    if ((order.product_type === 'DEL' || order.product_type === 'CNC' || order.product_type === 'DELIVERY') && remainingQty < 0 && !isDeriv) {
                        console.warn(`[SAFEGUARD] Blocked negative DEL cash equity position for user ${order.user_id}, symbol ${order.symbol}, qty: ${remainingQty}`);
                        return; // Do NOT insert negative DEL position for cash equities!
                    }

                    // MUTUAL FUNDS DELIVERY: Mutual fund purchases must directly enter Holdings as delivery assets (never open positions)
                    if (remainingQty > 0 && (order.symbol.endsWith('-MF') || order.symbol.includes('MUTUALFUND'))) {
                        const existingHolding = await trx('holdings')
                            .where({ user_id: order.user_id, symbol: order.symbol })
                            .first();
                        if (existingHolding) {
                            const prevQty = parseFloat(existingHolding.quantity) || 0;
                            const prevAvg = parseFloat(existingHolding.average_price) || execPrice;
                            const totalQty = prevQty + remainingQty;
                            const newAvg = totalQty > 0 ? ((prevQty * prevAvg) + (remainingQty * execPrice)) / totalQty : execPrice;
                            await trx('holdings').where({ id: existingHolding.id }).update({
                                quantity: parseFloat(totalQty.toFixed(4)),
                                average_price: parseFloat(newAvg.toFixed(2)),
                                asset_class: 'MUTUAL_FUND',
                                updated_at: new Date()
                            });
                        } else {
                            await trx('holdings').insert({
                                user_id: order.user_id,
                                symbol: order.symbol,
                                quantity: parseFloat(remainingQty.toFixed(4)),
                                average_price: parseFloat(execPrice.toFixed(2)),
                                asset_class: 'MUTUAL_FUND',
                                created_at: new Date(),
                                updated_at: new Date()
                            });
                        }
                        return;
                    }

                    const finalMargin = customMargin !== undefined ? Number(customMargin.toFixed(2)) : Number(order.margin || 0);
                    await trx('positions').insert({
                        user_id: order.user_id, symbol: order.symbol, quantity: remainingQty,
                        average_price: execPrice, product_type: order.product_type,
                        margin: finalMargin, created_at: new Date(), updated_at: new Date()
                    });
                }
            };

            const isMF = String(order.symbol).endsWith('-MF') || String(order.symbol).includes('MUTUALFUND');
            const roundQty = (q) => isMF ? Number(Number(q).toFixed(4)) : Math.round(Number(q));
            let bracketTargetQty = roundQty(Number(order.quantity));

            if (existingPos) {
                // Ensure Postgres decimal strings are converted to numbers to prevent string concatenation bugs (e.g. "10.0000" + 1 = "10.00001")
                existingPos.quantity = roundQty(Number(existingPos.quantity));
                existingPos.average_price = Math.abs(Number(existingPos.average_price));
                existingPos.margin = Number(existingPos.margin || 0);
                
                // Calculate if closing or averaging
                let isPartialClose = false;
                if ((existingPos.quantity > 0 && order.side === 'SELL') || (existingPos.quantity < 0 && order.side === 'BUY')) {
                    isPartialClose = true;
                }

                if (isPartialClose) {
                    const absQty = roundQty(Math.abs(Number(order.quantity)));
                    const posAbsQty = Math.abs(existingPos.quantity);
                    const closeQty = roundQty(Math.min(posAbsQty, absQty));

                    if (absQty <= posAbsQty) {
                        bracketTargetQty = 0;
                    } else {
                        bracketTargetQty = roundQty(Math.abs(absQty - posAbsQty));
                    }
                    
                    let realizedPnl = 0;
                    if (existingPos.quantity > 0) {
                        realizedPnl = (execPrice - existingPos.average_price) * closeQty;
                    } else {
                        realizedPnl = (existingPos.average_price - execPrice) * closeQty;
                    }
                    realizedPnl = Math.round((realizedPnl + Number.EPSILON) * 100) / 100;
                    
                    const propClosed = posAbsQty > 0 ? (closeQty / posAbsQty) : 1;
                    const marginRefund = Math.round((parseFloat(existingPos.margin) * propClosed) * 100) / 100;
                    const newMargin = Math.max(0, Math.round(((existingPos.margin || 0) - marginRefund + Number.EPSILON) * 100) / 100);
                    
                    const newQty = roundQty(existingPos.quantity > 0 ? (existingPos.quantity - closeQty) : (existingPos.quantity + closeQty));
                    
                    if (newQty === 0 || posAbsQty <= closeQty) {
                        await trx('positions').where({ id: existingPos.id }).update({ 
                           quantity: 0, 
                           closed_quantity: roundQty((parseFloat(existingPos.closed_quantity) || 0) + closeQty), 
                           exit_price: execPrice, 
                           margin: 0,
                           realized_pnl: (parseFloat(existingPos.realized_pnl) || 0) + realizedPnl,
                           updated_at: new Date()
                        });
                        // Cancel dangling linked pending and trigger orders (SL/Target child legs or linked brackets)
                        const isIntOrder = (order.product_type === 'INT' || order.product_type === 'MIS' || order.product_type === 'BO' || order.product_type === 'CO');
                        const isDelOrder = (order.product_type === 'CNC' || order.product_type === 'DELIVERY' || order.product_type === 'DEL');

                        const danglingOrders = await trx('orders')
                            .where({ user_id: order.user_id })
                            .where(builder => {
                                if (isIntOrder) builder.whereIn('product_type', ['INT', 'MIS', 'BO', 'CO']);
                                else if (isDelOrder) builder.whereIn('product_type', ['DEL', 'CNC', 'DELIVERY']);
                                else builder.where({ product_type: order.product_type });
                            })
                            .where(builder => {
                                builder.where({ symbol: order.symbol })
                                       .orWhere({ symbol: cleanSym })
                                       .orWhere({ symbol: `NSE:${cleanSym}` })
                                       .orWhere({ symbol: `BSE:${cleanSym}` })
                                       .orWhere({ symbol: `MCX:${cleanSym}` });
                            })
                            .where(builder => {
                                builder.where('status', 'PENDING_TRIGGER')
                                       .orWhereNotNull('parent_order_id');
                            })
                            .whereIn('status', ['PENDING', 'PENDING_TRIGGER']);
                            
                        for (const dangler of danglingOrders) {
                            await trx('orders').where({ id: dangler.id }).update({ status: 'CANCELLED', updated_at: new Date() });
                            const refundMargin = parseFloat(dangler.margin) || 0;
                            if (refundMargin > 0) {
                                const user = await trx('users').where({ id: order.user_id }).forUpdate().first();
                                if (user) {
                                    await trx('users').where({ id: order.user_id }).update({ balance: Math.round((Number(user.balance) + refundMargin + Number.EPSILON) * 100) / 100 });
                                    await trx('ledger').insert({
                                        user_id: order.user_id,
                                        amount: refundMargin,
                                        type: 'MARGIN_RELEASE',
                                        description: `Margin released for cancelled dangling order ${dangler.symbol}`
                                    });
                                }
                            }
                            this.removeOrderFromMemory(dangler.id, dangler.symbol);
                            try {
                                const volumeMatchingEngine = require('./volumeMatchingEngine');
                                volumeMatchingEngine.dequeueOrder(dangler.id, dangler.symbol);
                            } catch (e) {}
                        }
                    } else {
                        await trx('positions').where({ id: existingPos.id }).update({
                           quantity: newQty,
                           margin: newMargin,
                           closed_quantity: roundQty((parseFloat(existingPos.closed_quantity) || 0) + closeQty),
                           exit_price: execPrice,
                           realized_pnl: (parseFloat(existingPos.realized_pnl) || 0) + realizedPnl,
                           updated_at: new Date()
                        });

                        // Proportionally reduce child OCO legs if existing position was partially closed
                        const isIntOrder = (order.product_type === 'INT' || order.product_type === 'MIS' || order.product_type === 'BO' || order.product_type === 'CO');
                        const isDelOrder = (order.product_type === 'CNC' || order.product_type === 'DELIVERY' || order.product_type === 'DEL');

                        const childOrders = await trx('orders')
                            .where({ user_id: order.user_id })
                            .where(builder => {
                                if (isIntOrder) builder.whereIn('product_type', ['INT', 'MIS', 'BO', 'CO']);
                                else if (isDelOrder) builder.whereIn('product_type', ['DEL', 'CNC', 'DELIVERY']);
                                else builder.where({ product_type: order.product_type });
                            })
                            .where(builder => {
                                builder.where({ symbol: order.symbol })
                                       .orWhere({ symbol: cleanSym });
                            })
                            .whereIn('status', ['PENDING', 'PENDING_TRIGGER'])
                            .whereNotNull('parent_order_id');
                        for (const child of childOrders) {
                            const updatedChildQty = Math.max(0, child.quantity - closeQty);
                            if (updatedChildQty === 0) {
                                await trx('orders').where({ id: child.id }).update({ status: 'CANCELLED', updated_at: new Date() });
                                this.removeOrderFromMemory(child.id, child.symbol);
                                try {
                                    const volumeMatchingEngine = require('./volumeMatchingEngine');
                                    volumeMatchingEngine.dequeueOrder(child.id, child.symbol);
                                } catch (e) {}
                            } else {
                                await trx('orders').where({ id: child.id }).update({ quantity: updatedChildQty, updated_at: new Date() });
                            }
                        }
                    }

                    // Update Ledger for realized P&L and margin refund
                    const isRMS = order.is_rms || false;
                    const rmsPenalty = isRMS ? 59 : 0;
                    let balanceChange = Math.round((realizedPnl + marginRefund - rmsPenalty + Number.EPSILON) * 100) / 100;
                    
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

                    // Synchronize / decrement holdings table if an entry exists for this user and symbol to prevent ghost holdings
                    const holdingRecord = await trx('holdings')
                        .where({ user_id: order.user_id })
                        .where(builder => {
                            builder.where({ symbol: order.symbol })
                                   .orWhere({ symbol: cleanSym })
                                   .orWhere({ symbol: `NSE:${cleanSym}` })
                                   .orWhere({ symbol: `BSE:${cleanSym}` })
                                   .orWhere({ symbol: `MCX:${cleanSym}` });
                        })
                        .first();

                    if (holdingRecord) {
                        const currentHQty = Number(holdingRecord.quantity || 0);
                        const newHQty = currentHQty - closeQty;
                        if (newHQty <= 0) {
                            await trx('holdings').where({ id: holdingRecord.id }).del();
                        } else {
                            await trx('holdings').where({ id: holdingRecord.id }).update({ quantity: newHQty, updated_at: new Date() });
                        }
                    }
                    
                    const user = await trx('users').where({ id: order.user_id }).forUpdate().first();
                    if (user) {
                        await trx('users').where({ id: order.user_id }).update({ balance: Math.round((Number(user.balance) + balanceChange + Number.EPSILON) * 100) / 100 });
                    }

                    // If order quantity exceeds existing position (Reverse Position)
                    if (absQty > absPosQty) {
                        const remainingQty = order.side === 'BUY' ? (absQty - absPosQty) : -(absQty - absPosQty);
                        
                        // Check if reversing with delivery sell shares from existing holdings
                        let isHoldingSell = false;
                        if (order.side === 'SELL' && (order.product_type === 'DEL' || order.product_type === 'CNC' || order.product_type === 'DELIVERY')) {
                            const holding = await trx('holdings')
                                .where({ user_id: order.user_id })
                                .where(builder => {
                                    builder.where({ symbol: order.symbol })
                                           .orWhere({ symbol: cleanSym })
                                           .orWhere({ symbol: `NSE:${cleanSym}` })
                                           .orWhere({ symbol: `BSE:${cleanSym}` })
                                           .orWhere({ symbol: `MCX:${cleanSym}` });
                                })
                                .first();
                            if (holding && Number(holding.quantity) >= Math.abs(remainingQty)) {
                                isHoldingSell = true;
                            }
                        }

                        let newPosMargin = 0;
                        if (!isHoldingSell) {
                            const { calculateRequiredMargin } = require('./marginEngine');
                            const calcMargin = calculateRequiredMargin(order.symbol, order.product_type, order.side, Math.abs(remainingQty), execPrice);
                            newPosMargin = calcMargin > 0 ? calcMargin : Number(order.margin || 0);

                            // Balance margin difference: blocked on order vs required on new position
                            const orderMarginBlocked = Number(order.margin || 0);
                            const marginDelta = Math.round((newPosMargin - orderMarginBlocked + Number.EPSILON) * 100) / 100;
                            if (marginDelta > 0) {
                                // More margin required than was blocked on order
                                const u = await trx('users').where({ id: order.user_id }).forUpdate().first();
                                if (u) {
                                    const newBal = Math.round((Number(u.balance) - marginDelta + Number.EPSILON) * 100) / 100;
                                    await trx('users').where({ id: order.user_id }).update({ balance: newBal });
                                }
                                await trx('ledger').insert({
                                    user_id: order.user_id,
                                    amount: -marginDelta,
                                    type: 'MARGIN_BLOCK',
                                    description: `Margin blocked for reversed position ${remainingQty} ${order.symbol}`
                                });
                            } else if (marginDelta < 0) {
                                // Excess margin was blocked on order, refund the difference
                                const excessRefund = Math.round((Math.abs(marginDelta) + Number.EPSILON) * 100) / 100;
                                const u = await trx('users').where({ id: order.user_id }).forUpdate().first();
                                if (u) {
                                    const newBal = Math.round((Number(u.balance) + excessRefund + Number.EPSILON) * 100) / 100;
                                    await trx('users').where({ id: order.user_id }).update({ balance: newBal });
                                }
                                await trx('ledger').insert({
                                    user_id: order.user_id,
                                    amount: excessRefund,
                                    type: 'MARGIN_RELEASE',
                                    description: `Excess margin refunded for reversed position ${remainingQty} ${order.symbol}`
                                });
                            }
                        } else {
                            // If order had blocked any margin, refund it since it's backed by holdings
                            const orderMarginBlocked = Number(order.margin || 0);
                            if (orderMarginBlocked > 0) {
                                const u = await trx('users').where({ id: order.user_id }).forUpdate().first();
                                if (u) {
                                    const newBal = Math.round((Number(u.balance) + orderMarginBlocked + Number.EPSILON) * 100) / 100;
                                    await trx('users').where({ id: order.user_id }).update({ balance: newBal });
                                }
                                await trx('ledger').insert({
                                    user_id: order.user_id,
                                    amount: orderMarginBlocked,
                                    type: 'MARGIN_RELEASE',
                                    description: `Margin refunded for holdings-backed delivery sell reversal: ${order.symbol}`
                                });
                            }
                        }

                        await handleRemainingPos(trx, remainingQty, execPrice, newPosMargin);
                    }
                } else {
                    // Averaging
                    const currentTotal = Math.abs(existingPos.quantity) * Math.abs(Number(existingPos.average_price));
                    const newTotal = Math.abs(Number(order.quantity)) * execPrice;
                    const newQty = roundQty(existingPos.quantity + qtyChange);
                    const newAvgPrice = Math.round((Math.abs((currentTotal + newTotal) / Math.abs(newQty)) + Number.EPSILON) * 100) / 100;
                    
                    await trx('positions').where({ id: existingPos.id }).update({
                        quantity: newQty,
                        average_price: newAvgPrice,
                        margin: Math.round(((parseFloat(existingPos.margin) || 0) + Number(order.margin || 0) + Number.EPSILON) * 100) / 100,
                        exit_price: null,
                        updated_at: new Date()
                    });
                }
            } else {
                // Create new position (or offset holdings)
                await handleRemainingPos(trx, qtyChange, execPrice);
            }

            // 3. Bracket Order (CO/BO) Leg Generation
            if (bracketTargetQty > 0) {
                await this.spawnBracketLegs(trx, order, bracketTargetQty);
            }

            // 4. OCO (One Cancels Other) Logic for BO
            if (order.parent_order_id || order.linked_order_id) {
                const siblingQuery = trx('orders')
                    .whereIn('status', ['PENDING', 'PENDING_TRIGGER'])
                    .whereNot({ id: order.id })
                    .forUpdate();

                if (order.parent_order_id && order.linked_order_id) {
                    siblingQuery.where(b => b.where({ parent_order_id: order.parent_order_id }).orWhere({ id: order.linked_order_id }));
                } else if (order.parent_order_id) {
                    siblingQuery.where({ parent_order_id: order.parent_order_id });
                } else {
                    siblingQuery.where({ id: order.linked_order_id });
                }

                const siblings = await siblingQuery;
                
                for (const sibling of siblings) {
                    await trx('orders').where({ id: sibling.id }).update({ status: 'CANCELLED', updated_at: new Date() });
                    const sibMargin = parseFloat(sibling.margin) || 0;
                    if (sibMargin > 0) {
                        const user = await trx('users').where({ id: order.user_id }).forUpdate().first();
                        if (user) {
                            await trx('users').where({ id: order.user_id }).update({ balance: Math.round((Number(user.balance) + sibMargin + Number.EPSILON) * 100) / 100 });
                            await trx('ledger').insert({
                                user_id: order.user_id,
                                amount: sibMargin,
                                type: 'MARGIN_RELEASE',
                                description: `Margin released for cancelled OCO sibling order ${sibling.symbol}`
                            });
                        }
                    }
                    await this.removeOrderFromMemory(sibling.id, sibling.symbol);
                    try {
                        const volumeMatchingEngine = require('./volumeMatchingEngine');
                        volumeMatchingEngine.dequeueOrder(sibling.id, sibling.symbol);
                    } catch (e) {}
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

    async spawnBracketLegs(trx, order, childQty) {
        const { spawnBracketOrders } = require('./orderExecutor');
        await spawnBracketOrders(trx, order, childQty);
    }
}

module.exports = new TriggerEngine();
