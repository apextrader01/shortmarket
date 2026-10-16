const fs = require('fs');
const assert = require('assert');

// 1. Check OptionChainView.jsx
const ocView = fs.readFileSync('frontend/src/components/OptionChainView.jsx', 'utf8');
assert(ocView.includes("const ALLOWED_INDEX_SYMBOLS = ['NIFTY', 'BANKNIFTY', 'FINNIFTY', 'SENSEX', 'BANKEX'];"), '5 major indices must be defined');
assert(ocView.includes('NSE:NIFTY50-INDEX'), 'NSE:NIFTY50-INDEX must be present');
assert(ocView.includes('NSE:NIFTYBANK-INDEX'), 'NSE:NIFTYBANK-INDEX must be present');
assert(ocView.includes('NSE:FINNIFTY-INDEX'), 'NSE:FINNIFTY-INDEX must be present');
assert(ocView.includes('BSE:SENSEX-INDEX'), 'BSE:SENSEX-INDEX must be present');
assert(ocView.includes('BSE:BANKEX-INDEX'), 'BSE:BANKEX-INDEX must be present');
assert(ocView.includes('NSE:INDIAVIX-INDEX'), 'NSE:INDIAVIX-INDEX must be present');
assert(ocView.includes('atmIndex - 15'), '15 ITM strikes window must be present');
assert(ocView.includes('atmIndex + 15'), '15 OTM strikes window must be present');
assert(ocView.includes('<PcrSummary'), 'Reactive PcrSummary component must be present');

// 2. Check OptionChainRow.jsx
const ocRow = fs.readFileSync('frontend/src/components/OptionChainRow.jsx', 'utf8');
assert(ocRow.includes('formatOI(callPriceData?.volume)'), 'Call volume must use formatOI');
assert(ocRow.includes('formatOI(putPriceData?.volume)'), 'Put volume must use formatOI');
assert(ocRow.includes('cBreakPct > 0 ? \'+\' : \'\''), 'Call breakeven pct formatting must be present');
assert(ocRow.includes('pBreakPct > 0 ? \'+\' : \'\''), 'Put breakeven pct formatting must be present');

// 3. Check store.js
const store = fs.readFileSync('frontend/src/store.js', 'utf8');
assert(store.includes('oi: rawData[13] || 0'), 'store.js must unpack oi at index 13');
assert(store.includes('pOI: rawData[14] || 0'), 'store.js must unpack pOI at index 14');
assert(store.includes('oi_change: rawData[15] || 0'), 'store.js must unpack oi_change at index 15');
assert(store.includes('data.oi === undefined || old.oi === data.oi'), 'Value Equality Guard must check data.oi');

// 4. Check fyers.js
const fyers = fs.readFileSync('backend/services/fyers.js', 'utf8');
assert(fyers.includes('p.oi || 0'), 'fyers.js snapshotPayload must include p.oi');
assert(fyers.includes('oi: tick.oi !== undefined'), 'fyers.js priceObj must parse tick.oi');
assert(fyers.includes('pOI: tick.pOI !== undefined'), 'fyers.js priceObj must parse tick.pOI');

console.log('✅ ALL OPTION CHAIN VERIFICATION CHECKS PASSED PERFECTLY!');
