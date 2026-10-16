// test_all_segments_symbol_parity.js
const {
  getSymbolAliases,
  toCanonicalFyersSymbol,
  isCommoditySymbol,
  isBseSymbol,
  isDerivativeSymbol,
  cleanSymbol
} = require('./backend/services/symbolUtils');

let passed = 0;
let failed = 0;

function assert(condition, message) {
  if (condition) {
    console.log(`  ✔ [PASS] ${message}`);
    passed++;
  } else {
    console.error(`  ❌ [FAIL] ${message}`);
    failed++;
  }
}

console.log('================================================================');
console.log('🧪 TESTING UNIVERSAL SYMBOL PARITY ACROSS ALL 5 SEGMENTS');
console.log('================================================================\n');

// 1. STOCKS (NSE & BSE Equities)
console.log('▶ 1. Stocks (NSE & BSE Equities)');
const stockAliases1 = getSymbolAliases('RELIANCE');
assert(stockAliases1.includes('RELIANCE'), 'RELIANCE includes raw RELIANCE');
assert(stockAliases1.includes('NSE:RELIANCE'), 'RELIANCE includes NSE:RELIANCE');
assert(stockAliases1.includes('NSE:RELIANCE-EQ'), 'RELIANCE includes NSE:RELIANCE-EQ');
assert(stockAliases1.includes('BSE:RELIANCE'), 'RELIANCE includes BSE:RELIANCE');

const stockAliases2 = getSymbolAliases('NSE:RELIANCE-EQ');
assert(stockAliases2.includes('RELIANCE'), 'NSE:RELIANCE-EQ includes clean RELIANCE');
assert(stockAliases2.includes('NSE:RELIANCE'), 'NSE:RELIANCE-EQ includes NSE:RELIANCE');
assert(stockAliases2.includes('NSE:RELIANCE-EQ'), 'NSE:RELIANCE-EQ includes NSE:RELIANCE-EQ');

const bseStockAliases = getSymbolAliases('BSE:TCS-A');
assert(bseStockAliases.includes('TCS'), 'BSE:TCS-A includes clean TCS');
assert(bseStockAliases.includes('BSE:TCS'), 'BSE:TCS-A includes BSE:TCS');
assert(bseStockAliases.includes('BSE:TCS-A'), 'BSE:TCS-A includes BSE:TCS-A');
assert(bseStockAliases.includes('NSE:TCS-EQ'), 'BSE:TCS-A includes NSE:TCS-EQ');

// Lowercase & new equity resolution
const lowerStock = getSymbolAliases('reliance');
assert(lowerStock.includes('RELIANCE'), 'lowercase reliance generates uppercase RELIANCE alias');
assert(lowerStock.includes('NSE:RELIANCE-EQ'), 'lowercase reliance generates NSE:RELIANCE-EQ alias');

const unmappedStock = toCanonicalFyersSymbol('SWIGGY');
assert(unmappedStock === 'NSE:SWIGGY-EQ', 'Unmapped equity SWIGGY defaults to NSE:SWIGGY-EQ');

const unmappedPrefixed = toCanonicalFyersSymbol('NSE:SWIGGY');
assert(unmappedPrefixed === 'NSE:SWIGGY-EQ', 'Unmapped prefixed NSE:SWIGGY resolves to NSE:SWIGGY-EQ');

const lowercaseStockFyers = toCanonicalFyersSymbol('swiggy');
assert(lowercaseStockFyers === 'NSE:SWIGGY-EQ', 'Lowercase swiggy resolves to NSE:SWIGGY-EQ');

// 2. NFO (NSE Futures & Options)
console.log('\n▶ 2. NFO (NSE Futures & Options)');
const nfoOptionAliases = getSymbolAliases('NIFTY26O1923200CE');
assert(nfoOptionAliases.includes('NIFTY26O1923200CE'), 'Option includes raw NIFTY26O1923200CE');
assert(nfoOptionAliases.includes('NSE:NIFTY26O1923200CE'), 'Option includes NSE:NIFTY26O1923200CE');
assert(nfoOptionAliases.includes('NFO:NIFTY26O1923200CE'), 'Option includes NFO:NIFTY26O1923200CE');
assert(!nfoOptionAliases.includes('NSE:NIFTY26O1923200CE-EQ'), 'Option does NOT include -EQ suffix');

const nfoPrefixed = toCanonicalFyersSymbol('NFO:NIFTY26O1923200CE');
assert(nfoPrefixed === 'NSE:NIFTY26O1923200CE', 'NFO: prefix normalizes to NSE: for Fyers');

// Stock Futures and Options
const stockFut = getSymbolAliases('RELIANCE26OCTFUT');
assert(stockFut.includes('NSE:RELIANCE26OCTFUT'), 'Stock future includes NSE: prefix');
assert(stockFut.includes('NFO:RELIANCE26OCTFUT'), 'Stock future includes NFO: prefix');
assert(!stockFut.includes('NSE:RELIANCE26OCTFUT-EQ'), 'Stock future does not add -EQ');

const stockOpt = getSymbolAliases('RELIANCE26OCT2600CE');
assert(stockOpt.includes('NSE:RELIANCE26OCT2600CE'), 'Stock option includes NSE: prefix');
assert(stockOpt.includes('NFO:RELIANCE26OCT2600CE'), 'Stock option includes NFO: prefix');
assert(!stockOpt.includes('NSE:RELIANCE26OCT2600CE-EQ'), 'Stock option does not add -EQ');

// 3. BFO (BSE Futures & Options - SENSEX & BANKEX)
console.log('\n▶ 3. BFO (BSE Futures & Options)');
const bfoOptionAliases = getSymbolAliases('SENSEX26O1675000CE');
assert(bfoOptionAliases.includes('SENSEX26O1675000CE'), 'BFO option includes raw SENSEX26O1675000CE');
assert(bfoOptionAliases.includes('BSE:SENSEX26O1675000CE'), 'BFO option includes BSE:SENSEX26O1675000CE');
assert(bfoOptionAliases.includes('BFO:SENSEX26O1675000CE'), 'BFO option includes BFO:SENSEX26O1675000CE');
assert(!bfoOptionAliases.includes('NSE:SENSEX26O1675000CE'), 'BFO option does NOT pollute with NSE: prefix');

const bfoNormalized = toCanonicalFyersSymbol('BFO:SENSEX26O1675000CE');
assert(bfoNormalized === 'BSE:SENSEX26O1675000CE', 'BFO: prefix normalizes to BSE: for Fyers');

const bfoUnprefixed = toCanonicalFyersSymbol('SENSEX26O1675000CE');
assert(bfoUnprefixed === 'BSE:SENSEX26O1675000CE', 'Unprefixed SENSEX option auto-resolves to BSE: prefix');

const bfoFut = toCanonicalFyersSymbol('SENSEX26OCTFUT');
assert(bfoFut === 'BSE:SENSEX26OCTFUT', 'SENSEX future auto-resolves to BSE: prefix');

// 4. MCX COMMODITIES & COMMODITY DERIVATIVES
console.log('\n▶ 4. MCX Commodities & Derivatives');
const crudeAliases = getSymbolAliases('CRUDEOIL26OCTFUT');
assert(crudeAliases.includes('CRUDEOIL26OCTFUT'), 'Crude includes raw CRUDEOIL26OCTFUT');
assert(crudeAliases.includes('MCX:CRUDEOIL26OCTFUT'), 'Crude includes MCX:CRUDEOIL26OCTFUT');

const natgasMiniAliases = getSymbolAliases('NATGASMINI26OCTFUT');
assert(natgasMiniAliases.includes('MCX:NATGASMINI26OCTFUT'), 'NATGASMINI correctly identified as commodity and prefixed MCX:');

const silverMicAliases = getSymbolAliases('SILVERMIC26NOVFUT');
assert(silverMicAliases.includes('MCX:SILVERMIC26NOVFUT'), 'SILVERMIC correctly identified as commodity and prefixed MCX:');

const goldPetalAliases = getSymbolAliases('GOLDPETAL26OCTFUT');
assert(goldPetalAliases.includes('MCX:GOLDPETAL26OCTFUT'), 'GOLDPETAL correctly identified as commodity and prefixed MCX:');

const mcxOption = toCanonicalFyersSymbol('CRUDEOIL26O206000CE');
assert(mcxOption === 'MCX:CRUDEOIL26O206000CE', 'MCX Option resolves to MCX: prefix');

const goldOption = toCanonicalFyersSymbol('GOLD26D0575000PE');
assert(goldOption === 'MCX:GOLD26D0575000PE', 'GOLD option resolves to MCX: prefix');

// 5. INDICES
console.log('\n▶ 5. Indices');
const niftyAliases = getSymbolAliases('NIFTY');
assert(niftyAliases.includes('NSE:NIFTY50-INDEX'), 'NIFTY includes NSE:NIFTY50-INDEX');
assert(niftyAliases.includes('NIFTY50'), 'NIFTY includes NIFTY50');

const sensexAliases = getSymbolAliases('SENSEX');
assert(sensexAliases.includes('BSE:SENSEX-INDEX'), 'SENSEX includes BSE:SENSEX-INDEX');
assert(sensexAliases.includes('BSE SENSEX'), 'SENSEX includes BSE SENSEX');

const vixAliases = getSymbolAliases('INDIAVIX');
assert(vixAliases.includes('NSE:INDIAVIX-INDEX'), 'INDIAVIX includes NSE:INDIAVIX-INDEX');

const bankniftyAliases = getSymbolAliases('BANKNIFTY');
assert(bankniftyAliases.includes('NSE:NIFTYBANK-INDEX'), 'BANKNIFTY includes NSE:NIFTYBANK-INDEX');

console.log('\n================================================================');
console.log(`🏁 RESULTS: ${passed} PASSED, ${failed} FAILED`);
console.log('================================================================');

if (failed > 0) process.exit(1);
