const path = require('path');
const fs = require('fs');

let lotsizeMap = {};
try {
    const lotsPath = path.join(__dirname, '..', 'database', 'lotsizeMap.json');
    if (fs.existsSync(lotsPath)) {
        lotsizeMap = JSON.parse(fs.readFileSync(lotsPath, 'utf8'));
    }
} catch (e) {
    console.error('Failed to load lotsizeMap in taxCalculator:', e);
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

const COMMODITY_FREEZE_LIMITS = {
    CRUDEOIL: 10000,
    CRUDEOILM: 1000,
    NATURALGAS: 50000,
    NATURALGASM: 10000,
    GOLD: 100,
    GOLDM: 1000,
    GOLDPETAL: 10000,
    SILVER: 300,
    SILVERM: 1000,
    SILVERMIC: 10000,
    COPPER: 25000,
    ZINC: 50000,
    LEAD: 50000,
    ALUMINIUM: 50000,
    MENTHAOIL: 3600,
    COTTON: 2500
};

function getFreezeLimit(symbol, explicitLotsize = null) {
    if (!symbol) return 100000;
    const upper = String(symbol).toUpperCase().replace(/^(NSE:|BSE:|MCX:)/i, '');

    // 1. Commodity Check (MCX)
    if (symbol.includes('MCX') || symbol.includes('NCDEX') || isCommodityContract(symbol)) {
        const sortedCommodities = Object.entries(COMMODITY_FREEZE_LIMITS).sort((a, b) => b[0].length - a[0].length);
        for (const [key, limit] of sortedCommodities) {
            if (upper.startsWith(key)) return limit;
        }
        const lot = explicitLotsize || getInstantLotsize(symbol);
        return lot > 1 ? lot * 50 : 10000;
    }

    const lot = explicitLotsize || getInstantLotsize(symbol);

    // 1.5 Cash Equity & ETF Guard (e.g. NIFTYBEES, BANKBEES, GOLDBEES, cash shares)
    if (lot === 1 && !isDerivativeContract(symbol) && !upper.includes('FUT') && !upper.includes('CE') && !upper.includes('PE')) {
        return 100000;
    }

    // 2. Major Indices Check
    if (upper.startsWith('BANKNIFTY') || upper.includes('BANKNIFTY')) {
        return lot > 1 ? (Math.floor(900 / lot) * lot <= 600 ? Math.floor(600 / lot) * lot : 600) : 600;
    }
    if (upper.startsWith('FINNIFTY') || upper.includes('FINNIFTY')) {
        return lot > 1 ? Math.floor(1800 / lot) * lot : 1800;
    }
    if (upper.startsWith('MIDCPNIFTY') || upper.includes('MIDCPNIFTY') || upper.startsWith('MIDCAPNIFTY') || upper.includes('MIDCAPNIFTY')) {
        return lot > 1 ? Math.floor(2800 / lot) * lot : 2800;
    }
    if (upper.startsWith('NIFTYNXT50') || upper.includes('NIFTYNXT50') || upper.includes('NIFTYJR')) {
        return lot > 1 ? Math.floor(600 / lot) * lot : 600;
    }
    if (upper.startsWith('NIFTY') || upper.includes('NIFTY')) {
        return lot > 1 ? Math.floor(1800 / lot) * lot : 1755;
    }
    if (upper.startsWith('SENSEX') || upper.includes('SENSEX')) {
        return 1000;
    }
    if (upper.startsWith('BANKEX') || upper.includes('BANKEX')) {
        return 1000;
    }

    // 3. Stock F&O (Derivatives: Futures & Options for individual stocks)
    // NSE standard freeze limit for individual security F&O is 40 market lots
    if (isDerivativeContract(symbol) || upper.includes('FUT') || upper.includes('CE') || upper.includes('PE')) {
        if (lot > 1) {
            return lot * 40;
        }
        return 1800;
    }

    // 4. Cash Equity (Default)
    return 100000;
}

/**
 * Calculates Brokerage and Taxes for a trade.
 * 
 * @param {string} symbol - The trading symbol (e.g., RELIANCE, NIFTY24JUN24000CE, CRUDEOIL24JULFUT)
 * @param {string} productType - 'INT' (Intraday) or 'DEL' (Delivery/Normal)
 * @param {string} side - 'BUY' or 'SELL'
 * @param {number} quantity - Number of shares/lots
 * @param {number} price - Execution price
 * @param {number} entryPrice - Purchase price for P&L tax
 * @param {number} holdingDays - Holding period
 * @param {number|null} slicesOverride - Explicit slices count
 * @param {boolean} isExercise - Expiry ITM exercise flag
 * @param {boolean} includeBrokerage - True to charge order brokerage (charged once per order), false for partial fills
 * @returns {object} { brokerage, stt, exchangeCharge, gst, sebiCharge, stampDuty, dpCharge, totalTaxes }
 */
function calculateTaxes(symbol, productType, side, quantity, price, entryPrice = 0, holdingDays = 0, slicesOverride = null, isExercise = false, includeBrokerage = true) {
    const turnover = (quantity || 0) * (price || 0);
    
    const clean = symbol.includes(':') ? symbol.split(':')[1] : symbol;
    const isMutualFund = clean.endsWith('-MF') || /^\d{5,6}$/.test(clean) || ['EDEL', 'MIRA', 'NIPP', 'EDEL-MF', 'MIRA-MF', 'NIPP-MF'].includes(clean);
    const isCommodity = symbol.includes('MCX') || symbol.includes('NCDEX') || ['GOLD', 'SILVER', 'CRUDE', 'NATURALGAS', 'COPPER', 'ZINC', 'LEAD', 'ALUMINIUM', 'MENTHAOIL', 'COTTON', 'NICKEL'].some(c => clean.startsWith(c));
    const isOption = !isMutualFund && /(?:\d+|[-_\s])(CE|PE)(?:[-_\s].*)?$/i.test(clean);
    const isFuture = !isMutualFund && !isOption && (/(?:\d+|[A-Z]{3}|[-_\s])FUT(?:[-_\s].*)?$/i.test(clean) || clean.endsWith('-FUT') || isCommodity);
    const isEquity = !isMutualFund && !isOption && !isFuture && !isCommodity;

    const freezeLimit = getFreezeLimit(symbol);
    const slicesCount = slicesOverride !== null ? slicesOverride : (quantity > 0 ? (quantity > freezeLimit ? Math.min(100, Math.ceil(quantity / freezeLimit)) : 1) : 0);

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
        brokerage = isExercise ? 0 : (includeBrokerage ? 20 * slicesCount : 0); // Flat ₹20 per executed order/slice for Options; ₹0 on expiry exercise or partial fill
        if (isExercise) {
            // Statutory 0.125% STT on exercised ITM options at expiry (Finance Act Section 98)
            stt = turnover * 0.00125;
        } else if (side === 'SELL') {
            stt = turnover * (isCommodity ? 0.0005 : 0.001); // 0.1% STT on Options sale (revised Oct 2024)
        }
        exchangeCharge = turnover * (isCommodity ? 0.000418 : 0.0003553);
        if (side === 'BUY' && !isExercise) stampDuty = turnover * 0.00003;
        sebiCharge = turnover * 0.000001;
    } else if (isFuture) {
        if (includeBrokerage && slicesCount > 0) {
            const sliceTurnover = turnover / slicesCount;
            brokerage = Math.min(sliceTurnover * 0.0003, 20) * slicesCount;
        } else {
            brokerage = 0;
        }
        if (side === 'SELL') {
            stt = turnover * (isCommodity ? 0.0001 : 0.0002); // 0.02% STT on Futures sale (revised Oct 2024)
        }
        exchangeCharge = turnover * (isCommodity ? 0.000021 : 0.0000183);
        if (side === 'BUY') stampDuty = turnover * 0.00002;
        sebiCharge = turnover * 0.000001;
    } else {
        // Equity Stocks
        if (productType === 'DEL' || productType === 'CNC' || productType === 'DELIVERY') {
            brokerage = 0; // Free equity delivery
            stt = turnover * 0.001; // 0.1% on buy & sell
            if (side === 'BUY') stampDuty = turnover * 0.00015;
            if (side === 'SELL') dpCharge = 15.93; // Standard CDSL DP charge ₹13.50 + 18% GST
        } else {
            // Intraday Equity (INT, BO, CO, MIS)
            if (includeBrokerage && slicesCount > 0) {
                const sliceTurnover = turnover / slicesCount;
                brokerage = Math.min(sliceTurnover * 0.0003, 20) * slicesCount;
            } else {
                brokerage = 0;
            }
            if (side === 'SELL') stt = turnover * 0.00025; // 0.025% on sell only
            if (side === 'BUY') stampDuty = turnover * 0.00003;
        }
        exchangeCharge = turnover * 0.0000307; // Equity NSE: 0.00307%
        sebiCharge = turnover * 0.000001; // ₹10 per crore
    }

    // 5. Stamp Duty - Charged ONLY on Buy
    if (side === 'BUY') {
        if (isEquity && (productType === 'DEL' || productType === 'CNC' || productType === 'DELIVERY')) {
            stampDuty = turnover * 0.00015;
        } else if (isEquity && ['INT', 'INTRADAY', 'BO', 'CO', 'MIS'].includes(productType)) {
            stampDuty = turnover * 0.00003;
        } else if (isFuture) {
            stampDuty = turnover * 0.00002;
        } else if (isOption) {
            stampDuty = turnover * 0.00003;
        }
    }

    // 6. SEBI Turnover Charge (₹1 per crore for Agri derivatives, ₹10 per crore standard)
    const isAgri = isCommodity && (symbol.includes('AGRI') || symbol.includes('COTTON') || symbol.includes('CHANA') || symbol.includes('JEERA') || symbol.includes('SOYBEAN'));
    sebiCharge = turnover * (isAgri ? 0.0000001 : 0.000001);

    // 7. GST (Broken down into CGST 9% and SGST 9%)
    const gst = (brokerage + exchangeCharge + sebiCharge) * 0.18; // 18% on services
    const cgst = gst / 2;
    const sgst = gst / 2;

    // 8. Capital Gains Tax (STCG & LTCG for Equity Delivery & Mutual Funds only; derivatives are business income under Sec 43(5))
    const isDebt = isMutualFund && (symbol.toLowerCase().includes('debt') || symbol.toLowerCase().includes('liquid') || symbol.toLowerCase().includes('gilt') || symbol.toLowerCase().includes('bond'));
    let stcg = 0;
    let ltcg = 0;
    let capitalGainsTax = 0;
    
    if ((isEquity && (productType === 'DEL' || productType === 'CNC' || productType === 'DELIVERY')) || isMutualFund) {
        if (side === 'SELL' && entryPrice > 0 && price > entryPrice) {
            const profit = (price - entryPrice) * quantity;
            if (isDebt) {
                stcg = Number((profit * 0.30).toFixed(2)); // Debt Funds taxed at slab rates
                capitalGainsTax = stcg;
            } else if (holdingDays > 365) {
                // LTCG: 12.5% under revised Finance Act 2024
                ltcg = Number((profit * 0.125).toFixed(2));
                capitalGainsTax = ltcg;
            } else {
                // STCG: 20% under revised Finance Act 2024
                stcg = Number((profit * 0.20).toFixed(2));
                capitalGainsTax = stcg;
            }
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

function calculateOrderSlices(symbol, totalQty, explicitLotsize = null) {
    const qty = Number(totalQty) || 0;
    if (qty <= 0) return [];
    const limit = getFreezeLimit(symbol, explicitLotsize);
    if (!limit || limit <= 0) return [qty];
    if (qty <= limit) return [qty];
    const MAX_SLICES = 100;
    const slices = [];
    const maxAllowed = limit * MAX_SLICES;
    let remaining = Math.min(qty, maxAllowed);
    while (remaining > 0 && slices.length < MAX_SLICES) {
        const currentSlice = Math.min(remaining, limit);
        slices.push(currentSlice);
        remaining -= currentSlice;
    }
    return slices;
}

module.exports = { calculateTaxes, getFreezeLimit, calculateOrderSlices, getInstantLotsize, isDerivativeContract, isCommodityContract };

