const fs = require('fs');
let code = fs.readFileSync('frontend/src/components/MutualFundDetailsModal.jsx', 'utf8');

code = code.replace(
    'className="mf-modal-right" style={{ width: \'420px\', borderLeft: \'1px solid var(--border-color)\', display: \'flex\', flexDirection: \'column\', background: \'var(--bg-panel)\' }}',
    'className="mf-modal-right" style={{ width: \'420px\', borderLeft: \'1px solid var(--border-color)\', display: \'flex\', flexDirection: \'column\', background: \'var(--bg-panel)\', overflowY: \'auto\', minHeight: 0 }}'
);

fs.writeFileSync('frontend/src/components/MutualFundDetailsModal.jsx', code, 'utf8');
console.log('Patched right panel scroll');
