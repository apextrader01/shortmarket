const db = require('../database/db');

function initOrderExecutor(priceCache) {
  console.log('Starting Order Execution Engine...');

  setInterval(async () => {
    try {
      // 1. Fetch all pending orders
      const pendingOrders = await db('orders').where({ status: 'PENDING' });
      if (pendingOrders.length === 0) return;

      for (const order of pendingOrders) {
        const ltp = priceCache[order.symbol]?.ltp;
        if (!ltp) continue; // No live price available yet

        let shouldExecute = false;

        // --- GTT / SL Trigger Logic ---
        if (order.trigger_price) {
           const trigger = Number(order.trigger_price);
           if (order.side === 'BUY') {
              // Buy SL triggers when price goes UP to/above trigger.
              // Buy Target/GTT triggers when price goes DOWN to/below trigger.
              if (order.type.startsWith('SL')) {
                  if (ltp >= trigger) shouldExecute = true;
              } else {
                  if (ltp <= trigger) shouldExecute = true;
              }
           } else if (order.side === 'SELL') {
              // Sell SL triggers when price goes DOWN to/below trigger.
              // Sell Target/GTT triggers when price goes UP to/above trigger.
              if (order.type.startsWith('SL')) {
                  if (ltp <= trigger) shouldExecute = true;
              } else {
                  if (ltp >= trigger) shouldExecute = true;
              }
           }
        } else if (order.type === 'LIMIT') {
           const limitPrice = Number(order.price);
           if (order.side === 'BUY' && ltp <= limitPrice) shouldExecute = true;
           if (order.side === 'SELL' && ltp >= limitPrice) shouldExecute = true;
        } else if (order.type === 'MARKET') {
           shouldExecute = true;
        }

        if (shouldExecute) {
           await executeOrder(order, ltp);
        }
      }
    } catch (err) {
      console.error('OrderExecutor Error:', err.message);
    }
  }, 2000); // Check every 2 seconds
}

async function executeOrder(order, execPrice) {
  try {
    await db.transaction(async (trx) => {
      // 1. Mark as executed
      await trx('orders').where({ id: order.id }).update({ 
        status: 'EXECUTED',
        price: execPrice 
      });

      // 2. Update Positions
      const existingPos = await trx('positions').where({ user_id: order.user_id, symbol: order.symbol }).first();
      const qtyChange = order.side === 'BUY' ? Number(order.quantity) : -Number(order.quantity);
      
      if (existingPos) {
        const newQty = existingPos.quantity + qtyChange;
        let newAvgPrice = existingPos.average_price;
        
        // Average up/down only if we are increasing the position on the SAME side
        if ((existingPos.quantity > 0 && order.side === 'BUY') || (existingPos.quantity < 0 && order.side === 'SELL')) {
            const currentTotal = Math.abs(existingPos.quantity) * existingPos.average_price;
            const newTotal = Number(order.quantity) * execPrice;
            newAvgPrice = (currentTotal + newTotal) / Math.abs(newQty);
        }

        if (newQty === 0) {
            // Position closed! Delete it to keep table clean.
            await trx('positions').where({ id: existingPos.id }).delete();
            
            // Release margin back to user if applicable
            if (order.margin > 0) {
                const user = await trx('users').where({ id: order.user_id }).first();
                await trx('users').where({ id: order.user_id }).update({ balance: user.balance + Number(order.margin) });
            }
        } else {
            await trx('positions').where({ id: existingPos.id }).update({ quantity: newQty, average_price: newAvgPrice });
        }
      } else {
        // Create new position
        await trx('positions').insert({
          user_id: order.user_id,
          symbol: order.symbol,
          quantity: qtyChange,
          average_price: execPrice,
          product_type: order.product_type || 'DEL'
        });
      }

      console.log(`Executed Order ${order.id} for ${order.symbol} at ${execPrice}`);
    });
  } catch (err) {
    console.error(`Failed to execute order ${order.id}:`, err);
  }
}

module.exports = { initOrderExecutor };
