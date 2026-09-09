const fs = require('fs');
const path = require('path');
const https = require('https');

const FYERS_URLS = [
    'https://public.fyers.in/sym_details/NSE_FO.csv',
    'https://public.fyers.in/sym_details/BSE_FO.csv',
    'https://public.fyers.in/sym_details/MCX_COM.csv',
    'https://public.fyers.in/sym_details/NSE_CM.csv',
    'https://public.fyers.in/sym_details/BSE_CM.csv'
];

async function downloadCSV(url) {
    return new Promise((resolve, reject) => {
        https.get(url, (res) => {
            if (res.statusCode !== 200) return reject(new Error(`Failed to fetch ${url}`));
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => resolve(data));
        }).on('error', reject);
    });
}

async function updateOptionsMaster() {
    console.log('Downloading Fyers Master CSVs...');
    
    const options = {};
    const spots = {};
    const futures = {};
    const stocks = [];
    
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
                    const mcxLotSizes = { 'NATURALGAS': 1250, 'CRUDEOIL': 100, 'GOLD': 100, 'GOLDM': 10, 'SILVER': 30, 'SILVERM': 5, 'SILVERMIC': 1, 'COPPER': 2500, 'ZINC': 5000, 'LEAD': 5000, 'ALUMINIUM': 5000, 'MENTHAOIL': 360, 'COTTON': 25 };
                    if (mcxLotSizes[underlying]) lotsize = mcxLotSizes[underlying];
                }

                const strikeStr = cols[15];
                const strike = parseFloat(strikeStr);
                const optType = cols[16] ? cols[16].trim() : ''; // CE, PE, XX (Futures)
                const exchPrefix = symbol.split(':')[0] || '';

                if (!symbol || !underlying) continue;

                // Stocks / Spots (NSE_CM, BSE_CM)
                if (url.includes('_CM')) {
                    const uniqueKey = `${underlying}-${exchPrefix}`;
                    spots[uniqueKey] = {
                        token: exchToken,
                        symbol: symbol,
                        name: underlying,
                        description: desc,
                        exchange: exchPrefix
                    };
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

    // Generate lotsizeMap.json for frontend
    const lotsizeMap = {};
    for (const underlying of Object.keys(options)) {
        const firstExp = Object.keys(options[underlying])[0];
        if (firstExp) {
            const firstStrike = Object.keys(options[underlying][firstExp])[0];
            if (firstStrike) {
                const item = options[underlying][firstExp][firstStrike].CE || options[underlying][firstExp][firstStrike].PE;
                if (item && item.lotsize) lotsizeMap[underlying] = item.lotsize;
            }
        }
    }
    for (const underlying of Object.keys(futures)) {
        if (!lotsizeMap[underlying] && futures[underlying][0] && futures[underlying][0].lotsize) {
            lotsizeMap[underlying] = futures[underlying][0].lotsize;
        }
    }

    // ⚡ Slim options data: keep active expiries & ATM ± strikes (slims from 16MB to ~2.6MB)
    const { slim: slimmedOptions, keptCount } = slimOptionsData(options);
    fs.writeFileSync(path.join(__dirname, 'options.json'), JSON.stringify(slimmedOptions));
    console.log(`Saved ${keptCount} Option contracts to options.json (Slimmed from ${count} contracts)!`);

    fs.writeFileSync(path.join(__dirname, 'spots.json'), JSON.stringify(spots));
    console.log(`Saved ${Object.keys(spots).length} Spot contracts to spots.json!`);

    for (const name of Object.keys(futures)) {
        futures[name].sort((a, b) => a.expiryTimestamp - b.expiryTimestamp);
    }
    fs.writeFileSync(path.join(__dirname, 'futures.json'), JSON.stringify(futures));
    console.log(`Saved ${futCount} Future contracts to futures.json!`);

    fs.writeFileSync(path.join(__dirname, 'stocks.json'), JSON.stringify(stocks));
    console.log(`Saved ${stocks.length} Stock contracts to stocks.json!`);

    const backendMapPath = path.join(__dirname, 'lotsizeMap.json');
    fs.writeFileSync(backendMapPath, JSON.stringify(lotsizeMap, null, 2));
    console.log(`Saved ${Object.keys(lotsizeMap).length} lot sizes to backend lotsizeMap.json!`);

    const frontendMapPath = path.join(__dirname, '..', '..', 'frontend', 'src', 'utils', 'lotsizeMap.json');
    if (fs.existsSync(path.dirname(frontendMapPath))) {
        fs.writeFileSync(frontendMapPath, JSON.stringify(lotsizeMap, null, 2));
        console.log(`Saved ${Object.keys(lotsizeMap).length} lot sizes to frontend lotsizeMap.json!`);
    }
}

function slimOptionsData(rawOptions) {
    const today = new Date();
    const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
    const indices = new Set(['NIFTY', 'BANKNIFTY', 'FINNIFTY', 'MIDCPNIFTY', 'SENSEX', 'BANKEX']);
    const mcx = new Set(['CRUDEOIL', 'NATURALGAS', 'GOLD', 'GOLDM', 'SILVER', 'SILVERM', 'COPPER', 'ZINC', 'ALUMINIUM', 'LEAD', 'COTTONCNDL', 'MENTHAOIL']);

    const slim = {};
    let keptCount = 0;

    for (const [u, expMap] of Object.entries(rawOptions)) {
        const isIndex = indices.has(u);
        const isMcx = mcx.has(u);
        const maxExps = isIndex ? 3 : (isMcx ? 2 : 2);
        const strikeRange = isIndex ? 15 : (isMcx ? 12 : 8);

        const activeExps = Object.keys(expMap)
            .filter(e => e >= todayStr)
            .sort()
            .slice(0, maxExps);

        if (activeExps.length === 0) continue;
        slim[u] = {};

        for (const exp of activeExps) {
            slim[u][exp] = {};
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
    return { slim, keptCount };
}

if (require.main === module) {
    updateOptionsMaster();
}

module.exports = { updateOptionsMaster, slimOptionsData };

