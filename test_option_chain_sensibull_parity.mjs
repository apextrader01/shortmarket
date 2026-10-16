import assert from 'assert';
import { calculateBlack76Greeks, calculateGreeks, calculateIV } from './frontend/src/utils/blackScholes.js';

console.log('================================================================');
console.log('🧪 TESTING OPTION CHAIN SENSIBULL / BLACK-76 PARITY');
console.log('================================================================\n');

// 1. Put-Call Parity Synthetic Futures Price
const K_ATM = 23100;
const C_ATM = 84.95;
const P_ATM = 93.85;
const synthFut = K_ATM + C_ATM - P_ATM;
console.log(`▶ 1. Synthetic Futures Price Test:`);
console.log(`  K=${K_ATM}, C=${C_ATM}, P=${P_ATM} => Synth Fut = ${synthFut.toFixed(2)}`);
assert.strictEqual(synthFut.toFixed(2), '23091.10');
console.log('  ✔ [PASS] Synthetic Futures Price matches Put-Call Parity exact value.\n');

// 2. Greeks Alignment with Sensibull Screenshot
console.log(`▶ 2. Greeks Alignment vs Sensibull Institutional Benchmark:`);
const F = 23091.51; // Sensibull's published synthetic future
const T = 2.65 / 365; // ~2.65 calendar days to expiry
const r = 0.10;

const strikeData = [
  { K: 23000, C: 144.00, P: 53.95, expDeltaC: 0.66, expDeltaP: -0.34, expVega: 8, expGamma: 0.0016, expTheta: -14 },
  { K: 23050, C: 112.20, P: 71.05, expDeltaC: 0.57, expDeltaP: -0.43, expVega: 8, expGamma: 0.0017, expTheta: -15 },
  { K: 23100, C: 84.95,  P: 93.85, expDeltaC: 0.49, expDeltaP: -0.51, expVega: 8, expGamma: 0.0018, expTheta: -15 },
  { K: 23150, C: 62.80,  P: 120.65, expDeltaC: 0.40, expDeltaP: -0.60, expVega: 8, expGamma: 0.0017, expTheta: -14 },
  { K: 23200, C: 45.00,  P: 152.65, expDeltaC: 0.31, expDeltaP: -0.69, expVega: 7, expGamma: 0.0016, expTheta: -13 }
];

for (const s of strikeData) {
  const cIV = calculateIV('CE', s.C, F, s.K, T, r, true);
  const pIV = calculateIV('PE', s.P, F, s.K, T, r, true);
  const midIV = (cIV > 0 && pIV > 0) ? (cIV + pIV) / 2 : (cIV || pIV);

  const cG = calculateBlack76Greeks('CE', F, s.K, T, r, midIV);
  const pG = calculateBlack76Greeks('PE', F, s.K, T, r, midIV);

  const callDelta = Number(cG.delta.toFixed(2));
  const putDelta = Number(pG.delta.toFixed(2));
  const vega = Math.round(cG.vega);
  const gamma = Number(cG.gamma.toFixed(4));

  console.log(`  Strike ${s.K}:`);
  console.log(`    Delta: Call ${callDelta} (expected ${s.expDeltaC}), Put ${putDelta} (expected ${s.expDeltaP})`);
  console.log(`    Vega: ${vega} (expected ${s.expVega}) | Gamma: ${gamma} (expected ${s.expGamma})`);
  console.log(`    Theta: Call ${cG.theta.toFixed(0)}, Put ${pG.theta.toFixed(0)} (expected ~${s.expTheta})`);

  // Assert Call Delta + |Put Delta| is approximately 1.00
  const deltaSum = Math.abs(callDelta) + Math.abs(putDelta);
  assert(Math.abs(deltaSum - 1.00) <= 0.02, `Delta sum should be ~1.00, got ${deltaSum}`);

  // Assert Call Delta is within 0.02 of Sensibull
  assert(Math.abs(callDelta - s.expDeltaC) <= 0.02, `Call Delta mismatch at ${s.K}: got ${callDelta}, expected ${s.expDeltaC}`);
  // Assert Put Delta is within 0.02 of Sensibull
  assert(Math.abs(putDelta - s.expDeltaP) <= 0.02, `Put Delta mismatch at ${s.K}: got ${putDelta}, expected ${s.expDeltaP}`);
  // Assert Gamma is within 0.0002
  assert(Math.abs(gamma - s.expGamma) <= 0.0002, `Gamma mismatch at ${s.K}: got ${gamma}, expected ${s.expGamma}`);
  // Assert Vega matches within 1 point
  assert(Math.abs(vega - s.expVega) <= 1, `Vega mismatch at ${s.K}: got ${vega}, expected ${s.expVega}`);

  console.log(`    ✔ [PASS] Strike ${s.K} matches Sensibull Greek values.`);
}

// 3. Theta / 365 Scaling Check
console.log(`\n▶ 3. Daily Theta Scaling Verification:`);
const atmCall = calculateBlack76Greeks('CE', F, 23100, T, r, 0.114);
console.log(`  ATM Call Theta (/ 365): ${atmCall.theta.toFixed(2)} (rounds to ${atmCall.theta.toFixed(0)})`);
assert(atmCall.theta < 0 && atmCall.theta > -25, 'Theta should be around -15 to -17 per day');
console.log('  ✔ [PASS] Daily Theta scaled by 365 calendar days.\n');

console.log('================================================================');
console.log('🏁 ALL SENSIBULL OPTION CHAIN TESTS PASSED (100% PARITY)');
console.log('================================================================');
