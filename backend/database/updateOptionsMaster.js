const fs = require('fs');
const path = require('path');

const URL = 'https://margincalculator.angelbroking.com/OpenAPI_File/files/OpenAPIScripMaster.json';
const OUTPUT_FILE = path.join(__dirname, 'options.json');

// We want ALL options (Index, Stock, Commodity, Currency)
const OPTION_TYPES = ['OPTIDX', 'OPTSTK', 'OPTFUT', 'OPTCOM', 'OPTFOC', 'OPTCUR'];

async function updateOptionsMaster() {
  console.log('Downloading Angel One Script Master...');
  try {
    const res = await fetch(URL);
    if (!res.ok) {
      throw new Error(`Failed to fetch master: ${res.statusText}`);
    }

    const data = await res.json();
    console.log(`Successfully downloaded. Total items: ${data.length}`);

    const options = {};
    const spots = {}; // To store Spot Tokens (Indices, Stocks, Commodities)
    const futures = {}; // To store Future Tokens
    let count = 0;
    let futCount = 0;

    for (const item of data) {
      // 1. Gather Option Contracts
      if (OPTION_TYPES.includes(item.instrumenttype)) {
        // Expiry format from Angel One is "27JUN2024"
        const expiry = item.expiry;
        const name = item.name;
        
        // Strike comes as "2350000.000000". Convert it back.
        const strike = parseInt(parseFloat(item.strike) / 100);

        // Identify CE or PE based on the symbol ending (e.g. NIFTY27JUN2423500CE)
        const isCE = item.symbol.endsWith('CE');
        const type = isCE ? 'CE' : 'PE';

        if (!options[name]) options[name] = {};
        if (!options[name][expiry]) options[name][expiry] = {};
        if (!options[name][expiry][strike]) options[name][expiry][strike] = { CE: null, PE: null };

        options[name][expiry][strike][type] = {
          token: item.token,
          symbol: item.symbol,
          lotsize: item.lotsize,
          exch_seg: item.exch_seg
        };
        count++;
      }
      
      // 2. Gather Spot / Underlying Contracts
      if (item.instrumenttype === 'AMXIDX' || item.instrumenttype === 'EQ' || item.instrumenttype === 'FUTCOM') {
        const uniqueKey = `${item.name}-${item.exch_seg}`;
        // For FUTCOM (Commodities), we want the nearest expiry as the Spot.
        if (item.instrumenttype === 'FUTCOM') {
          if (!spots[uniqueKey] || new Date(item.expiry) < new Date(spots[uniqueKey].expiry)) {
            spots[uniqueKey] = { token: item.token, symbol: item.symbol, name: item.name, exchange: item.exch_seg, expiry: item.expiry };
          }
        } else {
          spots[uniqueKey] = { token: item.token, symbol: item.symbol, name: item.name, exchange: item.exch_seg };
        }
      }

      // 3. Gather Futures Contracts
      if (['FUTIDX', 'FUTSTK', 'FUTCOM'].includes(item.instrumenttype)) {
        if (!futures[item.name]) futures[item.name] = [];
        futures[item.name].push({
          token: item.token,
          symbol: item.symbol,
          expiry: item.expiry,
          lotsize: item.lotsize,
          exchange: item.exch_seg
        });
        futCount++;
      }
    }

    // Sort expiries for each name
    for (const name of Object.keys(options)) {
      const expiries = Object.keys(options[name]);
      // Expiries are strings like "27JUN2024". We can sort them by parsing as Date.
      expiries.sort((a, b) => new Date(a) - new Date(b));
      
      // We only want to keep upcoming valid expiries (e.g. next 3 weeks) to keep file small
      // We'll just save all of them for now, it's not too big.
      
      const sortedOptions = {};
      for (const exp of expiries) {
        sortedOptions[exp] = options[name][exp];
      }
      options[name] = sortedOptions;
    }

    fs.writeFileSync(OUTPUT_FILE, JSON.stringify(options));
    console.log(`Saved ${count} Option contracts to options.json!`);

    fs.writeFileSync(path.join(__dirname, 'spots.json'), JSON.stringify(spots));
    console.log(`Saved ${Object.keys(spots).length} Spot contracts to spots.json!`);

    // Sort futures by expiry
    for (const name of Object.keys(futures)) {
      futures[name].sort((a, b) => new Date(a.expiry) - new Date(b.expiry));
    }
    fs.writeFileSync(path.join(__dirname, 'futures.json'), JSON.stringify(futures));
    console.log(`Saved ${futCount} Future contracts to futures.json!`);

  } catch (err) {
    console.error('Error updating options master:', err.message);
  }
}

// Allow running directly from command line
if (require.main === module) {
  updateOptionsMaster();
}

module.exports = { updateOptionsMaster };
