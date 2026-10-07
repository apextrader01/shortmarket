const { resolveSingleLotSize, getDiskLotsizeMap } = require('./instrumentsCache');

// Fast O(1) lot size lookup using instrumentsCache
function lookupDerivativeBySymbol(symbol) {
    if (!symbol) return null;
    const lotsize = resolveSingleLotSize(symbol);
    return lotsize > 1 ? { symbol, lotsize } : null;
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

function getLotSize(symbol) {
    if (!symbol) return 1;
    const cleanSym = String(symbol).replace(/^(NSE:|BSE:|MCX:)/i, '').toUpperCase();

    // 1. Live lookup from in-memory instrumentsCache (contract-exact + reloaded lotsizeMap)
    const cachedLot = resolveSingleLotSize(symbol);
    if (cachedLot && cachedLot > 1) {
        return Math.max(1, Number(cachedLot) || 1);
    }

    // 2. Lookup lot size from instruments master
    const deriv = lookupDerivativeBySymbol(symbol) || lookupDerivativeBySymbol(cleanSym);
    if (deriv && deriv.lotsize && Number(deriv.lotsize) > 1) {
        return Math.max(1, Number(deriv.lotsize) || 1);
    }

    // 3. Lookup in live reloaded lotsizeMap.json
    const liveMap = getDiskLotsizeMap() || {};
    if (liveMap[cleanSym]) return Math.max(1, Number(liveMap[cleanSym]) || 1);
    const sortedKeys = Object.keys(liveMap).sort((a, b) => b.length - a.length);
    for (const key of sortedKeys) {
        if (cleanSym.startsWith(key)) return Math.max(1, Number(liveMap[key]) || 1);
    }

    // 4. Fallback estimates for indices
    if (cleanSym.startsWith('SENSEX')) return 20;
    if (cleanSym.startsWith('BANKNIFTY')) return 30;
    if (cleanSym.startsWith('NIFTY')) return 65;
    if (cleanSym.startsWith('FINNIFTY')) return 60;
    if (cleanSym.startsWith('MIDCPNIFTY') || cleanSym.startsWith('MIDCAPNIFTY')) return 120;
    if (cleanSym.startsWith('BSE') || cleanSym.startsWith('BANKEX')) return 30;
    return 1;
}

module.exports = {
    calculateRequiredMargin,
    getLotSize
};
