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
function calculateTaxes(symbol, productType, side, quantity, price, entryPrice = 0, holdingDays = 0) {
    const turnover = quantity * price;
    
    const clean = symbol.includes(':') ? symbol.split(':')[1] : symbol;
    const isMutualFund = clean.endsWith('-MF') || /^\d{5,6}$/.test(clean) || ['EDEL', 'MIRA', 'NIPP', 'EDEL-MF', 'MIRA-MF', 'NIPP-MF'].includes(clean);
    const isOption = !isMutualFund && /(?:\d+|[-_\s])(CE|PE)(?:[-_\s].*)?$/i.test(clean);
    const isFuture = !isMutualFund && !isOption && (/(?:\d+|[A-Z]{3}|[-_\s])FUT(?:[-_\s].*)?$/i.test(clean) || clean.endsWith('-FUT'));
    const isEquity = !isMutualFund && !isOption && !isFuture;
    const isCommodity = symbol.includes('MCX') || symbol.includes('NCDEX') || symbol.includes('GOLD') || symbol.includes('SILVER') || symbol.includes('CRUDE') || symbol.includes('NATURALGAS') || symbol.includes('COPPER') || symbol.includes('ZINC');

    let brokerage = 0;
    let stt = 0;
    let exchangeCharge = 0;
    let stampDuty = 0;
    let dpCharge = 0;
    let sebiCharge = 0;

    if (isMutualFund) {
        // Direct Mutual Funds: Zero brokerage, Zero DP charge
        if (side === 'BUY') stampDuty = turnover * 0.00005; // 0.005% stamp duty on MF purchase
        if (side === 'SELL') stt = turnover * 0.001; // 0.1% STT on equity MF redemption
    } else if (isOption) {
        brokerage = 20; // Flat ₹20 for Options
        if (side === 'SELL') {
            stt = turnover * (isCommodity ? 0.0005 : 0.000625);
        }
        exchangeCharge = turnover * (isCommodity ? 0.000418 : 0.0003553);
        if (side === 'BUY') stampDuty = turnover * 0.00003;
        sebiCharge = turnover * 0.000001;
    } else if (isFuture) {
        brokerage = Math.min(turnover * 0.0003, 20);
        if (side === 'SELL') {
            stt = turnover * (isCommodity ? 0.0001 : 0.000125);
        }
        exchangeCharge = turnover * (isCommodity ? 0.000021 : 0.0000183);
        if (side === 'BUY') stampDuty = turnover * 0.00002;
        sebiCharge = turnover * 0.000001;
    } else {
        // Equity Stocks
        if (productType === 'DEL') {
            brokerage = 0; // Free equity delivery
            stt = turnover * 0.001; // 0.1% on buy & sell
            if (side === 'BUY') stampDuty = turnover * 0.00015;
            if (side === 'SELL') dpCharge = 15.93; // Standard CDSL DP charge ₹13.50 + 18% GST
        } else {
            // Intraday Equity
            brokerage = Math.min(turnover * 0.0003, 20); // 0.03% or ₹20 max
            if (side === 'SELL') stt = turnover * 0.00025; // 0.025% on sell only
            if (side === 'BUY') stampDuty = turnover * 0.00003;
        }
        exchangeCharge = turnover * 0.0000307; // Equity NSE: 0.00307%
        sebiCharge = turnover * 0.000001; // ₹10 per crore
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
    sebiCharge = turnover * (isCommodity && !symbol.includes('AGRI') ? 0.000001 : 0.000001); // ₹10 per crore

    // 7. GST (Broken down into CGST 9% and SGST 9%)
    const gst = (brokerage + exchangeCharge + sebiCharge) * 0.18; // 18% on services
    const cgst = gst / 2;
    const sgst = gst / 2;

    // 8. Capital Gains Tax (STCG & LTCG for Mutual Funds & Equity Investments)
    const isDebt = isMutualFund && (symbol.toLowerCase().includes('debt') || symbol.toLowerCase().includes('liquid') || symbol.toLowerCase().includes('gilt') || symbol.toLowerCase().includes('bond'));
    let stcg = 0;
    let ltcg = 0;
    let capitalGainsTax = 0;
    
    if (side === 'SELL' && entryPrice > 0 && price > entryPrice) {
        const profit = (price - entryPrice) * quantity;
        if (isDebt) {
            capitalGainsTax = Number((profit * 0.01).toFixed(2)); // 1% for Debt Funds
            stcg = capitalGainsTax;
        } else if (holdingDays > 365) {
            // LTCG: 12.5% on profit exceeding ₹1.25 Lakh per financial year
            const taxableProfit = Math.max(0, profit - 125000);
            ltcg = Number((taxableProfit * 0.125).toFixed(2));
            capitalGainsTax = ltcg;
        } else {
            // STCG: 20% on profit held <= 12 months
            stcg = Number((profit * 0.20).toFixed(2));
            capitalGainsTax = stcg;
        }
    }

    const totalTaxes = brokerage + stt + exchangeCharge + stampDuty + dpCharge + sebiCharge + gst;

    return {
        brokerage: Number(brokerage.toFixed(2)),
        stt: Number(stt.toFixed(2)),
        exchangeCharge: Number(exchangeCharge.toFixed(2)),
        stampDuty: Number(stampDuty.toFixed(2)),
        dpCharge: Number(dpCharge.toFixed(2)),
        sebiCharge: Number(sebiCharge.toFixed(2)),
        gst: Number(gst.toFixed(2)),
        cgst: Number(cgst.toFixed(2)),
        sgst: Number(sgst.toFixed(2)),
        stcg,
        ltcg,
        capitalGainsTax,
        capitalGainsRules: {
            stcg: '20% on profit (held ≤ 12 months)',
            ltcg: '12.5% on profit (held > 12 months, first ₹1.25L exempt)',
            debtFund: '1% on profit'
        },
        totalTaxes: Number(totalTaxes.toFixed(2))
    };
}

module.exports = { calculateTaxes };
