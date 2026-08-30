const fs = require('fs');

// 1. Fix ChartWidget
let chartCode = fs.readFileSync('frontend/src/components/ChartWidget.jsx', 'utf8');
chartCode = chartCode.replace(/prices\[selectedSymbol\]\?\.lotsize/g, 'price?.lotsize');
fs.writeFileSync('frontend/src/components/ChartWidget.jsx', chartCode);

// 2. Temporarily restore prices to PositionsView so the site stops crashing
let posCode = fs.readFileSync('frontend/src/components/PositionsView.jsx', 'utf8');
// Just inject it at the top of PositionsView
if (!posCode.includes('const prices = useStore(state => state.prices);') || posCode.indexOf('const prices = useStore') > posCode.indexOf('export default function PositionsView')) {
    posCode = posCode.replace('export default function PositionsView() {', 'export default function PositionsView() {\n  const prices = useStore(state => state.prices);');
}
// Add prices back to useMemo dependencies
posCode = posCode.replace(/\[sourceData, viewMode\]/, '[sourceData, viewMode, prices]');

fs.writeFileSync('frontend/src/components/PositionsView.jsx', posCode);

console.log('Hotfix applied');
