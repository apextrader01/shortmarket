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
        try {
            console.log('📥 Loading Angel One instruments master from local cache...');
            const fs = require('fs');
            const path = require('path');
            const data = fs.readFileSync(path.join(__dirname, '../database/stocks.json'), 'utf8');
            const nseStocks = JSON.parse(data);

            // Add indices manually (not in EQ segment)
            const indices = {
                "99926000": { symbol: "NIFTY",     name: "Nifty 50",   exchange: "NSE" },
                "99926009": { symbol: "BANKNIFTY", name: "Bank Nifty",  exchange: "NSE" },
                "99926037": { symbol: "MIDCPNIFTY",name: "MidCap Nifty",exchange: "NSE" },
                "99926074": { symbol: "FINNIFTY",  name: "Fin Nifty",   exchange: "NSE" },
            };

            STOCK_MASTER = { ...indices };
            symbolToToken = {};

            // Add indices to reverse map
            for (const [token, info] of Object.entries(indices)) {
                const uniqueSymbol = `${info.symbol}-${info.exchange}`;
                info.uniqueSymbol = uniqueSymbol;
                symbolToToken[uniqueSymbol] = token;
            }

            // Add all stocks (NSE and BSE)
            for (const stock of nseStocks) {
                // If the symbol ends with -EQ (NSE), strip it for cleanliness
                const rawSymbol = stock.symbol.endsWith('-EQ') ? stock.symbol.replace('-EQ', '') : stock.symbol;
                const uniqueSymbol = `${rawSymbol}-${stock.exchange}`;
                
                STOCK_MASTER[stock.token] = {
                    symbol: rawSymbol,
                    name: stock.name,
                    exchange: stock.exchange,
                    uniqueSymbol
                };
                symbolToToken[uniqueSymbol] = stock.token;
            }

            allTokens = Object.keys(STOCK_MASTER);
            console.log(`✅ Loaded ${allTokens.length} instruments (${nseStocks.length} total stocks)`);
            resolve();
        } catch (e) {
            console.error('Failed to load local instrument master:', e.message);
            loadFallbackMaster();
            resolve();
        }
    });
}


function loadFallbackMaster() {
    console.log('⚠️  Using fallback stock list (200+ top NSE stocks)');
    STOCK_MASTER = {
        // ── Indices ─────────────────────────────────────────────────────────
        "99926000": { symbol: "NIFTY",       name: "Nifty 50",           exchange: "NSE" },
        "99926009": { symbol: "BANKNIFTY",   name: "Bank Nifty",          exchange: "NSE" },
        "99926037": { symbol: "MIDCPNIFTY",  name: "MidCap Nifty",        exchange: "NSE" },
        "99926074": { symbol: "FINNIFTY",    name: "Fin Nifty",            exchange: "NSE" },
        // ── Large Cap ───────────────────────────────────────────────────────
        "2885":     { symbol: "RELIANCE",    name: "Reliance Ind.",        exchange: "NSE" },
        "11536":    { symbol: "TCS",         name: "Tata Cons. Serv.",     exchange: "NSE" },
        "1594":     { symbol: "INFY",        name: "Infosys",              exchange: "NSE" },
        "3045":     { symbol: "SBIN",        name: "State Bank India",     exchange: "NSE" },
        "1333":     { symbol: "HDFCBANK",    name: "HDFC Bank",            exchange: "NSE" },
        "1660":     { symbol: "ICICIBANK",   name: "ICICI Bank",           exchange: "NSE" },
        "10604":    { symbol: "KOTAKBANK",   name: "Kotak Mahindra",       exchange: "NSE" },
        "11483":    { symbol: "WIPRO",       name: "Wipro",                exchange: "NSE" },
        "236":      { symbol: "BAJFINANCE",  name: "Bajaj Finance",        exchange: "NSE" },
        "7229":     { symbol: "HCLTECH",     name: "HCL Tech",             exchange: "NSE" },
        "2031":     { symbol: "MARUTI",      name: "Maruti Suzuki",        exchange: "NSE" },
        "3787":     { symbol: "SUNPHARMA",   name: "Sun Pharma",           exchange: "NSE" },
        "20374":    { symbol: "BHARTIARTL",  name: "Bharti Airtel",        exchange: "NSE" },
        "14977":    { symbol: "ADANIENT",    name: "Adani Enterprises",    exchange: "NSE" },
        "25":       { symbol: "ADANIPORTS",  name: "Adani Ports",          exchange: "NSE" },
        "16675":    { symbol: "ADANIPOWER",  name: "Adani Power",          exchange: "NSE" },
        "15083":    { symbol: "ADANIGREEN",  name: "Adani Green Energy",   exchange: "NSE" },
        "317":      { symbol: "BAJAJ-AUTO",  name: "Bajaj Auto",           exchange: "NSE" },
        "16669":    { symbol: "BAJAJFINSV",  name: "Bajaj Finserv",        exchange: "NSE" },
        "526":      { symbol: "BRITANNIA",   name: "Britannia Ind.",        exchange: "NSE" },
        "910":      { symbol: "CIPLA",       name: "Cipla",                exchange: "NSE" },
        "1232":     { symbol: "DRREDDY",     name: "Dr. Reddy's Labs",     exchange: "NSE" },
        "2276":     { symbol: "NESTLEIND",   name: "Nestle India",         exchange: "NSE" },
        "17963":    { symbol: "POWERGRID",   name: "Power Grid Corp",      exchange: "NSE" },
        "2303":     { symbol: "NTPC",        name: "NTPC",                 exchange: "NSE" },
        "4963":     { symbol: "TECHM",       name: "Tech Mahindra",        exchange: "NSE" },
        "3456":     { symbol: "SHREECEM",    name: "Shree Cement",         exchange: "NSE" },
        "794":      { symbol: "COALINDIA",   name: "Coal India",           exchange: "NSE" },
        "383":      { symbol: "BPCL",        name: "BPCL",                 exchange: "NSE" },
        "1394":     { symbol: "INDUSINDBK",  name: "IndusInd Bank",        exchange: "NSE" },
        "1082":     { symbol: "DIVISLAB",    name: "Divi's Laboratories",  exchange: "NSE" },
        "3506":     { symbol: "TITAN",       name: "Titan Company",        exchange: "NSE" },
        "14413":    { symbol: "ULTRACEMCO",  name: "UltraTech Cement",     exchange: "NSE" },
        "2939":     { symbol: "ONGC",        name: "ONGC",                 exchange: "NSE" },
        "10940":    { symbol: "LT",          name: "Larsen & Toubro",      exchange: "NSE" },
        "5258":     { symbol: "ASIANPAINT",  name: "Asian Paints",         exchange: "NSE" },
        "1348":     { symbol: "HINDALCO",    name: "Hindalco Ind.",         exchange: "NSE" },
        "1394":     { symbol: "ITC",         name: "ITC",                  exchange: "NSE" },
        "5900":     { symbol: "HDFCLIFE",    name: "HDFC Life Insurance",  exchange: "NSE" },
        "21808":    { symbol: "SBILIFE",     name: "SBI Life Insurance",   exchange: "NSE" },
        "4717":     { symbol: "TATAMOTORS",  name: "Tata Motors",          exchange: "NSE" },
        "3506":     { symbol: "TATASTEEL",   name: "Tata Steel",           exchange: "NSE" },
        // ── Mid Cap ─────────────────────────────────────────────────────────
        "5215":     { symbol: "ZOMATO",      name: "Zomato",               exchange: "NSE" },
        "6705":     { symbol: "NYKAA",       name: "FSN E-Commerce (Nykaa)",exchange: "NSE"},
        "6066":     { symbol: "PAYTM",       name: "One97 Communications", exchange: "NSE" },
        "16782":    { symbol: "IRCTC",       name: "IRCTC",                exchange: "NSE" },
        "3001":     { symbol: "PNB",         name: "Punjab National Bank", exchange: "NSE" },
        "1195":     { symbol: "FEDERALBNK",  name: "Federal Bank",         exchange: "NSE" },
        "2142":     { symbol: "MUTHOOTFIN",  name: "Muthoot Finance",      exchange: "NSE" },
        "5633":     { symbol: "CHOLAFIN",    name: "Cholamandalam Finance",exchange: "NSE" },
        "13611":    { symbol: "RECLTD",      name: "REC Limited",          exchange: "NSE" },
        "3580":     { symbol: "PFC",         name: "Power Finance Corp",   exchange: "NSE" },
        "17818":    { symbol: "IRFC",        name: "Indian Railway Fin.",  exchange: "NSE" },
        "3324":     { symbol: "SAIL",        name: "Steel Auth. of India", exchange: "NSE" },
        "2142":     { symbol: "NHPC",        name: "NHPC",                 exchange: "NSE" },
        "14366":    { symbol: "TATAPOWER",   name: "Tata Power",           exchange: "NSE" },
        "5097":     { symbol: "SUZLON",      name: "Suzlon Energy",        exchange: "NSE" },
        "3063":     { symbol: "OBEROIRLTY",  name: "Oberoi Realty",        exchange: "NSE" },
        "2142":     { symbol: "PRESTIGE",    name: "Prestige Estates",     exchange: "NSE" },
        "4668":     { symbol: "GODREJPROP",  name: "Godrej Properties",    exchange: "NSE" },
        "15141":    { symbol: "DMART",       name: "Avenue Supermarts",    exchange: "NSE" },
        "2142":     { symbol: "TRENT",       name: "Trent",                exchange: "NSE" },
        "3365":     { symbol: "JUBLFOOD",    name: "Jubilant FoodWorks",   exchange: "NSE" },
        "4536":     { symbol: "VOLTAS",      name: "Voltas",               exchange: "NSE" },
        "3063":     { symbol: "HAVELLS",     name: "Havells India",        exchange: "NSE" },
        "11630":    { symbol: "ABB",         name: "ABB India",            exchange: "NSE" },
        "438":      { symbol: "CUMMINSIND",  name: "Cummins India",        exchange: "NSE" },
        "2031":     { symbol: "MOTHERSON",   name: "Samvardhana Motherson",exchange: "NSE" },
        "15355":    { symbol: "POLYCAB",     name: "Polycab India",        exchange: "NSE" },
        "3296":     { symbol: "PIIND",       name: "PI Industries",        exchange: "NSE" },
        "856":      { symbol: "COROMANDEL",  name: "Coromandel Int.",      exchange: "NSE" },
        "3165":     { symbol: "UPL",         name: "UPL",                  exchange: "NSE" },
        "6363":     { symbol: "LTIM",        name: "LTIMindtree",          exchange: "NSE" },
        "9764":     { symbol: "MPHASIS",     name: "Mphasis",              exchange: "NSE" },
        "18680":    { symbol: "PERSISTENT",  name: "Persistent Systems",   exchange: "NSE" },
        "5148":     { symbol: "COFORGE",     name: "Coforge",              exchange: "NSE" },
        "3721":     { symbol: "KPITTECH",    name: "KPIT Technologies",    exchange: "NSE" },
        "6472":     { symbol: "ZEEL",        name: "Zee Entertainment",    exchange: "NSE" },
        "3329":     { symbol: "SUNTVNETWORK",name: "Sun TV Network",        exchange: "NSE" },
        "2952":     { symbol: "PIDILITIND",  name: "Pidilite Industries",  exchange: "NSE" },
        "3696":     { symbol: "BERGEPAINT",  name: "Berger Paints",        exchange: "NSE" },
        "3726":     { symbol: "KANSAINER",   name: "Kansai Nerolac",       exchange: "NSE" },
        "1023":     { symbol: "DABUR",       name: "Dabur India",          exchange: "NSE" },
        "1099":     { symbol: "EMAMILTD",    name: "Emami",                exchange: "NSE" },
        "1586":     { symbol: "MARICO",      name: "Marico",               exchange: "NSE" },
        "3649":     { symbol: "GODREJCP",    name: "Godrej Consumer Prod.",exchange: "NSE" },
        "2283":     { symbol: "COLPAL",      name: "Colgate-Palmolive",    exchange: "NSE" },
        "1131":     { symbol: "HINDUNILVR",  name: "Hindustan Unilever",   exchange: "NSE" },
        "4244":     { symbol: "TATACONSUM",  name: "Tata Consumer Prod.",  exchange: "NSE" },
        "11195":    { symbol: "APOLLOHOSP",  name: "Apollo Hospitals",     exchange: "NSE" },
        "288":      { symbol: "BIOCON",      name: "Biocon",               exchange: "NSE" },
        "2939":     { symbol: "TORNTPHARM",  name: "Torrent Pharma",       exchange: "NSE" },
        "3721":     { symbol: "AUROPHARMA",  name: "Aurobindo Pharma",     exchange: "NSE" },
        "4668":     { symbol: "LUPIN",       name: "Lupin",                exchange: "NSE" },
        "535":      { symbol: "CADILAHC",    name: "Zydus Lifesciences",   exchange: "NSE" },
        "467":      { symbol: "ALKEM",       name: "Alkem Laboratories",   exchange: "NSE" },
        "1122":     { symbol: "LALPATHLAB",  name: "Dr. Lal PathLabs",     exchange: "NSE" },
        "2855":     { symbol: "METROPOLIS",  name: "Metropolis Healthcare",exchange: "NSE" },
        "13769":    { symbol: "FORTIS",      name: "Fortis Healthcare",    exchange: "NSE" },
        "3496":     { symbol: "MAXHEALTH",   name: "Max Healthcare",       exchange: "NSE" },
        "3631":     { symbol: "BANKBARODA",  name: "Bank of Baroda",       exchange: "NSE" },
        "3029":     { symbol: "CANBK",       name: "Canara Bank",          exchange: "NSE" },
        "4306":     { symbol: "UNIONBANK",   name: "Union Bank of India",  exchange: "NSE" },
        "3634":     { symbol: "IDFCFIRSTB",  name: "IDFC First Bank",      exchange: "NSE" },
        "13854":    { symbol: "BANDHANBNK",  name: "Bandhan Bank",         exchange: "NSE" },
        "3045":     { symbol: "AUBANK",      name: "AU Small Finance Bank",exchange: "NSE" },
        "3432":     { symbol: "RBLBANK",     name: "RBL Bank",             exchange: "NSE" },
        "4854":     { symbol: "YESBANK",     name: "Yes Bank",             exchange: "NSE" },
        "3876":     { symbol: "MANAPPURAM",  name: "Manappuram Finance",   exchange: "NSE" },
        "3698":     { symbol: "M&MFIN",      name: "M&M Financial Serv.",  exchange: "NSE" },
        "1232":     { symbol: "SHRIRAMFIN",  name: "Shriram Finance",      exchange: "NSE" },
        "13538":    { symbol: "HDFCAMC",     name: "HDFC AMC",             exchange: "NSE" },
        "15083":    { symbol: "ICICIPRULI",  name: "ICICI Prudential Life",exchange: "NSE" },
        "5215":     { symbol: "ICICIGI",     name: "ICICI Lombard",        exchange: "NSE" },
        "14977":    { symbol: "NIACL",       name: "New India Assurance",  exchange: "NSE" },
        "4963":     { symbol: "GICRE",       name: "GIC Re",               exchange: "NSE" },
        "383":      { symbol: "IOC",         name: "Indian Oil Corp",      exchange: "NSE" },
        "1394":     { symbol: "HINDPETRO",   name: "HPCL",                 exchange: "NSE" },
        "2885":     { symbol: "GAIL",        name: "GAIL India",           exchange: "NSE" },
        "2939":     { symbol: "IGL",         name: "Indraprastha Gas",     exchange: "NSE" },
        "4717":     { symbol: "MGL",         name: "Mahanagar Gas",        exchange: "NSE" },
        "2031":     { symbol: "GUJGASLTD",   name: "Gujarat Gas",          exchange: "NSE" },
        "3506":     { symbol: "PETRONET",    name: "Petronet LNG",         exchange: "NSE" },
        "11536":    { symbol: "JSPL",        name: "Jindal Steel & Power", exchange: "NSE" },
        "1594":     { symbol: "JSWSTEEL",    name: "JSW Steel",            exchange: "NSE" },
        "3045":     { symbol: "VEDL",        name: "Vedanta",              exchange: "NSE" },
        "1660":     { symbol: "HINDZINC",    name: "Hindustan Zinc",       exchange: "NSE" },
        "10604":    { symbol: "NATIONALUM",  name: "National Aluminium",   exchange: "NSE" },
        "16675":    { symbol: "NMDC",        name: "NMDC",                 exchange: "NSE" },
        "526":      { symbol: "APLAPOLLO",   name: "APL Apollo Tubes",     exchange: "NSE" },
        "910":      { symbol: "JSWENERGY",   name: "JSW Energy",           exchange: "NSE" },
        "2276":     { symbol: "TORNTPOWER",  name: "Torrent Power",        exchange: "NSE" },
        "794":      { symbol: "CESC",        name: "CESC",                 exchange: "NSE" },
        "17963":    { symbol: "SJVN",        name: "SJVN",                 exchange: "NSE" },
        "2303":     { symbol: "IREDA",       name: "IREDA",                exchange: "NSE" },
        "3001":     { symbol: "NPTC",        name: "NPTC",                 exchange: "NSE" },
        "5633":     { symbol: "DLF",         name: "DLF",                  exchange: "NSE" },
        "1195":     { symbol: "MAHLIFE",     name: "Mahindra Lifespace",   exchange: "NSE" },
        "13611":    { symbol: "SOBHA",       name: "Sobha",                exchange: "NSE" },
        "3580":     { symbol: "SUNTECK",     name: "Sunteck Realty",       exchange: "NSE" },
        "17818":    { symbol: "M&M",         name: "Mahindra & Mahindra",  exchange: "NSE" },
        "3324":     { symbol: "ASHOKLEY",    name: "Ashok Leyland",        exchange: "NSE" },
        "14366":    { symbol: "EICHERMOT",   name: "Eicher Motors",        exchange: "NSE" },
        "5097":     { symbol: "EXIDEIND",    name: "Exide Industries",     exchange: "NSE" },
        "3063":     { symbol: "BOSCHLTD",    name: "Bosch",                exchange: "NSE" },
        "4668":     { symbol: "SCHAEFFLER",  name: "Schaeffler India",     exchange: "NSE" },
        "2142":     { symbol: "MINDA",       name: "Minda Industries",     exchange: "NSE" },
        "3365":     { symbol: "AAPL",        name: "Apollo Tyres",         exchange: "NSE" },
        "4536":     { symbol: "BALKRISIND",  name: "Balkrishna Industries",exchange: "NSE" },
        "3063":     { symbol: "CEAT",        name: "CEAT",                 exchange: "NSE" },
        "11630":    { symbol: "MRF",         name: "MRF",                  exchange: "NSE" },
        "438":      { symbol: "ASALCBR",     name: "Associated Alcohols",  exchange: "NSE" },
        "15355":    { symbol: "UBL",         name: "United Breweries",     exchange: "NSE" },
        "3296":     { symbol: "RADICO",      name: "Radico Khaitan",       exchange: "NSE" },
        "856":      { symbol: "UNITDSPR",    name: "United Spirits",       exchange: "NSE" },
        "3165":     { symbol: "VBL",         name: "Varun Beverages",      exchange: "NSE" },
        "6363":     { symbol: "PGHH",        name: "Procter & Gamble",     exchange: "NSE" },
        "9764":     { symbol: "3MINDIA",     name: "3M India",             exchange: "NSE" },
        "18680":    { symbol: "HONAUT",      name: "Honeywell Automation",exchange: "NSE" },
        "5148":     { symbol: "SIEMENS",     name: "Siemens",              exchange: "NSE" },
        "3721":     { symbol: "BHEL",        name: "Bharat Heavy Electicals",exchange: "NSE" },
        "6472":     { symbol: "BEL",         name: "Bharat Electronics",   exchange: "NSE" },
        "3329":     { symbol: "HAL",         name: "Hindustan Aeronautics",exchange: "NSE" },
        "2952":     { symbol: "BDL",         name: "Bharat Dynamics",      exchange: "NSE" },
        "3696":     { symbol: "COCHINSHIP",  name: "Cochin Shipyard",      exchange: "NSE" },
        "3726":     { symbol: "MAZDOCK",     name: "Mazagon Dock",         exchange: "NSE" },
        "1023":     { symbol: "GRSE",        name: "Garden Reach Shipbuilders",exchange:"NSE"},
        "1099":     { symbol: "DATAPATTNS",  name: "Data Patterns",        exchange: "NSE" },
        "1586":     { symbol: "DIXON",       name: "Dixon Technologies",   exchange: "NSE" },
        "3649":     { symbol: "AMBER",       name: "Amber Enterprises",    exchange: "NSE" },
        "2283":     { symbol: "SYRMA",       name: "Syrma SGS Technology", exchange: "NSE" },
        "1131":     { symbol: "CAMPUS",      name: "Campus Activewear",    exchange: "NSE" },
        "4244":     { symbol: "DOMS",        name: "DOMS Industries",      exchange: "NSE" },
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

let global_web_socket = null;
const clientSubscriptions = new Set();

async function addSubscription(data, io, priceCache) {
    let token, exchangeCode, uniqueSymbol, exchStr;

    if (typeof data === 'string') {
        uniqueSymbol = data;
        if (!symbolToToken[uniqueSymbol]) return;
        token = symbolToToken[uniqueSymbol];
        exchStr = STOCK_MASTER[token]?.exchange || 'NSE';
        exchangeCode = exchStr === 'BSE' ? 3 : 1;
    } else {
        token = data.token;
        uniqueSymbol = data.symbol;
        exchStr = data.exchange || 'NFO'; // e.g. 'NFO'
        exchangeCode = (exchStr === 'BSE' || exchStr === 'BFO') ? 3 : (exchStr === 'MCX' ? 5 : (exchStr === 'NFO' ? 2 : 1));
        
        // Dynamically add to STOCK_MASTER so processTick works
        if (!STOCK_MASTER[token]) {
            STOCK_MASTER[token] = { symbol: data.symbol, uniqueSymbol: data.symbol, name: data.name || data.symbol, exchange: exchStr };
            symbolToToken[uniqueSymbol] = token;
        }
    }

    if (!clientSubscriptions.has(token)) {
        clientSubscriptions.add(token);
        
        // If websocket is running, dynamically subscribe to the new token
        if (global_web_socket) {
            global_web_socket.fetchData({
                correlationID: `dynamic_sub_${token}`,
                action: 1, mode: 1, exchangeType: exchangeCode, tokens: [token]
            });
        }

        // Immediately fetch the price via REST to remove the 10-second delay
        try {
            const exchangeMap = { NSE: [], BSE: [], NFO: [], BFO: [] };
            if (exchangeMap[exchStr]) {
                exchangeMap[exchStr].push(token);
                const res = await smart_api.marketData({ mode: 'LTP', exchangeTokens: exchangeMap });
                if (res?.status && res.data?.fetched && res.data.fetched.length > 0) {
                    const item = res.data.fetched[0];
                    if (item.ltp && priceCache) {
                        const ltpData = {
                            symbol: uniqueSymbol,
                            ltp: item.ltp,
                            open: item.open || item.ltp,
                            high: item.high || item.ltp,
                            low: item.low || item.ltp,
                            close: item.close || item.ltp,
                            change: item.netChange || 0,
                            pct: item.percentChange || 0,
                            timestamp: new Date().toISOString()
                        };
                        priceCache[uniqueSymbol] = ltpData;
                        if (io) io.to(uniqueSymbol).emit('market_data', ltpData);
                    }
                }
            }
        } catch (e) {} // silent on fail
    }
}

// ─── Fetch specific LTPs on demand (for search results) ──────────────────────
async function fetchBatchLTPs(uniqueSymbols) {
    const exchangeMap = { NSE: [], BSE: [], NFO: [], BFO: [] };
    const tokensRequested = [];
    
    uniqueSymbols.slice(0, 50).forEach(sym => {
        const token = symbolToToken[sym];
        if (token) {
            const exch = STOCK_MASTER[token]?.exchange || 'NSE';
            if (exchangeMap[exch]) {
                exchangeMap[exch].push(token);
                tokensRequested.push(token);
            }
        }
    });
    
    const result = {};
    if (tokensRequested.length === 0) return result;

    try {
        const res = await smart_api.marketData({ mode: 'LTP', exchangeTokens: exchangeMap });
        if (res?.status && res.data?.fetched) {
            for (const item of res.data.fetched) {
                const info = STOCK_MASTER[item.symbolToken];
                if (info && item.ltp) {
                    result[info.uniqueSymbol] = {
                        symbol: info.uniqueSymbol,
                        ltp: item.ltp,
                        open: item.open || item.ltp,
                        high: item.high || item.ltp,
                        low: item.low || item.ltp,
                        close: item.close || item.ltp,
                        change: item.netChange || 0,
                        pct: item.percentChange || 0,
                        timestamp: new Date().toISOString()
                    };
                }
            }
        }
    } catch (e) { console.error('fetchBatchLTPs error', e.message); }
    return result;
}

// ─── Fetch LTPs in batches (API limit ~50 tokens per call) ───────────────────
async function fetchAllLTPs() {
    const BATCH_SIZE = 50;
    const result = {};
    
    // Poll top 300 tokens AND any tokens clients are actively subscribed to
    const baseTokens = allTokens.slice(0, 300);
    const tokensToFetch = Array.from(new Set([...baseTokens, ...clientSubscriptions]));

    for (let i = 0; i < tokensToFetch.length; i += BATCH_SIZE) {
        const batch = tokensToFetch.slice(i, i + BATCH_SIZE);
        const exchangeMap = { NSE: [], BSE: [] };
        
        batch.forEach(token => {
            const exch = STOCK_MASTER[token]?.exchange || 'NSE';
            if (exchangeMap[exch]) exchangeMap[exch].push(token);
        });

        try {
            const res = await smart_api.marketData({
                mode: 'LTP',
                exchangeTokens: exchangeMap
            });
            if (res?.status && res.data?.fetched) {
                for (const item of res.data.fetched) {
                    const info = STOCK_MASTER[item.symbolToken];
                    if (info && item.ltp) {
                        result[info.uniqueSymbol] = {
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
async function fetchCandleData(uniqueSymbol, interval = 'ONE_DAY') {
    const token = symbolToToken[uniqueSymbol];
    if (!token) return [];
    
    const stockInfo = STOCK_MASTER[token];
    const exchange = stockInfo ? stockInfo.exchange : 'NSE';
    
    const now = new Date();
    // Adjust lookback per Angel One API limits & usefulness
    const LOOKBACK = {
        'ONE_MINUTE':     5,    
        'THREE_MINUTE':   15,
        'FIVE_MINUTE':    30,
        'TEN_MINUTE':     60,
        'FIFTEEN_MINUTE': 60,
        'THIRTY_MINUTE':  100,
        'ONE_HOUR':       200,
        'ONE_DAY':        730,  
    };
    const lookbackDays = LOOKBACK[interval] || 60;
    const from = new Date(now.getTime() - lookbackDays * 24 * 60 * 60 * 1000);
    
    try {
        const payload = {
            exchange: exchange,
            symboltoken: token,
            interval: interval,
            fromdate: fmtDate(from),
            todate: fmtDate(now)
        };
        
        console.log(`Fetching candles for ${uniqueSymbol} with payload:`, payload);

        // Bypass SDK to ensure no token/header dropping bugs
        const response = await fetch('https://apiconnect.angelbroking.com/rest/secure/angelbroking/historical/v1/getCandleData', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${smart_api.access_token}`,
                'Content-Type': 'application/json',
                'Accept': 'application/json',
                'X-PrivateKey': process.env.ANGEL_API_KEY,
                'X-ClientLocalIP': '127.0.0.1',
                'X-ClientPublicIP': '127.0.0.1',
                'X-MACAddress': '00-00-00-00-00-00',
                'X-UserType': 'USER',
                'X-SourceID': 'WEB'
            },
            body: JSON.stringify(payload)
        });

        const res = await response.json();
        
        if (!res) {
            console.error(`fetchCandleData returned empty for ${symbol}`);
            return [];
        }
        
        if (!res.status || !res.data) {
            console.error(`Angel One historical API error for ${symbol}:`, res);
            return [];
        }
        
        // Angel One returns timestamps as IST strings ("2024-02-08T09:15:00+05:30")
        // Shift by 19800 seconds (5h 30m) so Lightweight Charts displays it correctly in IST
        return res.data.map(c => {
            const utcSeconds = Math.floor(new Date(c[0]).getTime() / 1000);
            return {
                time: utcSeconds + 19800,
                open: c[1], high: c[2], low: c[3], close: c[4], volume: c[5]
            };
        });
    } catch (e) {
        console.error(`fetchCandleData exception for ${symbol}:`, e.message);
        return [];
    }
}

// ─── Broadcast LTPs to all subscribers & update cache ───────────────────────
async function broadcastLTPs(io) {
    const { processTick } = require('./matchingEngine');
    const ltps = await fetchAllLTPs();
    const ts = new Date().toISOString();
    
    for (const [uniqueSymbol, data] of Object.entries(ltps)) {
        const entry = { symbol: uniqueSymbol, ...data, timestamp: ts };
        // Update the shared cache
        sharedPriceCache[uniqueSymbol] = entry;
        processTick(uniqueSymbol, data.ltp);
        // Emit to subscribers (socket rooms)
        io.to(uniqueSymbol).emit('market_data', entry);
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

    global_web_socket = new WebSocketV2({
        jwttoken: jwtToken,
        apikey: process.env.ANGEL_API_KEY,
        clientcode: process.env.ANGEL_CLIENT_ID,
        feedtype: feedToken
    });

    global_web_socket.connect().then(() => {
        console.log('🔌 WebSocket Connected!');

        // Subscribe in batches of 50, but max 300 base + dynamic client subs to avoid websocket overload
        const baseTokens = allTokens.slice(0, 300);
        const tokensToSubscribe = Array.from(new Set([...baseTokens, ...clientSubscriptions]));
        
        for (let i = 0; i < tokensToSubscribe.length; i += BATCH) {
            const batch = tokensToSubscribe.slice(i, i + BATCH);
            // Split into NSE and BSE
            const nseBatch = batch.filter(t => STOCK_MASTER[t]?.exchange !== 'BSE');
            const bseBatch = batch.filter(t => STOCK_MASTER[t]?.exchange === 'BSE');

            if (nseBatch.length > 0) {
                global_web_socket.fetchData({
                    correlationID: `short_market_nse_${i}`,
                    action: 1, mode: 1, exchangeType: 1, tokens: nseBatch
                });
            }
            if (bseBatch.length > 0) {
                global_web_socket.fetchData({
                    correlationID: `short_market_bse_${i}`,
                    action: 1, mode: 1, exchangeType: 3, tokens: bseBatch
                });
            }
        }

        global_web_socket.on('tick', (receiveData) => {
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

        global_web_socket.on('error', () => {
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
    addSubscription,
    fetchBatchLTPs,
    smart_api
};
