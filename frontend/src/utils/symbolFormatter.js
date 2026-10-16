/**
 * Utility to format raw broker symbols into clean, institutional-grade labels (Zerodha Kite / Fyers standard)
 */

const INDEX_MAP = {
  'NIFTY50-INDEX': 'NIFTY 50',
  'NIFTY-NSE': 'NIFTY 50',
  'NIFTY 50': 'NIFTY 50',
  'NIFTY': 'NIFTY 50',
  'NIFTYBANK-INDEX': 'BANK NIFTY',
  'BANKNIFTY-NSE': 'BANK NIFTY',
  'NIFTY BANK': 'BANK NIFTY',
  'BANKNIFTY': 'BANK NIFTY',
  'FINNIFTY-INDEX': 'FIN NIFTY',
  'FINNIFTY-NSE': 'FIN NIFTY',
  'FINNIFTY': 'FIN NIFTY',
  'MIDCPNIFTY-INDEX': 'MIDCAP NIFTY',
  'MIDCPNIFTY': 'MIDCAP NIFTY',
  'SENSEX-INDEX': 'SENSEX',
  'SENSEX-BSE': 'SENSEX',
  'SENSEX': 'SENSEX',
  'BANKEX-INDEX': 'BANKEX',
  'BANKEX-BSE': 'BANKEX',
  'BANKEX': 'BANKEX',
  'INDIAVIX-INDEX': 'INDIA VIX',
  'INDIA VIX-NSE': 'INDIA VIX',
  'INDIAVIX': 'INDIA VIX'
};

const MONTH_CODES = {
  '1': 'JAN', '2': 'FEB', '3': 'MAR', '4': 'APR', '5': 'MAY', '6': 'JUN',
  '7': 'JUL', '8': 'AUG', '9': 'SEP', 'O': 'OCT', 'N': 'NOV', 'D': 'DEC'
};

export function formatInstrument(symbol, description = '', exchange = '') {
  if (!symbol) return { name: '', subtitle: '', tag: '', exchange: exchange || 'NSE' };
  
  const raw = String(symbol).trim();
  const exchFromPrefix = raw.includes(':') ? raw.split(':')[0].toUpperCase() : '';
  const effExch = exchFromPrefix || exchange || 'NSE';
  let clean = raw.includes(':') ? raw.split(':')[1] : raw;

  // 1. Index Symbol
  const upperClean = clean.toUpperCase();
  if (INDEX_MAP[upperClean]) {
    return {
      name: INDEX_MAP[upperClean],
      subtitle: `INDEX • ${effExch}`,
      tag: 'INDEX',
      exchange: effExch,
      isIndex: true,
      raw
    };
  }

  // 2. Weekly Option: e.g. NIFTY26O1922800CE or BANKNIFTY26N0655000PE
  const weeklyOptMatch = clean.match(/^([A-Z]+)(\d{2})([1-9OND])(\d{2})(\d+(?:\.\d+)?)(CE|PE)$/i);
  if (weeklyOptMatch) {
    const [_, under, yy, mCode, dd, strike, type] = weeklyOptMatch;
    const month = MONTH_CODES[mCode.toUpperCase()] || mCode.toUpperCase();
    return {
      name: `${under.toUpperCase()} ${strike} ${type.toUpperCase()}`,
      subtitle: `${dd} ${month} 20${yy} • ${effExch}`,
      tag: type.toUpperCase(),
      exchange: effExch,
      strike: Number(strike),
      optionType: type.toUpperCase(),
      underlying: under.toUpperCase(),
      isOption: true,
      raw
    };
  }

  // 3. Monthly Option: e.g. NIFTY26OCT23100CE or CRUDEOIL26NOV9500PE
  const monthlyOptMatch = clean.match(/^([A-Z]+)(\d{2})([A-Z]{3})(\d+(?:\.\d+)?)(CE|PE)$/i);
  if (monthlyOptMatch) {
    const [_, under, yy, month, strike, type] = monthlyOptMatch;
    return {
      name: `${under.toUpperCase()} ${strike} ${type.toUpperCase()}`,
      subtitle: `${month.toUpperCase()} 20${yy} • ${effExch}`,
      tag: type.toUpperCase(),
      exchange: effExch,
      strike: Number(strike),
      optionType: type.toUpperCase(),
      underlying: under.toUpperCase(),
      isOption: true,
      raw
    };
  }

  // 4. Futures: e.g. CRUDEOIL26OCTFUT or CRUDEOILM26OCTFUT or NIFTY26OCTFUT
  const futMatch = clean.match(/^([A-Z]+)(\d{2})([A-Z]{3})FUT$/i);
  if (futMatch) {
    const [_, under, yy, month] = futMatch;
    return {
      name: `${under.toUpperCase()} ${month.toUpperCase()} FUT`,
      subtitle: `${month.toUpperCase()} 20${yy} • ${effExch}`,
      tag: 'FUT',
      exchange: effExch,
      underlying: under.toUpperCase(),
      isFuture: true,
      raw
    };
  }

  // 5. Equity / Cash Stock
  const cleanEq = clean.replace(/-(EQ|A|B|T|X|XT|Z|P|M|SM|BE|BZ)$/i, '');
  const hasValidDesc = description && 
                       description !== clean && 
                       description !== raw && 
                       description !== cleanEq &&
                       !description.endsWith('-EQ') &&
                       !description.includes('INDEX');

  return {
    name: cleanEq,
    subtitle: hasValidDesc ? description : `${cleanEq} • ${effExch}`,
    tag: 'EQ',
    exchange: effExch,
    isEquity: true,
    raw
  };
}
