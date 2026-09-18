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
 * Checks if position conversion is allowed for a symbol based on target product type and timing.
 * Rule (Segment Timings):
 * 1. Mutual fund units cannot be converted.
 * 2. Markets must be open (disabled on weekends and outside market hours).
 * 3. Converting Intraday to Delivery (INT -> DEL):
 *    Allowed throughout all active trading hours up to market close (03:30 PM for Equities & F&O, 11:30 PM / 11:55 PM for MCX).
 * 4. Converting Delivery to Intraday (DEL -> INT):
 *    Blocked starting 1 minute before intraday cutoff (03:04 PM for F&O Equities, 03:14 PM for Cash Equities, 03:24 PM for F&O Derivatives, 10:49 PM / 11:29 PM for MCX Commodities).
 */
export function checkPositionConversionAllowed(symbol, targetProductTypeOrDate = 'DEL', maybeDateObj = new Date()) {
  if (!symbol) return { allowed: false, reason: 'Invalid instrument symbol.' };

  let targetProductType = 'DEL';
  let dateObj = new Date();

  if (targetProductTypeOrDate instanceof Date) {
    dateObj = targetProductTypeOrDate;
    targetProductType = 'DEL';
  } else if (typeof targetProductTypeOrDate === 'string') {
    const upper = targetProductTypeOrDate.toUpperCase();
    targetProductType = (upper === 'CNC' || upper === 'NRML') ? 'DEL' : (upper === 'MIS' ? 'INT' : upper);
    if (maybeDateObj instanceof Date) {
      dateObj = maybeDateObj;
    }
  }

  const isTargetingIntraday = targetProductType === 'INT' || targetProductType === 'MIS';

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
    // Summer: Market open 09:00 AM (540 mins) to 11:30 PM (1410 mins). Cutoff 10:50 PM. Blocked from 10:49 PM (1369 mins).
    // Winter: Market open 09:00 AM (540 mins) to 11:55 PM (1435 mins). Cutoff 11:30 PM. Blocked from 11:29 PM (1409 mins).
    const closeMins = isWinter ? (23 * 60 + 55) : (23 * 60 + 30);
    const openMins = 9 * 60; // 09:00 AM
    const blockMinsToInt = isWinter ? (23 * 60 + 29) : (22 * 60 + 49);
    const blockLabel = isWinter ? '11:29 PM' : '10:49 PM';

    if (currentMinutes < openMins || currentMinutes >= closeMins) {
      return { allowed: false, reason: 'Position conversion for MCX Commodities is disabled when the commodity market is closed.' };
    }
    if (isTargetingIntraday && currentMinutes >= blockMinsToInt) {
      return { allowed: false, reason: `Converting Delivery to Intraday for MCX Commodities is disabled starting at ${blockLabel} due to intraday cutoff.` };
    }
    return { allowed: true };
  }

  // For Equities and Derivatives (NSE / BSE): Market hours 09:15 AM (555 mins) to 03:30 PM (930 mins)
  const openMins = 9 * 60 + 15; // 09:15 AM
  const closeMins = 15 * 60 + 30; // 03:30 PM

  if (currentMinutes < openMins || currentMinutes >= closeMins) {
    return { allowed: false, reason: 'Position conversion is disabled outside trading hours (09:15 AM - 03:30 PM IST).' };
  }

  if (isTargetingIntraday) {
    if (sub === 'DERIVATIVE') {
      // Cutoff 03:25 PM. Blocked from 03:24 PM (924 mins)
      const blockMinsToInt = 15 * 60 + 24;
      if (currentMinutes >= blockMinsToInt) {
        return { allowed: false, reason: 'Converting Delivery to Intraday for Futures & Options is disabled after 03:24 PM due to intraday cutoff.' };
      }
    } else if (sub === 'FNO_EQ') {
      // Cutoff 03:05 PM. Blocked from 03:04 PM (904 mins)
      const blockMinsToInt = 15 * 60 + 4;
      if (currentMinutes >= blockMinsToInt) {
        return { allowed: false, reason: 'Converting Delivery to Intraday for F&O Cash Equities is disabled after 03:04 PM due to intraday cutoff.' };
      }
    } else {
      // NON_FNO_EQ (All other Cash Equities): Cutoff 03:15 PM. Blocked from 03:14 PM (914 mins)
      const blockMinsToInt = 15 * 60 + 14;
      if (currentMinutes >= blockMinsToInt) {
        return { allowed: false, reason: 'Converting Delivery to Intraday for Cash Equities is disabled after 03:14 PM due to intraday cutoff.' };
      }
    }
  }

  // Intraday to Delivery (INT -> DEL) is permitted throughout all open market hours up to 03:30 PM IST!
  return { allowed: true };
}

