const fs = require('fs');
let code = fs.readFileSync('frontend/src/components/ChartWidget.jsx', 'utf8');

code = code.replace(
    '<div style={{ position: \'relative\', width: \'100%\', flex: \'1 1 50%\', minHeight: \'300px\' }}>',
    '<div style={{ position: \'relative\', width: \'100%\', flex: 1, minHeight: \'200px\' }}>'
);

code = code.replace(
    '<div style={{ flex: \'1 1 50%\', minHeight: 0, display: \'flex\', flexDirection: \'column\', borderTop: \'1px solid rgba(255,255,255,0.1)\', paddingTop: \'16px\' }}>',
    '<div style={{ flex: \'0 0 35%\', minHeight: 0, display: \'flex\', flexDirection: \'column\', borderTop: \'1px solid rgba(255,255,255,0.1)\', paddingTop: \'16px\', marginTop: \'16px\' }}>'
);

fs.writeFileSync('frontend/src/components/ChartWidget.jsx', code, 'utf8');
console.log('Fixed chart layout');
