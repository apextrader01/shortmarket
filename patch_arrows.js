const fs = require('fs');
let code = fs.readFileSync('frontend/src/components/MutualFundsView.jsx', 'utf8');

code = code.replace(/Category \{sortConfig\.key === 'category'.*\}/, "Category {sortConfig.key === 'category' ? (sortConfig.direction === 'desc' ? '↓' : '↑') : '↕'}");
code = code.replace(/Risk \{sortConfig\.key === 'risk'.*\}/, "Risk {sortConfig.key === 'risk' ? (sortConfig.direction === 'desc' ? '↓' : '↑') : '↕'}");
code = code.replace(/NAV \{sortConfig\.key === 'nav'.*\}/, "NAV {sortConfig.key === 'nav' ? (sortConfig.direction === 'desc' ? '↓' : '↑') : '↕'}");

fs.writeFileSync('frontend/src/components/MutualFundsView.jsx', code);
console.log('Fixed unicode arrows');
