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

module.exports = {
    initializeCache,
    getLotSizes,
    getLotSize,
    getAllStocks,
    searchInstruments,
    isDerivativeContract,
    isCommodityContract,
    isFnoEligibleStock,
    getAssetSubsegment
};
