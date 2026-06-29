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
    let count = 0;

    for (const item of data) {
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

  } catch (err) {
    console.error('Error updating options master:', err.message);
  }
}

// Allow running directly from command line
if (require.main === module) {
  updateOptionsMaster();
}

module.exports = { updateOptionsMaster };
