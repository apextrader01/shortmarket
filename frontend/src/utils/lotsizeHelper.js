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

export const isMCXWinterSession = (d = new Date()) => {
  const year = d.getFullYear();
  const marchFirst = new Date(Date.UTC(year, 2, 1));
  const marchFirstDay = marchFirst.getUTCDay();
  const firstSunMarch = marchFirstDay === 0 ? 1 : (7 - marchFirstDay + 1);
  const secondSunMarch = firstSunMarch + 7;
  const dstStart = new Date(Date.UTC(year, 2, secondSunMarch, 7, 0, 0));

  const novFirst = new Date(Date.UTC(year, 10, 1));
  const novFirstDay = novFirst.getUTCDay();
  const firstSunNov = novFirstDay === 0 ? 1 : (7 - novFirstDay + 1);
  const dstEnd = new Date(Date.UTC(year, 10, firstSunNov, 6, 0, 0));

  const isDstSummer = d >= dstStart && d < dstEnd;
  return !isDstSummer;
};

/**
 * Checks if position conversion (INT <-> DEL) is allowed for a symbol.
 * Rule: Position conversion is NOT allowed starting 1 minute before the segment's intraday cutoff
 * and throughout the cutoff / auto square-off / market-closed period.
 */
export function checkPositionConversionAllowed(symbol, dateObj = new Date()) {
  if (!symbol) return { allowed: false, reason: 'Invalid instrument symbol.' };

  const sub = getAssetSubsegment(symbol);
  if (sub === 'MUTUAL_FUND') {
    return { allowed: false, reason: 'Mutual fund units cannot be converted.' };
  }

  // Evaluate in Indian Standard Time (IST)
  const istParts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Kolkata',
    hour: 'numeric',
    minute: 'numeric',
    weekday: 'short',
    hour12: false
  }).formatToParts(dateObj);

  const hours = parseInt(istParts.find(p => p.type === 'hour')?.value || '0', 10);
  const minutes = parseInt(istParts.find(p => p.type === 'minute')?.value || '0', 10);
  const weekday = istParts.find(p => p.type === 'weekday')?.value; // 'Sat', 'Sun', etc.
  const currentMinutes = hours * 60 + minutes;

  // Weekend Check
  if (weekday === 'Sat' || weekday === 'Sun') {
    return { allowed: false, reason: 'Position conversion is disabled on weekends when markets are closed.' };
  }

  if (sub === 'COMMODITY') {
    const isWinter = isMCXWinterSession(dateObj);
    // Summer: Cutoff 10:50 PM (1370 mins). 1 min before: 10:49 PM (1369 mins).
    // Winter: Cutoff 11:30 PM (1410 mins). 1 min before: 11:29 PM (1409 mins).
    const cutoffMins = isWinter ? (23 * 60 + 30) : (22 * 60 + 50);
    const cutoffLabel = isWinter ? '11:30 PM' : '10:50 PM';
    const blockMins = cutoffMins - 1; // 1 min before cutoff
    const blockLabel = isWinter ? '11:29 PM' : '10:49 PM';
    const openMins = 9 * 60; // 09:00 AM

    if (currentMinutes < openMins) {
      return { allowed: false, reason: 'Position conversion for MCX Commodities is disabled before market opens at 09:00 AM IST.' };
    }
    if (currentMinutes >= blockMins) {
      return { allowed: false, reason: `Position conversion for MCX Commodities is disabled starting 1 minute before the intraday cutoff (${cutoffLabel}, blocked from ${blockLabel}) and during auto square-off.` };
    }
    return { allowed: true };
  }

  if (sub === 'DERIVATIVE') {
    // Cutoff 03:25 PM (925 mins). 1 min before: 03:24 PM (924 mins).
    const openMins = 9 * 60 + 15; // 09:15 AM
    const blockMins = 15 * 60 + 24; // 03:24 PM (1 min before 03:25 PM)

    if (currentMinutes < openMins) {
      return { allowed: false, reason: 'Position conversion for Futures & Options is disabled before market opens at 09:15 AM IST.' };
    }
    if (currentMinutes >= blockMins) {
      return { allowed: false, reason: 'Position conversion for Futures & Options is disabled starting 1 minute before the intraday cutoff (03:25 PM, blocked from 03:24 PM) and during auto square-off.' };
    }
    return { allowed: true };
  }

  if (sub === 'FNO_EQ') {
    // Cutoff 03:05 PM (905 mins). 1 min before: 03:04 PM (904 mins).
    const openMins = 9 * 60 + 15; // 09:15 AM
    const blockMins = 15 * 60 + 4; // 03:04 PM (1 min before 03:05 PM)

    if (currentMinutes < openMins) {
      return { allowed: false, reason: 'Position conversion for F&O Cash Equities is disabled before market opens at 09:15 AM IST.' };
    }
    if (currentMinutes >= blockMins) {
      return { allowed: false, reason: 'Position conversion for F&O Cash Equities is disabled starting 1 minute before the intraday cutoff (03:05 PM, blocked from 03:04 PM) and during auto square-off.' };
    }
    return { allowed: true };
  }

  // NON_FNO_EQ (All other Cash Equities)
  {
    // Cutoff 03:15 PM (915 mins). 1 min before: 03:14 PM (914 mins).
    const openMins = 9 * 60 + 15; // 09:15 AM
    const blockMins = 15 * 60 + 14; // 03:14 PM (1 min before 03:15 PM)

    if (currentMinutes < openMins) {
      return { allowed: false, reason: 'Position conversion for Cash Equities is disabled before market opens at 09:15 AM IST.' };
    }
    if (currentMinutes >= blockMins) {
      return { allowed: false, reason: 'Position conversion for Cash Equities is disabled starting 1 minute before the intraday cutoff (03:15 PM, blocked from 03:14 PM) and during auto square-off.' };
    }
    return { allowed: true };
  }
}

