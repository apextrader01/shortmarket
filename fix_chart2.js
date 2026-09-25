const fs = require('fs');

const path = 'frontend/src/components/ChartWidget.jsx';
let code = fs.readFileSync(path, 'utf8');

code = code.replace(
    '<div className="glass-panel" style={{ padding: \'16px 20px\', display: \'flex\', flexDirection: \'column\', height: \'100%\', overflowY: \'auto\' }}>',
    '<div className="glass-panel" style={{ padding: \'16px 20px\', display: \'flex\', flexDirection: \'column\', flex: 1, minHeight: 0, overflowY: \'auto\' }}>'
);

fs.writeFileSync(path, code, 'utf8');
console.log("Done");
