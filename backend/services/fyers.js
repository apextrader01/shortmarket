const fyersModel = require("fyers-api-v3").fyersModel;
const fs = require('fs');
const path = require('path');
require('dotenv').config();

let global_io = null;
let sharedPriceCache = null;
let wsInstance = null;
let clientSubscriptions = new Set();
let mfSubscriptions = new Set();
let watchdogInterval = null;
let reconnectAttempts = 0;
let lastDataSocketError = null;
let lastTickTime = Date.now();
let isMasterNode = false;

let dirtySymbols = new Set(); // Track symbols that changed in the last 300ms

// The global map of ALL subscriptions we care about (used by PM2 master);

const fyers = new fyersModel({ "path": path.join(__dirname, '../logs'), "enableLogging": false });

// Set Fyers Credentials
const APP_ID = process.env.FYERS_APP_ID || 'HBIQP0RPMK-200';
const SECRET_ID = process.env.FYERS_SECRET_ID || 'bBPHCtnZiGzWdeuD';
const REDIRECT_URL = 'https://34-93-99-22.nip.io/api/fyers/callback';

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

try {
    const fyersMap = JSON.parse(fs.readFileSync(path.join(__dirname, '../database/fyers_map.json'), 'utf8'));
    if (fyersMap.nameToFyers) nameToFyers = fyersMap.nameToFyers;
    if (fyersMap.tokenToFyers) tokenToFyers = fyersMap.tokenToFyers;
    if (fyersMap.fyersToToken) fyersToToken = fyersMap.fyersToToken;
} catch (e) {
    console.error("Error loading fyers_map.json:", e);
}

// ── O(1) reverse lookup: fyersSymbol → our platform symbol (built once at boot) ──
// The fromFyersSymbol() function was doing O(n) for-loop over nameToFyers on EVERY tick.
// For 200 subscribed symbols × 10 ticks/sec = 200,000 iterations/sec. This Map makes it O(1).
const fyersToNameMap = new Map(Object.entries(nameToFyers).map(([k, v]) => [v, k]));

// ── Pre-require triggerEngine at module level so it's not re-required in every tick ──
let triggerEngine = null;
try { triggerEngine = require('./triggerEngine'); } catch(e) {}


// Convert our platform's unique symbols to Fyers Symbols (guaranteeing valid exchange prefix)
function toFyersSymbol(symbol) {
    if (typeof symbol === 'object' && symbol !== null) symbol = symbol.symbol;
    if (!symbol) return null;

    let sym = symbol;
    if (symbol.includes(':')) {
        sym = symbol.split(':')[1];
    }
    
    if (nameToFyers[sym]) return nameToFyers[sym];
    if (nameToFyers[symbol]) return nameToFyers[symbol];
    
    if (symbol.includes(':')) {
        return symbol; // Already has exchange prefix (e.g. NSE:TCS-EQ, BSE:SENSEX-INDEX)
    }

    // Auto-resolve exchange prefix for derivatives/equities passed without prefix
    if (/(GOLD|SILVER|CRUDEOIL|NATURALGAS|COPPER|ZINC|NICKEL|ALUMINIUM|LEAD|COTTON|MENTHAOIL|STEELREBAR)/i.test(symbol)) {
        return `MCX:${symbol}`;
    }
    if (/^(SENSEX|BANKEX)/i.test(symbol) || symbol.endsWith('-BSE') || symbol.endsWith('-A') || symbol.endsWith('-B')) {
        return `BSE:${symbol}`;
    }
    return `NSE:${symbol}`;
}

// Convert Fyers Symbols back to our platform's unique symbols — O(1) Map lookup
function fromFyersSymbol(fyersSymbol) {
    if (!fyersSymbol) return null;
    // Use O(1) Map lookup instead of O(n) for-loop
    const mapped = fyersToNameMap.get(fyersSymbol);
    if (mapped) return mapped;
    return fyersSymbol; // Since we are now Fyers native, the symbol IS the Fyers symbol
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
                    pubClient.publish('fyers_token_updated', 'updated').catch(e => {});
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
            if (token && token.trim().length > 20) {
                activeAccessToken = token.trim();
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
    
    if (loadTokenFromDisk()) {
        if (isMaster) {
            startLiveWebSocket();
        } else {
            console.log("🔌 Loaded Fyers token for Worker instance. REST API enabled.");
        }
    } else {
        console.warn("⚠️ Fyers is not authenticated. Please visit Admin Dashboard to connect.");
    }
    
    // Start interval to broadcast LTPs to clients — BATCHED (1 message for ALL symbols)
    // This is far more efficient than 1 message per symbol (N messages) for multi-user scenarios.
    if (isMasterNode) {
        setInterval(() => {
            if (dirtySymbols.size > 0 && global_io) {
                // Build one batch object with ALL updated prices — slimmed to essential fields
                // to slash network egress bandwidth and Redis loopback traffic by >80%
                const batchUpdate = {};
                dirtySymbols.forEach(uniqueSymbol => {
                    const priceObj = sharedPriceCache[uniqueSymbol];
                    if (priceObj) {
                        batchUpdate[uniqueSymbol] = {
                            symbol: priceObj.symbol,
                            timestamp: priceObj.timestamp,
                            ltp: priceObj.ltp,
                            open: priceObj.open,
                            high: priceObj.high,
                            low: priceObj.low,
                            close: priceObj.close,
                            volume: priceObj.volume,
                            change: priceObj.change,
                            pct: priceObj.pct,
                            totBuyQuan: priceObj.totBuyQuan,
                            totSellQuan: priceObj.totSellQuan
                        };
                    }
                });
                dirtySymbols.clear();

                if (Object.keys(batchUpdate).length > 0) {
                    // Send targeted updates to specific symbol rooms to prevent DDOSing the frontend
                    // with ticks they aren't subscribed to, which causes severe UI lag.
                    for (const sym of Object.keys(batchUpdate)) {
                        const room = global_io.sockets?.adapter?.rooms?.get(sym);
                        // ⚡ Skip emitting if no client is actively subscribed to this symbol
                        if (room && room.size > 0) {
                            global_io.to(sym).emit('price_snapshot', { [sym]: batchUpdate[sym] });
                        }
                    }

                    // Also batch-sync this updated cache to Worker nodes via Redis (this stays batched)
                    try {
                        const { pubClient } = require('./redisClient');
                        if (pubClient) {
                            pubClient.publish('price_cache_batch_sync', JSON.stringify(batchUpdate)).catch(e => {});
                        }
                    } catch(e) {}
                }
            }
        }, 1000); // 1000ms (1 update per sec) to drastically save Egress Bandwidth costs for 100k users
    }
}

// ─── WEBSOCKET ──────────────────────────────────────────────────────────────

const DataSocket = require("fyers-api-v3").fyersDataSocket;

function startLiveWebSocket() {
    if (wsInstance) { try { if (wsInstance.close) wsInstance.close(); if (wsInstance.disconnect) wsInstance.disconnect(); } catch(e) {} }
    // With fyers-api-v3, we MUST use getInstance() instead of new DataSocket
    // to prevent 'Only one instance of DataSocket is allowed' errors during reconnects.
    // If wsInstance exists, we just let it be, but we will call connect() later.
    
    // Fyers V3 DataSocket requires access_token in APPID:ACCESS_TOKEN format
    const APP_ID = process.env.FYERS_APP_ID || 'HBIQP0RPMK-200';
    
    try {
        const logPath = path.join(__dirname, '../logs');
        if (!fs.existsSync(logPath)) fs.mkdirSync(logPath, { recursive: true });
        wsInstance = DataSocket.getInstance(`${APP_ID}:${activeAccessToken.trim()}`, logPath, false);
        lastDataSocketError = null;
    } catch(err) {
        lastDataSocketError = err.stack || err.message || err.toString();
        console.error("🚨 Failed to initialize Fyers DataSocket:", err);
        return;
    }
    
    if (wsInstance.FullMode) {
        wsInstance.mode(wsInstance.FullMode);
    }
    
    // Always remove old listeners and re-attach fresh ones.
    // The singleton pattern means we get the same object back, but after a token change
    // or pm2 restart we MUST re-register handlers so the new code takes effect.
    try { if (wsInstance.removeAllListeners) wsInstance.removeAllListeners(); } catch(e) {}
    wsInstance.hasListenersAttached = true;
    
    wsInstance.on('connect', () => {
        console.log('✅ Fyers WebSocket Connected!');
        lastTickTime = Date.now();
        isFyersConnected = true;
        
        // CRITICAL: Always enable autoreconnect unconditionally so Fyers can
        // recover from hourly session drops even when no clients are connected at boot.
        if (wsInstance) wsInstance.autoreconnect();
        
        // Re-subscribe to all existing client subscriptions
        if (clientSubscriptions.size > 0) {
            const fyersSymbols = Array.from(clientSubscriptions)
                .map(toFyersSymbol)
                .filter(Boolean);
            
                  (async () => {
                      const chunkSize = 25;
                      for (let i = 0; i < fyersSymbols.length; i += chunkSize) {
                          if (!wsInstance) break;
                          const chunk = fyersSymbols.slice(i, i + chunkSize);
                          wsInstance.subscribe(chunk);
                          await new Promise(r => setTimeout(r, 300));
                      }
                  })();
        }
        
        // Watchdog — only trigger if we've been running for more than 2 minutes.
        // This prevents false restarts during PM2 boot when no clients have connected yet.
        const bootGracePeriodMs = 120000; // 2 minutes
        if (watchdogInterval) clearInterval(watchdogInterval);
        watchdogInterval = setInterval(() => {
            const staleSec = (Date.now() - lastTickTime) / 1000;
            const uptimeSec = process.uptime();
            // MCX is open until 23:30/23:55, so we need to run watchdog until hour 23
            const d = new Date();
            const h = d.getHours();
            const day = d.getDay();
            const isWeekend = (day === 0 || day === 6);
            // Only restart if:
            // 1. Not a weekend
            // 2. Within market hours
            // 3. No tick in 60 seconds (not 45)
            // 4. There ARE active subscriptions (means clients are watching)
            // 5. Server has been up for at least 90 seconds (avoid restart loops on boot)
            if (!isWeekend && staleSec > 60 && (h >= 9 && h <= 23) && clientSubscriptions.size > 0 && uptimeSec > 90) {
                console.warn(`🐛 WATCHDOG: No Fyers ticks for ${staleSec.toFixed(0)}s! SDK stuck. Forcing PM2 restart...`);
                process.exit(0);
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
            // Tick types: 'dp'=Depth, 'if'=IndexFull, 'sf'=SymFull(Lite), 'of'=SymFull(Full)
            // We accept ALL types that have an ltp - do not whitelist by type string
            // because Fyers may send 'of' or other types depending on mode/symbol.
            
            if (tick.ltp !== undefined) {
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
                        timestamp: Date.now(),
                        ltp: ltp,
                        open: tick.open_price !== undefined ? tick.open_price : (oldPriceObj.open || null),
                        high: tick.high_price !== undefined ? tick.high_price : (oldPriceObj.high || null),
                        low: tick.low_price !== undefined ? tick.low_price : (oldPriceObj.low || null),
                        close: prev || null,
                        volume: tick.vol_traded_today !== undefined ? tick.vol_traded_today : (oldPriceObj.volume || 0),
                        ltt: tick.last_traded_time ? tick.last_traded_time * 1000 : (oldPriceObj.ltt || null),
                        change: change,
                        pct: pct,
                        bids: bids.length > 0 ? bids : (oldPriceObj.bids || []),
                        asks: asks.length > 0 ? asks : (oldPriceObj.asks || []),
                        totBuyQuan: tick.tot_buy_qty !== undefined ? tick.tot_buy_qty : (oldPriceObj.totBuyQuan || 0),
                        totSellQuan: tick.tot_sell_qty !== undefined ? tick.tot_sell_qty : (oldPriceObj.totSellQuan || 0)
                    };
                    
                    sharedPriceCache[uniqueSymbol] = priceObj;
                    if (uniqueSymbol.includes(':')) {
                        const raw = uniqueSymbol.split(':')[1];
                        sharedPriceCache[raw] = priceObj;
                        dirtySymbols.add(raw);
                    }
                    dirtySymbols.add(uniqueSymbol); // Mark as dirty for the debounce interval
                    
                    // Evaluate triggers on the master node using pre-cached reference (no require() on each tick)
                    if (triggerEngine) {
                        triggerEngine.evaluateTick(uniqueSymbol, ltp).catch(() => {});
                    }
                });
            }
        });
    });
    
    wsInstance.on('error', (err) => {
        console.error("Fyers WS Error:", err);
    });
    
    wsInstance.on('close', () => {
        console.log("Fyers WS Closed — resetting state and scheduling reconnect.");
        isFyersConnected = false;  // CRITICAL FIX: was never set to false, causing false "Connected" status
        
        // Safety-net manual reconnect after 5 seconds.
        // autoreconnect() should handle this, but if the SDK silently fails
        // (which happens when Fyers drops the connection due to token expiry),
        // this ensures we always attempt a fresh connection.
        setTimeout(() => {
            if (!isFyersConnected && activeAccessToken) {
                console.log("[WS] Manual reconnect triggered after close.");
                startLiveWebSocket();
            }
        }, 5000);
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
            const chunk = subQueue.splice(0, 25);
            wsInstance.subscribe(chunk);
            await new Promise(r => setTimeout(r, 300)); // Limit rate while batching
        }
    } catch (e) {
        console.error("Error processing Fyers sub queue:", e);
    }
    isProcessingSubQueue = false;
}

function addSubscriptionBatch(symbols) {
    if (Array.isArray(symbols)) symbols = symbols.map(s => typeof s === 'object' && s !== null ? s.symbol : s).filter(Boolean);
    if (!Array.isArray(symbols) || symbols.length === 0) return;
    
    const now = Date.now();
    symbols.forEach(item => {
        let s = typeof item === 'string' ? item : item?.symbol;
        if (!s || typeof s !== 'string') return;
        if (s.endsWith('-MF')) { mfSubscriptions.add(s); return; }
        
        // FIX: Update symbolLastSeen so GC doesn't kill manually subscribed symbols.
        // Previously only handlePingSubscriptions updated symbolLastSeen, so symbols added
        // via watchlist/order/position 'subscribe' event got GC'd after 30s silently.
        symbolLastSeen.set(s, now);
        
        const alreadySubscribed = clientSubscriptions.has(s);
        clientSubscriptions.add(s);
        const fSym = toFyersSymbol(s);
        if (fSym) {
            if (!alreadySubscribed && !subQueue.includes(fSym)) {
                subQueue.push(fSym);
            }
            if (!globalFyersToRequested[fSym]) globalFyersToRequested[fSym] = [];
            if (!globalFyersToRequested[fSym].includes(s)) globalFyersToRequested[fSym].push(s);
        }
    });
    
    if (wsInstance && isFyersConnected && subQueue.length > 0) {
        processSubQueue();
    }
    
    // Start GC if not already running
    if (!gcInterval) {
        gcInterval = setInterval(garbageCollectSubscriptions, 30000);
    }
}

let symbolLastSeen = new Map();
let gcInterval = null;

function handlePingSubscriptions(symbols) {
    if (!Array.isArray(symbols)) return;
    
    const now = Date.now();
    const newSymbols = [];
    
    symbols.forEach(s => {
        if (!s || typeof s !== 'string' || s.endsWith('-MF')) return;
        
        symbolLastSeen.set(s, now);
        
        if (!clientSubscriptions.has(s)) {
            clientSubscriptions.add(s);
            newSymbols.push(s);
        }
    });
    
    // Subscribe to new symbols that we aren't already tracking
    if (newSymbols.length > 0) {
        newSymbols.forEach(s => {
            const fSym = toFyersSymbol(s);
            if (fSym) {
                if (!subQueue.includes(fSym)) subQueue.push(fSym);
                if (!globalFyersToRequested[fSym]) globalFyersToRequested[fSym] = [];
                if (!globalFyersToRequested[fSym].includes(s)) globalFyersToRequested[fSym].push(s);
            }
        });
        
        if (wsInstance && isFyersConnected && subQueue.length > 0) {
            processSubQueue();
        }
    }
    
    // Start GC if not running
    if (!gcInterval) {
        gcInterval = setInterval(garbageCollectSubscriptions, 30000); // Check every 30 seconds
    }
}

async function garbageCollectSubscriptions() {
    if (!wsInstance || !isFyersConnected) return;
    
    const now = Date.now();
    const staleFyersSymbols = [];
    
    // --- ANTI-GC FOR ESSENTIAL SYMBOLS ---
    // Prevent garbage collection for open orders, positions, and indices
    // Active user watchlists are automatically protected by ping_subscriptions from client
    try {
        const db = require('../database/db');
        const protectSymbol = (sym) => {
            if (sym && !sym.endsWith('-MF')) {
                symbolLastSeen.set(sym, now); // Prevent GC
                if (!clientSubscriptions.has(sym)) {
                    clientSubscriptions.add(sym);
                    const fSym = toFyersSymbol(sym);
                    if (fSym) {
                        if (!subQueue.includes(fSym)) subQueue.push(fSym);
                        if (!globalFyersToRequested[fSym]) globalFyersToRequested[fSym] = [];
                        if (!globalFyersToRequested[fSym].includes(sym)) globalFyersToRequested[fSym].push(sym);
                    }
                }
            }
        };
        
        // 1. Protect Indices
        ['NSE:NIFTY50-INDEX', 'NSE:NIFTYBANK-INDEX', 'BSE:SENSEX-INDEX'].forEach(protectSymbol);
        
        // 2. Protect Pending Orders
        const ordRows = await db('orders').whereIn('status', ['PENDING', 'PENDING_TRIGGER']).distinct('symbol').catch(()=>[]);
        ordRows.forEach(r => protectSymbol(r.symbol));
            
        // 3. Protect Open Positions
        const posRows = await db('positions').where('qty', '!=', 0).distinct('symbol').catch(()=>[]);
        posRows.forEach(r => protectSymbol(r.symbol));

        if (wsInstance && isFyersConnected && subQueue.length > 0) {
            processSubQueue();
        }
    } catch(e) {}
    // ----------------------------------

    for (const [symbol, lastSeen] of symbolLastSeen.entries()) {
        // If a symbol hasn't been pinged in 60 seconds by ANY user, unsubscribe it
        if (now - lastSeen > 60000) {
            clientSubscriptions.delete(symbol);
            symbolLastSeen.delete(symbol);
            
            const fSym = toFyersSymbol(symbol);
            if (fSym) {
                if (globalFyersToRequested[fSym]) {
                    globalFyersToRequested[fSym] = globalFyersToRequested[fSym].filter(item => item !== symbol);
                    if (globalFyersToRequested[fSym].length === 0) {
                        delete globalFyersToRequested[fSym];
                        staleFyersSymbols.push(fSym);
                    }
                }
            }
        }
    }
    
    if (staleFyersSymbols.length > 0) {
        console.log(`[GC] Unsubscribing ${staleFyersSymbols.length} stale symbols from Fyers...`);
        try {
            for (let i = 0; i < staleFyersSymbols.length; i++) {
                wsInstance.unsubscribe([staleFyersSymbols[i]]);
            }
        } catch(e) {}
    }
}

// ─── API FETCH FUNCTIONS ────────────────────────────────────────────────────

// Helper for HTTP fallback
async function fetchBatchLTPs(symbols) {
    if (!Array.isArray(symbols) || symbols.length === 0) return {};
    
    const isMfSymbol = s => typeof s === 'string' && (s.endsWith('-MF') || /^\d{5,6}$/.test(s) || ['EDEL', 'MIRA', 'NIPP', 'EDEL-MF', 'MIRA-MF', 'NIPP-MF'].includes(s));
    const validSymbols = symbols.filter(s => typeof s === 'string' && s.length > 0 && !isMfSymbol(s));
    const mfSymbols = symbols.filter(isMfSymbol);
    
    const mfResults = {};
    if (mfSymbols.length > 0) {
        const LEGACY_MF_MAP = {
            'EDEL-MF': '118615',
            'MIRA-MF': '118825',
            'NIPP-MF': '118778',
            'EDEL': '118615',
            'MIRA': '118825',
            'NIPP': '118778'
        };
        const axios = require('axios');
        for (const sym of mfSymbols) {
            try {
                const rawCode = sym.replace('-MF', '').replace('BSE:', '').replace('NSE:', '');
                const mfCode = LEGACY_MF_MAP[sym] || LEGACY_MF_MAP[rawCode] || rawCode;
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
                                        if (uniqueSymbol.includes(':')) {
                                            const raw = uniqueSymbol.split(':')[1];
                                            results[raw] = priceObj;
                                            sharedPriceCache[raw] = priceObj;
                                        }
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
function subscribeToDepth(symbol) { 
    if (!wsInstance || !isFyersConnected) return;
    const fSym = toFyersSymbol(symbol);
    if (fSym) {
        try { wsInstance.subscribe([fSym], "DepthUpdate"); } catch (e) { console.error(e); }
    }
}
function unsubscribeFromDepth(symbol) {
    if (!wsInstance || !isFyersConnected) return;
    const fSym = toFyersSymbol(symbol);
    if (fSym) {
        try { wsInstance.subscribe([fSym], "SymbolUpdate"); } catch (e) { console.error(e); }
    }
}

function reloadFyersToken() {
    console.log("Redis Event: Fyers token updated! Forcing PM2 restart to clear DataSocket cache in 3s...");
    // fyers-api-v3 caches the DataSocket singleton. The only reliable way to force 
    // it to use the new token is to exit the process and let PM2 restart it.
    // Delaying by 3 seconds ensures the user's redirect request completes without a 502 Bad Gateway.
    setTimeout(() => {
        process.exit(0);
    }, 3000);
}

function getPriceFromCache() {
    return sharedPriceCache || {};
}

function getFyersStatus() {
    const recentTick = (Date.now() - lastTickTime) < 15000;
    const isTokenExpiredError = lastDataSocketError && (
        lastDataSocketError.toLowerCase().includes('expired token') || 
        lastDataSocketError.toLowerCase().includes('failed to decode jwt')
    );
    const masterConnected = isFyersConnected && !isTokenExpiredError;
    return {
        isMasterNode,
        isFyersConnected: isMasterNode ? masterConnected : (isFyersConnected || recentTick),
        hasAccessToken: (!!activeAccessToken && !isTokenExpiredError),
        tokenExpired: !!isTokenExpiredError,
        wsInstanceExists: !!wsInstance,
        lastDataSocketError: lastDataSocketError,
        subscriptions: Array.from(clientSubscriptions),
        lastTickTime: new Date(lastTickTime).toISOString(),
        secondsSinceLastTick: (Date.now() - lastTickTime) / 1000,
        fyersToRequestedMap: globalFyersToRequested
    };
}

function updateWorkerTickTime() {
    lastTickTime = Date.now();
}

module.exports = {
    updateWorkerTickTime,
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
    handlePingSubscriptions,
    getFyersStatus,
    toFyersSymbol,
    fromFyersSymbol
};

// Background task to poll mutual fund NAVs from mfapi.in
setInterval(async () => {
    if (typeof mfSubscriptions === 'undefined' || mfSubscriptions.size === 0) return;
    const axios = require('axios');
    const updates = {};
    const LEGACY_MF_MAP = {
        'EDEL-MF': '118615',
        'MIRA-MF': '118825',
        'NIPP-MF': '118778',
        'EDEL': '118615',
        'MIRA': '118825',
        'NIPP': '118778'
    };
    for (const sym of mfSubscriptions) {
        try {
            const rawCode = sym.replace('-MF', '').replace('BSE:', '').replace('NSE:', '');
            const mfCode = LEGACY_MF_MAP[sym] || LEGACY_MF_MAP[rawCode] || rawCode;
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
    if (Object.keys(updates).length > 0 && typeof isMasterNode !== 'undefined' && isMasterNode && typeof global_io !== 'undefined' && global_io) {
        global_io.emit('price_update', updates);
    } else if (Object.keys(updates).length > 0 && typeof isMasterNode !== 'undefined' && !isMasterNode) {
        try { 
            const { pubClient } = require('./redisClient');
            pubClient.publish('fyers_ws_tick', JSON.stringify(updates)); 
        } catch (e) {}
    }
}, 43200000); // Poll every 12 hours (Mutual Funds update NAV daily)
