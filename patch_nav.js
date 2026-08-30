const fs = require('fs');
let code = fs.readFileSync('frontend/src/components/MutualFundDetailsModal.jsx', 'utf8');

code = code.replace(/details\?\.nav \|\| fund\.nav/g, 'fund.nav || details?.nav');

fs.writeFileSync('frontend/src/components/MutualFundDetailsModal.jsx', code);
