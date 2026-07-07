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
    
    const isOption = /(CE|PE)(?:-[A-Za-z]+)?$/i.test(symbol);
    const isFuture = /FUT(?:-[A-Za-z]+)?$/i.test(symbol) || symbol.includes('FUT');
    const isEquity = !isOption && !isFuture;
    const isCommodity = symbol.includes('MCX') || symbol.includes('NCDEX') || symbol.includes('GOLD') || symbol.includes('SILVER') || symbol.includes('CRUDE') || symbol.includes('NATURALGAS') || symbol.includes('COPPER') || symbol.includes('ZINC');

    let brokerage = 0;
    let stt = 0;
    let exchangeCharge = 0;
    let stampDuty = 0;
    let dpCharge = 0;

    // 1. Brokerage
    if (isOption) {
        brokerage = 20; // Flat ₹20 for Options
    } else if (isEquity && productType === 'DEL') {
        brokerage = 0; // Free equity delivery
    } else {
        // Equity Intraday, Futures, Commodity Futures
        brokerage = Math.min(turnover * 0.0003, 20); 
    }

    // 2. STT/CTT
    if (isEquity && productType === 'DEL') {
        stt = turnover * 0.001; // 0.1% on buy & sell
    } else if (side === 'SELL') {
        if (isEquity && productType === 'INT') {
            stt = turnover * 0.00025; // 0.025%
        } else if (isFuture) {
            stt = turnover * (isCommodity ? 0.0001 : 0.000125); // 0.01% for MCX, 0.0125% for NSE
        } else if (isOption) {
            stt = turnover * (isCommodity ? 0.0005 : 0.000625); // 0.05% for MCX, 0.0625% for NSE
        }
    }

    // 3. Transaction Charges
    if (isOption) {
        exchangeCharge = turnover * (isCommodity ? 0.000418 : 0.0003553); // MCX: 0.0418%, NSE: 0.03553%
    } else if (isFuture) {
        exchangeCharge = turnover * (isCommodity ? 0.000021 : 0.0000183); // MCX: 0.0021%, NSE: 0.00183%
    } else {
        exchangeCharge = turnover * 0.0000307; // Equity NSE: 0.00307%
    }

    // 4. DP Charges (CDSL/NSDL) - Charged ONLY when selling Equity Delivery
    if (isEquity && productType === 'DEL' && side === 'SELL') {
        dpCharge = 15.93; // Standard DP charge ₹13.5 + 18% GST
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
    const sebiCharge = turnover * (isCommodity && !symbol.includes('AGRI') ? 0.000001 : 0.000001); // ₹10 per crore

    // 7. GST
    const gst = (brokerage + exchangeCharge + sebiCharge) * 0.18; // 18% on services

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
