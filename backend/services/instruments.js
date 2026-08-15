const fs = require('fs');
const path = require('path');

let STOCK_MASTER = {};
let symbolToToken = {};
let tokenToSymbol = {};
let allTokens = [];
let SEARCH_INDEX = [];

let globalNfoOptions = {};
let globalNfoFutures = {};
let globalBseSpots = {};

async function loadInstrumentMaster() {
    try {
        console.log('🔌 Loading instruments master into PostgreSQL...');
        const db = require('../database/db');
        
        // Wait for DB schema to be ready (rudimentary check)
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        let nseStocks = [];
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
            "101000000026000": { symbol: "NSE:NIFTY50-INDEX", name: "Nifty 50", exchange: "NSE" },
            "101000000026009": { symbol: "NSE:NIFTYBANK-INDEX", name: "Bank Nifty", exchange: "NSE" },
            "101000000026037": { symbol: "NSE:NIFTYMIDCAP50-INDEX", name: "MidCap Nifty", exchange: "NSE" },
            "101000000026074": { symbol: "NSE:NIFTYFINSERVICE-INDEX", name: "Fin Nifty", exchange: "NSE" },
            "102000000000001": { symbol: "BSE:SENSEX-INDEX", name: "Sensex", exchange: "BSE" },
            "102000000000002": { symbol: "BSE:BANKEX-INDEX", name: "Bankex", exchange: "BSE" },
        };

        globalNfoOptions = nfoOptions;
        globalNfoFutures = nfoFutures;
        globalBseSpots = bseSpots;

        let tempStockMaster = { ...indices };
        symbolToToken = {};

        // In Fyers, the symbol itself is the unique identifier (e.g. NSE:RELIANCE-EQ)
        for (const [token, info] of Object.entries(tempStockMaster)) {
            info.uniqueSymbol = info.symbol;
            symbolToToken[info.uniqueSymbol] = token;
        }

        if (typeof nfoOptions === 'object') {
            Object.values(nfoOptions).forEach(expiries => {
                for (const [expiry, strikes] of Object.entries(expiries)) {
                    Object.values(strikes).forEach(types => {
                        if (types.CE) {
                            types.CE.uniqueSymbol = types.CE.symbol;
                            symbolToToken[types.CE.uniqueSymbol] = types.CE.token;
                            tempStockMaster[types.CE.token] = types.CE;
                        }
                        if (types.PE) {
                            types.PE.uniqueSymbol = types.PE.symbol;
                            symbolToToken[types.PE.uniqueSymbol] = types.PE.token;
                            tempStockMaster[types.PE.token] = types.PE;
                        }
                    });
                }
            });
        }

        if (typeof nfoFutures === 'object') {
            Object.values(nfoFutures).forEach(futureArray => {
                for (const fut of futureArray) {
                    fut.uniqueSymbol = fut.symbol;
                    fut.lotsize = 1; // Force futures to have a lot size of 1
                    symbolToToken[fut.uniqueSymbol] = fut.token;
                    tempStockMaster[fut.token] = fut;
                }
            });
        }

        if (Array.isArray(nseStocks)) {
            for (const stock of nseStocks) {
                stock.uniqueSymbol = stock.symbol;
                tempStockMaster[stock.token] = stock;
                symbolToToken[stock.uniqueSymbol] = stock.token;
            }
        }

        if (typeof bseSpots === 'object') {
            for (const [key, info] of Object.entries(bseSpots)) {
                info.uniqueSymbol = info.symbol;
                tempStockMaster[info.token] = info;
                symbolToToken[info.uniqueSymbol] = info.token;
            }
        }

        allTokens = Object.keys(tempStockMaster);

        // Build records for PostgreSQL
        let dbRecords = [];
        tokenToSymbol = {};
        for (const [token, value] of Object.entries(tempStockMaster)) {
            if (!value || !value.symbol) continue;
            const ex = value.exchange || value.exch_seg || value.symbol.split(':')[0] || 'NSE';
            
            const uniqueSym = value.uniqueSymbol || value.symbol;
            tokenToSymbol[token] = uniqueSym;
            
            const name = value.name || value.description || value.symbol;
            dbRecords.push({
                token,
                symbol: uniqueSym,
                name: name,
                exchange: ex,
                lotsize: Number(value.lotsize || 1),
                expiry_timestamp: value.expiryTimestamp || null,
                unique_symbol: uniqueSym,
                search_string: `${uniqueSym} ${name} ${ex}`.toLowerCase()
            });
        }
        
        // TRUNCATE AND INSERT to handle the complete shift from Angel One to Fyers
        const existingCount = await db('instruments').count('token as count').first();
        
        if (existingCount && existingCount.count > 0) {
            console.log(`🧹 Dropping legacy Angel One symbols from DB...`);
            await db('instruments').truncate();
        }

        console.log(`📦 Inserting ${dbRecords.length} Fyers instruments to Postgres...`);
        const BATCH_SIZE = 2000;
        for (let i = 0; i < dbRecords.length; i += BATCH_SIZE) {
            const batch = dbRecords.slice(i, i + BATCH_SIZE);
            await db('instruments').insert(batch).onConflict('token').merge();
        }
        console.log(`✅ Postgres instruments populated successfully!`);

        // FREE MEMORY (GC will clean these up now)
        tempStockMaster = null;
        dbRecords = null;
        SEARCH_INDEX = []; 
        STOCK_MASTER = {}; // Deprecated, left empty to avoid breaking legacy requires
        
    } catch (e) {
        console.error('Failed to load local instrument master:', e.message);
    }
}

// Load asynchronously on startup
loadInstrumentMaster();

module.exports = {
    STOCK_MASTER,
    symbolToToken,
    tokenToSymbol,
    allTokens,
    globalNfoOptions,
    globalNfoFutures,
    globalBseSpots,
    SEARCH_INDEX
};
