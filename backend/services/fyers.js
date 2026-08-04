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
        }, 1000);
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
    
    // IMPORTANT: Mode must be set for Equities/Futures to receive ticks (LiteMode = 'sf')
    if (wsInstance.LiteMode) {
        wsInstance.mode(wsInstance.LiteMode);
    } else {
        // Fallback literal if instance property is somehow missing
        wsInstance.mode('LiteMode');
    }
    
    
    wsInstance.on('connect', () => {
        console.log('✅ Fyers WebSocket Connected!');
        lastTickTime = Date.now();
        isFyersConnected = true;
        
        if (clientSubscriptions.size > 0) {
            const fyersSymbols = Array.from(clientSubscriptions).map(toFyersSymbol).filter(Boolean);
            if (fyersSymbols.length > 0) {
                try {
                    wsInstance.subscribe(fyersSymbols);
                    if (wsInstance) wsInstance.autoreconnect();
                } catch(e) { console.error(e); }
            }
        }
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
                
                const prev = tick.prev_close_price || ltp;
                const change = ltp - prev;
                const pct = prev > 0 ? (change / prev) * 100 : 0;

                syms.forEach(uniqueSymbol => {
                    const priceObj = {
                        symbol: uniqueSymbol,
                        ltp: ltp,
                        open: tick.open_price || null,
                        high: tick.high_price || null,
                        low: tick.low_price || null,
                        close: prev || null,
                        volume: tick.vol_traded_today || 0,
                        ltt: tick.last_traded_time ? new Date(tick.last_traded_time * 1000).toLocaleString('en-GB') : null,
                        change: change,
                        pct: pct,
                        bids: bids,
                        asks: asks
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


let pendingSubscriptionTimer = null;

function addSubscriptionBatch(symbols) {
    if (Array.isArray(symbols)) symbols = symbols.map(s => typeof s === 'object' && s !== null ? s.symbol : s).filter(Boolean);
    if (!Array.isArray(symbols) || symbols.length === 0) return;
    
    let addedNew = false;
    symbols.forEach(item => {
        let s = typeof item === 'string' ? item : item?.symbol;
        if (!s || typeof s !== 'string' || s.endsWith('-MF')) return;
        if (!clientSubscriptions.has(s)) {
            clientSubscriptions.add(s);
            addedNew = true;
        }
    });
    
    if (addedNew && wsInstance && isFyersConnected) {
        if (pendingSubscriptionTimer) clearTimeout(pendingSubscriptionTimer);
        
        pendingSubscriptionTimer = setTimeout(() => {
            const fyersSymbols = Array.from(clientSubscriptions)
                .map(toFyersSymbol)
                .filter(Boolean);
                
            if (fyersSymbols.length > 0) {
                console.log(`📡 Pushing ${fyersSymbols.length} debounced symbols to Fyers WebSocket...`);
                try {
                    wsInstance.subscribe(fyersSymbols);
                } catch(e) {
                    console.error('Fyers debounced subscribe error:', e);
                }
            }
        }, 1000);
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
