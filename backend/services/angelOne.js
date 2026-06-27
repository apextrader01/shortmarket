const { SmartAPI, WebSocketV2 } = require('smartapi-javascript');
const { TOTP } = require('totp-generator');
const https = require('https');
require('dotenv').config();

const smart_api = new SmartAPI({
    api_key: process.env.ANGEL_API_KEY
});

// ─── Price Cache (injected from server.js to ensure same reference) ──────────
let sharedPriceCache = null;

function getPriceCache() { return sharedPriceCache; }

let jwtToken = '';
let feedToken = '';

// Dynamic stock master - loaded from Angel One instrument file
let STOCK_MASTER = {};   // token -> { symbol, name, exchange }
let symbolToToken = {};  // symbol -> token
let allTokens = [];

// ─── Load all NSE stocks from Angel One master file ──────────────────────────
async function loadInstrumentMaster() {
    return new Promise((resolve) => {
        console.log('📥 Downloading Angel One instruments master...');
        const url = 'https://margincalculator.angelbroking.com/OpenAPI_File/files/OpenAPIScripMaster.json';
        
        https.get(url, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                try {
                    const arr = JSON.parse(data);
                    
                    // Add indices manually (not in EQ segment)
                    const indices = {
                        "99926000": { symbol: "NIFTY",     name: "Nifty 50",   exchange: "NSE" },
                        "99926009": { symbol: "BANKNIFTY", name: "Bank Nifty",  exchange: "NSE" },
                        "99926037": { symbol: "MIDCPNIFTY",name: "MidCap Nifty",exchange: "NSE" },
                        "99926074": { symbol: "FINNIFTY",  name: "Fin Nifty",   exchange: "NSE" },
                    };

                    // Filter NSE equity stocks only
                    const nseStocks = arr.filter(s =>
                        s.exch_seg === 'NSE' &&
                        s.symbol &&
                        s.symbol.endsWith('-EQ') &&
                        parseFloat(s.lotsize) === 1 &&
                        s.token
                    );

                    STOCK_MASTER = { ...indices };
                    symbolToToken = {};

                    // Add indices to reverse map
                    for (const [token, info] of Object.entries(indices)) {
                        symbolToToken[info.symbol] = token;
                    }

                    // Add all NSE-EQ stocks
                    for (const stock of nseStocks) {
                        const rawSymbol = stock.symbol.replace('-EQ', '');
                        STOCK_MASTER[stock.token] = {
                            symbol: rawSymbol,
                            name: stock.name,
                            exchange: 'NSE'
                        };
                        symbolToToken[rawSymbol] = stock.token;
                    }

                    allTokens = Object.keys(STOCK_MASTER);
                    console.log(`✅ Loaded ${allTokens.length} instruments (${nseStocks.length} stocks + ${Object.keys(indices).length} indices)`);
                    resolve();
                } catch (e) {
                    console.error('Failed to parse instrument master:', e.message);
                    // Fall back to a minimal set
                    loadFallbackMaster();
                    resolve();
                }
            });
        }).on('error', (e) => {
            console.error('Failed to download instrument master:', e.message);
            loadFallbackMaster();
            resolve();
        });
    });
}

function loadFallbackMaster() {
    console.log('⚠️  Using fallback minimal stock list');
    STOCK_MASTER = {
        "99926000": { symbol: "NIFTY",     name: "Nifty 50",        exchange: "NSE" },
        "99926009": { symbol: "BANKNIFTY", name: "Bank Nifty",       exchange: "NSE" },
        "2885":     { symbol: "RELIANCE",  name: "Reliance Ind.",    exchange: "NSE" },
        "11536":    { symbol: "TCS",       name: "Tata Cons. Serv.", exchange: "NSE" },
        "1594":     { symbol: "INFY",      name: "Infosys",          exchange: "NSE" },
        "3045":     { symbol: "SBIN",      name: "State Bank India", exchange: "NSE" },
        "1333":     { symbol: "HDFCBANK",  name: "HDFC Bank",        exchange: "NSE" },
        "1660":     { symbol: "ICICIBANK", name: "ICICI Bank",       exchange: "NSE" },
        "10604":    { symbol: "KOTAKBANK", name: "Kotak Mahindra",   exchange: "NSE" },
        "11483":    { symbol: "WIPRO",     name: "Wipro",            exchange: "NSE" },
        "236":      { symbol: "BAJFINANCE",name: "Bajaj Finance",    exchange: "NSE" },
        "7229":     { symbol: "HCLTECH",   name: "HCL Tech",         exchange: "NSE" },
        "2031":     { symbol: "MARUTI",    name: "Maruti Suzuki",    exchange: "NSE" },
        "3787":     { symbol: "SUNPHARMA", name: "Sun Pharma",       exchange: "NSE" },
        "20374":    { symbol: "BHARTIARTL",name: "Bharti Airtel",    exchange: "NSE" },
    };
    symbolToToken = {};
    for (const [token, info] of Object.entries(STOCK_MASTER)) {
        symbolToToken[info.symbol] = token;
    }
    allTokens = Object.keys(STOCK_MASTER);
}

// ─── Market Hours Check ───────────────────────────────────────────────────────
function isMarketOpen() {
    const now = new Date();
    const day = now.getUTCDay();
    if (day === 0 || day === 6) return false;
    
    const utcMins = now.getUTCHours() * 60 + now.getUTCMinutes();
    const istMins = utcMins + 330; // IST = UTC+5:30
    const t = istMins % (24 * 60);
    
    return t >= (9 * 60 + 15) && t <= (15 * 60 + 30);
}

// ─── Format date for API ──────────────────────────────────────────────────────
function fmtDate(d) {
    // Angel One API expects IST dates. Convert UTC → IST (UTC+5:30)
    const ist = new Date(d.getTime() + 5.5 * 60 * 60 * 1000);
    const pad = n => String(n).padStart(2, '0');
    return `${ist.getUTCFullYear()}-${pad(ist.getUTCMonth()+1)}-${pad(ist.getUTCDate())} ${pad(ist.getUTCHours())}:${pad(ist.getUTCMinutes())}`;
}

// ─── Fetch LTPs in batches (API limit ~50 tokens per call) ───────────────────
async function fetchAllLTPs() {
    const BATCH_SIZE = 50;
    const result = {};

    for (let i = 0; i < allTokens.length; i += BATCH_SIZE) {
        const batch = allTokens.slice(i, i + BATCH_SIZE);
        try {
            const res = await smart_api.marketData({
                mode: 'LTP',
                exchangeTokens: { NSE: batch }
            });
            if (res?.status && res.data?.fetched) {
                for (const item of res.data.fetched) {
                    const info = STOCK_MASTER[item.symbolToken];
                    if (info && item.ltp) {
                        result[info.symbol] = {
                            ltp: item.ltp,
                            open: item.open || item.ltp,
                            high: item.high || item.ltp,
                            low: item.low || item.ltp,
                            close: item.close || item.ltp,
                            change: item.netChange || 0,
                            pct: item.percentChange || 0,
                        };
                    }
                }
            }
        } catch (e) {
            // Silent - batch might fail for some tokens
        }
    }
    return result;
}

// ─── Fetch candle data for a symbol ──────────────────────────────────────────
async function fetchCandleData(symbol, interval = 'ONE_DAY') {
    const token = symbolToToken[symbol];
    if (!token) return [];
    
    const now = new Date();
    // Adjust lookback per Angel One API limits & usefulness
    const LOOKBACK = {
        'ONE_MINUTE':     5,    // 5 days of 1M candles
        'THREE_MINUTE':   15,
        'FIVE_MINUTE':    30,
        'TEN_MINUTE':     60,
        'FIFTEEN_MINUTE': 60,
        'THIRTY_MINUTE':  100,
        'ONE_HOUR':       200,
        'ONE_DAY':        730,  // 2 years of daily
    };
    const lookbackDays = LOOKBACK[interval] || 60;
    const from = new Date(now.getTime() - lookbackDays * 24 * 60 * 60 * 1000);
    
    try {
        const res = await smart_api.getCandleData({
            exchange: 'NSE',
            symboltoken: token,
            interval: interval,
            fromdate: fmtDate(from),
            todate: fmtDate(now)
        });
        if (!res?.status || !res.data) return [];
        // Angel One returns timestamps as IST strings ("YYYY-MM-DD HH:MM")
        // Append +05:30 so JS parses them correctly as IST instead of UTC
        return res.data.map(c => ({
            time: Math.floor(new Date(c[0].replace(' ', 'T') + '+05:30').getTime() / 1000),
            open: c[1], high: c[2], low: c[3], close: c[4], volume: c[5]
        }));
    } catch (e) {
        console.error('fetchCandleData error:', e.message);
        return [];
    }
}

// ─── Broadcast LTPs to all subscribers & update cache ───────────────────────
async function broadcastLTPs(io) {
    const { processTick } = require('./matchingEngine');
    const ltps = await fetchAllLTPs();
    const ts = new Date().toISOString();
    
    for (const [symbol, data] of Object.entries(ltps)) {
        const entry = { symbol, ...data, timestamp: ts };
        // Update the shared cache
        sharedPriceCache[symbol] = entry;
        processTick(symbol, data.ltp);
        // Emit to subscribers (socket rooms)
        io.to(symbol).emit('market_data', entry);
    }
    // Also broadcast ALL prices at once so any connected client can receive everything
    io.emit('price_snapshot', sharedPriceCache);
    console.log(`📡 Broadcast ${Object.keys(ltps).length} LTPs`);
}

// ─── Main Login ───────────────────────────────────────────────────────────────
async function loginAngelOne(io, externalPriceCache) {
    sharedPriceCache = externalPriceCache; // Use the server.js cache object
    try {
        // First load the full instrument master
        await loadInstrumentMaster();

        console.log('🔐 Logging into Angel One...');
        const { otp } = await TOTP.generate(process.env.ANGEL_TOTP_SECRET);
        const loginSession = await smart_api.generateSession(
            process.env.ANGEL_CLIENT_ID,
            process.env.ANGEL_PIN,
            otp
        );

        if (loginSession.status) {
            console.log('✅ Angel One Login Successful');
            jwtToken = loginSession.data.jwtToken;
            feedToken = loginSession.data.feedToken;

            await broadcastLTPs(io);

            if (isMarketOpen()) {
                console.log('📈 Market OPEN → Starting live WebSocket...');
                startLiveWebSocket(io);
            } else {
                console.log('📴 Market CLOSED → REST polling every 10s...');
                setInterval(() => broadcastLTPs(io), 10000);
            }
        } else {
            console.error('Login Failed:', loginSession.message);
        }
    } catch (error) {
        console.error('Error:', error.message);
    }
}

// ─── Live WebSocket ───────────────────────────────────────────────────────────
function startLiveWebSocket(io) {
    const { processTick } = require('./matchingEngine');
    const BATCH = 50; // WebSocket token limit per subscription

    const web_socket = new WebSocketV2({
        jwttoken: jwtToken,
        apikey: process.env.ANGEL_API_KEY,
        clientcode: process.env.ANGEL_CLIENT_ID,
        feedtype: feedToken
    });

    web_socket.connect().then(() => {
        console.log('🔌 WebSocket Connected!');

        // Subscribe in batches
        for (let i = 0; i < allTokens.length; i += BATCH) {
            web_socket.fetchData({
                correlationID: `short_market_${i}`,
                action: 1,
                mode: 1,
                exchangeType: 1,
                tokens: allTokens.slice(i, i + BATCH)
            });
        }

        web_socket.on('tick', (receiveData) => {
            const data = Array.isArray(receiveData) ? receiveData[0] : receiveData;
            if (!data?.token) return;
            const info = STOCK_MASTER[data.token];
            if (info && data.last_traded_price) {
                const ltp = data.last_traded_price / 100;
                processTick(info.symbol, ltp);
                io.to(info.symbol).emit('market_data', {
                    symbol: info.symbol, ltp,
                    timestamp: new Date().toISOString()
                });
            }
        });

        web_socket.on('error', () => {
            console.log('⚠️  WS error, falling back to REST polling');
            setInterval(() => broadcastLTPs(io), 10000);
        });

    }).catch(err => {
        console.error('WS connect error:', err.message);
        setInterval(() => broadcastLTPs(io), 10000);
    });
}

module.exports = {
    loginAngelOne,
    fetchCandleData,
    fetchAllLTPs,
    getPriceCache,
    get STOCK_MASTER() { return STOCK_MASTER; },
    get symbolToToken() { return symbolToToken; },
    smart_api
};
