import lotsizeMap from './lotsizeMap.json';

const sortedKeys = Object.keys(lotsizeMap).sort((a, b) => b.length - a.length);

export function isDerivativeContract(sym) {
  if (!sym || typeof sym !== 'string') return false;
  const clean = sym.includes(':') ? sym.split(':')[1] : sym;
  return /(?:\d+|[-_\s])(CE|PE)(?:[-_\s].*)?$/i.test(clean) || 
         /(?:\d+|[A-Z]{3}|[-_\s])FUT(?:[-_\s].*)?$/i.test(clean) || 
         clean.endsWith('-FUT');
}

export function isCommodityContract(sym) {
  if (!sym || typeof sym !== 'string') return false;
  if (sym.includes('MCX') || sym.includes('NCDEX')) return true;
  const clean = sym.replace(/^(NSE:|BSE:|MCX:)/i, '');
  return ['CRUDEOIL', 'GOLD', 'SILVER', 'NATURALGAS', 'COPPER', 'ZINC', 'LEAD', 'ALUMINIUM', 'MENTHAOIL', 'COTTON', 'NICKEL'].some(c => clean.startsWith(c));
}

export function getInstantLotsize(sym) {
  if (!sym || typeof sym !== 'string') return 1;
  const isDeriv = isDerivativeContract(sym);
  const isComm = isCommodityContract(sym);
  
  if (!isDeriv && !isComm) {
    return 1; // Cash Equity / ETF / MF is always lotsize 1
  }

  const clean = sym.replace(/^(NSE:|BSE:|MCX:)/i, '').toUpperCase();
  
  // Direct match
  if (lotsizeMap[clean]) return lotsizeMap[clean];
  
  // Prefix match for derivatives (e.g. NATURALGAS26SEP275PE -> NATURALGAS)
  for (const key of sortedKeys) {
    if (clean.startsWith(key)) {
      return lotsizeMap[key];
    }
  }
  return 1;
}

export function isFnoEligibleStock(sym) {
  if (!sym || typeof sym !== 'string') return false;
  if (isDerivativeContract(sym) || isCommodityContract(sym)) return false;
  const clean = sym.replace(/^(NSE:|BSE:|MCX:)/i, '').replace(/-(EQ|A|B|T|X|XT|Z|P|M|SM|BE|BZ)$/i, '').toUpperCase().trim();
  if (['NIFTY', 'BANKNIFTY', 'FINNIFTY', 'MIDCPNIFTY', 'NIFTYNXT50', 'NIFTYFPI'].includes(clean)) return false;
  return Boolean(lotsizeMap[clean]);
}

export function getAssetSubsegment(sym) {
  if (!sym || typeof sym !== 'string') return 'NON_FNO_EQ';
  const clean = sym.replace(/^(NSE:|BSE:|MCX:)/i, '').toUpperCase().trim();
  if (clean.endsWith('-MF') || clean.includes('MUTUALFUND')) return 'MUTUAL_FUND';
  if (isCommodityContract(sym)) return 'COMMODITY';
  if (isDerivativeContract(sym)) return 'DERIVATIVE';
  if (isFnoEligibleStock(sym)) return 'FNO_EQ';
  return 'NON_FNO_EQ';
}
