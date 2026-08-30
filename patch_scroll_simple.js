const fs = require('fs');
let code = fs.readFileSync('frontend/src/components/ChartWidget.jsx', 'utf8');

// Make the outer container scrollable
code = code.replace(
    '<div className="glass-panel" style={{ padding: \'16px 20px\', display: \'flex\', flexDirection: \'column\', height: \'100%\' }}>',
    '<div className="glass-panel" style={{ padding: \'16px 20px\', display: \'flex\', flexDirection: \'column\', flex: 1, minHeight: 0, overflowY: \'auto\' }}>'
);

// Give the chart area a fixed height so it doesn't grow infinitely in a scrolling container
code = code.replace(
    '<div style={{ position: \'relative\', width: \'100%\', flex: 1, minHeight: \'300px\' }}>',
    '<div style={{ position: \'relative\', width: \'100%\', flex: \'0 0 60vh\', minHeight: \'400px\' }}>'
);

fs.writeFileSync('frontend/src/components/ChartWidget.jsx', code, 'utf8');
console.log('Fixed scroll layout');
