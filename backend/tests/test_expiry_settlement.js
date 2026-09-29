const assert = require('assert');

// Test regex extraction of underlying, strike, optType, and isIndex
const testCases = [
  { symbol: 'NSE:BANKNIFTY26SEP54500CE', expUnderlying: 'BANKNIFTY', expStrike: 54500, expOptType: 'CE', expIsIndex: true },
  { symbol: 'NSE:BANKNIFTY26SEP54700CE', expUnderlying: 'BANKNIFTY', expStrike: 54700, expOptType: 'CE', expIsIndex: true },
  { symbol: 'NSE:NIFTY26SEP22850CE', expUnderlying: 'NIFTY', expStrike: 22850, expOptType: 'CE', expIsIndex: true },
  { symbol: 'NSE:NIFTY26SEP22950CE', expUnderlying: 'NIFTY', expStrike: 22950, expOptType: 'CE', expIsIndex: true },
  { symbol: 'NSE:NIFTY26SEP23200CE', expUnderlying: 'NIFTY', expStrike: 23200, expOptType: 'CE', expIsIndex: true },
  { symbol: 'NSE:NIFTY26SEP23200PE', expUnderlying: 'NIFTY', expStrike: 23200, expOptType: 'PE', expIsIndex: true },
  { symbol: 'NSE:TATAPOWER26SEPFUT', expUnderlying: 'TATAPOWER', expStrike: 0, expOptType: null, expIsIndex: false },
  { symbol: 'NSE:TCS26SEPFUT', expUnderlying: 'TCS', expStrike: 0, expOptType: null, expIsIndex: false },
  { symbol: 'NSE:BAJFINANCE26SEP1000CE', expUnderlying: 'BAJFINANCE', expStrike: 1000, expOptType: 'CE', expIsIndex: false },
  { symbol: 'NSE:BAJFINANCE26SEP980CE', expUnderlying: 'BAJFINANCE', expStrike: 980, expOptType: 'CE', expIsIndex: false },
  { symbol: 'NSE:HDFCBANK26SEP680PE', expUnderlying: 'HDFCBANK', expStrike: 680, expOptType: 'PE', expIsIndex: false },
  { symbol: 'NSE:HDFCBANK26SEP700PE', expUnderlying: 'HDFCBANK', expStrike: 700, expOptType: 'PE', expIsIndex: false },
  { symbol: 'NSE:HDFCBANK26SEP740CE', expUnderlying: 'HDFCBANK', expStrike: 740, expOptType: 'CE', expIsIndex: false },
  { symbol: 'NSE:HDFCBANK26SEP760CE', expUnderlying: 'HDFCBANK', expStrike: 760, expOptType: 'CE', expIsIndex: false },
  { symbol: 'NSE:NIFTY26SEP22850CE', expUnderlying: 'NIFTY', expStrike: 22850, expOptType: 'CE', expIsIndex: true },
  { symbol: 'NSE:NIFTY26SEP22850PE', expUnderlying: 'NIFTY', expStrike: 22850, expOptType: 'PE', expIsIndex: true }
];

for (const tc of testCases) {
    const cleanSym = tc.symbol.replace(/^(NSE:|BSE:|MCX:)/i, '');
    let underlying = null;
    let optType = null;
    let strike = 0;

    const monthlyMatch = cleanSym.match(/^([A-Z0-9]+?)(\d{2})(JAN|FEB|MAR|APR|MAY|JUN|JUL|AUG|SEP|OCT|NOV|DEC)(?:(\d+)(CE|PE)|FUT)?$/i);
    if (monthlyMatch) {
        underlying = monthlyMatch[1].toUpperCase();
        if (monthlyMatch[4] && monthlyMatch[5]) {
            strike = parseFloat(monthlyMatch[4]);
            optType = monthlyMatch[5].toUpperCase();
        }
    } else {
        const weeklyMatch = cleanSym.match(/^([A-Z0-9]+?)(\d{2})([1-9OND])(\d{2})(\d+)(CE|PE)$/i);
        if (weeklyMatch) {
            underlying = weeklyMatch[1].toUpperCase();
            strike = parseFloat(weeklyMatch[5]);
            optType = weeklyMatch[6].toUpperCase();
        } else {
            const genMatch = cleanSym.match(/([A-Z0-9]+).*?(\d{3,6})(CE|PE)$/i);
            if (genMatch) {
                underlying = genMatch[1].toUpperCase();
                strike = parseFloat(genMatch[2]);
                optType = genMatch[3].toUpperCase();
            } else {
                underlying = cleanSym.replace(/(?:[-_\s]?FUT|[-_\s]?CE|[-_\s]?PE).*$/i, '').toUpperCase();
            }
        }
    }

    const isIndex = ['NIFTY', 'BANKNIFTY', 'FINNIFTY', 'MIDCPNIFTY', 'SENSEX', 'BANKEX'].includes(underlying?.toUpperCase());

    assert.strictEqual(underlying, tc.expUnderlying, `Mismatch in underlying for ${tc.symbol}: got ${underlying}, expected ${tc.expUnderlying}`);
    assert.strictEqual(strike, tc.expStrike, `Mismatch in strike for ${tc.symbol}: got ${strike}, expected ${tc.expStrike}`);
    assert.strictEqual(optType, tc.expOptType, `Mismatch in optType for ${tc.symbol}: got ${optType}, expected ${tc.expOptType}`);
    assert.strictEqual(isIndex, tc.expIsIndex, `Mismatch in isIndex for ${tc.symbol}: got ${isIndex}, expected ${tc.expIsIndex}`);
}

console.log('✅ [PASS] All 16 expiry test contracts parsed accurately (underlying, strike, optType, isIndex).');
