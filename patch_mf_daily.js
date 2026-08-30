const fs = require('fs');
let code = fs.readFileSync('frontend/src/components/MutualFundDetailsModal.jsx', 'utf8');

// 1. Add DAILY_SIP to investType state comment (just for readability)
code = code.replace(
    'const [investType, setInvestType] = useState(\'MONTHLY_SIP\'); // \'MONTHLY_SIP\' | \'WEEKLY_SIP\' | \'LUMPSUM\'',
    'const [investType, setInvestType] = useState(\'MONTHLY_SIP\'); // \'MONTHLY_SIP\' | \'WEEKLY_SIP\' | \'DAILY_SIP\' | \'LUMPSUM\''
);

// 2. Update SIP logic conditions
code = code.replace(
    'if (investType === \'MONTHLY_SIP\' || investType === \'WEEKLY_SIP\') {',
    'if (investType === \'MONTHLY_SIP\' || investType === \'WEEKLY_SIP\' || investType === \'DAILY_SIP\') {'
);

code = code.replace(
    /if \(investType === 'MONTHLY_SIP' \|\| investType === 'WEEKLY_SIP'\) \{\s*res = await setupSip\(\{\s*symbol: actualSymbolToUse,\s*amount: numAmount,\s*frequency: investType === 'WEEKLY_SIP' \? 'WEEKLY' : 'MONTHLY',\s*price: currentNav\s*\}\);/g,
    `if (investType === 'MONTHLY_SIP' || investType === 'WEEKLY_SIP' || investType === 'DAILY_SIP') {
                    res = await setupSip({
                        symbol: actualSymbolToUse,
                        amount: numAmount,
                        frequency: investType === 'DAILY_SIP' ? 'DAILY' : (investType === 'WEEKLY_SIP' ? 'WEEKLY' : 'MONTHLY'),
                        price: currentNav
                    });`
);

// 3. Add the Daily SIP radio button
code = code.replace(
    /<label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '14px', color: investType === 'WEEKLY_SIP' \? 'var\(--text-primary\)' : 'var\(--text-secondary\)' }}>[\s\S]*?<input type="radio" checked={investType === 'WEEKLY_SIP'} onChange={\(\) => setInvestType\('WEEKLY_SIP'\)} style={{ accentColor: 'var\(--color-blue\)' }} \/> Weekly SIP[\s\S]*?<\/label>/,
    `<label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '14px', color: investType === 'WEEKLY_SIP' ? 'var(--text-primary)' : 'var(--text-secondary)' }}>
                                        <input type="radio" checked={investType === 'WEEKLY_SIP'} onChange={() => setInvestType('WEEKLY_SIP')} style={{ accentColor: 'var(--color-blue)' }} /> Weekly SIP
                                    </label>
                                    <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '14px', color: investType === 'DAILY_SIP' ? 'var(--text-primary)' : 'var(--text-secondary)' }}>
                                        <input type="radio" checked={investType === 'DAILY_SIP'} onChange={() => setInvestType('DAILY_SIP')} style={{ accentColor: 'var(--color-blue)' }} /> Daily SIP
                                    </label>`
);

fs.writeFileSync('frontend/src/components/MutualFundDetailsModal.jsx', code, 'utf8');
console.log('Patched MutualFundDetailsModal for Daily SIP');
