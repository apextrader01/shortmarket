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
            "99990000": { symbol: "SENSEX",    name: "Sensex",      exchange: "BSE" },
            "99990001": { symbol: "BANKEX",    name: "Bankex",      exchange: "BSE" },
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

        const getExpiryTimestamp = (expiryStr) => {
            if (!expiryStr) return null;
            const day = parseInt(expiryStr.slice(0, 2), 10);
            const monthStr = expiryStr.slice(2, 5).toUpperCase();
            let year = parseInt(expiryStr.slice(5), 10);
            if (year < 100) year += 2000;
            
            const monthMap = { 'JAN':0, 'FEB':1, 'MAR':2, 'APR':3, 'MAY':4, 'JUN':5, 'JUL':6, 'AUG':7, 'SEP':8, 'OCT':9, 'NOV':10, 'DEC':11 };
            const month = monthMap[monthStr];
            if (!isNaN(day) && month !== undefined && !isNaN(year)) {
                return new Date(year, month, day).getTime();
            }
            return null;
        };

        let tempStockMaster = { ...indices };
        symbolToToken = {};

        for (const [token, info] of Object.entries(tempStockMaster)) {
            info.uniqueSymbol = `${info.symbol}-${info.exchange}`;
            symbolToToken[info.uniqueSymbol] = token;
        }

        if (typeof nfoOptions === 'object') {
            Object.values(nfoOptions).forEach(expiries => {
                for (const [expiry, strikes] of Object.entries(expiries)) {
                    if (isExpired(expiry)) continue;
                    const expiryTs = getExpiryTimestamp(expiry);
                    Object.values(strikes).forEach(types => {
                        if (types.CE) {
                            const ex = types.CE.exch_seg || types.CE.exchange;
                            const suffix = ex === 'MCX' ? 'MCX' : ex === 'BFO' ? 'BFO' : 'NFO';
                            types.CE.uniqueSymbol = `${types.CE.symbol}-${suffix}`;
                            types.CE.expiryTimestamp = expiryTs;
                            symbolToToken[types.CE.uniqueSymbol] = types.CE.token;
                            tempStockMaster[types.CE.token] = types.CE;
                        }
                        if (types.PE) {
                            const ex = types.PE.exch_seg || types.PE.exchange;
                            const suffix = ex === 'MCX' ? 'MCX' : ex === 'BFO' ? 'BFO' : 'NFO';
                            types.PE.uniqueSymbol = `${types.PE.symbol}-${suffix}`;
                            types.PE.expiryTimestamp = expiryTs;
                            symbolToToken[types.PE.uniqueSymbol] = types.PE.token;
                            tempStockMaster[types.PE.token] = types.PE;
                        }
                    });
                }
            });
        }

        if (typeof nfoFutures === 'object') {
            Object.values(nfoFutures).forEach(expiries => {
                for (const [expiry, fut] of Object.entries(expiries)) {
                    if (isExpired(expiry)) continue;
                    const expiryTs = getExpiryTimestamp(expiry);
                    const ex = fut.exch_seg || fut.exchange;
                    const suffix = ex === 'MCX' ? 'MCX' : ex === 'BFO' ? 'BFO' : 'NFO';
                    fut.uniqueSymbol = `${fut.symbol}-${suffix}`;
                    fut.expiryTimestamp = expiryTs;
                    fut.lotsize = 1; // Force futures to have a lot size of 1
                    symbolToToken[fut.uniqueSymbol] = fut.token;
                    tempStockMaster[fut.token] = fut;
                }
            });
        }

        if (Array.isArray(nseStocks)) {
            for (const stock of nseStocks) {
                let uniqueSymbol = stock.symbol; // keep -EQ
                if (stock.exchange === 'BSE' && !uniqueSymbol.endsWith('-BSE')) {
                    uniqueSymbol += '-BSE';
                }
                
                tempStockMaster[stock.token] = {
                    symbol: stock.symbol.replace('-EQ', ''),
                    name: stock.name,
                    exchange: stock.exchange,
                    lotsize: Number(stock.lotsize || 1),
                    uniqueSymbol
                };
                symbolToToken[uniqueSymbol] = stock.token;
            }
        }

        // Add BSE Spots (like SENSEX) to tempStockMaster so they get inserted into Postgres
        if (typeof bseSpots === 'object') {
            for (const [token, info] of Object.entries(bseSpots)) {
                if (isExpired(info.expiry)) continue;
                
                // Add -BSE suffix if not already present, similar to NFO
                let uniqueSymbol = info.symbol;
                if (!uniqueSymbol.endsWith('-BSE')) uniqueSymbol += '-BSE';
                
                tempStockMaster[token] = {
                    symbol: info.symbol,
                    name: info.name || info.symbol,
                    exchange: 'BSE',
                    lotsize: Number(info.lotsize || 1),
                    uniqueSymbol
                };
                symbolToToken[uniqueSymbol] = token;
            }
        }

        allTokens = [...Object.keys(indices)];
        if (Array.isArray(nseStocks)) {
            allTokens = allTokens.concat(nseStocks.map(s => s.token));
        }
        if (typeof bseSpots === 'object') {
            allTokens = allTokens.concat(Object.keys(bseSpots));
        }

        // Build records for PostgreSQL
        let dbRecords = [];
        tokenToSymbol = {};
        for (const [token, value] of Object.entries(tempStockMaster)) {
            if (!value || !value.symbol) continue;
            const ex = value.exchange || value.exch_seg || 'NSE';
            if (ex === 'BSE' && value.symbol.length > 5 && value.symbol !== 'SENSEX' && value.symbol !== 'BANKEX') continue; 
            
            const uniqueSym = value.uniqueSymbol || `${value.symbol}-${ex}`;
            tokenToSymbol[token] = uniqueSym;
            
            const name = value.name || value.symbol;
            dbRecords.push({
                token,
                symbol: value.symbol,
                name: name,
                exchange: ex,
                lotsize: Number(value.lotsize || 1),
                expiry_timestamp: value.expiryTimestamp || null,
                unique_symbol: uniqueSym,
                search_string: `${value.symbol} ${name} ${ex}`.toLowerCase()
            });
        }
        
        // Insert in batches of 2000 to prevent query size limits
        const existingCount = await db('instruments').count('token as count').first();
        
        if (existingCount && existingCount.count == 0) {
            console.log(`📦 Inserting ${dbRecords.length} instruments to Postgres...`);
            const BATCH_SIZE = 2000;
            for (let i = 0; i < dbRecords.length; i += BATCH_SIZE) {
                const batch = dbRecords.slice(i, i + BATCH_SIZE);
                await db('instruments').insert(batch).onConflict('token').merge();
            }
            console.log(`✅ Postgres instruments populated successfully!`);
        } else {
            console.log(`✅ Postgres instruments already populated (Found ${existingCount.count}).`);
        }

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
