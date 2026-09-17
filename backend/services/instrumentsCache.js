const fs = require('fs');
const path = require('path');

let allInstruments = [];
let lotSizeMap = {};

function flattenTree(node, results = []) {
    if (!node || typeof node !== 'object') return results;
    
    if (node.symbol && node.token) {
        results.push(node);
        return results;
    }
    
    for (const key in node) {
        flattenTree(node[key], results);
    }
    return results;
}

function loadJSON(filename) {
    try {
        const filepath = path.join(__dirname, '..', 'database', filename);
        if (fs.existsSync(filepath)) {
            const data = JSON.parse(fs.readFileSync(filepath, 'utf8'));
            return Array.isArray(data) ? data : flattenTree(data);
        }
    } catch (e) {
        console.error(`Error loading ${filename}:`, e);
    }
    return [];
}

function initializeCache() {
    console.log('Loading instruments into memory cache...');
    const stocks = loadJSON('stocks.json');
    const futures = loadJSON('futures.json');
    const options = loadJSON('options.json');
    
    let rawInstruments = [...stocks, ...futures, ...options];

    
    // Filtering and Deduplication
    const symbolMap = new Map();
    
    rawInstruments.forEach(item => {
        item.search_string = `${item.symbol} ${item.name || ''} ${item.description || ''} ${item.exchange || ''}`.toLowerCase();
        if (!item.unique_symbol) item.unique_symbol = item.symbol;
        
        // Filter out debt/bonds, debentures, government securities, etc.
        if (item.exchange === 'NSE') {
            // NSE Debt segments: N*, Y*, Z*, GS (Govt Sec), GB (Govt Bond), TB (Treasury Bill), SG (Sovereign Gold)
            if (item.symbol.match(/-(N[A-Z0-9]|Y[A-Z0-9]|Z[A-Z0-9]|GS|GB|TB|SG)$/i)) return;
        }
        if (item.exchange === 'BSE') {
            // BSE Debt segments: -F (Fixed Income/NCDs), -G (Govt Securities)
            if (item.symbol.match(/-(F|G)$/i)) return;
        }
        if (!symbolMap.has(item.unique_symbol)) {
            symbolMap.set(item.unique_symbol, item);
        }
    });
    
    let filteredInstruments = Array.from(symbolMap.values());
    
    allInstruments = filteredInstruments;
    
    // Pre-calculate lot sizes map for O(1) lookup
    lotSizeMap = {};
    allInstruments.forEach(item => {
        lotSizeMap[item.symbol] = item.lotsize || 1;
        lotSizeMap[item.unique_symbol] = item.lotsize || 1;
    });
    
    console.log(`Loaded ${allInstruments.length} instruments into memory after filtering duplicates.`);
}

// Initial load
initializeCache();

function getLotSizes(symbols) {
    if (!Array.isArray(symbols)) return {};
    const result = {};
    symbols.forEach(sym => {
        if (!sym) return;
        const cleanSym = String(sym).replace(/^(NSE:|BSE:|MCX:)/i, '');
        result[sym] = lotSizeMap[sym] || lotSizeMap[cleanSym] || lotSizeMap['NSE:' + cleanSym] || lotSizeMap['MCX:' + cleanSym] || 1;
    });
    return result;
}

function getAllStocks() {
    // Only return stocks and spots for the main API response
    // Filter out futures and options, and slim payload to essential fields
    return allInstruments
        .filter(item => {
            const clean = item.symbol.includes(':') ? item.symbol.split(':')[1] : item.symbol;
            const isOpt = /(?:\d+|[-_\s])(CE|PE)(?:[-_\s].*)?$/i.test(clean);
            const isFut = /(?:\d+|[A-Z]{3}|[-_\s])FUT(?:[-_\s].*)?$/i.test(clean) || clean.endsWith('-FUT');
            const isNSE_BSE = item.exchange === 'NSE' || item.exchange === 'BSE';
            return isNSE_BSE && !isOpt && !isFut;
        })
        .map(item => ({
            symbol: item.symbol,
            name: item.name,
            exchange: item.exchange,
            lotsize: item.lotsize || 1,
            token: item.token || ''
        }));
}

function searchInstruments(query) {
    if (!query || query.length < 2) return [];
    
    const queryParts = query.toLowerCase().split(/\s+/).filter(Boolean);
    
    // Simple filter: every part of the query must be included in the search_string
    const nowMs = Date.now();
    const results = allInstruments.filter(item => {
        const expMs = item.expiryTimestamp 
            ? Number(item.expiryTimestamp) 
            : (item.expiry_timestamp 
                ? (Number(item.expiry_timestamp) > 1e11 ? Number(item.expiry_timestamp) : Number(item.expiry_timestamp) * 1000) 
                : null);
        if (expMs && expMs < nowMs) return false;
        for (const part of queryParts) {
            if (!item.search_string.includes(part)) return false;
        }
        return true;
    });
    
    // Return max 50 results to prevent large payloads
    return results.slice(0, 50);
}

// Watch for file changes so we can reload dynamically if updateOptionsMaster is run
try {
    const dbWatcher = fs.watch(path.join(__dirname, '..', 'database'), (eventType, filename) => {
        if (filename && filename.endsWith('.json')) {
            console.log(`Detected change in ${filename}, reloading instruments cache...`);
            // Debounce reloading to avoid doing it multiple times during a bulk update
            if (global.reloadCacheTimeout) clearTimeout(global.reloadCacheTimeout);
            global.reloadCacheTimeout = setTimeout(() => initializeCache(), 5000);
        }
    });
    if (dbWatcher && typeof dbWatcher.unref === 'function') {
        dbWatcher.unref();
    }
} catch(e) {
    console.warn("Could not watch database dir:", e.message);
}

const COMMODITIES_LIST = ['CRUDEOIL', 'GOLD', 'SILVER', 'NATURALGAS', 'COPPER', 'ZINC', 'LEAD', 'ALUMINIUM', 'MENTHAOIL', 'COTTON', 'NICKEL'];

function isDerivativeContract(sym) {
    if (!sym || typeof sym !== 'string') return false;
    const clean = sym.includes(':') ? sym.split(':')[1] : sym;
    return /(?:\d+|[-_\s])(CE|PE)(?:[-_\s].*)?$/i.test(clean) || /(?:\d+|[A-Z]{3}|[-_\s])FUT(?:[-_\s].*)?$/i.test(clean) || clean.endsWith('-FUT');
}

function isCommodityContract(sym) {
    if (!sym || typeof sym !== 'string') return false;
    if (sym.includes('MCX') || sym.includes('NCDEX')) return true;
    const clean = sym.replace(/^(NSE:|BSE:|MCX:)/i, '');
    return COMMODITIES_LIST.some(c => clean.startsWith(c));
}

let cachedFnoSet = null;
function isFnoEligibleStock(sym) {
    if (!sym || typeof sym !== 'string') return false;
    if (isDerivativeContract(sym) || isCommodityContract(sym)) return false;
    const clean = sym.replace(/^(NSE:|BSE:|MCX:)/i, '').replace(/-(EQ|A|B|T|X|XT|Z|P|M|SM|BE|BZ)$/i, '').toUpperCase().trim();
    if (['NIFTY', 'BANKNIFTY', 'FINNIFTY', 'MIDCPNIFTY', 'NIFTYNXT50', 'NIFTYFPI'].includes(clean)) return false;
    if (!cachedFnoSet) {
        try {
            const lotsPath = path.join(__dirname, '..', 'database', 'lotsizeMap.json');
            if (fs.existsSync(lotsPath)) {
                const raw = JSON.parse(fs.readFileSync(lotsPath, 'utf8'));
                cachedFnoSet = new Set(Object.keys(raw));
            } else {
                cachedFnoSet = new Set();
            }
        } catch (e) {
            cachedFnoSet = new Set();
        }
    }
    return cachedFnoSet.has(clean);
}

function getAssetSubsegment(sym) {
    if (!sym || typeof sym !== 'string') return 'NON_FNO_EQ';
    const clean = sym.replace(/^(NSE:|BSE:|MCX:)/i, '').toUpperCase().trim();
    if (clean.endsWith('-MF') || clean.includes('MUTUALFUND')) return 'MUTUAL_FUND';
    if (isCommodityContract(sym)) return 'COMMODITY';
    if (isDerivativeContract(sym)) return 'DERIVATIVE';
    if (isFnoEligibleStock(sym)) return 'FNO_EQ';
    return 'NON_FNO_EQ';
}

function getLotSize(symbol) {
    if (!symbol) return 1;
    const cleanSym = String(symbol).replace(/^(NSE:|BSE:|MCX:)/i, '');
    return lotSizeMap[symbol] || lotSizeMap[cleanSym] || lotSizeMap['NSE:' + cleanSym] || lotSizeMap['MCX:' + cleanSym] || 1;
}

const isMCXWinterSession = (d = new Date()) => {
    const year = d.getFullYear();
    const marchFirst = new Date(Date.UTC(year, 2, 1));
    const marchFirstDay = marchFirst.getUTCDay();
    const firstSunMarch = marchFirstDay === 0 ? 1 : (7 - marchFirstDay + 1);
    const secondSunMarch = firstSunMarch + 7;
    const dstStart = new Date(Date.UTC(year, 2, secondSunMarch, 7, 0, 0));

    const novFirst = new Date(Date.UTC(year, 10, 1));
    const novFirstDay = novFirst.getUTCDay();
    const firstSunNov = novFirstDay === 0 ? 1 : (7 - novFirstDay + 1);
    const dstEnd = new Date(Date.UTC(year, 10, firstSunNov, 6, 0, 0));

    const isDstSummer = d >= dstStart && d < dstEnd;
    return !isDstSummer;
};

/**
 * Checks if position conversion (INT <-> DEL) is allowed for a symbol.
 * Rule: Position conversion is NOT allowed starting 1 minute before the segment's intraday cutoff
 * and throughout the cutoff / auto square-off / market-closed period.
 */
function checkPositionConversionAllowed(symbol, dateObj = new Date()) {
    if (!symbol) return { allowed: false, reason: 'Invalid instrument symbol.' };

    const sub = getAssetSubsegment(symbol);
    if (sub === 'MUTUAL_FUND') {
        return { allowed: false, reason: 'Mutual fund units cannot be converted.' };
    }

    // Evaluate in Indian Standard Time (IST)
    const istParts = new Intl.DateTimeFormat('en-US', {
        timeZone: 'Asia/Kolkata',
        hour: 'numeric',
        minute: 'numeric',
        weekday: 'short',
        hour12: false
    }).formatToParts(dateObj);

    const hours = parseInt(istParts.find(p => p.type === 'hour')?.value || '0', 10);
    const minutes = parseInt(istParts.find(p => p.type === 'minute')?.value || '0', 10);
    const weekday = istParts.find(p => p.type === 'weekday')?.value; // 'Sat', 'Sun', etc.
    const currentMinutes = hours * 60 + minutes;

    // Weekend Check
    if (weekday === 'Sat' || weekday === 'Sun') {
        return { allowed: false, reason: 'Position conversion is disabled on weekends when markets are closed.' };
    }

    if (sub === 'COMMODITY') {
        const isWinter = isMCXWinterSession(dateObj);
        // Summer: Cutoff 10:50 PM (1370 mins). 1 min before: 10:49 PM (1369 mins).
        // Winter: Cutoff 11:30 PM (1410 mins). 1 min before: 11:29 PM (1409 mins).
        const cutoffMins = isWinter ? (23 * 60 + 30) : (22 * 60 + 50);
        const cutoffLabel = isWinter ? '11:30 PM' : '10:50 PM';
        const blockMins = cutoffMins - 1; // 1 min before cutoff
        const blockLabel = isWinter ? '11:29 PM' : '10:49 PM';
        const openMins = 9 * 60; // 09:00 AM

        if (currentMinutes < openMins) {
            return { allowed: false, reason: 'Position conversion for MCX Commodities is disabled before market opens at 09:00 AM IST.' };
        }
        if (currentMinutes >= blockMins) {
            return { allowed: false, reason: `Position conversion for MCX Commodities is disabled starting 1 minute before the intraday cutoff (${cutoffLabel}, blocked from ${blockLabel}) and during auto square-off.` };
        }
        return { allowed: true };
    }

    if (sub === 'DERIVATIVE') {
        // Cutoff 03:25 PM (925 mins). 1 min before: 03:24 PM (924 mins).
        const openMins = 9 * 60 + 15; // 09:15 AM
        const blockMins = 15 * 60 + 24; // 03:24 PM (1 min before 03:25 PM)

        if (currentMinutes < openMins) {
            return { allowed: false, reason: 'Position conversion for Futures & Options is disabled before market opens at 09:15 AM IST.' };
        }
        if (currentMinutes >= blockMins) {
            return { allowed: false, reason: 'Position conversion for Futures & Options is disabled starting 1 minute before the intraday cutoff (03:25 PM, blocked from 03:24 PM) and during auto square-off.' };
        }
        return { allowed: true };
    }

    if (sub === 'FNO_EQ') {
        // Cutoff 03:05 PM (905 mins). 1 min before: 03:04 PM (904 mins).
        const openMins = 9 * 60 + 15; // 09:15 AM
        const blockMins = 15 * 60 + 4; // 03:04 PM (1 min before 03:05 PM)

        if (currentMinutes < openMins) {
            return { allowed: false, reason: 'Position conversion for F&O Cash Equities is disabled before market opens at 09:15 AM IST.' };
        }
        if (currentMinutes >= blockMins) {
            return { allowed: false, reason: 'Position conversion for F&O Cash Equities is disabled starting 1 minute before the intraday cutoff (03:05 PM, blocked from 03:04 PM) and during auto square-off.' };
        }
        return { allowed: true };
    }

    // NON_FNO_EQ (All other Cash Equities)
    {
        // Cutoff 03:15 PM (915 mins). 1 min before: 03:14 PM (914 mins).
        const openMins = 9 * 60 + 15; // 09:15 AM
        const blockMins = 15 * 60 + 14; // 03:14 PM (1 min before 03:15 PM)

        if (currentMinutes < openMins) {
            return { allowed: false, reason: 'Position conversion for Cash Equities is disabled before market opens at 09:15 AM IST.' };
        }
        if (currentMinutes >= blockMins) {
            return { allowed: false, reason: 'Position conversion for Cash Equities is disabled starting 1 minute before the intraday cutoff (03:15 PM, blocked from 03:14 PM) and during auto square-off.' };
        }
        return { allowed: true };
    }
}

module.exports = {
    initializeCache,
    getLotSizes,
    getLotSize,
    getAllStocks,
    searchInstruments,
    isDerivativeContract,
    isCommodityContract,
    isFnoEligibleStock,
    getAssetSubsegment,
    isMCXWinterSession,
    checkPositionConversionAllowed
};
