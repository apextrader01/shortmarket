const fs = require('fs');
let posCode = fs.readFileSync('frontend/src/components/PositionsView.jsx', 'utf8');

posCode = posCode.replace('export default function PositionsView() {\n  const [viewMode', 'export default function PositionsView() {\n  const prices = useStore(state => state.prices);\n  const [viewMode');

fs.writeFileSync('frontend/src/components/PositionsView.jsx', posCode);
console.log('Fixed PositionsView');
