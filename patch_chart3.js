const fs = require('fs');
let code = fs.readFileSync('frontend/src/components/ChartWidget.jsx', 'utf8');

// Remove overflowY: 'auto' from the root glass-panel
code = code.replace(
    '<div className="glass-panel" style={{ padding: \'16px 20px\', display: \'flex\', flexDirection: \'column\', flex: 1, minHeight: 0, overflowY: \'auto\' }}>',
    '<div className="glass-panel" style={{ padding: \'16px 20px\', display: \'flex\', flexDirection: \'column\', flex: 1, minHeight: 0 }}>'
);

// Change Chart area flex property
code = code.replace(
    '<div style={{ position: \'relative\', width: \'100%\', flex: 1, minHeight: \'300px\' }}>',
    '<div style={{ position: \'relative\', width: \'100%\', flex: \'1 1 50%\', minHeight: \'300px\' }}>'
);

// Wrap StockDetails in a flex container
code = code.replace(
    '<StockDetails symbol={selectedSymbol} price={price} candles={candles} />',
    '<div style={{ flex: \'1 1 50%\', minHeight: 0, display: \'flex\', flexDirection: \'column\', borderTop: \'1px solid rgba(255,255,255,0.1)\', paddingTop: \'16px\' }}>\n          <StockDetails symbol={selectedSymbol} price={price} candles={candles} />\n        </div>'
);

fs.writeFileSync('frontend/src/components/ChartWidget.jsx', code, 'utf8');
console.log('ChartWidget patched');
