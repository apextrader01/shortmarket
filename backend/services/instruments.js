const fs = require('fs');
const path = require('path');

let STOCK_MASTER = {};
let symbolToToken = {};
let allTokens = [];
let SEARCH_INDEX = [];

let globalNfoOptions = {};
let globalNfoFutures = {};
let globalBseSpots = {};

function loadInstrumentMaster() {
    try {
        console.log('🔌 Loading instruments master from local cache...');
        
        let nseStocks = {};
        try {
            const data = fs.readFileSync(path.join(__dirname, '../database/stocks.json'), 'utf8');
            nseStocks = JSON.parse(data);
        } catch(e) {}
        
        let nfoOptions = {};
        try {
            const data2 = fs.readFileSync(path.join(__dirname, '../database/options.json'), 'utf8');
            nfoOptions = JSON.parse(data2);
        } catch(e) {}
        
        let nfoFutures = {};
        try {
            const data3 = fs.readFileSync(path.join(__dirname, '../database/futures.json'), 'utf8');
            nfoFutures = JSON.parse(data3);
        } catch(e) {}
        
        let bseSpots = {};
        try {
            const data4 = fs.readFileSync(path.join(__dirname, '../database/spots.json'), 'utf8');
            bseSpots = JSON.parse(data4);
        } catch(e) {}

        const indices = {
            "99926000": { symbol: "NIFTY",     name: "Nifty 50",   exchange: "NSE" },
            "99926009": { symbol: "BANKNIFTY", name: "Bank Nifty",  exchange: "NSE" },
            "99926037": { symbol: "MIDCPNIFTY",name: "MidCap Nifty",exchange: "NSE" },
            "99926074": { symbol: "FINNIFTY",  name: "Fin Nifty",   exchange: "NSE" },
        };

        globalNfoOptions = nfoOptions;
        globalNfoFutures = nfoFutures;
        globalBseSpots = bseSpots;

        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const isExpired = (expiryStr) => {
            if (!expiryStr) return false;
            const day = parseInt(expiryStr.slice(0, 2), 10);
            const monthStr = expiryStr.slice(2, 5).toUpperCase();
            let year = parseInt(expiryStr.slice(5), 10);
            if (year < 100) year += 2000;
            
            const monthMap = { 'JAN':0, 'FEB':1, 'MAR':2, 'APR':3, 'MAY':4, 'JUN':5, 'JUL':6, 'AUG':7, 'SEP':8, 'OCT':9, 'NOV':10, 'DEC':11 };
            const month = monthMap[monthStr];
            if (!isNaN(day) && month !== undefined && !isNaN(year)) {
                const expiryDate = new Date(year, month, day);
                return expiryDate < today;
            }
            return false;
        };

        STOCK_MASTER = { ...indices };
        symbolToToken = {};

        for (const [token, info] of Object.entries(STOCK_MASTER)) {
            info.uniqueSymbol = `${info.symbol}-${info.exchange}`;
            symbolToToken[info.uniqueSymbol] = token;
        }

        if (typeof nfoOptions === 'object') {
            Object.values(nfoOptions).forEach(expiries => {
                for (const [expiry, strikes] of Object.entries(expiries)) {
                    if (isExpired(expiry)) continue;
                    Object.values(strikes).forEach(types => {
                        if (types.CE) {
                            const ex = types.CE.exch_seg || types.CE.exchange;
                            const suffix = ex === 'MCX' ? 'MCX' : ex === 'BFO' ? 'BFO' : 'NFO';
                            types.CE.uniqueSymbol = `${types.CE.symbol}-${suffix}`;
                            symbolToToken[types.CE.uniqueSymbol] = types.CE.token;
                            STOCK_MASTER[types.CE.token] = types.CE;
                        }
                        if (types.PE) {
                            const ex = types.PE.exch_seg || types.PE.exchange;
                            const suffix = ex === 'MCX' ? 'MCX' : ex === 'BFO' ? 'BFO' : 'NFO';
                            types.PE.uniqueSymbol = `${types.PE.symbol}-${suffix}`;
                            symbolToToken[types.PE.uniqueSymbol] = types.PE.token;
                            STOCK_MASTER[types.PE.token] = types.PE;
                        }
                    });
                }
            });
        }

        if (typeof nfoFutures === 'object') {
            Object.values(nfoFutures).forEach(expiries => {
                for (const [expiry, fut] of Object.entries(expiries)) {
                    if (isExpired(expiry)) continue;
                    const ex = fut.exch_seg || fut.exchange;
                    const suffix = ex === 'MCX' ? 'MCX' : ex === 'BFO' ? 'BFO' : 'NFO';
                    fut.uniqueSymbol = `${fut.symbol}-${suffix}`;
                    symbolToToken[fut.uniqueSymbol] = fut.token;
                    STOCK_MASTER[fut.token] = fut;
                }
            });
        }

        if (Array.isArray(nseStocks)) {
            for (const stock of nseStocks) {
                let uniqueSymbol = stock.symbol; // keep -EQ
                if (stock.exchange === 'BSE' && !uniqueSymbol.endsWith('-BSE')) {
                    uniqueSymbol += '-BSE';
                }
                
                STOCK_MASTER[stock.token] = {
                    symbol: stock.symbol.replace('-EQ', ''),
                    name: stock.name,
                    exchange: stock.exchange,
                    lotsize: Number(stock.lotsize || 1),
                    uniqueSymbol
                };
                symbolToToken[uniqueSymbol] = stock.token;
            }
        }

        allTokens = [...Object.keys(indices)];
        if (Array.isArray(nseStocks)) {
            allTokens = allTokens.concat(nseStocks.map(s => s.token));
        }

        // Build SEARCH_INDEX
        SEARCH_INDEX = [];
        for (const [token, value] of Object.entries(STOCK_MASTER)) {
            if (!value || !value.symbol) continue;
            const ex = value.exchange || value.exch_seg || 'NSE';
            if (ex === 'BSE' && value.symbol.length > 5) continue; // Skip junk BSE spots (keep only major BSE stocks if any)
            
            const name = value.name || value.symbol;
            SEARCH_INDEX.push({
                token,
                symbol: value.symbol,
                name: name,
                exchange: ex,
                lotsize: Number(value.lotsize || 1),
                uniqueSymbol: value.uniqueSymbol || `${value.symbol}-${ex}`,
                searchString: `${value.symbol} ${name} ${ex}`.toLowerCase()
            });
        }

        console.log(`📦 Loaded ${Object.keys(STOCK_MASTER).length} instruments`);
        console.log(`🔍 Built Search Index with ${SEARCH_INDEX.length} instruments`);
    } catch (e) {
        console.error('Failed to load local instrument master:', e.message);
    }
}

// Load synchronously on startup
loadInstrumentMaster();

module.exports = {
    STOCK_MASTER,
    symbolToToken,
    allTokens,
    globalNfoOptions,
    globalNfoFutures,
    globalBseSpots,
    SEARCH_INDEX
};
