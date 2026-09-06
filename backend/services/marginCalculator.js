const path = require('path');
const fs = require('fs');

let lotsizeMap = {};
try {
    const lotsPath = path.join(__dirname, '..', 'database', 'lotsizeMap.json');
    if (fs.existsSync(lotsPath)) {
        lotsizeMap = JSON.parse(fs.readFileSync(lotsPath, 'utf8'));
    }
} catch (e) {
    console.error('Failed to load lotsizeMap in marginCalculator:', e);
}

let dynamicMarginOverrides = {};

function setDynamicMarginOverrides(overrides) {
    if (overrides && typeof overrides === 'object') {
        dynamicMarginOverrides = { ...dynamicMarginOverrides, ...overrides };
    }
}

function getDynamicMarginOverrides() {
    return dynamicMarginOverrides;
}

function isDerivativeContract(sym) {
    if (!sym || typeof sym !== 'string') return false;
    const clean = sym.includes(':') ? sym.split(':')[1] : sym;
    return /(?:\d+|[-_\s])(CE|PE)(?:[-_\s].*)?$/i.test(clean) || 
           /(?:\d+|[A-Z]{3}|[-_\s])FUT(?:[-_\s].*)?$/i.test(clean) || 
           clean.endsWith('-FUT');
}

function isCommodityContract(sym) {
    if (!sym || typeof sym !== 'string') return false;
    if (sym.includes('MCX') || sym.includes('NCDEX')) return true;
    const clean = sym.replace(/^(NSE:|BSE:|MCX:)/i, '');
    return ['CRUDEOIL', 'GOLD', 'SILVER', 'NATURALGAS', 'COPPER', 'ZINC', 'LEAD', 'ALUMINIUM', 'MENTHAOIL', 'COTTON', 'NICKEL'].some(c => clean.startsWith(c));
}

function getInstantLotsize(sym) {
    if (!sym || typeof sym !== 'string') return 1;
    const isDeriv = isDerivativeContract(sym);
    const isComm = isCommodityContract(sym);
    if (!isDeriv && !isComm) return 1;
    const clean = sym.replace(/^(NSE:|BSE:|MCX:)/i, '').toUpperCase();
    if (lotsizeMap[clean]) return lotsizeMap[clean];
    const sortedKeys = Object.keys(lotsizeMap).sort((a, b) => b.length - a.length);
    for (const key of sortedKeys) {
        if (clean.startsWith(key)) return lotsizeMap[key];
    }
    return 1;
}

const STOCK_FUTURES_MARGIN_RATES = {
  TCS: 0.1825,
  RELIANCE: 0.17825,
  HDFCBANK: 0.185,
  INFY: 0.185,
  ICICIBANK: 0.180,
  SBIN: 0.195,
  BHARTIARTL: 0.190,
  TATAMOTORS: 0.200,
  TATASTEEL: 0.205,
  TATAELXSI: 0.210,
  BAJFINANCE: 0.195,
  BAJAJFINSV: 0.200,
  ITC: 0.180,
  KOTAKBANK: 0.185,
  LT: 0.185,
  AXISBANK: 0.190,
  MARUTI: 0.180,
  SUNPHARMA: 0.180,
  WIPRO: 0.190,
  HCLTECH: 0.185,
  ADANIENT: 0.245,
  ADANIPORTS: 0.210
};

const COMMODITY_FUTURES_MARGIN_RATES = {
  GOLD: 0.095,
  GOLDM: 0.095,
  GOLDPETAL: 0.095,
  SILVER: 0.110,
  SILVERM: 0.110,
  SILVERMIC: 0.110,
  CRUDEOIL: 0.265,
  CRUDEOILM: 0.265,
  NATURALGAS: 0.300,
  NATURALGASM: 0.300,
  COPPER: 0.110,
  ZINC: 0.115,
  ALUMINIUM: 0.115,
  LEAD: 0.115,
  MENTHAOIL: 0.125,
  COTTON: 0.125
};

const INDEX_FUTURES_MARGIN_RATES = {
  NIFTY: 0.1075,
  BANKNIFTY: 0.1225,
  FINNIFTY: 0.110,
  MIDCPNIFTY: 0.135,
  MIDCAPNIFTY: 0.135,
  NIFTYNXT50: 0.125,
  SENSEX: 0.115,
  BANKEX: 0.120
};

function getFuturesMarginRate(symbol) {
  if (!symbol) return 0.185;
  const upper = String(symbol).toUpperCase().replace(/^(NSE:|BSE:|MCX:)/i, '');

  for (const [key, rate] of Object.entries(dynamicMarginOverrides)) {
    if (upper.startsWith(key.toUpperCase())) return Number(rate);
  }
  for (const [key, rate] of Object.entries(COMMODITY_FUTURES_MARGIN_RATES)) {
    if (upper.startsWith(key)) return rate;
  }
  for (const [key, rate] of Object.entries(INDEX_FUTURES_MARGIN_RATES)) {
    if (upper.startsWith(key)) return rate;
  }
  for (const [key, rate] of Object.entries(STOCK_FUTURES_MARGIN_RATES)) {
    if (upper.startsWith(key)) return rate;
  }
  return 0.185;
}

function calculateOrderMargin({
  symbol,
  side = 'BUY',
  quantity = 1,
  price = 0,
  productType = 'INT',
  lotsize = null,
  isOption = null,
  optionStrike = 0
}) {
  const isBuy = String(side || 'BUY').toUpperCase() === 'BUY';
  const cleanSym = String(symbol || '').replace(/^(NSE:|BSE:|MCX:)/i, '');
  const isCommodity = symbol?.includes('MCX') || isCommodityContract(symbol);
  const effectiveLotsize = (lotsize && Number(lotsize) > 1) ? Number(lotsize) : (getInstantLotsize(symbol) || 1);
  const totalQty = Number(quantity) || 1;
  const unitPrice = parseFloat(price) || 0;
  const totalValue = totalQty * unitPrice;

  const isOpt = isOption !== null 
    ? isOption 
    : (/(?:\d+|[-_\s])(CE|PE)(?:[-_\s].*)?$/i.test(cleanSym) || cleanSym.endsWith('CE') || cleanSym.endsWith('PE'));
  const isFut = !isOpt && (/(?:\d+|[A-Z]{3}|[-_\s])FUT(?:[-_\s].*)?$/i.test(cleanSym) || cleanSym.endsWith('-FUT'));
  const isEq = !isOpt && !isFut;

  const isIndex = ['NIFTY', 'BANKNIFTY', 'SENSEX', 'FINNIFTY', 'MIDCPNIFTY', 'MIDCAPNIFTY', 'NIFTYNXT50', 'BANKEX'].some(idx => cleanSym.startsWith(idx));

  let requiredMargin = 0;
  let leverageText = '1x';
  let marginRate = 1.0;

  if (isOpt) {
    if (isBuy) {
      requiredMargin = totalValue;
      leverageText = '1x';
      marginRate = 1.0;
    } else {
      const sellMarginRate = isIndex ? 0.125 : (isCommodity ? 0.25 : 0.225);
      marginRate = sellMarginRate;
      
      let strikeVal = optionStrike;
      if (!strikeVal || strikeVal <= 0) {
        const strikeMatch = cleanSym.match(/(\d+)(CE|PE)$/i);
        if (strikeMatch) {
          let s = strikeMatch[1];
          if (s.length > 5) s = s.slice(-5);
          strikeVal = parseFloat(s);
        }
      }

      if (strikeVal > 0) {
        const grossMargin = strikeVal * totalQty * sellMarginRate;
        const premiumCollected = totalValue;
        requiredMargin = Math.max(grossMargin - premiumCollected, totalQty * (isIndex ? 40 : 80));
      } else {
        requiredMargin = totalQty * (isIndex ? 4500 : 9000);
      }
      leverageText = '1x';
    }
  } else if (isFut) {
    marginRate = getFuturesMarginRate(symbol);
    requiredMargin = totalValue * marginRate;
    leverageText = '1x';
  } else {
    if (productType === 'INT') {
      marginRate = 0.20;
      requiredMargin = totalValue * 0.20;
      leverageText = '5x';
    } else {
      marginRate = 1.0;
      requiredMargin = totalValue;
      leverageText = '1x';
    }
  }

  return {
    requiredMargin: Number(requiredMargin.toFixed(2)),
    totalValue: Number(totalValue.toFixed(2)),
    leverageText,
    marginRate,
    isOption: isOpt,
    isFuture: isFut,
    isEquity: isEq
  };
}

module.exports = {
  getFuturesMarginRate,
  calculateOrderMargin,
  setDynamicMarginOverrides,
  getDynamicMarginOverrides,
  STOCK_FUTURES_MARGIN_RATES,
  COMMODITY_FUTURES_MARGIN_RATES,
  INDEX_FUTURES_MARGIN_RATES
};
