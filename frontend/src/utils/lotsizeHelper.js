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
