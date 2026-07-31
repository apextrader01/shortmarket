const fs = require('fs');
const path = require('path');

let STOCK_MASTER = {};
let symbolToToken = {};
let allTokens = [];

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

        STOCK_MASTER = { ...indices };
        symbolToToken = {};

        for (const [token, info] of Object.entries(STOCK_MASTER)) {
            info.uniqueSymbol = `${info.symbol}-${info.exchange}`;
            symbolToToken[info.uniqueSymbol] = token;
        }

        if (Array.isArray(nseStocks)) {
            for (const stock of nseStocks) {
                const rawSymbol = stock.symbol.endsWith('-EQ') ? stock.symbol.replace('-EQ', '') : stock.symbol;
                const uniqueSymbol = `${rawSymbol}-${stock.exchange}`;
                
                STOCK_MASTER[stock.token] = {
                    symbol: rawSymbol,
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
        console.log(`📦 Loaded ${Object.keys(STOCK_MASTER).length} instruments`);
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
    globalBseSpots
};
