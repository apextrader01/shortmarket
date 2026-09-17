const db = require('../database/db');
const LedgerService = require('./ledgerService');
const { calculateTaxes, isDerivativeContract } = require('./taxCalculator');

function normalizeSymbol(sym) {
  if (!sym || typeof sym !== 'string') return '';
  return sym
    .replace(/^(NSE:|BSE:|MCX:)/i, '')
    .replace(/-(EQ|A|B|T|X|XT|Z|P|M|SM|BE|BZ)$/i, '')
    .toUpperCase();
}

function getCachedPrice(priceCache, symbol) {
  if (!priceCache || !symbol) return {};
  if (priceCache[symbol]) return priceCache[symbol];
  const clean = symbol
    .replace(/^(NSE:|BSE:|MCX:)/i, '')
    .replace(/-(EQ|A|B|T|X|XT|Z|P|M|SM|BE|BZ)$/i, '');
  if (priceCache[clean]) return priceCache[clean];
  if (priceCache[`NSE:${clean}`]) return priceCache[`NSE:${clean}`];
  if (priceCache[`NSE:${clean}-EQ`]) return priceCache[`NSE:${clean}-EQ`];
  if (priceCache[`BSE:${clean}`]) return priceCache[`BSE:${clean}`];
  if (priceCache[`BSE:${clean}-A`]) return priceCache[`BSE:${clean}-A`];
  if (priceCache[`BSE:${clean}-B`]) return priceCache[`BSE:${clean}-B`];
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
   * Load any PARTIAL_FILLED or PENDING market orders from DB on server startup or cluster sync.
   */
  async loadPendingVolumeOrders() {
    try {
      const pending = await db('orders')
        .whereIn('status', ['PARTIAL_FILLED'])
        .orWhere(builder => {
          builder.where({ status: 'PENDING', type: 'MARKET' });
        });

      const symbolsToSubscribe = new Set();
      for (const ord of pending) {
        this.enqueueOrder(ord);
        if (ord.symbol) symbolsToSubscribe.add(ord.symbol);
      }

      // Ensure Fyers WebSocket actively subscribes to all resting volume order symbols
      if (symbolsToSubscribe.size > 0) {
        try {
          const { addSubscriptionBatch } = require('./fyers');
          if (addSubscriptionBatch) addSubscriptionBatch(Array.from(symbolsToSubscribe));
        } catch (e) {}
      }

      if (pending.length > 0) {
        console.log(`📊 Loaded ${pending.length} resting volume-matching orders into queue.`);
      }
    } catch (err) {
      console.warn('VolumeMatchingEngine.loadPendingVolumeOrders error:', err.message);
    }
  }

  getActiveSymbols() {
    const symbols = [];
    for (const [normSym, q] of this.symbolQueues.entries()) {
      if (q && q.length > 0) {
        q.forEach(ord => {
          if (ord.symbol && !symbols.includes(ord.symbol)) symbols.push(ord.symbol);
        });
      }
    }
    return symbols;
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
      created_at: order.created_at || new Date(),
      _lastFillTime: Date.now()
    };

    this.activeOrders.set(ordObj.id.toString(), ordObj);

    if (!this.symbolQueues.has(normSym)) {
      this.symbolQueues.set(normSym, []);
    }
    const queue = this.symbolQueues.get(normSym);
    const existingIdx = queue.findIndex(o => o.id === ordObj.id);
    if (existingIdx !== -1) {
      queue[existingIdx] = ordObj;
    } else {
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

    const { isDerivativeContract, isCommodityContract } = require('./instrumentsCache');
    // High-liquidity segment applies ONLY to actual derivative/commodity contracts (e.g. NIFTY26SEPFUT, CRUDEOILM).
    // Cash equity stocks (e.g. NSE:VMM, NSE:KITEX, NSE:RELIANCE) are NEVER treated as high liquidity derivatives,
    // even if F&O contracts exist for the company. Cash equity orders must respect actual volume & depth.
    const isHighLiquiditySegment = isDerivativeContract(ordObj.symbol) || isCommodityContract(ordObj.symbol);
    const totalOrderQty = Number(ordObj.pending_quantity || ordObj.quantity || 0);
    const isRetailOrder = totalOrderQty <= 500;
    const canInstantSweep = isHighLiquiditySegment || isRetailOrder;

    // For bulk / whale cash equity orders (> 500 shares), strictly limit initial depth matching to at most 500 shares
    const depthCap = canInstantSweep ? ordObj.pending_quantity : Math.min(ordObj.pending_quantity, 500);

    let depthFilled = 0;
    let totalDepthCost = 0;

    // Check if Level-2 market depth exists
    if (Array.isArray(book) && book.length > 0) {
      let remainingToFill = depthCap;

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

    // Option B: Calculate realistic market impact slippage for illiquid cash equities
    const calculateMarketSlippage = (order, basePrice) => {
      if (!basePrice || basePrice <= 0) return basePrice;
      const qty = Number(order.pending_quantity || order.quantity || 0);
      if (qty <= 100) return basePrice; // Retail micro-order: zero slippage

      if (isHighLiquiditySegment) return basePrice; // High-liquidity F&O / Commodities / Index: zero slippage

      const depthTotalQty = Array.isArray(book) ? book.reduce((sum, lvl) => sum + Number(lvl.qty || lvl.quantity || lvl.volume || 0), 0) : 0;
      const liveDailyVol = Number(cached.volume || cached.vol_traded_today || 0);
      const marketTotalQty = Number(order.side === 'BUY' ? (cached.totSellQuan || 0) : (cached.totBuyQuan || 0));

      // Dynamic effective liquidity: incorporates today's volume, total market quotes, and orderbook depth
      const effectiveVolume = Math.max(liveDailyVol, marketTotalQty, depthTotalQty * 10);

      // Liquid stock or 5x-10x volume surge today (effective volume >= 100,000)
      if (effectiveVolume >= 100000) return basePrice;

      // Order is very small relative to daily volume (< 5% of daily volume)
      if (effectiveVolume > 0 && (qty / effectiveVolume) <= 0.05) return basePrice;

      // Thinly traded / illiquid stock bulk market order: calculate realistic market impact
      let slippageRatio = 0.01;
      if (effectiveVolume > 0) {
        const impactRatio = qty / effectiveVolume;
        // Realistic scaling: 1.5% per 1.0x daily volume, capped at 5% (standard exchange circuit band)
        slippageRatio = Math.min(0.05, Math.max(0.005, impactRatio * 0.015));
      } else {
        slippageRatio = 0.02; // Default 2% for unquoted dead scrips
      }

      if (order.side === 'BUY') {
        return Number((basePrice * (1 + slippageRatio)).toFixed(2));
      } else {
        return Number((basePrice * (1 - slippageRatio)).toFixed(2));
      }
    };

    const depthTotalQty = Array.isArray(book) ? book.reduce((sum, lvl) => sum + Number(lvl.qty || lvl.quantity || lvl.volume || 0), 0) : 0;
    const liveDailyVol = Number(cached.volume || cached.vol_traded_today || 0);
    const marketTotalQty = Number(ordObj.side === 'BUY' ? (cached.totSellQuan || 0) : (cached.totBuyQuan || 0));
    const effectiveVolume = Math.max(liveDailyVol, marketTotalQty, depthTotalQty * 10);

    if (depthFilled > 0) {
      const sliceAvgPrice = Number((totalDepthCost / depthFilled).toFixed(2));
      await this.processSliceFill(ordObj, depthFilled, sliceAvgPrice);

      // For MARKET orders: High-liquidity F&O / indices and retail cash equity orders sweep remaining quantity immediately.
      // Bulk orders on illiquid equities (e.g. 1 Lakh KITEX, 1 Lakh VMM) do NOT sweep 100% out of thin air; remaining qty paces via onTick().
      if ((ordObj.type === 'MARKET' || ordObj.isMarket) && ordObj.pending_quantity > 0 && baseLtp > 0) {
        if (canInstantSweep) {
          const sweepPrice = calculateMarketSlippage(ordObj, baseLtp);
          if (sweepPrice === baseLtp) {
            await this.processSliceFill(ordObj, ordObj.pending_quantity, baseLtp);
          } else {
            await this.processSliceFill(ordObj, ordObj.pending_quantity, sweepPrice);
          }
        }
      }
    } else {
      if (ordObj.type === 'MARKET' || ordObj.isMarket) {
        if (baseLtp && baseLtp > 0 && ordObj.pending_quantity > 0) {
          if (canInstantSweep) {
            // Liquid F&O / retail cash orders execute 100% immediately at market price (baseLtp) with Option B realism
            const sweepPrice = calculateMarketSlippage(ordObj, baseLtp);
            if (sweepPrice === baseLtp) {
              await this.processSliceFill(ordObj, ordObj.pending_quantity, baseLtp);
            } else {
              await this.processSliceFill(ordObj, ordObj.pending_quantity, sweepPrice);
            }
          } else {
            // Bulk order on illiquid stock with zero depth: execute initial participation slice, queue remaining for onTick
            const initialSlice = Math.min(ordObj.pending_quantity, Math.max(100, Math.floor(Math.min(effectiveVolume > 0 ? effectiveVolume * 0.01 : 500, 500))));
            const sweepPrice = calculateMarketSlippage({ ...ordObj, pending_quantity: initialSlice }, baseLtp);
            await this.processSliceFill(ordObj, initialSlice, sweepPrice);
          }
        }
      } else {
        // For LIMIT orders: check if marketable against baseLtp
        let isMarketable = false;
        if (ordObj.type === 'LIMIT' && ordObj.price && baseLtp > 0) {
          const limitPrice = Number(ordObj.price);
          if (ordObj.side === 'BUY' && baseLtp <= limitPrice) isMarketable = true;
          if (ordObj.side === 'SELL' && baseLtp >= limitPrice) isMarketable = true;
        }

        if (isMarketable && ordObj.pending_quantity > 0) {
          if (canInstantSweep) {
            await this.processSliceFill(ordObj, ordObj.pending_quantity, baseLtp);
          } else {
            const initialSlice = Math.min(ordObj.pending_quantity, Math.max(100, Math.floor(Math.min(effectiveVolume > 0 ? effectiveVolume * 0.01 : 500, 500))));
            await this.processSliceFill(ordObj, initialSlice, baseLtp);
          }
        }
      }
    }

    // Automatically dequeue order if completely executed
    if (ordObj.pending_quantity <= 0) {
      this.dequeueOrder(ordObj.id, ordObj.symbol);
    } else {
      // If order has resting pending quantity: ensure Fyers WebSocket is subscribed to it
      try {
        const { addSubscriptionBatch } = require('./fyers');
        if (addSubscriptionBatch) addSubscriptionBatch([ordObj.symbol]);
      } catch (e) {}

      // Notify other cluster nodes (specifically Master) via Redis pub/sub
      try {
        const { pubClient } = require('./redisClient');
        if (pubClient && pubClient.isReady) {
          pubClient.publish('reload_volume_orders', JSON.stringify({ orderId: ordObj.id, symbol: ordObj.symbol })).catch(() => {});
          pubClient.publish('fyers_subscribe', JSON.stringify([ordObj.symbol])).catch(() => {});
        }
      } catch (e) {}
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
      const v = Number(tick.volume || tick.vol_traded_today || tick.vol || tick.v || 0);
      if (v > 0) {
        this.lastSymbolVolume.set(normSym, v);
      }
      return;
    }

    if (this.processingSymbols.has(normSym)) return;
    this.processingSymbols.add(normSym);

    try {
      const currentVol = Number(tick.volume || tick.vol_traded_today || tick.vol || tick.v || 0);
      let deltaVol = 0;

      if (currentVol > 0) {
        if (!this.lastSymbolVolume.has(normSym)) {
          // Initialize baseline volume without triggering a false multi-lakh trade spike
          this.lastSymbolVolume.set(normSym, currentVol);
        } else {
          const prevVol = this.lastSymbolVolume.get(normSym) || currentVol;
          if (currentVol > prevVol) {
            const rawDelta = currentVol - prevVol;
            // Guard against massive reconnect / cumulative feed jumps (> 50,000 in a single tick on cash equities)
            // Real volume on liquid stocks like VMM can be 24K/min, so threshold must be high enough
            const { isDerivativeContract, isCommodityContract } = require('./instrumentsCache');
            const isDeriv = queue.some(o => isDerivativeContract(o.symbol) || isCommodityContract(o.symbol));
            deltaVol = (!isDeriv && rawDelta > 50000) ? Math.floor(rawDelta * 0.30) : rawDelta;
            this.lastSymbolVolume.set(normSym, currentVol);
          }
        }
      }

      const ltp = Number(tick.ltp || 0);
      if (ltp <= 0) return;

      const now = Date.now();

      // If deltaVol is 0 (e.g. quote tick without new traded volume):
      // - Derivatives/Commodities: use heartbeat micro-flow (5-20 shares every 3.5s) since exchange depth is deep
      // - Cash Equities: NEVER fabricate fake volume. Only fill on real exchange volume deltas.
      if (deltaVol <= 0) {
        const { isDerivativeContract, isCommodityContract } = require('./instrumentsCache');
        const isDerivQueue = queue.some(o => isDerivativeContract(o.symbol) || isCommodityContract(o.symbol));
        if (isDerivQueue) {
          const hasRestingOrdersNeedingHeartbeat = queue.some(o => !o._lastFillTime || (now - o._lastFillTime >= 3500));
          if (hasRestingOrdersNeedingHeartbeat) {
            deltaVol = Math.floor(Math.random() * 20) + 5; // Natural micro-flow for derivatives only
          }
        }
      }

      if (deltaVol <= 0) return; // Cash equities: strictly wait for real exchange volume

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

        // Determine lot size for contract compliance
        const cleanSym = String(order.symbol).replace(/^(NSE:|BSE:|MCX:)/i, '');
        const { getLotSizes } = require('./instrumentsCache');
        const lotSizes = getLotSizes([order.symbol, cleanSym]);
        const lotsize = lotSizes[order.symbol] || lotSizes[cleanSym] || 1;

        let fillQty = 0;
        if (lotsize > 1) {
          // Derivatives and Commodities trade strictly in whole lots. Never fill fractional lots!
          if (order.pending_quantity <= lotsize) {
            fillQty = order.pending_quantity;
          } else {
            const rawCap = Math.min(order.pending_quantity, Math.max(lotsize, Math.floor(availableVol * 0.5)));
            fillQty = Math.max(lotsize, Math.floor(rawCap / lotsize) * lotsize);
            fillQty = Math.min(order.pending_quantity, fillQty);
          }
        } else {
          // Equities (lot = 1): whole shares
          // POV (Percentage of Volume) approach: participate at 30% of real exchange volume per tick.
          // This scales naturally:
          //   - KITEX (deltaVol=200):  fill = 60 shares   (realistic for illiquid stock)
          //   - VMM   (deltaVol=24K):  fill = 7,200 shares (realistic for liquid stock)
          //   - RELIANCE (deltaVol=500K): fill = capped by pending_quantity
          const povRate = 0.30; // 30% participation rate
          fillQty = Math.min(order.pending_quantity, Math.max(1, Math.floor(availableVol * povRate)));
        }

        if (fillQty > 0) {
          order._lastFillTime = now;
          availableVol -= fillQty;
          await this.processSliceFill(order, fillQty, ltp);
          if (order.pending_quantity <= 0) {
            this.dequeueOrder(order.id, order.symbol);
          }
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

        const isMF = String(order.symbol).endsWith('-MF') || String(order.symbol).includes('MUTUALFUND');
        const roundQty = (q) => isMF ? Number(Number(q).toFixed(4)) : Math.round(Number(q));
        const sliceQtyClean = roundQty(sliceQty);

        const prevFilled = roundQty(Number(currentOrder.filled_quantity || 0));
        const prevAvg = Number(currentOrder.average_price || slicePrice);
        const totalQty = roundQty(Number(currentOrder.quantity));

        // Deduct Brokerage & Regulatory Taxes for this executed slice
        const sliceTaxes = await LedgerService.chargeExecutionTaxes(
          trx,
          order.user_id,
          order.symbol,
          order.product_type,
          order.side,
          sliceQtyClean,
          slicePrice
        );
        const currentTaxes = Number(currentOrder.taxes || 0);
        const accumulatedTaxes = Math.round((currentTaxes + sliceTaxes + Number.EPSILON) * 100) / 100;

        // Safe definition of proportional slice margin accessible across all branches
        const sliceMargin = totalQty > 0 ? (sliceQtyClean / totalQty) * Number(order.margin || 0) : Number(order.margin || 0);

        const newFilled = Math.min(totalQty, roundQty(prevFilled + sliceQtyClean));
        const newPending = Math.max(0, roundQty(totalQty - newFilled));
        const newAvgPrice = prevFilled > 0
          ? Number((((prevFilled * prevAvg) + (sliceQtyClean * slicePrice)) / newFilled).toFixed(2))
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

        // Ensure Postgres decimal strings are converted to numbers to prevent string concatenation bugs (e.g. "-1.0000" + 1 = "-1.00001")
        if (existingPos) {
          existingPos.quantity = roundQty(Number(existingPos.quantity));
          existingPos.average_price = Number(existingPos.average_price);
          existingPos.margin = Number(existingPos.margin || 0);
          existingPos.closed_quantity = roundQty(Number(existingPos.closed_quantity || 0));
          existingPos.realized_pnl = Number(existingPos.realized_pnl || 0);
        }

        const isClosing = existingPos && (
          (existingPos.quantity > 0 && order.side === 'SELL') ||
          (existingPos.quantity < 0 && order.side === 'BUY')
        );

        if (isClosing) {
          const absPosQty = roundQty(Math.abs(existingPos.quantity));
          const closeQty = Math.min(sliceQtyClean, absPosQty);
          const leftoverQty = roundQty(sliceQtyClean - closeQty);
          let realizedPnl = 0;

          if (existingPos.quantity > 0) {
            realizedPnl = (slicePrice - existingPos.average_price) * closeQty;
          } else {
            realizedPnl = (existingPos.average_price - slicePrice) * closeQty;
          }
          realizedPnl = Math.round((realizedPnl + Number.EPSILON) * 100) / 100;

          const propClosed = absPosQty > 0 ? (closeQty / absPosQty) : 1;
          const marginRefund = Math.round((existingPos.margin * propClosed) * 100) / 100;

          const newPosQty = roundQty(existingPos.quantity > 0 ? (existingPos.quantity - closeQty) : (existingPos.quantity + closeQty));
          const isFullyClosed = newPosQty === 0 || absPosQty <= closeQty;

          if (isFullyClosed) {
            await trx('positions').where({ id: existingPos.id }).update({
              quantity: 0,
              closed_quantity: roundQty(existingPos.closed_quantity + closeQty),
              exit_price: slicePrice,
              realized_pnl: existingPos.realized_pnl + realizedPnl,
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
              closed_quantity: roundQty(existingPos.closed_quantity + closeQty),
              realized_pnl: existingPos.realized_pnl + realizedPnl,
              margin: Math.max(0, existingPos.margin - marginRefund),
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
                .orWhere({ symbol: `BSE:${cleanSym}` });
            })
            .first();

          if (holding && Number(holding.quantity) > 0) {
            const hQty = roundQty(Number(holding.quantity));
            const hAvg = Number(holding.average_price || slicePrice);
            const closeQty = Math.min(sliceQtyClean, hQty);
            const newHQty = roundQty(hQty - closeQty);

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
              const prevClosedQty = roundQty(Number(existingClosedPos.closed_quantity || 0));
              const prevExitPrice = Number(existingClosedPos.exit_price || slicePrice);
              const newTotalClosed = roundQty(prevClosedQty + closeQty);
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
            const initialPosQty = -sliceQtyClean;
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
            const prevPosQty = roundQty(Number(existingPos.quantity));
            const prevPosAvg = Number(existingPos.average_price);
            const addQty = order.side === 'BUY' ? sliceQtyClean : -sliceQtyClean;
            const newPosQty = roundQty(prevPosQty + addQty);
            const newPosAvg = Number((((Math.abs(prevPosQty) * prevPosAvg) + (sliceQtyClean * slicePrice)) / Math.abs(newPosQty)).toFixed(2));

            await trx('positions').where({ id: existingPos.id }).update({
              quantity: newPosQty,
              average_price: newPosAvg,
              margin: Number(existingPos.margin || 0) + sliceMargin,
              updated_at: new Date()
            });
          } else {
            const initialPosQty = order.side === 'BUY' ? sliceQtyClean : -sliceQtyClean;
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

    try {
      const { pubClient } = require('./redisClient');
      if (pubClient && pubClient.isReady) {
        pubClient.publish('reload_volume_orders', JSON.stringify({ cancelledOrderId: orderId })).catch(() => {});
      }
    } catch (e) {}

    return { success: true, refundAmount };
  }

  /**
   * Background fallback pacing heartbeat running on Master node.
   * ONLY fills derivatives/commodities orders (deep exchange liquidity).
   * Cash equity orders are NEVER filled by heartbeat — they wait for real exchange volume ticks only.
   */
  startPacingHeartbeat() {
    if (this._heartbeatInterval) return;
    this._heartbeatInterval = setInterval(async () => {
      try {
        if (this.symbolQueues.size === 0) return;
        const now = Date.now();
        const { isDerivativeContract, isCommodityContract } = require('./instrumentsCache');

        for (const [normSym, queue] of this.symbolQueues.entries()) {
          if (!queue || queue.length === 0) continue;
          const cached = getCachedPrice(this.priceCache, normSym) || {};
          const ltp = Number(cached.ltp || 0);
          if (ltp <= 0) continue;

          for (const order of [...queue]) {
            if (!order || order.pending_quantity <= 0) continue;

            // CRITICAL: Skip cash equity orders — they must only fill on real exchange volume
            const isDerivOrCommodity = isDerivativeContract(order.symbol) || isCommodityContract(order.symbol);
            if (!isDerivOrCommodity) continue;

            if (!order._lastFillTime || (now - order._lastFillTime >= 4500)) {
              order._lastFillTime = now;
              const cleanSym = String(order.symbol).replace(/^(NSE:|BSE:|MCX:)/i, '');
              const { getLotSizes } = require('./instrumentsCache');
              const lotSizes = getLotSizes([order.symbol, cleanSym]);
              const lotsize = lotSizes[order.symbol] || lotSizes[cleanSym] || 1;

              let slice = 0;
              if (lotsize > 1) {
                if (order.pending_quantity >= lotsize) slice = lotsize;
              } else {
                slice = Math.min(order.pending_quantity, Math.floor(Math.random() * 20) + 5);
              }

              if (slice > 0) {
                await this.processSliceFill(order, slice, ltp);
                if (order.pending_quantity <= 0) {
                  this.dequeueOrder(order.id, order.symbol);
                }
              }
            }
          }
        }
      } catch (err) {
        console.warn('VolumeMatchingEngine heartbeat error:', err.message);
      }
    }, 4000);
    if (this._heartbeatInterval.unref) this._heartbeatInterval.unref();
  }
}

const volumeMatchingEngine = new VolumeMatchingEngine();
module.exports = volumeMatchingEngine;
