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

const { calculateTaxes } = require('./taxCalculator');

async function executeOrder(order, execPrice) {
  try {
    await db.transaction(async (trx) => {
      // Calculate Taxes
      const taxesObj = calculateTaxes(order.symbol, order.product_type, order.side, Number(order.quantity), execPrice);
      const totalTaxes = taxesObj.totalTaxes;
      let realizedPnl = 0;

      // 1. Mark as executed
      await trx('orders').where({ id: order.id }).update({ 
        status: 'EXECUTED',
        price: execPrice,
        taxes: totalTaxes
      });

      // 2. Update Positions
      const existingPos = await trx('positions').where({ user_id: order.user_id, symbol: order.symbol }).first();
      const qtyChange = order.side === 'BUY' ? Number(order.quantity) : -Number(order.quantity);
      
      if (existingPos) {
        const newQty = existingPos.quantity + qtyChange;
        let newAvgPrice = existingPos.average_price;
        let newMargin = existingPos.margin || 0;
        let marginRefund = 0;
        
        // Average up/down only if we are increasing the position on the SAME side
        if ((existingPos.quantity > 0 && order.side === 'BUY') || (existingPos.quantity < 0 && order.side === 'SELL')) {
            const currentTotal = Math.abs(existingPos.quantity) * existingPos.average_price;
            const newTotal = Number(order.quantity) * execPrice;
            newAvgPrice = (currentTotal + newTotal) / Math.abs(newQty);
            // In a real execution engine, executing an automated entry order would use margin.
            // But since the margin was locked when placing the order, we add it to the position.
            newMargin += Number(order.margin || 0);
        }

        // Are we CLOSING a position?
        if ((existingPos.quantity > 0 && order.side === 'SELL') || (existingPos.quantity < 0 && order.side === 'BUY')) {
             if (existingPos.quantity > 0) {
                 realizedPnl = (execPrice - existingPos.average_price) * Number(order.quantity);
             } else {
                 realizedPnl = (existingPos.average_price - execPrice) * Number(order.quantity);
             }
             
             const proportionClosed = Math.abs(Number(order.quantity)) / Math.abs(existingPos.quantity);
             marginRefund = (existingPos.margin || 0) * proportionClosed;
             newMargin -= marginRefund;
        }

        if (newQty === 0) {
            // Position closed! Delete it to keep table clean.
            await trx('positions').where({ id: existingPos.id }).delete();
        } else {
            await trx('positions').where({ id: existingPos.id }).update({ quantity: newQty, average_price: newAvgPrice, margin: newMargin });
        }
        
        // 3. Update User Balance & Ledger
        const user = await trx('users').where({ id: order.user_id }).first();
        let balanceChange = -totalTaxes;
        
        await trx('ledger').insert({
            user_id: order.user_id,
            amount: -totalTaxes,
            type: 'TAXES',
            description: `Taxes & Charges for ${order.side} ${order.quantity} ${order.symbol}`
        });

        if (realizedPnl !== 0) {
            balanceChange += realizedPnl;
            await trx('orders').where({ id: order.id }).update({ realized_pnl: realizedPnl });
            await trx('ledger').insert({
                user_id: order.user_id,
                amount: realizedPnl,
                type: 'REALIZED_PNL',
                description: `Realized P&L for closing ${order.quantity} ${order.symbol}`
            });
        }
        if (marginRefund > 0) {
            balanceChange += marginRefund;
            await trx('ledger').insert({
                user_id: order.user_id,
                amount: marginRefund,
                type: 'MARGIN_RELEASE',
                description: `Margin released for closing ${order.quantity} ${order.symbol}`
           });
        }
        await trx('users').where({ id: order.user_id }).update({ balance: user.balance + balanceChange });
        
      } else {
        // Create new position
        await trx('positions').insert({
          user_id: order.user_id,
          symbol: order.symbol,
          quantity: qtyChange,
          average_price: execPrice,
          product_type: order.product_type || 'DEL',
          margin: Number(order.margin || 0)
        });
        
        // Update user balance to deduct taxes for this new position
        const user = await trx('users').where({ id: order.user_id }).first();
        await trx('users').where({ id: order.user_id }).update({ balance: user.balance - totalTaxes });
        
        await trx('ledger').insert({
            user_id: order.user_id,
            amount: -totalTaxes,
            type: 'TAXES',
            description: `Taxes & Charges for ${order.side} ${order.quantity} ${order.symbol}`
        });
      }

      console.log(`Executed Order ${order.id} for ${order.symbol} at ${execPrice} | PnL: ${realizedPnl} | Taxes: ${totalTaxes}`);
    });
  } catch (err) {
    console.error(`Failed to execute order ${order.id}:`, err);
  }
}

module.exports = { initOrderExecutor };
