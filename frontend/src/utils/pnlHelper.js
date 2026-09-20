/**
 * Centralized Realized P&L and Closed Trades Helper
 * 
 * Provides an authoritative single source of truth across:
 * - PortfolioView (Card 4: Today's Realized P&L and Closed Trades Count)
 * - PositionsView (CLOSED tab and Total Realized P&L header)
 * - OrderModal & BasketModal (Risk Guardian max_daily_loss & max_daily_trades validations)
 */

export const normalizeSym = (sym) => (sym ? String(sym).replace(/^(NSE:|BSE:|MCX:)/i, '').trim() : '');

export const getISTDate = (date) => {
  if (!date) return '';
  return new Intl.DateTimeFormat('en-CA', { 
    timeZone: 'Asia/Kolkata', 
    year: 'numeric', 
    month: '2-digit', 
    day: '2-digit' 
  }).format(new Date(date));
};

export const isToday = (dateString) => {
  if (!dateString) return false;
  const d = new Date(dateString);
  if (isNaN(d.getTime())) return false;
  return getISTDate(d) === getISTDate(new Date());
};

/**
 * Returns all positions/orders that were closed today.
 * Combines explicit database closed positions (quantity === 0 closed today)
 * with synthesized closed orders not already recorded in database closed positions.
 */
export const getTodayClosedPositions = (positions = [], orders = []) => {
  const normalizeProd = (p) => {
    const u = String(p || '').toUpperCase();
    if (['DEL', 'CNC', 'DELIVERY'].includes(u)) return 'DEL';
    if (['INT', 'MIS', 'BO', 'CO', 'INTRADAY'].includes(u)) return 'INT';
    return u || 'INT';
  };

  // 1. Include explicit closed positions updated/closed today from database
  const dbClosed = (positions || []).filter(p => Number(p.quantity) === 0 && isToday(p.updated_at || p.created_at));
  const dbClosedKeys = new Set(dbClosed.map(p => `${normalizeSym(p.symbol)}-${normalizeProd(p.product_type)}`));
  
  // Track all actively OPEN position keys so open positions are NEVER duplicated into closed
  const openPositionsKeys = new Set(
    (positions || [])
      .filter(p => Number(p.quantity) !== 0)
      .map(p => `${normalizeSym(p.symbol)}-${normalizeProd(p.product_type)}`)
  );

  // 2. Synthesize closed positions from executed orders ONLY if NOT already recorded in dbClosed AND NOT currently open
  const closedOrdersMap = {};
  (orders || []).forEach(o => {
    const isExecuted = o.status === 'COMPLETED' || o.status === 'COMPLETE' || o.status === 'EXECUTED';
    const orderPnl = Number(o.realized_pnl || 0);
    const isExitOrder = (o.remarks && (o.remarks.includes('Exit') || o.remarks.includes('Square-Off') || o.remarks.includes('Auto-Square-Off'))) 
      || (o.realized_pnl !== null && o.realized_pnl !== undefined && orderPnl !== 0)
      || (o.closed_quantity && Number(o.closed_quantity) > 0);
    const normSym = normalizeSym(o.symbol);
    const prod = normalizeProd(o.product_type);
    const key = `${normSym}-${prod}`;

    if (isExecuted && isExitOrder && isToday(o.updated_at || o.created_at) && !dbClosedKeys.has(key) && !openPositionsKeys.has(key)) {
      const orderQty = Math.abs(Number(o.quantity || 1));
      const exitPrice = Math.abs(Number(o.average_price || o.price || 0));
      const entrySide = o.side === 'SELL' ? 'BUY' : 'SELL';
      const rawEntryPrice = orderQty > 0 
        ? (entrySide === 'BUY' ? (exitPrice - (orderPnl / orderQty)) : (exitPrice + (orderPnl / orderQty)))
        : exitPrice;
      const entryPrice = Math.abs(rawEntryPrice);

      if (!closedOrdersMap[key]) {
        closedOrdersMap[key] = {
          id: `closed-ord-${o.id}`,
          symbol: o.symbol,
          product_type: o.product_type || 'INT',
          quantity: 0,
          closed_quantity: 0,
          side: entrySide,
          average_price: entryPrice,
          exit_price: exitPrice,
          realized_pnl: 0,
          created_at: o.created_at,
          updated_at: o.updated_at || o.created_at
        };
      }
      closedOrdersMap[key].closed_quantity += Number(o.quantity || 0);
      closedOrdersMap[key].realized_pnl += Number(o.realized_pnl || 0);
      closedOrdersMap[key].exit_price = exitPrice;
    }
  });

  return [...dbClosed, ...Object.values(closedOrdersMap)];
};

/**
 * Calculates authoritative realized P&L and trade count for today.
 * Groups positions by symbol and product type to match PositionsView closed tab.
 */
export const getTodayRealizedMetrics = (positions = [], orders = [], options = {}) => {
  const closedPositions = getTodayClosedPositions(positions, orders);
  
  const symbolAgg = {};
  closedPositions.forEach(pos => {
    const normProd = pos.product_type || 'INT';
    const key = `${pos.symbol}-${normProd}`;
    const pnl = parseFloat(pos.realized_pnl) || 0;
    const closedQty = parseFloat(pos.closed_quantity) || 0;
    const entryPrice = Math.abs(parseFloat(pos.average_price) || 0);
    const exitPrice = Math.abs(parseFloat(pos.exit_price) || 0);

    if (!symbolAgg[key]) {
      symbolAgg[key] = { 
        ...pos, 
        realized_pnl: pnl,
        closed_quantity: closedQty,
        average_price: entryPrice,
        exit_price: exitPrice
      };
    } else {
      const agg = symbolAgg[key];
      agg.realized_pnl = (parseFloat(agg.realized_pnl) || 0) + pnl;
      const prevClosed = parseFloat(agg.closed_quantity) || 0;
      agg.closed_quantity = prevClosed + closedQty;
      if (entryPrice > 0 && (!agg.average_price || agg.average_price === 0)) {
        agg.average_price = entryPrice;
      }
      if (exitPrice > 0) {
        agg.exit_price = exitPrice;
      }
    }
  });

  let todayRealizedPnl = 0;
  Object.values(symbolAgg).forEach(item => {
    todayRealizedPnl += parseFloat(item.realized_pnl || 0);
  });

  if (options.includePartialOpen) {
    (positions || []).forEach(p => {
      if (Number(p.quantity) !== 0 && isToday(p.updated_at || p.created_at)) {
        const partialPnl = parseFloat(p.realized_pnl) || 0;
        if (partialPnl !== 0) {
          todayRealizedPnl += partialPnl;
        }
      }
    });
  }

  const closedTrades = Object.values(symbolAgg);
  return {
    todayRealizedPnl: Math.round((todayRealizedPnl + Number.EPSILON) * 100) / 100,
    todayTradesCount: closedTrades.length,
    closedTrades
  };
};
