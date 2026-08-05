const fyersModel = require("fyers-api-v3").fyersModel;
const fs = require('fs');
const path = require('path');
require('dotenv').config();

let global_io = null;
let sharedPriceCache = null;
let wsInstance = null;
let clientSubscriptions = new Set();
let watchdogInterval = null;
let lastTickTime = Date.now();
let isMasterNode = false;

const fyers = new fyersModel({ "path": path.join(__dirname, '../logs'), "enableLogging": false });

// Set Fyers Credentials
const APP_ID = process.env.FYERS_APP_ID || 'HBIQP0RPMK-200';
const SECRET_ID = process.env.FYERS_SECRET_ID || 'bBPHCtnZiGzWdeuD';
const REDIRECT_URL = 'https://shortmarket-staging.web.app/api/fyers/callback';

fyers.setAppId(APP_ID);
fyers.setRedirectUrl(REDIRECT_URL);

// Keep track of the active access token
let activeAccessToken = null;
let isFyersConnected = false;

// Global map to ensure Fyers symbols map perfectly back to the exact requested frontend symbol
const globalFyersToRequested = {};

// Maps for token-based symbol lookups (populated if CSV maps are loaded, empty otherwise)
let tokenToFyers = {};
let fyersToToken = {};
// Fallback name-based map for indices whose Angel One token ≠ exchange token (e.g. POWER-BSE)
let nameToFyers = {};


// Convert our platform's unique symbols (e.g. NIFTY, NATURALGAS24AUG26270CE-MCX) to Fyers Symbols
function toFyersSymbol(symbol) {
    if (typeof symbol === 'object' && symbol !== null) symbol = symbol.symbol;
    if (!symbol) return null;

    try {
        const { symbolToToken } = require('./instruments');
        const token = symbolToToken[symbol];
        if (token && tokenToFyers[token]) {
            return tokenToFyers[token];
        }
        // Fallback for legacy watchlists that saved the raw Angel One token instead of the uniqueSymbol
        if (tokenToFyers[symbol]) {
            return tokenToFyers[symbol];
        }
    } catch(e) {}
    
    // Fallback logic for indices and equities
    if (symbol === 'NIFTY' || symbol === 'NIFTY-NSE') return 'NSE:NIFTY50-INDEX';
    if (symbol === 'BANKNIFTY' || symbol === 'BANKNIFTY-NSE') return 'NSE:NIFTYBANK-INDEX';
    if (symbol === 'SENSEX' || symbol === 'SENSEX-BSE') return 'BSE:SENSEX-INDEX';
    if (symbol === 'FINNIFTY' || symbol === 'FINNIFTY-NSE') return 'NSE:FINNIFTY-INDEX';
    if (symbol === 'MIDCPNIFTY' || symbol === 'MIDCPNIFTY-NSE') return 'NSE:MIDCPNIFTY-INDEX';
    if (symbol === 'BANKEX' || symbol === 'BANKEX-BSE') return 'BSE:BANKEX-INDEX';
    if (symbol === 'POWER-BSE' || symbol === 'POWER') return 'BSE:POWER-INDEX';

    if (symbol.endsWith('-EQ')) return `NSE:${symbol}`;
    
    if (symbol.endsWith('-BSE')) {
        const baseName = symbol.replace('-BSE', '');
        // Check name-based index map first (handles BSE sector indices whose Angel token differs from exchange token)
        if (nameToFyers[baseName]) return nameToFyers[baseName];
        return `BSE:${baseName}-EQ`;
    }
    
    if (symbol.endsWith('-NSE')) {
        const baseName = symbol.replace('-NSE', '');
        if (nameToFyers[baseName]) return nameToFyers[baseName];
        return `NSE:${baseName}-EQ`;
    }
    
    // For F&O, if it wasn't in the token map, we should not guess it.
    // However, if it has no exchange suffix, it's likely an NSE equity.
    if (!symbol.includes('-')) return `NSE:${symbol}-EQ`;
    
    return null;
}

// Convert Fyers Symbols back to our platform's unique symbols
function fromFyersSymbol(fyersSymbol) {
    if (!fyersSymbol) return null;

    try {
        const token = fyersToToken[fyersSymbol];
        if (token) {
            const { STOCK_MASTER } = require('./instruments');
            const stock = STOCK_MASTER[token];
            if (stock && stock.uniqueSymbol) {
                return stock.uniqueSymbol;
            }
        }
    } catch(e) {}

    // Fallback logic - MUST return uniqueSymbol format with exchange suffix
    if (fyersSymbol === 'NSE:NIFTY50-INDEX') return 'NIFTY-NSE';
    if (fyersSymbol === 'NSE:NIFTYBANK-INDEX') return 'BANKNIFTY-NSE';
    if (fyersSymbol === 'BSE:SENSEX-INDEX') return 'SENSEX-BSE';
    if (fyersSymbol === 'NSE:FINNIFTY-INDEX') return 'FINNIFTY-NSE';
    if (fyersSymbol === 'NSE:MIDCPNIFTY-INDEX') return 'MIDCPNIFTY-NSE';

    const parts = fyersSymbol.split(':');
    if (parts.length !== 2) return fyersSymbol;
    const [exchange, name] = parts;
    
    if (exchange === 'MCX') return `${name}-MCX`;
    if (name.endsWith('-EQ')) {
        const baseName = name.replace('-EQ', '');
        if (exchange === 'BSE') return `${baseName}-BSE`;
        return `${baseName}-EQ`;  // SBIN-EQ (matches instruments.js uniqueSymbol)
    }
    
    if (exchange === 'NSE') return `${name}-NFO`;
    if (exchange === 'BSE') return `${name}-BFO`;

    return name;
}

// ─── AUTHENTICATION ─────────────────────────────────────────────────────────

function getFyersAuthURL() {
    return fyers.generateAuthCode();
}

async function verifyFyersAuth(auth_code) {
    try {
        const response = await fyers.generate_access_token({
            client_id: APP_ID,
            secret_key: SECRET_ID,
            auth_code: auth_code
        });

        if (response.s === 'ok' && response.access_token) {
            activeAccessToken = response.access_token;
            fyers.setAccessToken(activeAccessToken);
            isFyersConnected = true;
            
            // Save token to disk so it survives restarts for the rest of the day
            fs.writeFileSync(path.join(__dirname, '../fyers_token.txt'), activeAccessToken);
            
            // Publish to Redis so all PM2 workers reload the token
            try {
                const { pubClient } = require('./redisClient');
                if (pubClient) {
                    pubClient.publish('fyers_token_updated', 'updated');
                }
            } catch (err) {}
            
            return { success: true };
        } else {
            console.error("Fyers Auth Error:", response);
            return { success: false, error: response.message };
        }
    } catch (e) {
        console.error("Fyers Verify Exception:", e);
        return { success: false, error: e.message };
    }
}

// On boot, try to load token from disk
function loadTokenFromDisk() {
    try {
        const p = path.join(__dirname, '../fyers_token.txt');
        if (fs.existsSync(p)) {
            const token = fs.readFileSync(p, 'utf8');
            if (token && token.length > 20) {
                activeAccessToken = token;
                fyers.setAccessToken(activeAccessToken);
                isFyersConnected = true;
                console.log("🔌 Loaded Fyers token from disk.");
                return true;
            }
        }
    } catch (e) {}
    return false;
}

// ─── INIT ───────────────────────────────────────────────────────────────────

async function initFyers(io, pc, isMaster = true) {
    global_io = io;
    sharedPriceCache = pc;
    isMasterNode = isMaster;
    
    // Asynchronously load the Fyers Token maps (Fyers Exchange Token -> Fyers Symbol)
    // This runs in the background and does not block PM2 startup.
    loadFyersSymbolMaps();
    
    if (loadTokenFromDisk()) {
        if (isMaster) {
            startLiveWebSocket();
        } else {
            console.log("🔌 Loaded Fyers token for Worker instance. REST API enabled.");
        }
    } else {
        console.warn("⚠️ Fyers is not authenticated. Please visit Admin Dashboard to connect.");
    }
    
    // Start interval to broadcast LTPs ONLY on Master to prevent duplicate network traffic
    if (isMaster) {
        setInterval(() => {
            if (Object.keys(sharedPriceCache).length > 0) {
                global_io.emit('price_snapshot', sharedPriceCache);
            }
        }, 200); // Changed from 1000ms to 200ms for ultra-fast LTP updates
    }
}

// ─── WEBSOCKET ──────────────────────────────────────────────────────────────

const DataSocket = require("fyers-api-v3").fyersDataSocket;

function startLiveWebSocket() {
    // If there's an existing connection, close it before reconnecting
    if (wsInstance) {
        try { wsInstance.close(); } catch(e) {}
        wsInstance = null;
    }
    
    // Fyers V3 DataSocket requires access_token in APPID:ACCESS_TOKEN format
    const APP_ID = process.env.FYERS_APP_ID || 'HBIQP0RPMK-200';
    
    wsInstance = new DataSocket(`${APP_ID}:${activeAccessToken}`, path.join(__dirname, '../logs'), false);
    
    // IMPORTANT: Use SymbolUpdate to receive change and pct along with LTP
    if (wsInstance.SymbolUpdate) {
        wsInstance.mode(wsInstance.SymbolUpdate);
    } else {
        wsInstance.mode('SymbolUpdate');
    }
    
    wsInstance.on('connect', () => {
        console.log('✅ Fyers WebSocket Connected!');
        lastTickTime = Date.now();
        
        // Re-subscribe to all existing client subscriptions
        if (clientSubscriptions.size > 0) {
            const fyersSymbols = Array.from(clientSubscriptions)
                .map(toFyersSymbol)
                .filter(Boolean);
            
                // Subscribe in chunks of 50 (Fyers max limit per request) to speed up initial connection
                (async () => {
                    const chunkSize = 50;
                    for (let i = 0; i < fyersSymbols.length; i += chunkSize) {
                        if (!wsInstance) break;
                        const chunk = fyersSymbols.slice(i, i + chunkSize);
                        wsInstance.subscribe(chunk);
                        await new Promise(r => setTimeout(r, 150));
                    }
                    if (wsInstance) wsInstance.autoreconnect();
                })();
            }
        }
        
        // Watchdog
        if (watchdogInterval) clearInterval(watchdogInterval);
        watchdogInterval = setInterval(() => {
            const staleSec = (Date.now() - lastTickTime) / 1000;
            // MCX is open until 23:30/23:55, so we need to run watchdog until hour 23
            const d = new Date();
            const h = d.getHours();
            if (staleSec > 30 && (h >= 9 && h <= 23) && clientSubscriptions.size > 0) {
                console.warn(`🐛 WATCHDOG: No Fyers ticks for ${staleSec.toFixed(0)}s! Forcing reconnect...`);
                startLiveWebSocket();
            }
        }, 15000);
    });
    
    wsInstance.on('message', (message) => {
        lastTickTime = Date.now();
        const data = Array.isArray(message) ? message : [message];
        
        data.forEach(tick => {
            if (!tick || !tick.symbol) return;
            
            let syms = globalFyersToRequested[tick.symbol];
            if (!syms || syms.length === 0) {
                const mapped = fromFyersSymbol(tick.symbol);
                if (mapped) syms = [mapped];
            }
            if (!syms || syms.length === 0) return;
            
            // Fyers WebSocket v3 sends tick data as an object
            // ltp, ch, chp, vol, bid, ask, etc.
            
            if (tick.type === 'dp' || tick.type === 'if' || tick.type === 'sf') {
                // dp = Depth, if = Index, sf = Symbol Update (Lite)
                const ltp = tick.ltp;
                if (ltp === undefined) return;
                
                let bids = [];
                let asks = [];
                
                if (tick.bids) {
                    bids = tick.bids.map(b => ({ price: b.price.toFixed(2), qty: b.volume, orders: b.ord }));
                }
                if (tick.asks) {
                    asks = tick.asks.map(a => ({ price: a.price.toFixed(2), qty: a.volume, orders: a.ord }));
                }
                
                syms.forEach(uniqueSymbol => {
                    let oldPriceObj = sharedPriceCache[uniqueSymbol] || {};
                    
                    const prev = tick.prev_close_price !== undefined ? tick.prev_close_price : (oldPriceObj.close !== undefined ? oldPriceObj.close : ltp);
                    const change = tick.ch !== undefined ? tick.ch : (ltp - prev);
                    const pct = tick.chp !== undefined ? tick.chp : (prev > 0 ? (change / prev) * 100 : 0);
                    
                    const priceObj = {
                        symbol: uniqueSymbol,
                        ltp: ltp,
                        open: tick.open_price !== undefined ? tick.open_price : (oldPriceObj.open || null),
                        high: tick.high_price !== undefined ? tick.high_price : (oldPriceObj.high || null),
                        low: tick.low_price !== undefined ? tick.low_price : (oldPriceObj.low || null),
                        close: prev || null,
                        volume: tick.vol_traded_today !== undefined ? tick.vol_traded_today : (oldPriceObj.volume || 0),
                        ltt: tick.last_traded_time ? new Date(tick.last_traded_time * 1000).toLocaleString('en-GB') : (oldPriceObj.ltt || null),
                        change: change,
                        pct: pct,
                        bids: bids.length > 0 ? bids : (oldPriceObj.bids || []),
                        asks: asks.length > 0 ? asks : (oldPriceObj.asks || [])
                    };
                    
                    sharedPriceCache[uniqueSymbol] = priceObj;
                });
                
                // Publish to Redis for PM2 Workers
                try {
                    const { pubClient } = require('./redisClient');
                    if (pubClient) {
                        pubClient.publish('price_cache_sync', JSON.stringify({ symbol: uniqueSymbol, priceObj }));
                    }
                } catch(e) {}
            }
        });
    });
    
    wsInstance.on('error', (err) => {
        console.error("Fyers WS Error:", err);
    });
    
    wsInstance.on('close', () => {
        console.log("Fyers WS Closed.");
    });
    
    wsInstance.connect();
}

let subQueue = [];
let isProcessingSubQueue = false;

async function processSubQueue() {
    if (isProcessingSubQueue || !wsInstance || !isFyersConnected) return;
    isProcessingSubQueue = true;
    try {
        while (subQueue.length > 0) {
            if (!wsInstance) break;
            const chunk = subQueue.splice(0, 50); // Fyers max limit per request
            wsInstance.subscribe(chunk);
            await new Promise(r => setTimeout(r, 150)); // Limit rate while batching
        }
    } catch (e) {
        console.error("Fyers subscribe error:", e);
    } finally {
        isProcessingSubQueue = false;
    }
}

function addSubscriptionBatch(symbols) {
    if (Array.isArray(symbols)) symbols = symbols.map(s => typeof s === 'object' && s !== null ? s.symbol : s).filter(Boolean);
    if (!Array.isArray(symbols) || symbols.length === 0) return;
    
    symbols.forEach(item => {
        let s = typeof item === 'string' ? item : item?.symbol;
        if (!s || typeof s !== 'string' || s.endsWith('-MF')) return; // Ignore mutual funds
        clientSubscriptions.add(s);
        const fSym = toFyersSymbol(s);
        if (fSym) {
            if (!subQueue.includes(fSym)) {
                subQueue.push(fSym);
            }
            if (!globalFyersToRequested[fSym]) globalFyersToRequested[fSym] = [];
            if (!globalFyersToRequested[fSym].includes(s)) globalFyersToRequested[fSym].push(s);
        }
    });
    
    if (wsInstance && isFyersConnected && subQueue.length > 0) {
        processSubQueue();
    }
}

function removeSubscriptionBatch(symbols) {
    if (!Array.isArray(symbols) || symbols.length === 0) return;
    
    const fyersSymbols = [];
    symbols.forEach(s => {
        clientSubscriptions.delete(s);
        const fSym = toFyersSymbol(s);
        if (fSym) {
            fyersSymbols.push(fSym);
            if (globalFyersToRequested[fSym]) {
                globalFyersToRequested[fSym] = globalFyersToRequested[fSym].filter(item => item !== s);
                if (globalFyersToRequested[fSym].length === 0) {
                    delete globalFyersToRequested[fSym];
                }
            }
        }
    });
    
    if (wsInstance && isFyersConnected && fyersSymbols.length > 0) {
        try {
            for (let i = 0; i < fyersSymbols.length; i++) {
                wsInstance.unsubscribe([fyersSymbols[i]]);
            }
        } catch(e) {}
    }
}

// ─── API FETCH FUNCTIONS ────────────────────────────────────────────────────

// Helper for HTTP fallback
async function fetchBatchLTPs(symbols) {
    symbols = symbols.map(s => typeof s === 'object' && s !== null ? s.symbol : s).filter(Boolean);
    const validSymbols = symbols.filter(s => s && !s.endsWith('-MF'));
    if (validSymbols.length === 0) return {};
    
    const fyersToRequested = {};
    const fyersSymbols = validSymbols.map(s => {
        const fSym = toFyersSymbol(s);
        if (fSym) {
            if (!fyersToRequested[fSym]) fyersToRequested[fSym] = [];
            if (!fyersToRequested[fSym].includes(s)) fyersToRequested[fSym].push(s);
            return fSym;
        }
        return null;
    }).filter(Boolean);
    
    console.log(`📡 fetchBatchLTPs called: ${validSymbols.length} symbols, ${fyersSymbols.length} mapped to Fyers, token=${activeAccessToken ? 'SET' : 'NONE'}`);
    if (fyersSymbols.length > 0 && fyersSymbols.length <= 5) {
        console.log(`   Fyers symbols: ${fyersSymbols.join(', ')}`);
    }
    
    if (!activeAccessToken || fyersSymbols.length === 0) {
        console.log(`⚠️ fetchBatchLTPs: skipping API call (token=${!!activeAccessToken}, fyersSymbols=${fyersSymbols.length})`);
        return validSymbols.reduce((acc, sym) => {
            if (sharedPriceCache[sym]) acc[sym] = sharedPriceCache[sym];
            return acc;
        }, {});
    }

    try {
        const results = {};
        
        // Fyers max batch size is usually 50. But we use 10 to minimize the impact of an invalid symbol
        const chunkSize = 10;
        for (let i = 0; i < fyersSymbols.length; i += chunkSize) {
            const chunk = fyersSymbols.slice(i, i + chunkSize);
            
            try {
                const response = await fyers.getQuotes(chunk);
                console.log(`📡 Fyers getQuotes response: s=${response?.s}, d_count=${response?.d?.length || 0}, code=${response?.code || 'none'}, msg=${response?.message || 'none'}`);
                
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
                    console.error(`❌ Fyers getQuotes error for chunk: code=${response.code}, message=${response.message}. Retrying individually...`);
                    // Retry individually to prevent one invalid symbol from ruining the batch
                    // Fyers API limit is 10 req/sec. We process sequentially with 150ms delay
                    for (let j = 0; j < chunk.length; j++) {
                        const fSym = chunk[j];
                        try {
                            await new Promise(r => setTimeout(r, 150));
                            const indRes = await fyers.getQuotes([fSym]);
                            if (indRes && indRes.s === 'ok') {
                                processQuotesResponse(indRes);
                            }
                        } catch(indErr) {
                            console.error(`Fyers getQuotes individual error for ${fSym}:`, indErr.message || indErr);
                        }
                    }
                }
            } catch(chunkErr) {
                console.error("Fyers getQuotes chunk error:", chunkErr);
            }
        }
        
        console.log(`📡 fetchBatchLTPs returning ${Object.keys(results).length} prices`);
        return results;
    } catch(e) {
        console.error("Fyers fetchBatchLTPs error:", e);
    }
    return {};
}

// Fyers interval mapping
const INTERVAL_MAP = {
    'ONE_MINUTE': '1',
    'THREE_MINUTE': '3',
    'FIVE_MINUTE': '5',
    'TEN_MINUTE': '10',
    'FIFTEEN_MINUTE': '15',
    'THIRTY_MINUTE': '30',
    'ONE_HOUR': '60',
    'ONE_DAY': '1D'
};

const { generalClient } = require('./redisClient');

async function fetchCandleData(symbol, interval = 'ONE_DAY') {
    if (!activeAccessToken || !symbol) return [];
    
    const fSym = toFyersSymbol(symbol);
    if (!fSym) return [];

    const res = INTERVAL_MAP[interval] || '1D';
    
    // Check Redis cache first
    const cacheKey = `chart:${fSym}:${res}`;
    try {
        const cached = await generalClient.get(cacheKey);
        if (cached) {
            return JSON.parse(cached);
        }
    } catch (err) {
        console.error("Redis get error in fetchCandleData", err);
    }
    
    // Fyers expects range in yyyy-mm-dd
    const formatDate = (d) => {
        return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
    };

    let range_to = new Date();
    let range_from = new Date();
    
    // 30 days for intraday, 1 year for daily
    if (res === '1D') {
        range_from.setFullYear(range_from.getFullYear() - 1);
    } else {
        range_from.setDate(range_from.getDate() - 30);
    }

    try {
        const fetchPromise = fyers.getHistory({
            symbol: fSym,
            resolution: res,
            date_format: 1,
            range_from: formatDate(range_from),
            range_to: formatDate(range_to),
            cont_flag: 1
        });
        
        // 10 second timeout to prevent hanging the route
        const timeoutPromise = new Promise((_, reject) => setTimeout(() => reject(new Error('Fyers API Timeout')), 10000));
        
        const response = await Promise.race([fetchPromise, timeoutPromise]);
        
        if (response && response.s === 'ok' && response.candles) {
            const formattedCandles = response.candles.map(c => ({
                time: c[0] + 19800,
                open: c[1],
                high: c[2],
                low: c[3],
                close: c[4],
                volume: c[5]
            }));
            
            // Save to Redis for 60 seconds (1 minute caching)
            try {
                await generalClient.setEx(cacheKey, 60, JSON.stringify(formattedCandles));
            } catch (err) {
                console.error("Redis set error in fetchCandleData", err);
            }
            
            return formattedCandles;
        }
    } catch (e) {
        console.error("Fyers fetchCandleData error:", e);
    }
    return [];
}

function setPriceCache(pc) { sharedPriceCache = pc; }
function registerTokens() {}
function addSubscription(symbol) { addSubscriptionBatch([symbol]); }
function subscribeToDepth(symbol) { /* Fyers v3 auto sends depth if requested */ }
function unsubscribeFromDepth(symbol) {}

function reloadFyersToken() {
    console.log("🔄 Redis Event: Fyers token updated! Reloading...");
    if (loadTokenFromDisk()) {
        if (isMasterNode) {
            startLiveWebSocket();
        } else {
            console.log("🔌 Reloaded Fyers token for Worker instance.");
        }
    }
}

function getPriceFromCache() {
    return sharedPriceCache || {};
}

function getFyersStatus() {
    return {
        isMasterNode,
        isFyersConnected,
        hasAccessToken: !!activeAccessToken,
        wsInstanceExists: !!wsInstance,
        subscriptions: Array.from(clientSubscriptions),
        lastTickTime: new Date(lastTickTime).toISOString(),
        secondsSinceLastTick: (Date.now() - lastTickTime) / 1000,
        fyersToRequestedMap: globalFyersToRequested,
        tokensMapped: Object.keys(tokenToFyers).length
    };
}

async function loadFyersSymbolMaps() {
    try {
        const fs = require('fs');
        const path = require('path');
        const https = require('https');
        const mapPath = path.join(__dirname, '../database/fyers_map.json');
        
        // 1. Load from local cache immediately so we have instant startup mapping
        if (fs.existsSync(mapPath)) {
            const data = JSON.parse(fs.readFileSync(mapPath, 'utf8'));
            tokenToFyers = data.tokenToFyers || {};
            fyersToToken = data.fyersToToken || {};
            nameToFyers  = data.nameToFyers  || {};
            console.log(`🔌 Loaded ${Object.keys(tokenToFyers).length} Fyers symbols + ${Object.keys(nameToFyers).length} indices from cache.`);
        }
        
        if (!isMasterNode) {
            console.log("ℹ️ Worker node skipping Fyers CSV download.");
            return;
        }
        
        // 2. Download latest CSVs asynchronously in the background
        const download = (url) => new Promise((resolve, reject) => {
            https.get(url, (res) => {
                let data = '';
                res.on('data', chunk => data += chunk);
                res.on('end', () => resolve(data));
            }).on('error', reject);
        });

        console.log("🔄 Downloading Fyers Master CSVs in background...");
        const urls = [
            'https://public.fyers.in/sym_details/NSE_FO.csv',
            'https://public.fyers.in/sym_details/BSE_FO.csv',
            'https://public.fyers.in/sym_details/MCX_COM.csv',
            'https://public.fyers.in/sym_details/NSE_CM.csv',
            'https://public.fyers.in/sym_details/BSE_CM.csv'
        ];
        
        const newMap = {};
        const revMap = {};
        const newNameMap = {};
        
        for (const url of urls) {
            try {
                const csv = await download(url);
                const lines = csv.split('\n');
                for (const line of lines) {
                    if (!line) continue;
                    const parts = line.split(',');
                    if (parts.length > 13) {
                        const fyersSym = parts[9];
                        const exchangeToken = parts[12];
                        const underlyingName = parts[13]; // e.g. 'POWER', 'RELIANCE'
                        if (exchangeToken && fyersSym && fyersSym.includes(':')) {
                            newMap[exchangeToken] = fyersSym;
                            revMap[fyersSym] = exchangeToken;
                            // Build name map for indices (e.g. POWER → BSE:POWER-INDEX)
                            if (fyersSym.endsWith('-INDEX') && underlyingName) {
                                newNameMap[underlyingName] = fyersSym;
                            }
                        }
                    }
                }
            } catch(e) {
                console.error(`Failed to download ${url}:`, e.message);
            }
        }
        
        if (Object.keys(newMap).length > 1000) {
            tokenToFyers = newMap;
            fyersToToken = revMap;
            nameToFyers = newNameMap;
            fs.writeFileSync(mapPath, JSON.stringify({ tokenToFyers, fyersToToken, nameToFyers }));
            console.log(`✅ Fyers Symbol Maps updated successfully (${Object.keys(newMap).length} tokens, ${Object.keys(newNameMap).length} indices).`);
        }
        
    } catch(err) {
        console.error("Fyers Map Error:", err);
    }
}

module.exports = {
    getPriceFromCache,
    setPriceCache,
    registerTokens,
    addSubscription,
    subscribeToDepth,
    unsubscribeFromDepth,
    initFyers,
    reloadFyersToken,
    getFyersAuthURL,
    verifyFyersAuth,
    fetchBatchLTPs,
    fetchCandleData,
    addSubscriptionBatch,
    removeSubscriptionBatch,
    getFyersStatus
};
