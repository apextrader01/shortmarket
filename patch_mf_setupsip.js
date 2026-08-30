const fs = require('fs');
let code = fs.readFileSync('frontend/src/components/MutualFundDetailsModal.jsx', 'utf8');

code = code.replace(
    /if \(investType === 'MONTHLY_SIP' \|\| investType === 'WEEKLY_SIP'\) \{\s*res = await setupSip\(\{\s*symbol: actualSymbolToUse,\s*amount: numAmount,\s*frequency: 'MONTHLY',\s*price: currentNav\s*\}\);/,
    `if (investType === 'MONTHLY_SIP' || investType === 'WEEKLY_SIP') {
                    res = await setupSip({
                        symbol: actualSymbolToUse,
                        amount: numAmount,
                        frequency: investType === 'WEEKLY_SIP' ? 'WEEKLY' : 'MONTHLY',
                        price: currentNav
                    });`
);

fs.writeFileSync('frontend/src/components/MutualFundDetailsModal.jsx', code, 'utf8');
console.log('Patched MutualFundDetailsModal setupSip');
