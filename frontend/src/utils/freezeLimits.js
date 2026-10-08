import { getInstantLotsize, isDerivativeContract, isCommodityContract } from './lotsizeHelper';

import freezeConfig from './freezeLimitsConfig.json';

let liveFreezeConfig = {
  INDEX_MAX_LOTS: { BANKNIFTY: 48, NIFTY: 54, FINNIFTY: 54, MIDCPNIFTY: 48, MIDCAPNIFTY: 48, NIFTYNXT50: 45, NIFTYFPI: 49, SENSEX: 50, BANKEX: 30, ...(freezeConfig?.INDEX_MAX_LOTS || {}) },
  STOCK_MAX_LOTS: freezeConfig?.STOCK_MAX_LOTS || 40,
  SYMBOL_FREEZE_LOTS: { ...(freezeConfig?.SYMBOL_FREEZE_LOTS || {}) },
  SYMBOL_FREEZE_QTY: { ...(freezeConfig?.SYMBOL_FREEZE_QTY || {}) },
  COMMODITY_FREEZE_LIMITS: { ...(freezeConfig?.COMMODITY_FREEZE_LIMITS || {}) }
};
let sortedSymbolFreezeKeys = Object.keys(liveFreezeConfig.SYMBOL_FREEZE_LOTS).sort((a, b) => b.length - a.length);

export const COMMODITY_FREEZE_LIMITS = liveFreezeConfig.COMMODITY_FREEZE_LIMITS;

export const INDEX_FREEZE_LIMITS = {
  NIFTY: 3510,
  BANKNIFTY: 1440,
  FINNIFTY: 3240,
  MIDCPNIFTY: 5760,
  MIDCAPNIFTY: 5760,
  NIFTYNXT50: 1125,
  SENSEX: 1000,
  BANKEX: 900
};

export function updateLiveFreezeConfig(newConfig) {
  if (!newConfig || typeof newConfig !== 'object') return;
  liveFreezeConfig = {
    ...liveFreezeConfig,
    ...newConfig,
    INDEX_MAX_LOTS: { ...liveFreezeConfig.INDEX_MAX_LOTS, ...(newConfig.INDEX_MAX_LOTS || {}) },
    COMMODITY_FREEZE_LIMITS: { ...liveFreezeConfig.COMMODITY_FREEZE_LIMITS, ...(newConfig.COMMODITY_FREEZE_LIMITS || {}) },
    SYMBOL_FREEZE_LOTS: { ...liveFreezeConfig.SYMBOL_FREEZE_LOTS, ...(newConfig.SYMBOL_FREEZE_LOTS || {}) },
    SYMBOL_FREEZE_QTY: { ...liveFreezeConfig.SYMBOL_FREEZE_QTY, ...(newConfig.SYMBOL_FREEZE_QTY || {}) }
  };
  Object.assign(COMMODITY_FREEZE_LIMITS, liveFreezeConfig.COMMODITY_FREEZE_LIMITS);
  sortedSymbolFreezeKeys = Object.keys(liveFreezeConfig.SYMBOL_FREEZE_LOTS).sort((a, b) => b.length - a.length);
}

let isFetchingFreezeConfig = false;
export async function syncLiveFreezeConfig(apiUrl = '') {
  if (isFetchingFreezeConfig) return;
  isFetchingFreezeConfig = true;
  try {
    const res = await fetch(`${apiUrl}/api/stocks/freeze-limits`);
    if (res.ok) {
      const data = await res.json();
      if (data && typeof data === 'object') {
        updateLiveFreezeConfig(data);
      }
    }
  } catch (e) {
    // Fallback to static bundle if offline
  } finally {
    isFetchingFreezeConfig = false;
  }
}

export function getFreezeLimit(symbol, explicitLotsize = null) {
  if (!symbol) return 100000;
  const upper = String(symbol).toUpperCase().replace(/^(NSE:|BSE:|MCX:)/i, '');
  const commLimits = liveFreezeConfig.COMMODITY_FREEZE_LIMITS || COMMODITY_FREEZE_LIMITS;

  // 1. Commodity Check (MCX)
  if (symbol.includes('MCX') || symbol.includes('NCDEX') || isCommodityContract(symbol)) {
    const sortedCommKeys = Object.keys(commLimits).sort((a, b) => b.length - a.length);
    for (const key of sortedCommKeys) {
      if (upper.startsWith(key)) return commLimits[key];
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
  const indexMaxLots = liveFreezeConfig.INDEX_MAX_LOTS || {};
  if (upper.startsWith('BANKNIFTY') || upper.includes('BANKNIFTY')) {
    const maxLots = indexMaxLots.BANKNIFTY || 48;
    return lot > 1 ? lot * maxLots : 1440;
  }
  if (upper.startsWith('FINNIFTY') || upper.includes('FINNIFTY')) {
    const maxLots = indexMaxLots.FINNIFTY || 54;
    return lot > 1 ? lot * maxLots : 3240;
  }
  if (upper.startsWith('MIDCPNIFTY') || upper.includes('MIDCPNIFTY') || upper.startsWith('MIDCAPNIFTY') || upper.includes('MIDCAPNIFTY')) {
    const maxLots = indexMaxLots.MIDCPNIFTY || indexMaxLots.MIDCAPNIFTY || 48;
    return lot > 1 ? lot * maxLots : 5760;
  }
  if (upper.startsWith('NIFTYNXT50') || upper.includes('NIFTYNXT50') || upper.includes('NIFTYJR')) {
    const maxLots = indexMaxLots.NIFTYNXT50 || 45;
    return lot > 1 ? lot * maxLots : 1125;
  }
  if (upper.startsWith('NIFTYFPI') || upper.includes('NIFTYFPI')) {
    const maxLots = indexMaxLots.NIFTYFPI || 49;
    return lot > 1 ? lot * maxLots : 53900;
  }
  if (upper.startsWith('NIFTY') || upper.includes('NIFTY')) {
    const maxLots = indexMaxLots.NIFTY || 54;
    return lot > 1 ? lot * maxLots : 3510;
  }
  if (upper.startsWith('SENSEX') || upper.includes('SENSEX')) {
    const maxLots = (indexMaxLots.SENSEX && indexMaxLots.SENSEX <= 200) ? indexMaxLots.SENSEX : 50;
    return lot > 1 ? lot * maxLots : 1000;
  }
  if (upper.startsWith('BANKEX') || upper.includes('BANKEX')) {
    const maxLots = (indexMaxLots.BANKEX && indexMaxLots.BANKEX <= 200) ? indexMaxLots.BANKEX : 30;
    return lot > 1 ? lot * maxLots : 900;
  }

  // 3. Stock F&O (Derivatives: Futures & Options for individual stocks)
  if (isDeriv) {
    const symLotsMap = liveFreezeConfig.SYMBOL_FREEZE_LOTS || {};
    const symQtyMap = liveFreezeConfig.SYMBOL_FREEZE_QTY || {};
    for (const key of sortedSymbolFreezeKeys) {
      if (upper.startsWith(key)) {
        const nextChar = upper.charAt(key.length);
        if (!nextChar || /[\d\-_\s]/.test(nextChar)) {
          const maxLots = symLotsMap[key];
          if (maxLots > 0) {
            return lot > 1 ? lot * maxLots : (symQtyMap[key] || 1800);
          }
        }
      }
    }
    const stockMaxLots = liveFreezeConfig.STOCK_MAX_LOTS || 40;
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

