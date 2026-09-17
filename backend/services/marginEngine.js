const { globalNfoFutures, globalNfoOptions } = require('./instruments');

// Helper to lookup lot size from instruments master
function lookupDerivativeBySymbol(symbol) {
    if (!symbol) return null;
    // Check futures first
    for (const underlying of Object.keys(globalNfoFutures || {})) {
        const list = globalNfoFutures[underlying];
        if (Array.isArray(list)) {
            const match = list.find(x => x.symbol === symbol || x.uniqueSymbol === symbol);
            if (match) return match;
        }
    }
    // Check options (flat search by expiry -> strike)
    for (const underlying of Object.keys(globalNfoOptions || {})) {
        const expiries = globalNfoOptions[underlying];
        if (expiries && typeof expiries === 'object') {
            for (const expiry of Object.keys(expiries)) {
                const strikes = expiries[expiry];
                for (const strike of Object.keys(strikes || {})) {
                    const { CE, PE } = strikes[strike] || {};
                    if (CE && (CE.symbol === symbol || CE.uniqueSymbol === symbol)) return CE;
                    if (PE && (PE.symbol === symbol || PE.uniqueSymbol === symbol)) return PE;
                }
            }
        }
    }
    return null;
}

/**
 * Calculates the required margin for an order based on asset class and product type.
 * @param {string} symbol - The trading symbol.
 * @param {string} product_type - 'DEL' (Delivery) or 'INT' (Intraday).
 * @param {string} side - 'BUY' or 'SELL'.
 * @param {number} quantity - Quantity of shares/lots.
 * @param {number} price - The execution price (LTP or Limit Price).
 * @returns {number} The required margin in INR.
 */
function calculateRequiredMargin(symbol, product_type, side, quantity, price, assetDetails = {}) {
    const { calculateOrderMargin } = require('./marginCalculator');
    const lotsize = assetDetails.lotsize || getLotSize(symbol);
    const result = calculateOrderMargin({
        symbol,
        side,
        quantity,
        price,
        productType: product_type,
        lotsize,
        optionStrike: assetDetails.optionStrike || 0
    });

    if (result && typeof result.requiredMargin === 'number') {
        // Support stopLoss reduction if specified for intraday equities
        if (assetDetails.stopLoss && ['INT', 'INTRADAY', 'CO', 'BO'].includes(product_type)) {
            const cleanSym = String(symbol || '').replace(/^(NSE:|BSE:|MCX:)/i, '').toUpperCase();
            const isOptions = /(?:\d+|[-_\s])(CE|PE)(?:[-_\s].*)?$/i.test(cleanSym);
            const isFutures = /(?:\d+|[A-Z]{3}|[-_\s])FUT(?:[-_\s].*)?$/i.test(cleanSym) || cleanSym.endsWith('-FUT');
            if (!isOptions && !isFutures) {
                const contractValue = quantity * price;
                const risk = Math.abs(price - assetDetails.stopLoss) * quantity;
                return Math.min(result.requiredMargin, (contractValue * 0.10) + risk);
            }
        }
        return result.requiredMargin;
    }

    return Number(quantity || 0) * Number(price || 0);
}

let lotsizeMap = {};
try {
    const lotsPath = require('path').join(__dirname, '..', 'database', 'lotsizeMap.json');
    if (require('fs').existsSync(lotsPath)) {
        lotsizeMap = JSON.parse(require('fs').readFileSync(lotsPath, 'utf8'));
    }
} catch (e) {}

function getLotSize(symbol) {
    if (!symbol) return 1;
    const cleanSym = String(symbol).replace(/^(NSE:|BSE:|MCX:)/i, '').toUpperCase();

    // 1. Lookup lot size from instruments master
    const deriv = lookupDerivativeBySymbol(symbol) || lookupDerivativeBySymbol(cleanSym);
    if (deriv && deriv.lotsize) {
        return Math.max(1, Number(deriv.lotsize) || 1);
    }

    // 2. Lookup in lotsizeMap.json
    if (lotsizeMap[cleanSym]) return Math.max(1, Number(lotsizeMap[cleanSym]) || 1);
    const sortedKeys = Object.keys(lotsizeMap).sort((a, b) => b.length - a.length);
    for (const key of sortedKeys) {
        if (cleanSym.startsWith(key)) return Math.max(1, Number(lotsizeMap[key]) || 1);
    }

    // 3. Fallback estimates for indices
    if (cleanSym.startsWith('SENSEX')) return 10;
    if (cleanSym.startsWith('BANKNIFTY')) return 15;
    if (cleanSym.startsWith('NIFTY')) return 25;
    if (cleanSym.startsWith('FINNIFTY')) return 25;
    if (cleanSym.startsWith('MIDCPNIFTY') || cleanSym.startsWith('MIDCAPNIFTY')) return 50;
    if (cleanSym.startsWith('BSE') || cleanSym.startsWith('BANKEX')) return 10;
    return 1;
}

module.exports = {
    calculateRequiredMargin,
    getLotSize
};
