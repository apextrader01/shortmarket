export const FREEZE_LIMITS = {
  NIFTY: 1800,
  BANKNIFTY: 900,
  FINNIFTY: 1800,
  MIDCPNIFTY: 4200,
  NIFTYNXT50: 1800,
  SENSEX: 1000,
  BANKEX: 1000,
  CRUDEOIL: 10000,
  NATURALGAS: 50000,
  GOLD: 100,
  GOLDM: 1000,
  SILVER: 300,
  SILVERM: 1000,
  DEFAULT_EQUITY: 100000,
  DEFAULT_FNO: 1800
};

export function getFreezeLimit(symbol) {
  if (!symbol) return FREEZE_LIMITS.DEFAULT_EQUITY;
  const upper = String(symbol).toUpperCase();
  if (upper.includes('BANKNIFTY')) return FREEZE_LIMITS.BANKNIFTY;
  if (upper.includes('FINNIFTY')) return FREEZE_LIMITS.FINNIFTY;
  if (upper.includes('MIDCPNIFTY') || upper.includes('MIDCAPNIFTY')) return FREEZE_LIMITS.MIDCPNIFTY;
  if (upper.includes('NIFTYNXT50') || upper.includes('NIFTYJR')) return FREEZE_LIMITS.NIFTYNXT50;
  if (upper.includes('NIFTY')) return FREEZE_LIMITS.NIFTY;
  if (upper.includes('SENSEX')) return FREEZE_LIMITS.SENSEX;
  if (upper.includes('BANKEX')) return FREEZE_LIMITS.BANKEX;
  if (upper.includes('CRUDEOIL')) return FREEZE_LIMITS.CRUDEOIL;
  if (upper.includes('NATURALGAS')) return FREEZE_LIMITS.NATURALGAS;
  if (upper.includes('GOLDM')) return FREEZE_LIMITS.GOLDM;
  if (upper.includes('GOLD')) return FREEZE_LIMITS.GOLD;
  if (upper.includes('SILVERM')) return FREEZE_LIMITS.SILVERM;
  if (upper.includes('SILVER')) return FREEZE_LIMITS.SILVER;
  if (upper.includes('CE') || upper.includes('PE') || upper.includes('FUT')) return FREEZE_LIMITS.DEFAULT_FNO;
  return FREEZE_LIMITS.DEFAULT_EQUITY;
}

export function calculateOrderSlices(symbol, totalQty) {
  const qty = Number(totalQty) || 0;
  if (qty <= 0) return [];
  const limit = getFreezeLimit(symbol);
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
