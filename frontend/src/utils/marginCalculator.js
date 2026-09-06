import { getInstantLotsize, isDerivativeContract, isCommodityContract } from './lotsizeHelper';

let dynamicMarginOverrides = {};

export function setDynamicMarginOverrides(overrides) {
  if (overrides && typeof overrides === 'object') {
    dynamicMarginOverrides = { ...dynamicMarginOverrides, ...overrides };
  }
}

export function getDynamicMarginOverrides() {
  return dynamicMarginOverrides;
}

// Exchange SPAN + Exposure Margin Rates for Stock Futures (NSE Official)
export const STOCK_FUTURES_MARGIN_RATES = {
  TCS: 0.1825,         // 18.25% (matches Fyers ₹95,245.638 on ₹5,21,842.50)
  RELIANCE: 0.17825,   // 17.825% (matches Fyers ₹1,18,910 on ₹6,67,100)
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

// Commodity Futures Margin Rates (MCX Official)
export const COMMODITY_FUTURES_MARGIN_RATES = {
  GOLD: 0.095,         // 9.5%
  GOLDM: 0.095,
  GOLDPETAL: 0.095,
  SILVER: 0.110,       // 11.0%
  SILVERM: 0.110,
  SILVERMIC: 0.110,
  CRUDEOIL: 0.265,     // 26.5% (High VAR)
  CRUDEOILM: 0.265,
  NATURALGAS: 0.300,   // 30.0% (High VAR)
  NATURALGASM: 0.300,
  COPPER: 0.110,       // 11.0%
  ZINC: 0.115,
  ALUMINIUM: 0.115,
  LEAD: 0.115,
  MENTHAOIL: 0.125,
  COTTON: 0.125
};

// Index Futures Margin Rates (NSE / BSE Official)
export const INDEX_FUTURES_MARGIN_RATES = {
  NIFTY: 0.1075,       // 10.75% (SPAN ~8.75% + Exp 2%)
  BANKNIFTY: 0.1225,   // 12.25% (SPAN ~9.75% + Exp 2.5%)
  FINNIFTY: 0.110,     // 11.0%
  MIDCPNIFTY: 0.135,   // 13.5%
  MIDCAPNIFTY: 0.135,
  NIFTYNXT50: 0.125,
  SENSEX: 0.115,       // 11.5%
  BANKEX: 0.120
};

/**
 * Resolves exact exchange margin rate for Futures
 */
export function getFuturesMarginRate(symbol) {
  if (!symbol) return 0.185;
  const upper = String(symbol).toUpperCase().replace(/^(NSE:|BSE:|MCX:)/i, '');

  // 0. Dynamic Overrides (from Admin / Live broker sync)
  for (const [key, rate] of Object.entries(dynamicMarginOverrides)) {
    if (upper.startsWith(key.toUpperCase())) return Number(rate);
  }

  // 1. Commodity Check
  for (const [key, rate] of Object.entries(COMMODITY_FUTURES_MARGIN_RATES)) {
    if (upper.startsWith(key)) return rate;
  }

  // 2. Index Check
  for (const [key, rate] of Object.entries(INDEX_FUTURES_MARGIN_RATES)) {
    if (upper.startsWith(key)) return rate;
  }

  // 3. Specific Stock Futures Check
  for (const [key, rate] of Object.entries(STOCK_FUTURES_MARGIN_RATES)) {
    if (upper.startsWith(key)) return rate;
  }

  // 4. Default Stock Futures rate (NSE Standard Average)
  return 0.185;
}

/**
 * Calculates exact margin and leverage metadata for any order
 */
export function calculateOrderMargin({
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

  // Determine contract category
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
      // 1. Option Buy: 100% upfront premium
      requiredMargin = totalValue;
      leverageText = '1x';
      marginRate = 1.0;
    } else {
      // 2. Option Sell (Shorting): SPAN + Exposure Margin
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
    // 3. Futures (Both Buy & Sell require standardized SPAN + Exposure)
    marginRate = getFuturesMarginRate(symbol);
    requiredMargin = totalValue * marginRate;
    leverageText = '1x'; // Matches Fyers official (1x) for derivative margins
  } else {
    // 4. Cash Equity (Stocks)
    if (productType === 'INT') {
      // 5x leverage (20% margin) for Intraday MIS
      marginRate = 0.20;
      requiredMargin = totalValue * 0.20;
      leverageText = '5x';
    } else {
      // 100% full cash for Delivery / CNC
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
