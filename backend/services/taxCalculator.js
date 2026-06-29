/**
 * Calculates Brokerage and Taxes for a trade.
 * 
 * @param {string} symbol - The trading symbol (e.g., RELIANCE, NIFTY24JUN24000CE, CRUDEOIL24JULFUT)
 * @param {string} productType - 'INT' (Intraday) or 'DEL' (Delivery/Normal)
 * @param {string} side - 'BUY' or 'SELL'
 * @param {number} quantity - Number of shares/lots
 * @param {number} price - Execution price
 * @returns {object} { brokerage, stt, exchangeCharge, gst, sebiCharge, stampDuty, dpCharge, totalTaxes }
 */
function calculateTaxes(symbol, productType, side, quantity, price) {
    const turnover = quantity * price;
    
    const isOption = symbol.endsWith('CE') || symbol.endsWith('PE');
    const isFuture = symbol.endsWith('FUT');
    const isEquity = !isOption && !isFuture;

    let brokerage = 0;
    let stt = 0;
    let exchangeCharge = 0;
    let stampDuty = 0;
    let dpCharge = 0;

    // 1. Brokerage
    if (isEquity && productType === 'DEL') {
        brokerage = 0; // Free equity delivery
    } else {
        brokerage = 20; // Flat ₹20 for Intraday, F&O
    }

    // 2. STT (Securities Transaction Tax) - Charged mostly on Sell
    if (isEquity && productType === 'DEL') {
        stt = turnover * 0.001; // 0.1% on both Buy and Sell for Delivery
    } else if (side === 'SELL') {
        if (isEquity && productType === 'INT') {
            stt = turnover * 0.00025; // 0.025%
        } else if (isFuture) {
            stt = turnover * 0.000125; // 0.0125%
        } else if (isOption) {
            stt = turnover * 0.00125; // 0.125% on Premium
        }
    }

    // 3. Exchange Transaction Charge
    if (isOption) {
        exchangeCharge = turnover * 0.0005; // ~0.05% on premium
    } else if (isFuture) {
        exchangeCharge = turnover * 0.000019; // ~0.0019%
    } else {
        exchangeCharge = turnover * 0.0000325; // ~0.00325%
    }

    // 4. DP Charges (CDSL/NSDL) - Charged ONLY when selling Equity Delivery
    if (isEquity && productType === 'DEL' && side === 'SELL') {
        dpCharge = 25; // Flat ₹25 per script per day (simplified per trade here)
    }

    // 5. Stamp Duty - Charged ONLY on Buy
    if (side === 'BUY') {
        if (isEquity && productType === 'DEL') {
            stampDuty = turnover * 0.00015;
        } else if (isEquity && productType === 'INT') {
            stampDuty = turnover * 0.00003;
        } else if (isFuture) {
            stampDuty = turnover * 0.00002;
        } else if (isOption) {
            stampDuty = turnover * 0.00003;
        }
    }

    // 6. SEBI Turnover Charge
    const sebiCharge = turnover * 0.000001; // ₹10 per crore

    // 7. GST
    const gst = (brokerage + exchangeCharge + dpCharge + sebiCharge) * 0.18; // 18% on services

    const totalTaxes = brokerage + stt + exchangeCharge + stampDuty + dpCharge + sebiCharge + gst;

    return {
        brokerage: Number(brokerage.toFixed(2)),
        stt: Number(stt.toFixed(2)),
        exchangeCharge: Number(exchangeCharge.toFixed(2)),
        stampDuty: Number(stampDuty.toFixed(2)),
        dpCharge: Number(dpCharge.toFixed(2)),
        sebiCharge: Number(sebiCharge.toFixed(2)),
        gst: Number(gst.toFixed(2)),
        totalTaxes: Number(totalTaxes.toFixed(2))
    };
}

module.exports = { calculateTaxes };
