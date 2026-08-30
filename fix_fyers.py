import re

with open('backend/services/fyers.js', 'r', encoding='utf-8') as f:
    code = f.read()

# Fix 1: processSubQueue individual subscribe
code = code.replace(
    "const chunk = subQueue.splice(0, 25);\n            wsInstance.subscribe(chunk);",
    "const chunk = subQueue.splice(0, 25);\n            for(let i=0; i<chunk.length; i++) { wsInstance.subscribe([chunk[i]]); }"
)

# Fix 2: wsInstance.on('connect') individual subscribe
code = code.replace(
    "const chunk = fyersSymbols.slice(i, i + chunkSize);\n                          wsInstance.subscribe(chunk);",
    "const chunk = fyersSymbols.slice(i, i + chunkSize);\n                          for(let j=0; j<chunk.length; j++) { wsInstance.subscribe([chunk[j]]); }"
)

# Fix 3: add mfSubscriptions tracking
code = code.replace(
    "let subQueue = [];\nlet isProcessingSubQueue = false;",
    "let subQueue = [];\nlet isProcessingSubQueue = false;\nlet mfSubscriptions = new Set();"
)

code = code.replace(
    "if (!s || typeof s !== 'string' || s.endsWith('-MF')) return; // Ignore mutual funds",
    "if (!s || typeof s !== 'string') return;\n        if (s.endsWith('-MF')) { mfSubscriptions.add(s); return; }"
)

# Fix 4: MF REST API in fetchBatchLTPs
new_fetch = """async function fetchBatchLTPs(symbols) {
    if (!Array.isArray(symbols) || symbols.length === 0) return {};
    
    symbols = symbols.map(s => typeof s === 'object' && s !== null ? s.symbol : s).filter(Boolean);
    const validSymbols = symbols.filter(s => typeof s === 'string' && s.length > 0 && !s.endsWith('-MF'));
    const mfSymbols = symbols.filter(s => typeof s === 'string' && s.endsWith('-MF'));
    
    const mfResults = {};
    if (mfSymbols.length > 0) {
        const axios = require('axios');
        for (const sym of mfSymbols) {
            try {
                const mfCode = sym.replace('-MF', '').replace('BSE:', '').replace('NSE:', '');
                const res = await axios.get(`https://api.mfapi.in/mf/${mfCode}`);
                if (res.data && res.data.data && res.data.data.length > 0) {
                    const nav = parseFloat(res.data.data[0].nav);
                    if (!isNaN(nav)) {
                        mfResults[sym] = { symbol: sym, ltp: nav, ch: 0, chp: 0, vol: 0, timestamp: Date.now() };
                        if (!sharedPriceCache[sym]) sharedPriceCache[sym] = {};
                        sharedPriceCache[sym] = { ...sharedPriceCache[sym], ...mfResults[sym] };
                    }
                }
            } catch (e) {
                console.error(`Failed to fetch MF data for ${sym}:`, e.message);
            }
        }
    }
    
    if (validSymbols.length === 0) return mfResults;

    const fyersToRequested = {};
    const fyersSymbols = validSymbols.map(s => {
        const fSym = toFyersSymbol(s);
        if (fSym) {
            if (!fyersToRequested[fSym]) fyersToRequested[fSym] = [];
            if (!fyersToRequested[fSym].includes(s)) fyersToRequested[fSym].push(s);
            
            if (!globalFyersToRequested[fSym]) {
                globalFyersToRequested[fSym] = [];
                if (!subQueue.includes(fSym)) subQueue.push(fSym);
            }
            if (!globalFyersToRequested[fSym].includes(s)) {
                globalFyersToRequested[fSym].push(s);
            }
            
            return fSym;
        }
        return null;
    }).filter(Boolean);
    
    if (!activeAccessToken || fyersSymbols.length === 0) {
        return validSymbols.reduce((acc, sym) => {
            if (sharedPriceCache[sym]) acc[sym] = sharedPriceCache[sym];
            return acc;
        }, mfResults);
    }

    try {
        const results = {};
        
        const chunkSize = 50;
        for (let i = 0; i < fyersSymbols.length; i += chunkSize) {
            const chunk = fyersSymbols.slice(i, i + chunkSize);
            
            try {
                const response = await fyers.getQuotes(chunk);
                
                const processQuotesResponse = (res) => {
                    if (res && res.s === 'ok' && res.d) {
                        res.d.forEach(item => {
                            if (item.v && (item.v.lp !== undefined || item.v.prev_close_price !== undefined || item.v.close_price !== undefined)) {
                                let syms = fyersToRequested[item.n];
                                if (!syms || syms.length === 0) {
                                    const mapped = fromFyersSymbol(item.n);
                                    if (mapped) syms = [mapped];
                                }
                                
                                if (syms && syms.length > 0) {
                                    syms.forEach(uniqueSymbol => {
                                        const priceObj = {
                                            symbol: uniqueSymbol,
                                            timestamp: Date.now(),
                                            ltp: Number(item.v.lp) || Number(item.v.prev_close_price) || Number(item.v.close_price) || 0,
                                            open: Number(item.v.open_price) || null,
                                            high: Number(item.v.high_price) || null,
                                            low: Number(item.v.low_price) || null,
                                            close: Number(item.v.prev_close_price) || Number(item.v.close_price) || null,
                                            volume: Number(item.v.volume) || 0,
                                            change: Number(item.v.ch) || 0,
                                            pct: Number(item.v.chp) || 0
                                        };
                                        results[uniqueSymbol] = priceObj;
                                        sharedPriceCache[uniqueSymbol] = priceObj;
                                    });
                                }
                            }
                        });
                    }
                };

                if (response && response.s === 'ok') {
                    processQuotesResponse(response);
                } else if (response && response.s === 'error') {
                    for (let j = 0; j < chunk.length; j++) {
                        const fSym = chunk[j];
                        try {
                            await new Promise(r => setTimeout(r, 150));
                            const indRes = await fyers.getQuotes([fSym]);
                            if (indRes && indRes.s === 'ok') {
                                processQuotesResponse(indRes);
                            }
                        } catch(indErr) {}
                    }
                }
            } catch(chunkErr) {}
        }
        
        return { ...results, ...mfResults };
    } catch(e) {
        console.error("Fyers fetchBatchLTPs error:", e);
    }
    return mfResults;
}"""

# Replace the entire fetchBatchLTPs function using regex
code = re.sub(
    r"async function fetchBatchLTPs\(symbols\) \{.*?(?=\n// ─── API FETCH FUNCTIONS ────────────────────────────────────────────────────|\n// Fyers interval mapping)",
    new_fetch + "\n",
    code,
    flags=re.DOTALL
)

# Append MF Polling
code += """
// Background task to poll mutual fund NAVs from mfapi.in
setInterval(async () => {
    if (typeof mfSubscriptions === 'undefined' || mfSubscriptions.size === 0) return;
    const axios = require('axios');
    const updates = {};
    for (const sym of mfSubscriptions) {
        try {
            const mfCode = sym.replace('-MF', '').replace('BSE:', '').replace('NSE:', '');
            const res = await axios.get(`https://api.mfapi.in/mf/${mfCode}`);
            if (res.data && res.data.data && res.data.data.length > 0) {
                const nav = parseFloat(res.data.data[0].nav);
                if (!isNaN(nav)) {
                    updates[sym] = { ltp: nav, ch: 0, chp: 0, vol: 0, ts: Date.now() };
                    if (!sharedPriceCache[sym]) sharedPriceCache[sym] = {};
                    sharedPriceCache[sym] = { ...sharedPriceCache[sym], ...updates[sym] };
                }
            }
        } catch (e) {
            console.error(`Failed to fetch MF data for ${sym}:`, e.message);
        }
    }
    if (Object.keys(updates).length > 0 && isMasterNode && global_io) {
        global_io.emit('price_update', updates);
    } else if (Object.keys(updates).length > 0 && !isMasterNode) {
        try { 
            const { pubClient } = require('./redisClient');
            pubClient.publish('fyers_ws_tick', JSON.stringify(updates)); 
        } catch (e) {}
    }
}, 300000); // Poll every 5 minutes
"""

with open('backend/services/fyers.js', 'w', encoding='utf-8') as f:
    f.write(code)
print("Done")
