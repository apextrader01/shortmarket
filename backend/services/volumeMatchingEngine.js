const db = require('../database/db');
const LedgerService = require('./ledgerService');
const { calculateTaxes, isDerivativeContract } = require('./taxCalculator');

function normalizeSymbol(sym) {
  if (!sym || typeof sym !== 'string') return '';
  return sym.replace(/^(NSE:|BSE:|MCX:)/i, '').replace(/-EQ$/i, '').toUpperCase();
}

function getCachedPrice(priceCache, symbol) {
  if (!priceCache || !symbol) return {};
  if (priceCache[symbol]) return priceCache[symbol];
  const clean = symbol.replace(/^(NSE:|BSE:|MCX:)/i, '').replace(/-EQ$/i, '');
  if (priceCache[clean]) return priceCache[clean];
  if (priceCache[`NSE:${clean}`]) return priceCache[`NSE:${clean}`];
  if (priceCache[`NSE:${clean}-EQ`]) return priceCache[`NSE:${clean}-EQ`];
  if (priceCache[`BSE:${clean}`]) return priceCache[`BSE:${clean}`];
  if (priceCache[`MCX:${clean}`]) return priceCache[`MCX:${clean}`];
  return {};
}

class VolumeMatchingEngine {
  constructor() {
    this.priceCache = {};
    this.io = null;
    // symbol -> Array of active order objects (FIFO queue)
    this.symbolQueues = new Map();
    // orderId -> active order object
    this.activeOrders = new Map();
    // symbol -> last cumulative volume recorded from ticks
    this.lastSymbolVolume = new Map();
    // Prevent overlapping tick processing for same symbol
    this.processingSymbols = new Set();
    console.log('📊 Volume & Market Depth Matching Engine initialized.');
  }

  init(priceCacheRef, ioInstance) {
    this.priceCache = priceCacheRef || {};
    this.io = ioInstance || null;
    this.loadPendingVolumeOrders();
  }

  setSocketIo(ioInstance) {
    this.io = ioInstance;
  }

  /**
   * Load any PARTIAL_FILLED or PENDING market orders from DB on server startup.
   */
  async loadPendingVolumeOrders() {
    try {
      const pending = await db('orders')
        .whereIn('status', ['PARTIAL_FILLED'])
        .orWhere(builder => {
          builder.where({ status: 'PENDING', type: 'MARKET' });
        });

      for (const ord of pending) {
        this.enqueueOrder(ord);
      }
      if (pending.length > 0) {
        console.log(`📊 Loaded ${pending.length} resting volume-matching orders into queue.`);
      }
    } catch (err) {
      console.warn('VolumeMatchingEngine.loadPendingVolumeOrders error:', err.message);
    }
  }

  enqueueOrder(order) {
    if (!order || !order.id || !order.symbol) return;
    const sym = order.symbol;
    const normSym = normalizeSymbol(sym);
    const ordObj = {
      id: order.id,
      user_id: order.user_id,
      symbol: order.symbol,
      norm_symbol: normSym,
      order_variety: order.order_variety || 'REGULAR',
      type: order.type,
      side: order.side,
      quantity: Number(order.quantity),
      filled_quantity: Number(order.filled_quantity || 0),
      pending_quantity: order.pending_quantity !== undefined && order.pending_quantity !== null
        ? Number(order.pending_quantity)
        : Number(order.quantity) - Number(order.filled_quantity || 0),
      average_price: order.average_price ? Number(order.average_price) : null,
      price: order.price ? Number(order.price) : null,
      product_type: order.product_type,
      margin: Number(order.margin || 0),
      taxes: Number(order.taxes || 0),
      status: order.status || 'PENDING',
      sl_price: order.sl_price,
      tgt_price: order.tgt_price,
      trail_amount: order.trail_amount,
      parent_order_id: order.parent_order_id,
      created_at: order.created_at || new Date()
    };

    this.activeOrders.set(ordObj.id.toString(), ordObj);

    if (!this.symbolQueues.has(normSym)) {
      this.symbolQueues.set(normSym, []);
    }
    const queue = this.symbolQueues.get(normSym);
    if (!queue.some(o => o.id === ordObj.id)) {
      queue.push(ordObj);
    }
  }

  dequeueOrder(orderId, symbol) {
    if (!orderId) return;
    const ord = this.activeOrders.get(orderId.toString());
    const targetSym = symbol || ord?.symbol;
    this.activeOrders.delete(orderId.toString());
    if (targetSym) {
      const normSym = normalizeSymbol(targetSym);
      if (this.symbolQueues.has(normSym)) {
        const queue = this.symbolQueues.get(normSym);
        const filtered = queue.filter(o => o.id.toString() !== orderId.toString());
        if (filtered.length === 0) {
          this.symbolQueues.delete(normSym);
        } else {
          this.symbolQueues.set(normSym, filtered);
        }
      }
    }
  }

  /**
   * Submit an order for volume & depth matching.
   * Step 1: Immediately fill whatever is available in Level-2 Order Book Depth.
   * Step 2: If quantity remains, put the rest in the tick-by-tick volume queue.
   */
  async submitOrder(order, baseLtp) {
    this.enqueueOrder(order);
    const ordObj = this.activeOrders.get(order.id.toString());
    if (!ordObj) return;

    // Check if limit order is currently unmarketable
    if (ordObj.type === 'LIMIT' && ordObj.price) {
      const limitPrice = Number(ordObj.price);
      if (ordObj.side === 'BUY' && baseLtp > limitPrice) {
        // Market is above buy limit, wait for incoming ticks at or below limit
        return;
      }
      if (ordObj.side === 'SELL' && baseLtp < limitPrice) {
        // Market is below sell limit, wait for incoming ticks at or above limit
        return;
      }
    }

    // Call Auction (CAS) 09:08 AM opening equilibrium match fills 100% of matched orders at baseLtp
    if (ordObj.order_variety === 'CAS') {
      if (baseLtp && baseLtp > 0 && ordObj.pending_quantity > 0) {
        await this.processSliceFill(ordObj, ordObj.pending_quantity, baseLtp);
      }
      return;
    }

    const cached = getCachedPrice(this.priceCache, ordObj.symbol);
    const depth = cached.asks && cached.bids ? cached : (cached.depth || {});
    const book = ordObj.side === 'BUY' ? (depth.asks || []) : (depth.bids || []);

    let depthFilled = 0;
    let totalDepthCost = 0;

    // Check if Level-2 market depth exists
    if (Array.isArray(book) && book.length > 0) {
      let remainingToFill = ordObj.pending_quantity;

      for (const level of book) {
        const levelPrice = Number(level.price);
        const levelQty = Number(level.qty || level.quantity || level.volume || 0);

        if (levelPrice > 0 && levelQty > 0) {
          // Verify level conforms to limit order boundary
          if (ordObj.type === 'LIMIT' && ordObj.price) {
            const limitPrice = Number(ordObj.price);
            if (ordObj.side === 'BUY' && levelPrice > limitPrice) break;
            if (ordObj.side === 'SELL' && levelPrice < limitPrice) break;
          }

          const fillQty = Math.min(remainingToFill, levelQty);
          if (fillQty > 0) {
            depthFilled += fillQty;
            totalDepthCost += (fillQty * levelPrice);
            remainingToFill -= fillQty;
          }
          if (remainingToFill <= 0) break;
        }
      }
    }

    if (depthFilled > 0) {
      const sliceAvgPrice = Number((totalDepthCost / depthFilled).toFixed(2));
      await this.processSliceFill(ordObj, depthFilled, sliceAvgPrice);
    } else {
      // If depth is not available in mock/feed or zero depth, fill a small initial slice
      // only if price satisfies order limit constraint (if limit order)
      let canFillInitial = true;
      if (ordObj.type === 'LIMIT' && ordObj.price) {
        const limitPrice = Number(ordObj.price);
        if (ordObj.side === 'BUY' && baseLtp > limitPrice) canFillInitial = false;
        if (ordObj.side === 'SELL' && baseLtp < limitPrice) canFillInitial = false;
      }

      if (canFillInitial) {
        const initialSlice = Math.min(ordObj.pending_quantity, Math.max(1, Math.floor(ordObj.pending_quantity * 0.2)));
        if (baseLtp && baseLtp > 0 && initialSlice > 0) {
          await this.processSliceFill(ordObj, initialSlice, baseLtp);
        }
      }
    }

    // Sync back to caller's order reference if provided
    if (order) {
      order.filled_quantity = ordObj.filled_quantity;
      order.pending_quantity = ordObj.pending_quantity;
      order.average_price = ordObj.average_price;
      order.status = ordObj.status;
      order.taxes = ordObj.taxes;
    }

    // Initialize last volume tracker for this symbol
    if (cached.volume) {
      const normSym = normalizeSymbol(ordObj.symbol);
      this.lastSymbolVolume.set(normSym, Number(cached.volume));
    }
  }

  /**
   * Retrieve active order by ID
   */
  getOrder(orderId) {
    return this.activeOrders.get(orderId?.toString());
  }

  /**
   * Called on every live WebSocket tick from Fyers.
   */
  async onTick(symbol, tick) {
    if (!symbol || !tick) return;
    const normSym = normalizeSymbol(symbol);
    const queue = this.symbolQueues.get(normSym);
    if (!queue || queue.length === 0) {
      if (tick.volume || tick.vol_traded_today) {
        this.lastSymbolVolume.set(normSym, Number(tick.volume || tick.vol_traded_today));
      }
      return;
    }

    if (this.processingSymbols.has(normSym)) return;
    this.processingSymbols.add(normSym);

    try {
      const currentVol = Number(tick.volume || tick.vol_traded_today || 0);
      const prevVol = this.lastSymbolVolume.get(normSym) || currentVol;
      let deltaVol = currentVol > prevVol ? (currentVol - prevVol) : 0;
      this.lastSymbolVolume.set(normSym, currentVol);

      const ltp = Number(tick.ltp || 0);
      if (ltp <= 0) return;

      // If deltaVol is 0 (e.g. tick update without volume change), allow a minimum
      // natural heartbeat volume for liquid stocks during active market hours
      if (deltaVol <= 0 && currentVol > 50000) {
        deltaVol = Math.floor(Math.random() * 20) + 1; // Natural micro-flow
      }

      if (deltaVol <= 0) return; // Low volume stock with 0 trades: wait for real volume

      // Distribute available tick volume to active orders in FIFO order
      let availableVol = deltaVol;
      const snapshotQueue = [...queue];

      for (let i = 0; i < snapshotQueue.length; i++) {
        const order = snapshotQueue[i];
        if (!order || !this.activeOrders.has(order.id.toString()) || order.pending_quantity <= 0) continue;

        // Check limit price constraint for limit orders
        if (order.type === 'LIMIT' && order.price) {
          const limitPrice = Number(order.price);
          if (order.side === 'BUY' && ltp > limitPrice) continue;
          if (order.side === 'SELL' && ltp < limitPrice) continue;
        }

        // Realistic participation rate: Order can absorb up to 50% of tick volume
        const maxFill = Math.min(order.pending_quantity, Math.max(1, Math.floor(availableVol * 0.5)));
        const fillQty = Math.min(order.pending_quantity, maxFill);

        if (fillQty > 0) {
          availableVol -= fillQty;
          await this.processSliceFill(order, fillQty, ltp);
        }

        if (availableVol <= 0) break;
      }
    } catch (err) {
      console.error(`VolumeMatchingEngine onTick error for ${symbol}:`, err.message);
    } finally {
      this.processingSymbols.delete(normSym);
    }
  }

  /**
   * Atomically process a slice fill for an order in the database.
   */
  async processSliceFill(order, sliceQty, slicePrice) {
    if (!order || sliceQty <= 0 || slicePrice <= 0) return;

    try {
      await db.transaction(async (trx) => {
        // Lock user to prevent balance / position race conditions
        await trx.raw('SELECT pg_advisory_xact_lock(?)', [order.user_id]);

        const currentOrder = await trx('orders').where({ id: order.id }).forUpdate().first();
        if (!currentOrder || currentOrder.status === 'CANCELLED' || currentOrder.status === 'EXECUTED') {
          this.dequeueOrder(order.id, order.symbol);
          return;
        }

        const prevFilled = Number(currentOrder.filled_quantity || 0);
        const prevAvg = Number(currentOrder.average_price || slicePrice);
        const totalQty = Number(currentOrder.quantity);

        // Deduct Brokerage & Regulatory Taxes for this executed slice
        const sliceTaxes = await LedgerService.chargeExecutionTaxes(
          trx,
          order.user_id,
          order.symbol,
          order.product_type,
          order.side,
          sliceQty,
          slicePrice
        );
        const currentTaxes = Number(currentOrder.taxes || 0);
        const accumulatedTaxes = Math.round((currentTaxes + sliceTaxes + Number.EPSILON) * 100) / 100;

        // Safe definition of proportional slice margin accessible across all branches
        const sliceMargin = totalQty > 0 ? (sliceQty / totalQty) * Number(order.margin || 0) : Number(order.margin || 0);

        const newFilled = Math.min(totalQty, prevFilled + sliceQty);
        const newPending = Math.max(0, totalQty - newFilled);
        const newAvgPrice = prevFilled > 0
          ? Number((((prevFilled * prevAvg) + (sliceQty * slicePrice)) / newFilled).toFixed(2))
          : slicePrice;

        const isComplete = newPending <= 0;
        const newStatus = isComplete ? 'EXECUTED' : 'PARTIAL_FILLED';

        // 1. Update Order record
        await trx('orders').where({ id: order.id }).update({
          filled_quantity: newFilled,
          pending_quantity: newPending,
          average_price: newAvgPrice,
          price: isComplete ? newAvgPrice : (currentOrder.price || newAvgPrice),
          taxes: accumulatedTaxes,
          status: newStatus,
          updated_at: new Date()
        });

        // 2. Incremental Position Update
        const cleanSym = order.symbol.includes(':') ? order.symbol.split(':')[1] : order.symbol;
        const isIntradayProduct = (order.product_type === 'INT' || order.product_type === 'BO' || order.product_type === 'CO');
        const isDeliveryProduct = (order.product_type === 'CNC' || order.product_type === 'DELIVERY' || order.product_type === 'DEL');

        const existingPos = await trx('positions')
          .where({ user_id: order.user_id })
          .where(builder => {
            if (isIntradayProduct) {
              builder.whereIn('product_type', ['INT', 'BO', 'CO']);
            } else if (isDeliveryProduct) {
              builder.whereIn('product_type', ['DEL', 'CNC', 'DELIVERY']);
            } else {
              builder.where({ product_type: order.product_type });
            }
          })
          .where(b => {
            b.where({ symbol: order.symbol })
              .orWhere({ symbol: cleanSym })
              .orWhere({ symbol: `NSE:${cleanSym}` })
              .orWhere({ symbol: `BSE:${cleanSym}` })
              .orWhere({ symbol: `MCX:${cleanSym}` });
          })
          .whereNot({ quantity: 0 })
          .first();

        const isClosing = existingPos && (
          (existingPos.quantity > 0 && order.side === 'SELL') ||
          (existingPos.quantity < 0 && order.side === 'BUY')
        );

        if (isClosing) {
          const absPosQty = Math.abs(Number(existingPos.quantity));
          const closeQty = Math.min(sliceQty, absPosQty);
          const leftoverQty = sliceQty - closeQty;
          let realizedPnl = 0;

          if (existingPos.quantity > 0) {
            realizedPnl = (slicePrice - Number(existingPos.average_price)) * closeQty;
          } else {
            realizedPnl = (Number(existingPos.average_price) - slicePrice) * closeQty;
          }
          realizedPnl = Math.round((realizedPnl + Number.EPSILON) * 100) / 100;

          const propClosed = closeQty / absPosQty;
          const marginRefund = Math.round((Number(existingPos.margin || 0) * propClosed) * 100) / 100;

          const newPosQty = existingPos.quantity > 0 ? (existingPos.quantity - closeQty) : (existingPos.quantity + closeQty);

          if (newPosQty === 0) {
            await trx('positions').where({ id: existingPos.id }).update({
              quantity: 0,
              closed_quantity: Number(existingPos.closed_quantity || 0) + closeQty,
              exit_price: slicePrice,
              realized_pnl: Number(existingPos.realized_pnl || 0) + realizedPnl,
              margin: 0,
              updated_at: new Date()
            });

            // Position Reversal: If order slice quantity exceeds closed position, open reverse position
            if (leftoverQty > 0) {
              const revSide = order.side === 'BUY' ? 1 : -1;
              const revPosQty = revSide * leftoverQty;
              const { calculateRequiredMargin } = require('./marginEngine');
              const calcMargin = calculateRequiredMargin(order.symbol, order.product_type, order.side, leftoverQty, slicePrice);
              const revMargin = calcMargin > 0 ? calcMargin : (totalQty > 0 ? (leftoverQty / totalQty) * Number(order.margin || 0) : 0);

              const orderMarginBlocked = Number(order.margin || 0);
              const marginDelta = revMargin - orderMarginBlocked;
              if (marginDelta > 0) {
                await trx('users').where({ id: order.user_id }).decrement('balance', marginDelta);
                await trx('ledger').insert({
                  user_id: order.user_id,
                  amount: -marginDelta,
                  type: 'MARGIN_BLOCK',
                  description: `Margin blocked for reversed position ${revPosQty} ${order.symbol}`
                });
              } else if (marginDelta < 0) {
                const excessRefund = Math.round((Math.abs(marginDelta) + Number.EPSILON) * 100) / 100;
                await trx('users').where({ id: order.user_id }).increment('balance', excessRefund);
                await trx('ledger').insert({
                  user_id: order.user_id,
                  amount: excessRefund,
                  type: 'MARGIN_RELEASE',
                  description: `Excess margin refunded on reversal ${revPosQty} ${order.symbol}`
                });
              }

              await trx('positions').insert({
                user_id: order.user_id,
                symbol: order.symbol,
                quantity: revPosQty,
                average_price: slicePrice,
                product_type: existingPos.product_type || order.product_type || 'INT',
                margin: revMargin,
                updated_at: new Date()
              });
            }
          } else {
            await trx('positions').where({ id: existingPos.id }).update({
              quantity: newPosQty,
              closed_quantity: Number(existingPos.closed_quantity || 0) + closeQty,
              realized_pnl: Number(existingPos.realized_pnl || 0) + realizedPnl,
              margin: Math.max(0, Number(existingPos.margin || 0) - marginRefund),
              updated_at: new Date()
            });
          }

          // Balance & Ledger updates
          const user = await trx('users').where({ id: order.user_id }).first();
          const netCredit = marginRefund + realizedPnl;
          await trx('users').where({ id: order.user_id }).update({
            balance: Math.round((Number(user.balance) + netCredit) * 100) / 100
          });

          if (marginRefund > 0) {
            await trx('ledger').insert({
              user_id: order.user_id,
              amount: marginRefund,
              type: 'MARGIN_RELEASE',
              description: `Margin released for partial close: ${closeQty} ${order.symbol}`
            });
          }

          if (realizedPnl !== 0) {
            await trx('ledger').insert({
              user_id: order.user_id,
              amount: realizedPnl,
              type: 'REALIZED_PNL',
              description: `Realized P&L on ${closeQty} ${order.symbol}`
            });
          }
        } else if (order.side === 'SELL' && (order.product_type === 'DEL' || order.product_type === 'CNC' || order.product_type === 'DELIVERY')) {
          // Offsetting overnight delivery shares from holdings table
          const holding = await trx('holdings')
            .where({ user_id: order.user_id })
            .where(b => {
              b.where({ symbol: order.symbol })
                .orWhere({ symbol: cleanSym })
                .orWhere({ symbol: `NSE:${cleanSym}` })
                .orWhere({ symbol: `BSE:${cleanSym}` })
                .orWhere({ symbol: `MCX:${cleanSym}` });
            })
            .where('quantity', '>', 0)
            .first();

          if (holding) {
            const hQty = Number(holding.quantity);
            const hAvg = Number(holding.average_price);
            const closeQty = Math.min(sliceQty, hQty);
            const newHQty = hQty - closeQty;

            if (newHQty <= 0) {
              await trx('holdings').where({ id: holding.id }).del();
            } else {
              await trx('holdings').where({ id: holding.id }).update({ quantity: newHQty });
            }

            const realizedPnl = Math.round(((slicePrice - hAvg) * closeQty + Number.EPSILON) * 100) / 100;
            const grossProceeds = Math.round((slicePrice * closeQty) * 100) / 100;

            // Record or consolidate closed position for today to avoid duplicate fragmented rows
            const todayStart = new Date();
            todayStart.setHours(0, 0, 0, 0);

            const existingClosedPos = await trx('positions')
              .where({ user_id: order.user_id, symbol: order.symbol, quantity: 0 })
              .where('updated_at', '>=', todayStart)
              .first();

            if (existingClosedPos) {
              const prevClosedQty = Number(existingClosedPos.closed_quantity || 0);
              const prevExitPrice = Number(existingClosedPos.exit_price || slicePrice);
              const newTotalClosed = prevClosedQty + closeQty;
              const newAvgExitPrice = newTotalClosed > 0
                ? Number((((prevClosedQty * prevExitPrice) + (closeQty * slicePrice)) / newTotalClosed).toFixed(2))
                : slicePrice;

              await trx('positions').where({ id: existingClosedPos.id }).update({
                closed_quantity: newTotalClosed,
                exit_price: newAvgExitPrice,
                realized_pnl: Number(existingClosedPos.realized_pnl || 0) + realizedPnl,
                updated_at: new Date()
              });
            } else {
              await trx('positions').insert({
                user_id: order.user_id,
                symbol: order.symbol,
                quantity: 0,
                closed_quantity: closeQty,
                average_price: hAvg,
                exit_price: slicePrice,
                realized_pnl: realizedPnl,
                product_type: order.product_type || 'DEL',
                updated_at: new Date()
              });
            }

            // Credit net sale proceeds to user balance
            const user = await trx('users').where({ id: order.user_id }).first();
            await trx('users').where({ id: order.user_id }).update({
              balance: Math.round((Number(user.balance) + grossProceeds) * 100) / 100
            });

            await trx('ledger').insert({
              user_id: order.user_id,
              amount: grossProceeds,
              type: 'CREDIT',
              description: `Delivery Holding Sale: ${closeQty} ${order.symbol} @ ₹${slicePrice}`
            });
          } else {
            const isDeriv = isDerivativeContract(order.symbol);
            if (!isDeriv) {
              console.warn(`[SAFEGUARD] Blocked negative DEL cash equity position for user ${order.user_id}, symbol ${order.symbol}`);
              return;
            }
            const initialPosQty = -sliceQty;
            await trx('positions').insert({
              user_id: order.user_id,
              symbol: order.symbol,
              quantity: initialPosQty,
              average_price: slicePrice,
              product_type: order.product_type || 'INT',
              margin: sliceMargin,
              updated_at: new Date()
            });
          }
        } else {
          // Opening or adding to position
          if (existingPos) {
            const prevPosQty = Number(existingPos.quantity);
            const prevPosAvg = Number(existingPos.average_price);
            const addQty = order.side === 'BUY' ? sliceQty : -sliceQty;
            const newPosQty = prevPosQty + addQty;
            const newPosAvg = Number((((Math.abs(prevPosQty) * prevPosAvg) + (sliceQty * slicePrice)) / Math.abs(newPosQty)).toFixed(2));

            await trx('positions').where({ id: existingPos.id }).update({
              quantity: newPosQty,
              average_price: newPosAvg,
              margin: Number(existingPos.margin || 0) + sliceMargin,
              updated_at: new Date()
            });
          } else {
            const initialPosQty = order.side === 'BUY' ? sliceQty : -sliceQty;
            await trx('positions').insert({
              user_id: order.user_id,
              symbol: order.symbol,
              quantity: initialPosQty,
              average_price: slicePrice,
              product_type: order.product_type || 'INT',
              margin: sliceMargin,
              updated_at: new Date()
            });
          }
        }

        // Update in-memory state
        order.filled_quantity = newFilled;
        order.pending_quantity = newPending;
        order.average_price = newAvgPrice;
        order.taxes = accumulatedTaxes;
        order.status = newStatus;

        if (isComplete) {
          this.dequeueOrder(order.id, order.symbol);

          // 3. Bracket Order (CO/BO) Leg Generation upon completion
          const hasSL = (currentOrder.sl_price && Number(currentOrder.sl_price) > 0) || (order.sl_price && Number(order.sl_price) > 0);
          const hasTgt = (currentOrder.tgt_price && Number(currentOrder.tgt_price) > 0) || (order.tgt_price && Number(order.tgt_price) > 0);

          if (hasSL || hasTgt || order.product_type === 'BO' || order.product_type === 'CO') {
            const { spawnBracketOrders } = require('./orderExecutor');
            await spawnBracketOrders(trx, {
              ...currentOrder,
              ...order,
              price: newAvgPrice,
              quantity: newFilled
            }, newFilled);
          }
        }

        // Broadcast real-time partial fill to user socket
        if (this.io) {
          this.io.emit('order_slice_filled', {
            orderId: order.id,
            userId: order.user_id,
            symbol: order.symbol,
            sliceQty,
            slicePrice,
            filledQty: newFilled,
            pendingQty: newPending,
            avgPrice: newAvgPrice,
            taxes: accumulatedTaxes,
            status: newStatus
          });
          this.io.emit('sync_user_data', { userId: order.user_id });
        }
      });
    } catch (err) {
      console.error(`Error processing slice fill for order ${order.id}:`, err.message);
    }
  }

  /**
   * Update resting order in-memory if quantity or price is modified via API.
   */
  updateOrder(orderId, updates) {
    if (!orderId) return;
    const ordObj = this.activeOrders.get(orderId.toString());
    if (ordObj && updates) {
      if (updates.quantity !== undefined) ordObj.quantity = Number(updates.quantity);
      if (updates.pending_quantity !== undefined) ordObj.pending_quantity = Number(updates.pending_quantity);
      if (updates.price !== undefined) ordObj.price = updates.price ? Number(updates.price) : null;
      if (updates.margin !== undefined) ordObj.margin = Number(updates.margin);
      if (updates.status !== undefined) ordObj.status = updates.status;
      if (ordObj.pending_quantity <= 0 || ordObj.status === 'CANCELLED' || ordObj.status === 'EXECUTED') {
        this.dequeueOrder(orderId, ordObj.symbol);
      }
    }
  }

  /**
   * Cancel the remaining unfilled portion of a PARTIAL_FILLED order.
   */
  async cancelPartialOrder(orderId, userId) {
    let refundAmount = 0;

    await db.transaction(async (trx) => {
      await trx.raw('SELECT pg_advisory_xact_lock(?)', [userId]);

      const order = await trx('orders').where({ id: orderId, user_id: userId }).forUpdate().first();
      if (!order) throw new Error('Order not found');
      if (order.status !== 'PARTIAL_FILLED' && order.status !== 'PENDING') {
        throw new Error(`Cannot cancel order in status ${order.status}`);
      }

      const totalQty = Number(order.quantity);
      const pendingQty = Number(order.pending_quantity || (totalQty - Number(order.filled_quantity || 0)));
      const totalMargin = Number(order.margin || 0);

      // Pro-rata refund for the unfilled portion
      if (totalQty > 0 && pendingQty > 0 && totalMargin > 0) {
        refundAmount = Math.round(((pendingQty / totalQty) * totalMargin) * 100) / 100;
      }

      await trx('orders').where({ id: orderId }).update({
        status: 'CANCELLED',
        remarks: `Partially filled: ${order.filled_quantity || 0} executed, ${pendingQty} cancelled`,
        updated_at: new Date()
      });

      // If partially filled BO/CO is cancelled, spawn protection legs for the filled portion
      const prevFilled = Number(order.filled_quantity || 0);
      if (prevFilled > 0) {
        const hasSL = order.sl_price && Number(order.sl_price) > 0;
        const hasTgt = order.tgt_price && Number(order.tgt_price) > 0;
        if (hasSL || hasTgt || order.product_type === 'BO' || order.product_type === 'CO') {
          const existingChild = await trx('orders').where({ parent_order_id: order.id }).first();
          if (!existingChild) {
            const { spawnBracketOrders } = require('./orderExecutor');
            await spawnBracketOrders(trx, {
              ...order,
              price: order.average_price,
              quantity: prevFilled
            }, prevFilled);
          }
        }
      }

      if (refundAmount > 0) {
        const user = await trx('users').where({ id: userId }).first();
        await trx('users').where({ id: userId }).update({
          balance: Math.round((Number(user.balance) + refundAmount) * 100) / 100
        });

        await trx('ledger').insert({
          user_id: userId,
          amount: refundAmount,
          type: 'MARGIN_RELEASE',
          description: `Refund for unfilled portion of cancelled order: ${pendingQty} ${order.symbol}`
        });
      }
    });

    this.dequeueOrder(orderId);
    if (this.io) {
      this.io.emit('sync_user_data', { userId });
    }
    return { success: true, refundAmount };
  }
}

const volumeMatchingEngine = new VolumeMatchingEngine();
module.exports = volumeMatchingEngine;
