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
        item.search_string = `${item.symbol} ${item.name} ${item.exchange}`.toLowerCase();
        if (!item.unique_symbol) item.unique_symbol = item.symbol;
        
        // Filter out weird debt/bond segments (usually ends with -N0 to -N9, -NO, -F, etc)
        if (item.symbol.match(/-(N[0-9O]|F|G|H|I|J|K|L|M|S)$/i)) return; 
        
        // Deduplicate exact unique_symbols (prevents 2 identical symbols from stocks & spots)
        if (!symbolMap.has(item.unique_symbol)) {
            symbolMap.set(item.unique_symbol, item);
        }
    });
    
    let filteredInstruments = Array.from(symbolMap.values());
    
    // Handle NSE vs BSE duplicates for the same company (Keep NSE-EQ if both exist)
    const nameMap = new Map();
    filteredInstruments.forEach(item => {
        if (!item.name) return;
        const name = item.name.toUpperCase();
        if (!nameMap.has(name)) nameMap.set(name, []);
        nameMap.get(name).push(item);
    });
    
    const toRemove = new Set();
    nameMap.forEach(group => {
        const nseEq = group.find(i => i.exchange === 'NSE' && i.symbol.endsWith('-EQ'));
        if (nseEq) {
            group.forEach(i => {
                // If it's not the NSE-EQ, but it's a cash market symbol, remove it to prevent duplicates
                if (i !== nseEq && (i.exchange === 'BSE' || i.exchange === 'NSE') && 
                    !i.symbol.includes('FUT') && !i.symbol.includes('CE') && !i.symbol.includes('PE')) {
                    toRemove.add(i.unique_symbol);
                }
            });
        }
    });
    
    allInstruments = filteredInstruments.filter(i => !toRemove.has(i.unique_symbol));
    
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
        const isOpt = item.symbol.includes('CE') || item.symbol.includes('PE');
        const isFut = item.symbol.includes('FUT');
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
    getLotSizes,
    getAllStocks,
    searchInstruments
};
