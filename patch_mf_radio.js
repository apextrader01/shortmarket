const fs = require('fs');
let code = fs.readFileSync('frontend/src/components/MutualFundDetailsModal.jsx', 'utf8');

code = code.replace(
    /<label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '14px', color: investType === 'SIP' \? 'var\(--text-primary\)' : 'var\(--text-secondary\)' }}>[\s\S]*?<input type="radio" checked={investType === 'SIP'} onChange={\(\) => setInvestType\('SIP'\)} style={{ accentColor: 'var\(--color-blue\)' }} \/> Monthly SIP[\s\S]*?<\/label>/,
    `<label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '14px', color: investType === 'MONTHLY_SIP' ? 'var(--text-primary)' : 'var(--text-secondary)' }}>
                                        <input type="radio" checked={investType === 'MONTHLY_SIP'} onChange={() => setInvestType('MONTHLY_SIP')} style={{ accentColor: 'var(--color-blue)' }} /> Monthly SIP
                                    </label>
                                    <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '14px', color: investType === 'WEEKLY_SIP' ? 'var(--text-primary)' : 'var(--text-secondary)' }}>
                                        <input type="radio" checked={investType === 'WEEKLY_SIP'} onChange={() => setInvestType('WEEKLY_SIP')} style={{ accentColor: 'var(--color-blue)' }} /> Weekly SIP
                                    </label>`
);

fs.writeFileSync('frontend/src/components/MutualFundDetailsModal.jsx', code, 'utf8');
console.log('Patched MutualFundDetailsModal radio buttons');
