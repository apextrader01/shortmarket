const db = require('../database/db');

// In a real application, you'd maintain a memory state of order book and execute against ticks.
// For this mock app, we'll simply look for pending orders and if the LTP crosses their price, execute them.

function processTick(symbol, ltp) {
    // 1. Get all pending limit/market orders for this symbol
    const pendingOrders = db.prepare(`SELECT * FROM orders WHERE status = 'PENDING' AND symbol = ?`).all(symbol);
    
    pendingOrders.forEach(order => {
        let shouldExecute = false;
        
        if (order.type === 'MARKET') {
            shouldExecute = true;
            order.price = ltp; // Market order executes at LTP
        } else if (order.type === 'LIMIT') {
            if (order.side === 'BUY' && ltp <= order.price) {
                shouldExecute = true;
            } else if (order.side === 'SELL' && ltp >= order.price) {
                shouldExecute = true;
            }
        }

        if (shouldExecute) {
            executeOrder(order, ltp);
        }
    });
}

function executeOrder(order, executionPrice) {
    const transaction = db.transaction(() => {
        // Update order status
        db.prepare(`UPDATE orders SET status = 'EXECUTED', price = ? WHERE id = ?`).run(executionPrice, order.id);

        const totalCost = executionPrice * order.quantity;
        
        // Update user balance
        if (order.side === 'BUY') {
            db.prepare(`UPDATE users SET balance = balance - ? WHERE id = ?`).run(totalCost, order.user_id);
            
            // Add or update position
            const position = db.prepare(`SELECT * FROM positions WHERE user_id = ? AND symbol = ?`).get(order.user_id, order.symbol);
            if (position) {
                const newQuantity = position.quantity + order.quantity;
                const newAvgPrice = ((position.quantity * position.average_price) + totalCost) / newQuantity;
                db.prepare(`UPDATE positions SET quantity = ?, average_price = ? WHERE id = ?`).run(newQuantity, newAvgPrice, position.id);
            } else {
                db.prepare(`INSERT INTO positions (user_id, symbol, quantity, average_price) VALUES (?, ?, ?, ?)`).run(order.user_id, order.symbol, order.quantity, executionPrice);
            }
        } else if (order.side === 'SELL') {
            db.prepare(`UPDATE users SET balance = balance + ? WHERE id = ?`).run(totalCost, order.user_id);
            
            const position = db.prepare(`SELECT * FROM positions WHERE user_id = ? AND symbol = ?`).get(order.user_id, order.symbol);
            if (position) {
                const newQuantity = position.quantity - order.quantity;
                if (newQuantity <= 0) {
                    db.prepare(`DELETE FROM positions WHERE id = ?`).run(position.id);
                } else {
                    db.prepare(`UPDATE positions SET quantity = ? WHERE id = ?`).run(newQuantity, position.id);
                }
            } else {
                // Short selling mock: insert negative position
                db.prepare(`INSERT INTO positions (user_id, symbol, quantity, average_price) VALUES (?, ?, ?, ?)`).run(order.user_id, order.symbol, -order.quantity, executionPrice);
            }
        }
    });

    try {
        transaction();
        console.log(`Order ${order.id} executed successfully at ${executionPrice}`);
    } catch (err) {
        console.error(`Failed to execute order ${order.id}:`, err);
    }
}

module.exports = {
    processTick
};
