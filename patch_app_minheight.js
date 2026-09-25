const fs = require('fs');
let code = fs.readFileSync('frontend/src/App.jsx', 'utf8');

code = code.replace(
    '<div style={{ flex: 1, display: \'flex\', flexDirection: \'column\', width: \'100%\', minWidth: 0, padding: window.innerWidth <= 1200 ? \'0\' : \'12px\' }}>',
    '<div style={{ flex: 1, display: \'flex\', flexDirection: \'column\', width: \'100%\', minWidth: 0, minHeight: 0, padding: window.innerWidth <= 1200 ? \'0\' : \'12px\' }}>'
);

code = code.replace(
    '<div style={{ display: \'flex\', flexDirection: \'column\', flex: 1, minWidth: 0 }}>\n                <ChartWidget />',
    '<div style={{ display: \'flex\', flexDirection: \'column\', flex: 1, minWidth: 0, minHeight: 0 }}>\n                <ChartWidget />'
);

fs.writeFileSync('frontend/src/App.jsx', code, 'utf8');
console.log('Patched App.jsx minHeight');
