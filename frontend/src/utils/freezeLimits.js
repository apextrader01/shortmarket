import { getInstantLotsize, isDerivativeContract, isCommodityContract } from './lotsizeHelper';

import freezeConfig from './freezeLimitsConfig.json';

export const COMMODITY_FREEZE_LIMITS = freezeConfig.COMMODITY_FREEZE_LIMITS || {};

export const INDEX_FREEZE_LIMITS = {
  NIFTY: 1755,
  BANKNIFTY: 600,
  FINNIFTY: 1800,
  MIDCPNIFTY: 2800,
  MIDCAPNIFTY: 2800,
  NIFTYNXT50: 600,
  SENSEX: 1000,
  BANKEX: 1000
};

export function getFreezeLimit(symbol, explicitLotsize = null) {
  if (!symbol) return 100000;
  const upper = String(symbol).toUpperCase().replace(/^(NSE:|BSE:|MCX:)/i, '');

  // 1. Commodity Check (MCX)
  if (symbol.includes('MCX') || symbol.includes('NCDEX') || isCommodityContract(symbol)) {
    const sortedCommKeys = Object.keys(COMMODITY_FREEZE_LIMITS).sort((a, b) => b.length - a.length);
    for (const key of sortedCommKeys) {
      if (upper.startsWith(key)) return COMMODITY_FREEZE_LIMITS[key];
    }
    const lot = explicitLotsize || getInstantLotsize(symbol);
    return lot > 1 ? lot * 50 : 10000;
  }

  const lot = explicitLotsize || getInstantLotsize(symbol);

  // 2. Cash Equities & ETFs (lot === 1 and not derivative contract)
  // Ensures cash ETFs like NIFTYBEES, BANKBEES, JUNIORBEES are not misclassified as index derivatives
  const isDeriv = isDerivativeContract(symbol) || /(?:\d+|[-_\s])(CE|PE)(?:[-_\s].*)?$/i.test(upper) || /(?:\d+|[A-Z]{3}|[-_\s])FUT(?:[-_\s].*)?$/i.test(upper) || upper.endsWith('-FUT');
  if (lot === 1 && !isDeriv) {
    return 100000;
  }

  // 3. Major Indices Check (Dynamic calculation: lotSize * maxLots)
  const indexMaxLots = freezeConfig.INDEX_MAX_LOTS || {};
  if (upper.startsWith('BANKNIFTY') || upper.includes('BANKNIFTY')) {
    const maxLots = indexMaxLots.BANKNIFTY || 20;
    return lot > 1 ? lot * maxLots : 600;
  }
  if (upper.startsWith('FINNIFTY') || upper.includes('FINNIFTY')) {
    const maxLots = indexMaxLots.FINNIFTY || 30;
    return lot > 1 ? lot * maxLots : 1800;
  }
  if (upper.startsWith('MIDCPNIFTY') || upper.includes('MIDCPNIFTY') || upper.startsWith('MIDCAPNIFTY') || upper.includes('MIDCAPNIFTY')) {
    return 2800;
  }
  if (upper.startsWith('NIFTYNXT50') || upper.includes('NIFTYNXT50') || upper.includes('NIFTYJR')) {
    const maxLots = indexMaxLots.NIFTYNXT50 || 24;
    return lot > 1 ? lot * maxLots : 600;
  }
  if (upper.startsWith('NIFTY') || upper.includes('NIFTY')) {
    const maxLots = indexMaxLots.NIFTY || 27;
    return lot > 1 ? lot * maxLots : 1755;
  }
  if (upper.startsWith('SENSEX') || upper.includes('SENSEX')) {
    return indexMaxLots.SENSEX || 1000;
  }
  if (upper.startsWith('BANKEX') || upper.includes('BANKEX')) {
    return indexMaxLots.BANKEX || 1000;
  }

  // 3. Stock F&O (Derivatives: Futures & Options for individual stocks)
  // NSE standard freeze limit for individual security F&O is 40 market lots
  if (isDeriv) {
    const stockMaxLots = freezeConfig.STOCK_MAX_LOTS || 40;
    if (lot > 1) {
      return lot * stockMaxLots;
    }
    return 1800;
  }

  // 4. Cash Equity (Default)
  return 100000;
}

export function getOrderSlicesCount(symbol, totalQty, explicitLotsize = null) {
  const qty = Number(totalQty) || 0;
  if (qty <= 0) return 0;
  const limit = getFreezeLimit(symbol, explicitLotsize);
  if (!limit || limit <= 0) return 1;
  return Math.min(100, Math.ceil(qty / limit));
}

export function calculateOrderSlices(symbol, totalQty, explicitLotsize = null) {
  const qty = Number(totalQty) || 0;
  if (qty <= 0) return [];
  const limit = getFreezeLimit(symbol, explicitLotsize);
  if (!limit || limit <= 0) return [qty];
  if (qty <= limit) return [qty];

  const MAX_SLICES = 100;
  const slices = [];
  const maxAllowed = limit * MAX_SLICES;
  let remaining = Math.min(qty, maxAllowed);

  while (remaining > 0 && slices.length < MAX_SLICES) {
    const currentSlice = Math.min(remaining, limit);
    slices.push(currentSlice);
    remaining -= currentSlice;
  }
  return slices;
}

