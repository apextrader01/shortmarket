const fs = require('fs');
let code = fs.readFileSync('frontend/src/components/MutualFundsView.jsx', 'utf8');

code = code.replace(/Category \{sortConfig\.key === 'category'.*\}/, "Category {sortConfig.key === 'category' ? (sortConfig.direction === 'desc' ? '\u2193' : '\u2191') : '\u2195'}");
code = code.replace(/Risk \{sortConfig\.key === 'risk'.*\}/, "Risk {sortConfig.key === 'risk' ? (sortConfig.direction === 'desc' ? '\u2193' : '\u2191') : '\u2195'}");
code = code.replace(/NAV \{sortConfig\.key === 'nav'.*\}/, "NAV {sortConfig.key === 'nav' ? (sortConfig.direction === 'desc' ? '\u2193' : '\u2191') : '\u2195'}");

fs.writeFileSync('frontend/src/components/MutualFundsView.jsx', code);
console.log('Fixed unicode arrows using escapes');
