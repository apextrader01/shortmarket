// backend/services/symbolUtils.js
// Universal Symbol Normalization, Classification, and Room Aliasing Engine
// Covers all market segments:
// 1. Stocks (NSE & BSE Equities with -EQ, -A, -B suffixes)
// 2. NFO (NSE Futures & Options)
// 3. BFO (BSE Futures & Options - SENSEX & BANKEX)
// 4. MCX Commodities (Crude, Gold, Silver, Natural Gas, Base Metals, Minis, Dexes)
// 5. Indices (NIFTY 50, BANKNIFTY, FINNIFTY, MIDCPNIFTY, NIFTYNXT50, INDIAVIX, SENSEX, BANKEX)

const COMMODITY_PREFIXES = [
  'CRUDEOIL', 'CRUDEOILM', 'GOLD', 'GOLDM', 'GOLDPETAL', 'GOLDGUINEA',
  'SILVER', 'SILVERM', 'SILVERMIC', 'NATURALGAS', 'NATGASMINI',
  'COPPER', 'ZINC', 'ZINCMINI', 'LEAD', 'LEADMINI', 'ALUMINIUM', 'ALUMINI',
  'NICKEL', 'MENTHAOIL', 'COTTON', 'COTTONCNDY', 'CARDAMOM', 'RUBBER',
  'STEELREBAR', 'MCXBULLDEX', 'MCXMETLDEX', 'MCXENRGDEX'
];

const INDEX_ALIAS_MAP = {
  'NIFTY': 'NSE:NIFTY50-INDEX',
  'NIFTY 50': 'NSE:NIFTY50-INDEX',
  'NIFTY50': 'NSE:NIFTY50-INDEX',
  'NIFTY50-INDEX': 'NSE:NIFTY50-INDEX',
  'NIFTY-INDEX': 'NSE:NIFTY50-INDEX',
  'BANKNIFTY': 'NSE:NIFTYBANK-INDEX',
  'BANK NIFTY': 'NSE:NIFTYBANK-INDEX',
  'NIFTY BANK': 'NSE:NIFTYBANK-INDEX',
  'NIFTYBANK': 'NSE:NIFTYBANK-INDEX',
  'NIFTYBANK-INDEX': 'NSE:NIFTYBANK-INDEX',
  'FINNIFTY': 'NSE:FINNIFTY-INDEX',
  'FIN NIFTY': 'NSE:FINNIFTY-INDEX',
  'NIFTY FIN SERVICE': 'NSE:FINNIFTY-INDEX',
  'FINNIFTY-INDEX': 'NSE:FINNIFTY-INDEX',
  'MIDCPNIFTY': 'NSE:MIDCPNIFTY-INDEX',
  'MIDCAP NIFTY': 'NSE:MIDCPNIFTY-INDEX',
  'MIDCAPNIFTY': 'NSE:MIDCPNIFTY-INDEX',
  'NIFTY MID SELECT': 'NSE:MIDCPNIFTY-INDEX',
  'MIDCPNIFTY-INDEX': 'NSE:MIDCPNIFTY-INDEX',
  'NIFTYNXT50': 'NSE:NIFTYNXT50-INDEX',
  'NIFTY NEXT 50': 'NSE:NIFTYNXT50-INDEX',
  'NIFTYNXT50-INDEX': 'NSE:NIFTYNXT50-INDEX',
  'INDIAVIX': 'NSE:INDIAVIX-INDEX',
  'INDIA VIX': 'NSE:INDIAVIX-INDEX',
  'INDIAVIX-INDEX': 'NSE:INDIAVIX-INDEX',
  'SENSEX': 'BSE:SENSEX-INDEX',
  'BSE SENSEX': 'BSE:SENSEX-INDEX',
  'SENSEX-INDEX': 'BSE:SENSEX-INDEX',
  'BANKEX': 'BSE:BANKEX-INDEX',
  'BSE BANKEX': 'BSE:BANKEX-INDEX',
  'BANKEX-INDEX': 'BSE:BANKEX-INDEX'
};

function isCommoditySymbol(str) {
  if (!str || typeof str !== 'string') return false;
  const upper = str.toUpperCase().trim();
  if (upper.startsWith('MCX:') || upper.startsWith('COM:') || upper.startsWith('COMM:') || upper.endsWith('-MCX')) return true;
  const noPrefix = upper.replace(/^(MCX:|COM:|COMM:|NSE:|BSE:|NFO:|BFO:)/i, '');
  return COMMODITY_PREFIXES.some(c => noPrefix.startsWith(c));
}

function isBseSymbol(str) {
  if (!str || typeof str !== 'string') return false;
  const upper = str.toUpperCase().trim();
  if (upper.startsWith('BSE:') || upper.startsWith('BFO:') || upper.endsWith('-BSE') || upper.endsWith('-A') || upper.endsWith('-B')) return true;
  const noPrefix = upper.replace(/^(MCX:|COM:|COMM:|NSE:|BSE:|NFO:|BFO:)/i, '');
  return noPrefix.startsWith('SENSEX') || noPrefix.startsWith('BANKEX');
}

function isDerivativeSymbol(str) {
  if (!str || typeof str !== 'string') return false;
  const upper = str.toUpperCase().trim();
  // Call / Put options always end with strike digits + CE or PE (e.g. 23200CE, 75000PE)
  if (/\d+(CE|PE)$/i.test(upper)) return true;
  // Futures end with FUT or FUTURE
  if (/(FUT|FUTURE)$/i.test(upper)) return true;
  // Standard monthly/weekly contract formats (e.g. 26OCT, 26O19, 26D05)
  if (/\d{2}(JAN|FEB|MAR|APR|MAY|JUN|JUL|AUG|SEP|OCT|NOV|DEC|[0-9O][0-9]{2})/i.test(upper)) return true;
  return false;
}

function cleanSymbol(str) {
  if (!str || typeof str !== 'string') return '';
  return str.trim()
    .replace(/^(NSE:|BSE:|MCX:|NFO:|BFO:|COM:|COMM:)/i, '')
    .replace(/-(EQ|A|B|T|X|XT|Z|P|M|SM|BE|BZ|INDEX|MCX|BSE)$/i, '');
}

/**
 * Returns an exhaustive list of symbol aliases and room names for any given symbol across
 * Stocks (NSE/BSE), NFO, BFO, MCX Commodities, and Indices.
 */
function getSymbolAliases(sym) {
  if (!sym || typeof sym !== 'string') return [];
  const trimmed = sym.trim();
  if (!trimmed) return [];
  const upper = trimmed.toUpperCase();
  const aliases = new Set([trimmed]);

  // 1. Check Index Alias Map
  const upperNoPrefix = upper.replace(/^(NSE:|BSE:|MCX:|NFO:|BFO:)/i, '').trim();
  if (INDEX_ALIAS_MAP[upperNoPrefix]) {
    const canonicalIndex = INDEX_ALIAS_MAP[upperNoPrefix];
    aliases.add(canonicalIndex);
    aliases.add(upperNoPrefix);
    for (const [key, val] of Object.entries(INDEX_ALIAS_MAP)) {
      if (val === canonicalIndex) {
        aliases.add(key);
      }
    }
    return Array.from(aliases);
  }

  // 2. Extract prefix and raw body
  let raw = trimmed;
  let ex = null;
  if (trimmed.includes(':')) {
    const colonIdx = trimmed.indexOf(':');
    let rawEx = trimmed.substring(0, colonIdx).toUpperCase();
    raw = trimmed.substring(colonIdx + 1);
    aliases.add(raw);

    if (rawEx === 'NFO') ex = 'NSE';
    else if (rawEx === 'BFO') ex = 'BSE';
    else if (rawEx === 'COM' || rawEx === 'COMM') ex = 'MCX';
    else ex = rawEx;
  }

  const clean = raw.replace(/-(EQ|A|B|T|X|XT|Z|P|M|SM|BE|BZ|INDEX|MCX|BSE)$/i, '');
  if (clean) aliases.add(clean);

  // 3. Segment Resolution
  if (isCommoditySymbol(trimmed) || isCommoditySymbol(raw)) {
    // === MCX COMMODITIES ===
    aliases.add(`MCX:${raw}`);
    aliases.add(`MCX:${clean}`);
    aliases.add(`${clean}-MCX`);
    aliases.add(`${raw}-MCX`);
  } else if (isBseSymbol(trimmed) || isBseSymbol(raw) || ex === 'BSE') {
    // === BSE EQUITIES & BFO (SENSEX & BANKEX DERIVATIVES) ===
    aliases.add(`BSE:${raw}`);
    aliases.add(`BSE:${clean}`);
    aliases.add(`BFO:${raw}`);
    aliases.add(`BFO:${clean}`);
    if (!isDerivativeSymbol(raw)) {
      aliases.add(`BSE:${clean}-A`);
      aliases.add(`BSE:${clean}-B`);
      aliases.add(`NSE:${clean}`);
      aliases.add(`NSE:${clean}-EQ`);
    }
  } else {
    // === NSE EQUITIES & NFO (NSE DERIVATIVES) ===
    aliases.add(`NSE:${raw}`);
    aliases.add(`NSE:${clean}`);
    aliases.add(`NFO:${raw}`);
    aliases.add(`NFO:${clean}`);
    if (!isDerivativeSymbol(raw)) {
      aliases.add(`NSE:${clean}-EQ`);
      aliases.add(`BSE:${clean}`);
      aliases.add(`BSE:${clean}-A`);
    }
  }

  return Array.from(aliases);
}

/**
 * Normalizes any symbol format to the exact canonical Fyers WebSocket format
 * (e.g. NSE:RELIANCE-EQ, NSE:NIFTY26O1923200CE, BSE:SENSEX26O1675000CE, MCX:CRUDEOIL26OCTFUT)
 */
function toCanonicalFyersSymbol(symbol, canonicalStockMap = null, nameToFyers = null) {
  if (typeof symbol === 'object' && symbol !== null) symbol = symbol.symbol;
  if (!symbol || typeof symbol !== 'string') return null;

  const trimmed = symbol.trim();
  const upper = trimmed.toUpperCase();
  const upperNoPrefix = upper.replace(/^(NSE:|BSE:|MCX:|NFO:|BFO:|COM:|COMM:)/i, '').trim();

  // 1. Index Alias Map
  if (INDEX_ALIAS_MAP[upperNoPrefix]) {
    return INDEX_ALIAS_MAP[upperNoPrefix];
  }

  // 2. Prefixed Symbol
  if (trimmed.includes(':')) {
    const colonIdx = trimmed.indexOf(':');
    let ex = trimmed.substring(0, colonIdx).toUpperCase();
    const symPart = trimmed.substring(colonIdx + 1);

    if (ex === 'NFO') ex = 'NSE';
    if (ex === 'BFO') ex = 'BSE';
    if (ex === 'COM' || ex === 'COMM') ex = 'MCX';

    const normalized = `${ex}:${symPart}`;
    if (canonicalStockMap && canonicalStockMap.has(normalized)) return canonicalStockMap.get(normalized);

    const clean = symPart.replace(/-(EQ|A|B|T|X|XT|Z|P|M|SM|BE|BZ)$/i, '');
    if (canonicalStockMap && canonicalStockMap.has(`${ex}:${clean}`)) return canonicalStockMap.get(`${ex}:${clean}`);

    if (nameToFyers && nameToFyers[normalized]) return nameToFyers[normalized];
    if (nameToFyers && nameToFyers[symbol]) return nameToFyers[symbol];

    return normalized;
  }

  // 3. Unprefixed Symbol
  if (nameToFyers && nameToFyers[trimmed]) return nameToFyers[trimmed];
  if (canonicalStockMap && canonicalStockMap.has(`NSE:${trimmed}`)) return canonicalStockMap.get(`NSE:${trimmed}`);
  if (canonicalStockMap && canonicalStockMap.has(`BSE:${trimmed}`)) return canonicalStockMap.get(`BSE:${trimmed}`);

  // Commodity
  if (isCommoditySymbol(trimmed)) {
    const cleanCom = trimmed.replace(/-MCX$/i, '');
    return `MCX:${cleanCom}`;
  }

  // BSE / BFO
  if (isBseSymbol(trimmed)) {
    const cleanBse = trimmed.replace(/-BSE$/i, '');
    return `BSE:${cleanBse}`;
  }

  // Default NSE
  return `NSE:${trimmed}`;
}

module.exports = {
  COMMODITY_PREFIXES,
  INDEX_ALIAS_MAP,
  isCommoditySymbol,
  isBseSymbol,
  isDerivativeSymbol,
  cleanSymbol,
  getSymbolAliases,
  toCanonicalFyersSymbol
};
