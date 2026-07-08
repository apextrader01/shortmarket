const db = require('../database/db');

// In a real application, you'd maintain a memory state of order book and execute against ticks.
// For this mock app, we'll simply look for pending orders and if the LTP crosses their price, execute them.

async function processTick(symbol, ltp) {
    try {
        // 1. Get all pending limit/market orders for this symbol
        const pendingOrders = await db('orders').where({ status: 'PENDING', symbol });
        
        for (const order of pendingOrders) {
            let shouldExecute = false;
            let executionPrice = ltp;
            
            if (order.type === 'MARKET') {
                shouldExecute = true;
            } else if (order.type === 'LIMIT' || order.type === 'TARGET') {
                const limitPrice = parseFloat(order.price);
                if (order.side === 'BUY' && ltp <= limitPrice) {
                    shouldExecute = true;
                    executionPrice = limitPrice; // Usually executes at limit price or better
                } else if (order.side === 'SELL' && ltp >= limitPrice) {
                    shouldExecute = true;
                    executionPrice = limitPrice;
                }
            } else if (order.type === 'SL' || order.type === 'SL-M' || order.type === 'SL-L') {
                const triggerPrice = parseFloat(order.trigger_price);
                if (order.side === 'BUY' && ltp >= triggerPrice) {
                    shouldExecute = true;
                    executionPrice = order.type === 'SL-L' ? parseFloat(order.price) : ltp;
                } else if (order.side === 'SELL' && ltp <= triggerPrice) {
                    shouldExecute = true;
                    executionPrice = order.type === 'SL-L' ? parseFloat(order.price) : ltp;
                }
            } else if (order.type === 'TRAILING_STOP') {
                const triggerPrice = parseFloat(order.trigger_price);
                const trailAmount = parseFloat(order.trail_amount);
                
                if (order.side === 'BUY') {
                    // For Buy Stop Loss, we buy if price goes ABOVE trigger
                    if (ltp >= triggerPrice) {
                        shouldExecute = true;
                        executionPrice = ltp;
                    } else if (ltp < (triggerPrice - trailAmount)) {
                        // Price went down (favorable), so trail the trigger price down
                        const newTrigger = ltp + trailAmount;
                        await db('orders').where({ id: order.id }).update({ trigger_price: newTrigger });
                    }
                } else if (order.side === 'SELL') {
                    // For Sell Stop Loss, we sell if price goes BELOW trigger
                    if (ltp <= triggerPrice) {
                        shouldExecute = true;
                        executionPrice = ltp;
                    } else if (ltp > (triggerPrice + trailAmount)) {
                        // Price went up (favorable), so trail the trigger price up
                        const newTrigger = ltp - trailAmount;
                        await db('orders').where({ id: order.id }).update({ trigger_price: newTrigger });
                    }
                }
            }

            if (shouldExecute) {
                await executeOrder(order, executionPrice);
            }
        }
    } catch (err) {
        console.error(`Tick processing error for ${symbol}:`, err);
    }
}

async function executeOrder(order, executionPrice) {
    try {
        await db.transaction(async (trx) => {
            // Update order status
            await trx('orders').where({ id: order.id }).update({ status: 'EXECUTED', price: executionPrice });

            const totalCost = executionPrice * order.quantity;

            // Deduct any taxes (e.g. Auto Square-Off Flat Fee)
            if (parseFloat(order.taxes || 0) > 0) {
                const taxes = parseFloat(order.taxes);
                const user = await trx('users').where({ id: order.user_id }).first();
                if (user) {
                    await trx('users').where({ id: order.user_id }).update({ balance: parseFloat(user.balance) - taxes });
                    await trx('ledger').insert({
                        user_id: order.user_id,
                        amount: -taxes,
                        type: 'TAXES',
                        description: `Auto Square-Off Fee for Order #${order.id}`
                    });
                }
            }

            
            // Note: Since we already deduct margin when the order is placed for both BUY and SELL (in server.js), 
            // we don't need to deduct the balance AGAIN here when the order executes.
            // If it's a SELL order, it means they are closing a long position or shorting.
            // For a complete paper trading system, we would calculate realized PnL when closing positions.
            // For now, we just update the positions table.
            
            if (order.side === 'BUY') {
                const position = await trx('positions').where({ user_id: order.user_id, symbol: order.symbol, product_type: order.product_type || 'DEL' }).first();
                if (position) {
                    const newQuantity = position.quantity + order.quantity;
                    const newAvgPrice = ((position.quantity * parseFloat(position.average_price)) + totalCost) / newQuantity;
                    await trx('positions').where({ id: position.id }).update({ quantity: newQuantity, average_price: newAvgPrice });
                } else {
                    await trx('positions').insert({ user_id: order.user_id, symbol: order.symbol, product_type: order.product_type || 'DEL', quantity: order.quantity, average_price: executionPrice });
                }
            } else if (order.side === 'SELL') {
                const position = await trx('positions').where({ user_id: order.user_id, symbol: order.symbol, product_type: order.product_type || 'DEL' }).first();
                if (position) {
                    const newQuantity = position.quantity - order.quantity;
                    if (newQuantity === 0) {
                        await trx('positions').where({ id: position.id }).del();
                    } else {
                        await trx('positions').where({ id: position.id }).update({ quantity: newQuantity });
                    }
                    
                    // Add profit/loss back to balance when position is closed (simple PnL)
                    const entryCost = parseFloat(position.average_price) * order.quantity;
                    const exitValue = executionPrice * order.quantity;
                    const pnl = exitValue - entryCost;
                    
                    // Add the freed up margin + profit back to balance
                    // Intraday (INT) only consumes 25% margin initially
                    const leverageMultiplier = position.product_type === 'INT' ? 0.25 : 1.0;
                    const user = await trx('users').where({ id: order.user_id }).first();
                    const marginToReturn = (order.quantity * parseFloat(position.average_price) * leverageMultiplier) + pnl;
                    await trx('users').where({ id: order.user_id }).update({ balance: parseFloat(user.balance) + marginToReturn });
                } else {
                    // Short selling mock: insert negative position
                    await trx('positions').insert({ user_id: order.user_id, symbol: order.symbol, product_type: order.product_type || 'DEL', quantity: -order.quantity, average_price: executionPrice });
                }
            }
            
            // OCO Logic: Cancel sibling orders linked by parent_order_id
            if (order.parent_order_id) {
                await trx('orders')
                    .where({ parent_order_id: order.parent_order_id })
                    .whereNot('id', order.id)
                    .where('status', 'PENDING')
                    .update({ status: 'CANCELLED' });
            }
        });
        console.log(`✅ Order ${order.id} (${order.side} ${order.quantity} ${order.symbol}) EXECUTED successfully at ₹${executionPrice}`);
    } catch (err) {
        console.error(`Failed to execute order ${order.id}:`, err);
    }
}

module.exports = {
    processTick,
    executeOrder
};
