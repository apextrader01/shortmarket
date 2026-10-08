const fs = require('fs');
const path = require('path');
const https = require('https');
const zlib = require('zlib');

const FYERS_URLS = [
    'https://public.fyers.in/sym_details/NSE_FO.csv',
    'https://public.fyers.in/sym_details/BSE_FO.csv',
    'https://public.fyers.in/sym_details/MCX_COM.csv',
    'https://public.fyers.in/sym_details/NSE_CM.csv',
    'https://public.fyers.in/sym_details/BSE_CM.csv'
];

function downloadCSVOnce(url, timeoutMs = 45000) {
    return new Promise((resolve, reject) => {
        const req = https.get(url, {
            timeout: timeoutMs,
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                'Accept': 'text/csv,*/*',
                'Accept-Encoding': 'gzip, deflate'
            }
        }, (res) => {
            if (res.statusCode !== 200) {
                res.resume();
                return reject(new Error(`Failed to fetch ${url} (HTTP ${res.statusCode})`));
            }
            const encoding = (res.headers['content-encoding'] || '').toLowerCase();
            let stream = res;
            if (encoding === 'gzip') {
                stream = res.pipe(zlib.createGunzip());
            } else if (encoding === 'deflate') {
                stream = res.pipe(zlib.createInflate());
            }
            const chunks = [];
            stream.on('data', chunk => chunks.push(chunk));
            stream.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
            stream.on('error', reject);
        });
        req.on('timeout', () => {
            req.destroy(new Error(`Timeout fetching ${url} after ${timeoutMs}ms`));
        });
        req.on('error', reject);
    });
}

async function downloadCSV(url, retries = 3) {
    for (let attempt = 1; attempt <= retries; attempt++) {
        try {
            return await downloadCSVOnce(url, 60000);
        } catch (err) {
            console.warn(`[updateOptionsMaster] Attempt ${attempt}/${retries} failed for ${url}: ${err.message}`);
            if (attempt === retries) throw err;
            await new Promise(r => setTimeout(r, 1500 * attempt));
        }
    }
}

async function updateOptionsMaster() {
    console.log('Downloading Fyers Master CSVs...');
    
    const options = {};
    const futures = {};
    const stocks = [];
    const mcxUnderlyings = new Set();
    
    let count = 0;
    let futCount = 0;

    for (const url of FYERS_URLS) {
        console.log(`Fetching ${url}...`);
        try {
            const data = await downloadCSV(url);
            const lines = data.split('\n');
            
            for (const line of lines) {
                if (!line) continue;
                const cols = line.split(',');
                if (cols.length < 17) continue;

                const desc = cols[1] ? cols[1].trim() : '';
                let lotsize = parseInt(cols[3], 10) || 1;
                const expiryTs = parseInt(cols[8], 10) * 1000;
                const symbol = cols[9] ? cols[9].trim() : '';
                const exchToken = cols[12] ? cols[12].trim() : '';
                const underlying = cols[13] ? cols[13].trim() : '';

                if (url.includes('MCX_COM')) {
                    if (underlying) mcxUnderlyings.add(underlying);
                    const mcxLotSizes = { 
                        'NATURALGAS': 1250, 'NATGASMINI': 250, 
                        'CRUDEOIL': 100, 'CRUDEOILM': 10, 
                        'GOLD': 100, 'GOLDM': 10, 'GOLDPETAL': 1, 'GOLDGUINEA': 1, 'GOLDTEN': 1,
                        'SILVER': 30, 'SILVERM': 5, 'SILVERMIC': 1, 'SILVER100': 100, 
                        'COPPER': 2500, 'ZINC': 5000, 'ZINCMINI': 1000, 
                        'LEAD': 5000, 'LEADMINI': 1000, 
                        'ALUMINIUM': 5000, 'ALUMINI': 1000, 
                        'MENTHAOIL': 360, 'COTTON': 25, 'COTTONCNDL': 25 
                    };
                    if ((!lotsize || lotsize <= 1) && mcxLotSizes[underlying]) {
                        lotsize = mcxLotSizes[underlying];
                    }
                }

                const strikeStr = cols[15];
                const strike = parseFloat(strikeStr);
                const optType = cols[16] ? cols[16].trim() : ''; // CE, PE, XX (Futures)
                const exchPrefix = symbol.split(':')[0] || '';

                if (!symbol || !underlying) continue;

                // Stocks / Spots (NSE_CM, BSE_CM)
                if (url.includes('_CM')) {
                    stocks.push({
                        token: exchToken,
                        symbol: symbol,
                        name: underlying,
                        description: desc,
                        exchange: exchPrefix,
                        lotsize: lotsize
                    });
                    continue;
                }

                // Options (CE/PE)
                if (optType === 'CE' || optType === 'PE') {
                    if (!options[underlying]) options[underlying] = {};
                    
                    const d = new Date(expiryTs);
                    const expiryStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

                    if (!options[underlying][expiryStr]) options[underlying][expiryStr] = {};
                    if (!options[underlying][expiryStr][strike]) options[underlying][expiryStr][strike] = { CE: null, PE: null };

                    options[underlying][expiryStr][strike][optType] = {
                        token: exchToken,
                        symbol: symbol, // NSE:RELIANCE26AUG1060PE
                        lotsize: lotsize,
                        exch_seg: exchPrefix,
                        description: desc,
                        expiryTimestamp: expiryTs
                    };
                    count++;
                }

                // Futures (XX)
                if (optType === 'XX' && !url.includes('_CM')) {
                    if (!futures[underlying]) futures[underlying] = [];
                    
                    const d = new Date(expiryTs);
                    const expiryStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

                    futures[underlying].push({
                        token: exchToken,
                        symbol: symbol,
                        expiry: expiryStr,
                        lotsize: lotsize,
                        exchange: exchPrefix,
                        description: desc,
                        expiryTimestamp: expiryTs
                    });
                    futCount++;
                }
            }
        } catch (e) {
            console.error(`Error processing ${url}:`, e);
        }
    }

    // Sort futures chronologically first and filter out expired futures so nearest active contract is always at index 0
    const today = new Date();
    const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
    for (const name of Object.keys(futures)) {
        futures[name].sort((a, b) => a.expiryTimestamp - b.expiryTimestamp);
        const active = futures[name].filter(f => f.expiry >= todayStr);
        if (active.length > 0) {
            futures[name] = active;
        }
    }

    // Generate lotsizeMap.json using the nearest active expiry (sorted chronologically)
    // Seed with existing lotsizeMap on disk so a transient failure on one CSV never wipes existing lot sizes
    let lotsizeMap = {};
    const backendMapPath = path.join(__dirname, 'lotsizeMap.json');
    try {
        if (fs.existsSync(backendMapPath)) {
            lotsizeMap = JSON.parse(fs.readFileSync(backendMapPath, 'utf8')) || {};
        }
    } catch (_) {}

    for (const underlying of Object.keys(options)) {
        const allExps = Object.keys(options[underlying]).sort();
        const activeExps = allExps.filter(e => e >= todayStr);
        const targetExp = activeExps[0] || allExps[allExps.length - 1];
        if (targetExp) {
            const firstStrike = Object.keys(options[underlying][targetExp])[0];
            if (firstStrike) {
                const item = options[underlying][targetExp][firstStrike].CE || options[underlying][targetExp][firstStrike].PE;
                if (item && item.lotsize) lotsizeMap[underlying] = Number(item.lotsize) || 1;
            }
        }
    }
    for (const underlying of Object.keys(futures)) {
        if (futures[underlying] && futures[underlying].length > 0) {
            const activeFut = futures[underlying].find(f => f.expiry >= todayStr) || futures[underlying][0];
            if (activeFut && activeFut.lotsize && (!options[underlying] || !lotsizeMap[underlying])) {
                lotsizeMap[underlying] = Number(activeFut.lotsize) || 1;
            }
        }
    }

    // ⚡ Slim options data: keep active expiries & ATM ± strikes (slims from 16MB to ~2.6MB)
    const { slim: slimmedOptions, keptCount } = slimOptionsData(options, mcxUnderlyings);
    if (keptCount > 0) {
        fs.writeFileSync(path.join(__dirname, 'options.json'), JSON.stringify(slimmedOptions));
        console.log(`Saved ${keptCount} Option contracts to options.json (Slimmed from ${count} contracts)!`);
    }

    fs.writeFileSync(path.join(__dirname, 'spots.json'), '{}');

    if (futCount > 0) {
        fs.writeFileSync(path.join(__dirname, 'futures.json'), JSON.stringify(futures));
        console.log(`Saved ${futCount} Future contracts to futures.json!`);
    }

    if (stocks.length > 0) {
        fs.writeFileSync(path.join(__dirname, 'stocks.json'), JSON.stringify(stocks));
        console.log(`Saved ${stocks.length} Stock contracts to stocks.json!`);
    }

    if (Object.keys(lotsizeMap).length > 0) {
        fs.writeFileSync(backendMapPath, JSON.stringify(lotsizeMap, null, 2));
        console.log(`Saved ${Object.keys(lotsizeMap).length} lot sizes to backend lotsizeMap.json!`);

        const frontendMapPath = path.join(__dirname, '..', '..', 'frontend', 'src', 'utils', 'lotsizeMap.json');
        if (fs.existsSync(path.dirname(frontendMapPath))) {
            fs.writeFileSync(frontendMapPath, JSON.stringify(lotsizeMap, null, 2));
            console.log(`Saved ${Object.keys(lotsizeMap).length} lot sizes to frontend lotsizeMap.json!`);
        }

        await syncNseFreezeLimits(lotsizeMap);
    }
}

async function syncNseFreezeLimits(lotsizeMap = {}) {
    const backendFreezePath = path.join(__dirname, 'freezeLimitsConfig.json');
    const frontendFreezePath = path.join(__dirname, '..', '..', 'frontend', 'src', 'utils', 'freezeLimitsConfig.json');

    let config = {
        INDEX_MAX_LOTS: {
            BANKNIFTY: 48,
            NIFTY: 54,
            FINNIFTY: 54,
            MIDCPNIFTY: 48,
            MIDCAPNIFTY: 48,
            NIFTYNXT50: 45,
            NIFTYFPI: 49,
            SENSEX: 50,
            BANKEX: 30
        },
        STOCK_MAX_LOTS: 40,
        SYMBOL_FREEZE_LOTS: {},
        SYMBOL_FREEZE_QTY: {},
        COMMODITY_FREEZE_LIMITS: {
            CRUDEOIL: 10000,
            CRUDEOILM: 1000,
            NATURALGAS: 50000,
            NATURALGASM: 10000,
            GOLD: 100,
            GOLDM: 1000,
            GOLDPETAL: 10000,
            SILVER: 300,
            SILVERM: 1000,
            SILVERMIC: 10000,
            COPPER: 25000,
            ZINC: 50000,
            LEAD: 50000,
            ALUMINIUM: 50000,
            MENTHAOIL: 3600,
            COTTON: 2500,
            NICKEL: 2500
        }
    };

    try {
        if (fs.existsSync(backendFreezePath)) {
            const existing = JSON.parse(fs.readFileSync(backendFreezePath, 'utf8'));
            if (existing && typeof existing === 'object') {
                config = {
                    ...config,
                    ...existing,
                    INDEX_MAX_LOTS: { ...config.INDEX_MAX_LOTS, ...(existing.INDEX_MAX_LOTS || {}) },
                    COMMODITY_FREEZE_LIMITS: { ...config.COMMODITY_FREEZE_LIMITS, ...(existing.COMMODITY_FREEZE_LIMITS || {}) },
                    SYMBOL_FREEZE_LOTS: { ...(existing.SYMBOL_FREEZE_LOTS || {}) },
                    SYMBOL_FREEZE_QTY: { ...(existing.SYMBOL_FREEZE_QTY || {}) }
                };
            }
        }
    } catch (e) {}

    try {
        console.log('Downloading NSE F&O Freeze Limits (qtyfreeze.csv)...');
        const csvRaw = await downloadCSV('https://nsearchives.nseindia.com/content/fo/qtyfreeze.csv', 15000, 2);
        if (csvRaw) {
            const lines = csvRaw.trim().split('\n');
            let count = 0;
            const indexSet = new Set(['NIFTY', 'BANKNIFTY', 'FINNIFTY', 'MIDCPNIFTY', 'NIFTYNXT50', 'NIFTYFPI']);

            for (const line of lines) {
                const parts = line.split(',').map(s => s.trim());
                if (parts.length < 3) continue;
                const sym = parts[1].toUpperCase();
                const frzQty = parseInt(parts[2], 10);
                if (!sym || sym === 'SYMBOL' || isNaN(frzQty) || frzQty <= 0) continue;

                config.SYMBOL_FREEZE_QTY[sym] = frzQty;
                const lot = Number(lotsizeMap[sym]) || 0;
                if (lot > 0) {
                    const maxLots = Math.max(1, Math.round(frzQty / lot));
                    config.SYMBOL_FREEZE_LOTS[sym] = maxLots;
                    if (indexSet.has(sym)) {
                        config.INDEX_MAX_LOTS[sym] = maxLots;
                        if (sym === 'MIDCPNIFTY') {
                            config.INDEX_MAX_LOTS.MIDCAPNIFTY = maxLots;
                        }
                    }
                }
                count++;
            }

            if (count > 0) {
                fs.writeFileSync(backendFreezePath, JSON.stringify(config, null, 2));
                console.log(`Saved ${count} NSE Freeze Limits to backend freezeLimitsConfig.json! (NIFTY: ${config.INDEX_MAX_LOTS.NIFTY} lots, BANKNIFTY: ${config.INDEX_MAX_LOTS.BANKNIFTY} lots)`);

                if (fs.existsSync(path.dirname(frontendFreezePath))) {
                    fs.writeFileSync(frontendFreezePath, JSON.stringify(config, null, 2));
                    console.log(`Saved ${count} NSE Freeze Limits to frontend freezeLimitsConfig.json!`);
                }
            }
        }
    } catch (err) {
        console.error('Warning: Failed to sync NSE qtyfreeze.csv (preserving existing freezeLimitsConfig.json):', err.message);
    }
}

function slimOptionsData(rawOptions, mcxUnderlyings = new Set()) {
    const today = new Date();
    const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
    const indices = new Set(['NIFTY', 'BANKNIFTY', 'FINNIFTY', 'MIDCPNIFTY', 'SENSEX', 'BANKEX', 'NIFTYNXT50', 'NIFTYFPI']);
    const mcx = new Set([
        'CRUDEOIL', 'CRUDEOILM', 'NATURALGAS', 'NATGASMINI', 'GOLD', 'GOLDM', 'GOLDPETAL', 'GOLDGUINEA', 'GOLDTEN',
        'SILVER', 'SILVERM', 'SILVERMIC', 'SILVER100', 'COPPER', 'ZINC', 'ZINCMINI', 'ALUMINIUM', 'ALUMINI',
        'LEAD', 'LEADMINI', 'COTTON', 'COTTONCNDL', 'COTTONOIL', 'MENTHAOIL', 'NICKEL', 'CARDAMOM', 'KAPAS', 'STEELREBAR'
    ]);
    if (mcxUnderlyings && mcxUnderlyings.size > 0) {
        for (const u of mcxUnderlyings) mcx.add(u);
    }

    const slim = {};
    let keptCount = 0;

    for (const [u, expMap] of Object.entries(rawOptions)) {
        const isIndex = indices.has(u);
        const isMcx = mcx.has(u);
        const maxExps = isIndex ? 4 : (isMcx ? 3 : 2);

        const activeExps = Object.keys(expMap)
            .filter(e => e >= todayStr)
            .sort()
            .slice(0, maxExps);

        if (activeExps.length === 0) continue;
        slim[u] = {};

        for (const exp of activeExps) {
            slim[u][exp] = {};
            if (isIndex || isMcx) {
                // ⚡ Indices and MCX Commodities: Keep ALL strikes for active expiries.
                // Ensures all ATM/ITM/OTM strikes (e.g. SENSEX 74800, CRUDEOIL 9600, CRUDEOILM 9600) are always available.
                for (const [s, contract] of Object.entries(expMap[exp])) {
                    slim[u][exp][s] = contract;
                    if (contract.CE) keptCount++;
                    if (contract.PE) keptCount++;
                }
            } else {
                // Equities: Keep a generous strike window (±25 strikes around midpoint)
                const strikeRange = 25;
                const strikes = Object.keys(expMap[exp]).map(Number).sort((a, b) => a - b);
                const midIdx = Math.floor(strikes.length / 2);
                const start = Math.max(0, midIdx - strikeRange);
                const end = Math.min(strikes.length, midIdx + strikeRange + 1);
                const selectedStrikes = strikes.slice(start, end);

                for (const s of selectedStrikes) {
                    slim[u][exp][s] = expMap[exp][s];
                    if (expMap[exp][s].CE) keptCount++;
                    if (expMap[exp][s].PE) keptCount++;
                }
            }
        }
    }
    return { slim, keptCount };
}

if (require.main === module) {
    updateOptionsMaster();
}

module.exports = { updateOptionsMaster, slimOptionsData, syncNseFreezeLimits };

