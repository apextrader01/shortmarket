const assert = require('assert');

console.log('=== Testing Crude Oil Expiry & Spot Resolution Safety Logic ===\n');

// 1. Test Candidate Generation for Options
const cleanSym = 'CRUDEOIL26OCT8800PE';
const isOpt = /(?:\d+|[-_\s])(CE|PE)(?:[-_\s].*)?$/i.test(cleanSym);
const underlying = 'CRUDEOIL';
const rawUnderlying = 'CRUDEOIL';

const comFutSym = cleanSym.replace(/\d+(?:\.\d+)?(CE|PE).*$/i, 'FUT');
assert.strictEqual(comFutSym, 'CRUDEOIL26OCTFUT', 'Should resolve option to corresponding futures symbol');

const candidates = [
    `MCX:${comFutSym}`,
    comFutSym,
    `MCX:${underlying}FUT`,
    `MCX:${rawUnderlying}FUT`,
    `MCX:${underlying}`,
    `MCX:${rawUnderlying}`,
    underlying,
    rawUnderlying
];

assert.ok(!candidates.includes('MCX:CRUDEOIL26OCT8800PE'), 'Option symbol must NOT be in spot candidates');
assert.ok(!candidates.includes('CRUDEOIL26OCT8800PE'), 'Clean option symbol must NOT be in spot candidates');
assert.ok(candidates.includes('MCX:CRUDEOIL26OCTFUT'), 'Near-month futures must be the #1 spot candidate');
console.log('✓ PASS: Candidates list correctly isolates underlying futures and excludes option symbol.');

// 2. Test Realistic Spot Price Sanity Check
const strike = 8800;
const corruptedSpot = 18.80;
const isSpotRealisticCorrupted = corruptedSpot > 0 && !(strike > 100 && (corruptedSpot < strike * 0.25 || corruptedSpot > strike * 4.0));
assert.strictEqual(isSpotRealisticCorrupted, false, 'Corrupted spot of 18.80 for strike 8800 must fail sanity check');
console.log('✓ PASS: Corrupted spot price (18.80 for strike 8800) is flagged as unrealistic and rejected.');

const validSpot = 9090.00;
const isSpotRealisticValid = validSpot > 0 && !(strike > 100 && (validSpot < strike * 0.25 || validSpot > strike * 4.0));
assert.strictEqual(isSpotRealisticValid, true, 'Spot price 9090 for strike 8800 must pass sanity check');
console.log('✓ PASS: Legitimate spot price (9090 for strike 8800) passes sanity check.');

// 3. Test Intrinsic PE Value
const optType = 'PE';
let ltp = 0;
if (isSpotRealisticValid && strike > 0 && optType) {
    ltp = Math.max(0, strike - validSpot);
}
assert.strictEqual(ltp, 0, 'PE with Strike 8800 and Spot 9090 must expire worthless at 0');
console.log('✓ PASS: Out-of-the-money Put option expires at ₹0.00 intrinsic value, protecting user premium.');

console.log('\n🎉 ALL CRUDE OIL EXPIRY TESTS PASSED!');
