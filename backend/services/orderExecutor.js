const db = require('../database/db');

function initOrderExecutor(priceCache, isSegmentMarketOpen = null) {
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

      const { isCommodityContract } = require('./instrumentsCache');
      for (const order of pendingOrders) {
        if (typeof isSegmentMarketOpen === 'function') {
          const isCom = isCommodityContract(order.symbol);
          const isExit = Boolean(order.is_exit || (order.remarks && /exit|square-off|close/i.test(order.remarks)));
          const mStatus = isSegmentMarketOpen(isCom, order.symbol, order.product_type, isExit);
          if (!mStatus || !mStatus.open) continue;
        }
        const ltp = priceCache[order.symbol]?.ltp;
        if (!ltp) continue; // No live price available yet
        await executeOrder(order, ltp);
      }
    } catch (err) {
      console.error('OrderExecutor Error:', err.message);
    } finally {
      isExecuting = false;
    }
  }, 60000); // Check every 60 seconds (Fallback only, MARKET orders now instantly execute)
}

const { calculateTaxes } = require('./taxCalculator');

async function spawnBracketOrders(trx, order, childQty) {
  // Check if SL or Target prices were provided on the parent order
  const hasSL = order.sl_price !== null && order.sl_price !== undefined && Number(order.sl_price) > 0;
  const hasTgt = order.tgt_price !== null && order.tgt_price !== undefined && Number(order.tgt_price) > 0;
  
  if (!hasSL && !hasTgt) return []; // Not a bracket order

  const finalQty = childQty !== undefined ? childQty : order.quantity;
  if (!finalQty || Number(finalQty) <= 0) return []; // No child orders if position is closed or invalid quantity
  
  // The side of the child orders is OPPOSITE to the parent order's side
  const childSide = order.side === 'BUY' ? 'SELL' : 'BUY';
  const triggerEngine = require('./triggerEngine');
  
  // ⚡ Dynamic Bracket Offset Protection (Prevents inverted targets/stops on Market orders or volume matching slippage)
  const actualFillPrice = Number(order.price || order.average_price || 0);
  const quoteAtPlacement = Number(order.quoted_price || order.trigger_price || 0);
  const isMarket = order.type === 'MARKET' || Boolean(order.isMarket);

  let finalSLPrice = hasSL ? Number(order.sl_price) : null;
  let finalTgtPrice = hasTgt ? Number(order.tgt_price) : null;

  if (actualFillPrice > 0) {
    if (order.side === 'BUY') {
      // 1. Calculate Target points offset for BUY
      let tgtOffset = 0;
      if (hasTgt) {
        if (quoteAtPlacement > 0 && Number(order.tgt_price) > quoteAtPlacement) {
          tgtOffset = Number(order.tgt_price) - quoteAtPlacement;
        } else if (Number(order.tgt_price) > actualFillPrice) {
          tgtOffset = Number(order.tgt_price) - actualFillPrice;
        } else {
          tgtOffset = Math.max(0.05, Math.round(actualFillPrice * 0.005 * 100) / 100);
        }
      }

      // 2. Calculate Stop Loss points offset for BUY
      let slOffset = 0;
      if (hasSL) {
        if (quoteAtPlacement > 0 && quoteAtPlacement > Number(order.sl_price)) {
          slOffset = quoteAtPlacement - Number(order.sl_price);
        } else if (actualFillPrice > Number(order.sl_price)) {
          slOffset = actualFillPrice - Number(order.sl_price);
        } else {
          slOffset = Math.max(0.05, Math.round(actualFillPrice * 0.01 * 100) / 100);
        }
      }

      // 3. For Market orders or whenever fill price reaches/exceeds target, maintain intended profit points
      if (hasTgt) {
        if (isMarket || finalTgtPrice <= actualFillPrice) {
          finalTgtPrice = Number((actualFillPrice + tgtOffset).toFixed(2));
        }
      }

      // 4. For Market orders or whenever fill price reaches/drops below SL, maintain intended risk cushion
      if (hasSL) {
        if (isMarket || finalSLPrice >= actualFillPrice) {
          finalSLPrice = Number(Math.max(0.05, actualFillPrice - slOffset).toFixed(2));
        }
      }
    } else if (order.side === 'SELL') {
      // 1. Calculate Target points offset for SELL (target is lower than entry)
      let tgtOffset = 0;
      if (hasTgt) {
        if (quoteAtPlacement > 0 && quoteAtPlacement > Number(order.tgt_price)) {
          tgtOffset = quoteAtPlacement - Number(order.tgt_price);
        } else if (actualFillPrice > Number(order.tgt_price)) {
          tgtOffset = actualFillPrice - Number(order.tgt_price);
        } else {
          tgtOffset = Math.max(0.05, Math.round(actualFillPrice * 0.005 * 100) / 100);
        }
      }

      // 2. Calculate Stop Loss points offset for SELL (SL is higher than entry)
      let slOffset = 0;
      if (hasSL) {
        if (quoteAtPlacement > 0 && Number(order.sl_price) > quoteAtPlacement) {
          slOffset = Number(order.sl_price) - quoteAtPlacement;
        } else if (Number(order.sl_price) > actualFillPrice) {
          slOffset = Number(order.sl_price) - actualFillPrice;
        } else {
          slOffset = Math.max(0.05, Math.round(actualFillPrice * 0.01 * 100) / 100);
        }
      }

      // 3. For Market orders or whenever fill price drops to/below target, maintain intended profit points
      if (hasTgt) {
        if (isMarket || finalTgtPrice >= actualFillPrice) {
          finalTgtPrice = Number(Math.max(0.05, actualFillPrice - tgtOffset).toFixed(2));
        }
      }

      // 4. For Market orders or whenever fill price rises to/above SL, maintain intended risk cushion
      if (hasSL) {
        if (isMarket || finalSLPrice <= actualFillPrice) {
          finalSLPrice = Number((actualFillPrice + slOffset).toFixed(2));
        }
      }
    }
  }

  let slOrder = null;
  let tgtOrder = null;

  if (hasSL && finalSLPrice) {
    slOrder = {
      user_id: order.user_id,
      symbol: order.symbol,
      type: 'SL-M', // Stop Loss Market
      side: childSide,
      quantity: finalQty,
      filled_quantity: 0,
      pending_quantity: finalQty,
      average_price: null,
      order_variety: 'REGULAR',
      price: null,
      status: 'PENDING_TRIGGER',
      trigger_price: finalSLPrice,
      trail_amount: order.trail_amount || null,
      product_type: order.product_type,
      trigger_type: order.trigger_type || (order.product_type === 'BO' ? 'BO' : order.product_type === 'CO' ? 'CO' : 'REGULAR'),
      parent_order_id: order.id,
      margin: 0,
      created_at: new Date(),
      updated_at: new Date()
    };
    const [slId] = await trx('orders').insert(slOrder).returning('id');
    slOrder.id = typeof slId === 'object' ? slId.id : slId;
  }

  if (hasTgt && finalTgtPrice) {
    tgtOrder = {
      user_id: order.user_id,
      symbol: order.symbol,
      type: 'LIMIT',
      side: childSide,
      quantity: finalQty,
      filled_quantity: 0,
      pending_quantity: finalQty,
      average_price: null,
      order_variety: 'REGULAR',
      price: finalTgtPrice,
      status: 'PENDING_TRIGGER',
      trigger_price: finalTgtPrice,
      product_type: order.product_type,
      trigger_type: order.trigger_type || (order.product_type === 'BO' ? 'BO' : order.product_type === 'CO' ? 'CO' : 'REGULAR'),
      parent_order_id: order.id,
      margin: 0,
      created_at: new Date(),
      updated_at: new Date()
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
  if (trx && typeof trx.on === 'function') {
    trx.on('commit', async () => {
      for (const ord of spawned) {
        await triggerEngine.addOrderToMemory(ord).catch(() => {});
      }
    });
  } else if (trx && typeof trx.executionPromise?.then === 'function') {
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
