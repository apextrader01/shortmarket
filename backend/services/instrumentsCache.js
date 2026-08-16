const fs = require('fs');
const path = require('path');

let allInstruments = [];
let lotSizeMap = {};

function loadJSON(filename) {
    try {
        const filepath = path.join(__dirname, '..', 'database', filename);
        if (fs.existsSync(filepath)) {
            const data = JSON.parse(fs.readFileSync(filepath, 'utf8'));
            return Array.isArray(data) ? data : [];
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
    
    // Combine everything for search
    allInstruments = [...stocks, ...spots, ...futures, ...options];
    
    // Pre-calculate lot sizes map for O(1) lookup
    lotSizeMap = {};
    allInstruments.forEach(item => {
        // Build search string for fast filtering
        item.search_string = `${item.symbol} ${item.name} ${item.exchange}`.toLowerCase();
        // Fallback for unique_symbol missing in JSON but required by frontend
        if (!item.unique_symbol) item.unique_symbol = item.symbol;
        
        lotSizeMap[item.symbol] = item.lotsize || 1;
        lotSizeMap[item.unique_symbol] = item.lotsize || 1;
    });
    
    console.log(`Loaded ${allInstruments.length} instruments into memory.`);
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
    const results = allInstruments.filter(item => {
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
