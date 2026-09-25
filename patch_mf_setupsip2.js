const fs = require('fs');
let code = fs.readFileSync('frontend/src/components/MutualFundDetailsModal.jsx', 'utf8');

code = code.replace(
    /if \(investType === 'SIP'\) \{\s*res = await setupSip\(\{/g,
    `if (investType === 'MONTHLY_SIP' || investType === 'WEEKLY_SIP') {\n                    res = await setupSip({`
);

code = code.replace(
    /frequency: 'MONTHLY',/g,
    `frequency: investType === 'WEEKLY_SIP' ? 'WEEKLY' : 'MONTHLY',`
);

fs.writeFileSync('frontend/src/components/MutualFundDetailsModal.jsx', code, 'utf8');
console.log('Patched MutualFundDetailsModal setupSip correctly');
