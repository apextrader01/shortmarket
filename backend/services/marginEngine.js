const { lookupDerivativeBySymbol } = require('./angelOne');

/**
 * Calculates the required margin for an order based on asset class and product type.
 * @param {string} symbol - The trading symbol.
 * @param {string} product_type - 'DEL' (Delivery) or 'INT' (Intraday).
 * @param {string} side - 'BUY' or 'SELL'.
 * @param {number} quantity - Quantity of shares/lots.
 * @param {number} price - The execution price (LTP or Limit Price).
 * @returns {number} The required margin in INR.
 */
function calculateRequiredMargin(symbol, product_type, side, quantity, price) {
    const isOptions = symbol.match(/(CE|PE)$/i);
    const isFutures = symbol.match(/FUT$/i);
    
    // 1. Equity Margin Rules
    if (!isOptions && !isFutures) {
        if (product_type === 'INT') {
            // 5x Leverage for Intraday (Requires 20% upfront)
            return (quantity * price) * 0.20;
        } else {
            // 1x Leverage for Delivery (Requires 100% upfront)
            return quantity * price;
        }
    }
    
    // 2. Options Margin Rules
    if (isOptions) {
        if (side === 'BUY') {
            // Option Buyers pay 100% of the Premium
            return quantity * price;
        } else if (side === 'SELL') {
            // Option Sellers require SPAN + Exposure margin
            // Placeholder: Assume 1,00,000 INR per lot for Option Selling
            const lotsize = getLotSize(symbol);
            const numLots = quantity / lotsize;
            return numLots * 100000;
        }
    }
    
    // 3. Futures Margin Rules
    if (isFutures) {
        // Futures Buyers and Sellers both require SPAN + Exposure margin
        // Placeholder: Assume 1,00,000 INR per lot for Futures
        const lotsize = getLotSize(symbol);
        const numLots = quantity / lotsize;
        return numLots * 100000;
    }
    
    return quantity * price;
}

function getLotSize(symbol) {
    // Attempt to lookup via angelOne derivative master
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
