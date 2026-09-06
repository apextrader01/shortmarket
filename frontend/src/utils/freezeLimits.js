import { getInstantLotsize, isDerivativeContract, isCommodityContract } from './lotsizeHelper';

export const COMMODITY_FREEZE_LIMITS = {
  CRUDEOIL: 10000,
  CRUDEOILM: 1000,
  NATURALGAS: 50000,
  NATURALGASM: 10000,
  GOLD: 100,
  GOLDM: 1000,
  GOLDPETAL: 10000,
  SILVER: 300,
  SILVERM: 1000,
  SILVERMIC: 10000,
  COPPER: 25000,
  ZINC: 50000,
  LEAD: 50000,
  ALUMINIUM: 50000,
  MENTHAOIL: 3600,
  COTTON: 2500
};

export const INDEX_FREEZE_LIMITS = {
  NIFTY: 1755,        // 27 lots * 65 = 1755 (or Math.floor(1800/lotsize)*lotsize)
  BANKNIFTY: 600,     // 20 lots * 30 = 600
  FINNIFTY: 1800,     // 30 lots * 60 = 1800
  MIDCPNIFTY: 2800,   // 2800 units
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
    for (const [key, limit] of Object.entries(COMMODITY_FREEZE_LIMITS)) {
      if (upper.startsWith(key)) return limit;
    }
    const lot = explicitLotsize || getInstantLotsize(symbol);
    return lot > 1 ? lot * 50 : 10000;
  }

  const lot = explicitLotsize || getInstantLotsize(symbol);

  // 2. Major Indices Check
  if (upper.startsWith('BANKNIFTY') || upper.includes('BANKNIFTY')) {
    return lot > 1 ? (Math.floor(900 / lot) * lot <= 600 ? Math.floor(600 / lot) * lot : 600) : 600;
  }
  if (upper.startsWith('FINNIFTY') || upper.includes('FINNIFTY')) {
    return lot > 1 ? Math.floor(1800 / lot) * lot : 1800;
  }
  if (upper.startsWith('MIDCPNIFTY') || upper.includes('MIDCPNIFTY') || upper.startsWith('MIDCAPNIFTY') || upper.includes('MIDCAPNIFTY')) {
    return lot > 1 ? Math.floor(2800 / lot) * lot : 2800;
  }
  if (upper.startsWith('NIFTYNXT50') || upper.includes('NIFTYNXT50') || upper.includes('NIFTYJR')) {
    return lot > 1 ? Math.floor(600 / lot) * lot : 600;
  }
  if (upper.startsWith('NIFTY') || upper.includes('NIFTY')) {
    return lot > 1 ? Math.floor(1800 / lot) * lot : 1755;
  }
  if (upper.startsWith('SENSEX') || upper.includes('SENSEX')) {
    return 1000;
  }
  if (upper.startsWith('BANKEX') || upper.includes('BANKEX')) {
    return 1000;
  }

  // 3. Stock F&O (Derivatives: Futures & Options for individual stocks)
  // NSE standard freeze limit for individual security F&O is 40 market lots
  if (isDerivativeContract(symbol) || upper.includes('FUT') || upper.includes('CE') || upper.includes('PE')) {
    if (lot > 1) {
      return lot * 40;
    }
    return 1800;
  }

  // 4. Cash Equity (Default)
  return 100000;
}

export function calculateOrderSlices(symbol, totalQty, explicitLotsize = null) {
  const qty = Number(totalQty) || 0;
  if (qty <= 0) return [];
  const limit = getFreezeLimit(symbol, explicitLotsize);
  if (qty <= limit) return [qty];
  const slices = [];
  let remaining = qty;
  while (remaining > 0) {
    const currentSlice = Math.min(remaining, limit);
    slices.push(currentSlice);
    remaining -= currentSlice;
  }
  return slices;
}
