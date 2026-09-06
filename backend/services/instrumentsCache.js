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
    const spots = loadJSON('spots.json');
    const futures = loadJSON('futures.json');
    const options = loadJSON('options.json');
    
    let rawInstruments = [...stocks, ...spots, ...futures, ...options];
    
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
        result[sym] = lotSizeMap[sym] || 1;
    });
    return result;
}

function getAllStocks() {
    // Only return stocks and spots for the main API response
    // Filter out futures and options
    return allInstruments.filter(item => {
        const clean = item.symbol.includes(':') ? item.symbol.split(':')[1] : item.symbol;
        const isOpt = /(?:\d+|[-_\s])(CE|PE)(?:[-_\s].*)?$/i.test(clean);
        const isFut = /(?:\d+|[A-Z]{3}|[-_\s])FUT(?:[-_\s].*)?$/i.test(clean) || clean.endsWith('-FUT');
        const isNSE_BSE = item.exchange === 'NSE' || item.exchange === 'BSE';
        return isNSE_BSE && !isOpt && !isFut;
    });
}

function searchInstruments(query) {
    if (!query || query.length < 2) return [];
    
    const queryParts = query.toLowerCase().split(/\s+/).filter(Boolean);
    
    // Simple filter: every part of the query must be included in the search_string
    const nowMs = Date.now();
    const results = allInstruments.filter(item => {
        if (item.expiryTimestamp && item.expiryTimestamp < nowMs) return false;
        if (item.expiry_timestamp && item.expiry_timestamp * 1000 < nowMs) return false;
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
    fs.watch(path.join(__dirname, '..', 'database'), (eventType, filename) => {
        if (filename && filename.endsWith('.json')) {
            console.log(`Detected change in ${filename}, reloading instruments cache...`);
            // Debounce reloading to avoid doing it multiple times during a bulk update
            if (global.reloadCacheTimeout) clearTimeout(global.reloadCacheTimeout);
            global.reloadCacheTimeout = setTimeout(() => initializeCache(), 5000);
        }
    });
} catch(e) {
    console.warn("Could not watch database dir:", e);
}

module.exports = {
    initializeCache,
    getLotSizes,
    getAllStocks,
    searchInstruments
};
