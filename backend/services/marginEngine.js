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
    const isOptions = symbol.match(/(CE|PE)$/i);
    const isFutures = symbol.match(/FUT$/i);
    const contractValue = quantity * price;
    
    // 1. Equity Margin Rules
    if (!isOptions && !isFutures) {
        if (product_type === 'DEL' || product_type === 'DELIVERY') {
            return contractValue; // 1x
        }
        if (['INT', 'INTRADAY', 'CO', 'BO'].includes(product_type)) {
            // 5x Leverage
            let margin = contractValue * 0.20;
            if (assetDetails.stopLoss) {
                const risk = Math.abs(price - assetDetails.stopLoss) * quantity;
                margin = (contractValue * 0.10) + risk; // Lower upfront if SL is tight
            }
            return margin;
        }
    }
    
    // 2. Options Margin Rules
    if (isOptions) {
        if (side === 'BUY') return contractValue; // 100% Premium
        if (side === 'SELL') {
            // SPAN + Exposure margin mocked as 15% of the underlying contract value. 
            // For options, we use the premium value as a fallback mock (15% of notional).
            // Since we don't have underlying price here, we'll mock it realistically at a flat ₹1,00,000 per lot fallback,
            // or 15% of the option notional if it exceeds 1L.
            const lotsize = getLotSize(symbol);
            const numLots = quantity / lotsize;
            return Math.max(numLots * 100000, contractValue * 0.15);
        }
    }
    
    // 3. Futures Margin Rules
    if (isFutures) {
        const lotsize = getLotSize(symbol);
        const numLots = quantity / lotsize;
        return Math.max(numLots * 100000, contractValue * 0.15);
    }
    
    return contractValue;
}

function getLotSize(symbol) {
    // Lookup lot size from instruments master
    const deriv = lookupDerivativeBySymbol(symbol);
    if (deriv && deriv.lotsize) {
        return Number(deriv.lotsize);
    }
    // Fallback estimates if lookup fails
    if (symbol.startsWith('SENSEX')) return 10;
    if (symbol.startsWith('BANKNIFTY')) return 15;
    if (symbol.startsWith('NIFTY')) return 25;
    if (symbol.startsWith('FINNIFTY')) return 25;
    if (symbol.startsWith('MIDCPNIFTY')) return 50;
    if (symbol.startsWith('BSE')) return 10;
    return 1;
}

module.exports = {
    calculateRequiredMargin
};
