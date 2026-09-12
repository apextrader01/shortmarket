const db = require('../database/db');

function initOrderExecutor(priceCache) {
  console.log('Starting Order Execution Engine...');

  let isExecuting = false;
  setInterval(async () => {
    if (isExecuting) return;
    isExecuting = true;
      // ⚡ Skip DB scan if all markets (Equities & MCX) are completely closed (nights / weekends)
      const now = new Date();
      const istParts = new Intl.DateTimeFormat('en-US', { timeZone: 'Asia/Kolkata', hour: 'numeric', minute: 'numeric', weekday: 'short', hour12: false }).formatToParts(now);
      const istH = parseInt(istParts.find(p => p.type === 'hour')?.value || '0', 10);
      const istM = parseInt(istParts.find(p => p.type === 'minute')?.value || '0', 10);
      const istDay = istParts.find(p => p.type === 'weekday')?.value;
      const isWeekend = (istDay === 'Sat' || istDay === 'Sun');
      const isMarketHours = !isWeekend && ((istH > 9 || (istH === 9 && istM >= 0)) && (istH < 23 || (istH === 23 && istM <= 30)));
      if (!isMarketHours) {
        isExecuting = false;
        return;
      }

      try {
        // Only handle MARKET orders here. LIMIT and PENDING_TRIGGER (SL/TP/CO/BO) orders
      // are owned by triggerEngine.js (in-memory, evaluated on every WS price tick) to
      // avoid double-execution races between the two engines.
      const pendingOrders = await db('orders').where({ status: 'PENDING', type: 'MARKET' });
      if (pendingOrders.length === 0) {
        isExecuting = false;
        return;
      }

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
    } finally {
      isExecuting = false;
    }
  }, 60000); // Check every 60 seconds (Fallback only, MARKET orders now instantly execute)
}

const { calculateTaxes } = require('./taxCalculator');

async function spawnBracketOrders(trx, order) {
  // Check if SL or Target prices were provided on the parent order
  const hasSL = order.sl_price !== null && order.sl_price !== undefined && Number(order.sl_price) > 0;
  const hasTgt = order.tgt_price !== null && order.tgt_price !== undefined && Number(order.tgt_price) > 0;
  
  if (!hasSL && !hasTgt) return []; // Not a bracket order
  
  // The side of the child orders is OPPOSITE to the parent order's side
  const childSide = order.side === 'BUY' ? 'SELL' : 'BUY';
  const triggerEngine = require('./triggerEngine');
  
  let slOrder = null;
  let tgtOrder = null;

  if (hasSL) {
    slOrder = {
      user_id: order.user_id,
      symbol: order.symbol,
      type: 'SL-M', // Stop Loss Market
      side: childSide,
      quantity: order.quantity,
      price: null,
      status: 'PENDING_TRIGGER',
      trigger_price: order.sl_price,
      trail_amount: order.trail_amount || null,
      product_type: order.product_type,
      trigger_type: order.trigger_type || (order.product_type === 'BO' ? 'BO' : order.product_type === 'CO' ? 'CO' : 'REGULAR'),
      parent_order_id: order.id,
      margin: 0
    };
    const [slId] = await trx('orders').insert(slOrder).returning('id');
    slOrder.id = typeof slId === 'object' ? slId.id : slId;
  }

  if (hasTgt) {
    tgtOrder = {
      user_id: order.user_id,
      symbol: order.symbol,
      type: 'LIMIT',
      side: childSide,
      quantity: order.quantity,
      price: order.tgt_price,
      status: 'PENDING_TRIGGER',
      trigger_price: order.tgt_price,
      product_type: order.product_type,
      trigger_type: order.trigger_type || (order.product_type === 'BO' ? 'BO' : order.product_type === 'CO' ? 'CO' : 'REGULAR'),
      parent_order_id: order.id,
      margin: 0
    };
    const [tgtId] = await trx('orders').insert(tgtOrder).returning('id');
    tgtOrder.id = typeof tgtId === 'object' ? tgtId.id : tgtId;
  }

  // Mutually link the Stop-Loss and Target orders for OCO tracking
  if (slOrder && tgtOrder) {
    slOrder.linked_order_id = tgtOrder.id;
    tgtOrder.linked_order_id = slOrder.id;
    await trx('orders').where({ id: slOrder.id }).update({ linked_order_id: tgtOrder.id });
    await trx('orders').where({ id: tgtOrder.id }).update({ linked_order_id: slOrder.id });
  }

  const spawned = [];
  if (slOrder) spawned.push(slOrder);
  if (tgtOrder) spawned.push(tgtOrder);

  // Hook into transaction completion to add orders to in-memory trigger engine
  // This guarantees that if the transaction rolls back, ghost orders are NOT added to memory
  if (trx && typeof trx.executionPromise?.then === 'function') {
    trx.executionPromise.then(async () => {
      for (const ord of spawned) {
        await triggerEngine.addOrderToMemory(ord).catch(() => {});
      }
    }).catch(() => {});
  } else {
    for (const ord of spawned) {
      await triggerEngine.addOrderToMemory(ord).catch(() => {});
    }
  }

  return spawned;
}

async function executeOrder(order, execPrice) {
  try {
    const triggerEngine = require('./triggerEngine');
    await triggerEngine.executeOrder(order, execPrice);
  } catch (err) {
    console.error(`Failed to execute order ${order.id}:`, err);
  }
}

module.exports = { initOrderExecutor, spawnBracketOrders };
