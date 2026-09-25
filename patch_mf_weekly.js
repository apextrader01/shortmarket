const fs = require('fs');
let code = fs.readFileSync('frontend/src/components/MutualFundDetailsModal.jsx', 'utf8');

// Update investType default
code = code.replace(
    'const [investType, setInvestType] = useState(\'SIP\'); // \'SIP\' | \'LUMPSUM\'',
    'const [investType, setInvestType] = useState(\'MONTHLY_SIP\'); // \'MONTHLY_SIP\' | \'WEEKLY_SIP\' | \'LUMPSUM\''
);

// Update conditions in calculations
code = code.replace(
    'if (investType === \'SIP\') {',
    'if (investType === \'MONTHLY_SIP\' || investType === \'WEEKLY_SIP\') {'
);

// Update setupSip payload
code = code.replace(
    'if (investType === \'SIP\') {\n                    res = await setupSip({\n                        symbol: actualSymbolToUse,\n                        amount: numAmount,\n                        frequency: \'MONTHLY\',\n                        price: currentNav\n                    });',
    'if (investType === \'MONTHLY_SIP\' || investType === \'WEEKLY_SIP\') {\n                    res = await setupSip({\n                        symbol: actualSymbolToUse,\n                        amount: numAmount,\n                        frequency: investType === \'WEEKLY_SIP\' ? \'WEEKLY\' : \'MONTHLY\',\n                        price: currentNav\n                    });'
);

// Update status message
code = code.replace(
    'setStatusMsg(`Successfully ${actionMode === \'INVEST\' ? (investType === \'SIP\' ? \'set up SIP\' : \'invested\') : \'redeemed\'}!`);',
    'setStatusMsg(`Successfully ${actionMode === \'INVEST\' ? (investType.includes(\'SIP\') ? \'set up SIP\' : \'invested\') : \'redeemed\'}!`);'
);

// Update Sub Tabs / Radio buttons
code = code.replace(
    '<label style={{ display: \'flex\', alignItems: \'center\', gap: \'8px\', cursor: \'pointer\', fontSize: \'14px\', color: investType === \'SIP\' ? \'var(--text-primary)\' : \'var(--text-secondary)\' }}>\n                                          <input type="radio" checked={investType === \'SIP\'} onChange={() => setInvestType(\'SIP\')} style={{ accentColor: \'var(--color-blue)\' }} /> Monthly SIP\n                                      </label>',
    '<label style={{ display: \'flex\', alignItems: \'center\', gap: \'8px\', cursor: \'pointer\', fontSize: \'14px\', color: investType === \'MONTHLY_SIP\' ? \'var(--text-primary)\' : \'var(--text-secondary)\' }}>\n                                          <input type="radio" checked={investType === \'MONTHLY_SIP\'} onChange={() => setInvestType(\'MONTHLY_SIP\')} style={{ accentColor: \'var(--color-blue)\' }} /> Monthly SIP\n                                      </label>\n                                      <label style={{ display: \'flex\', alignItems: \'center\', gap: \'8px\', cursor: \'pointer\', fontSize: \'14px\', color: investType === \'WEEKLY_SIP\' ? \'var(--text-primary)\' : \'var(--text-secondary)\' }}>\n                                          <input type="radio" checked={investType === \'WEEKLY_SIP\'} onChange={() => setInvestType(\'WEEKLY_SIP\')} style={{ accentColor: \'var(--color-blue)\' }} /> Weekly SIP\n                                      </label>'
);

// Input label
code = code.replace(
    '<div style={{ fontSize: \'13px\', color: \'var(--text-secondary)\', marginBottom: \'12px\' }}>{investType === \'SIP\' ? \'Installment Amount\' : \'Investment Amount\'}</div>',
    '<div style={{ fontSize: \'13px\', color: \'var(--text-secondary)\', marginBottom: \'12px\' }}>{investType.includes(\'SIP\') ? \'Installment Amount\' : \'Investment Amount\'}</div>'
);

// Confirm button text
code = code.replace(
    '{isInvesting ? \'Processing...\' : actionMode === \'INVEST\' ? (investType === \'SIP\' ? \'Start SIP\' : \'Pay Now\') : \'Confirm Redeem\'}',
    '{isInvesting ? \'Processing...\' : actionMode === \'INVEST\' ? (investType.includes(\'SIP\') ? \'Start SIP\' : \'Pay Now\') : \'Confirm Redeem\'}'
);

fs.writeFileSync('frontend/src/components/MutualFundDetailsModal.jsx', code, 'utf8');
console.log('Patched MutualFundDetailsModal.jsx for Weekly SIP');
