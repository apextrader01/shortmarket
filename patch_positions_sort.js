const fs = require('fs');
let code = fs.readFileSync('frontend/src/components/PositionsView.jsx', 'utf8');

const oldSort = `flatList.sort((a, b) => a.symbol.localeCompare(b.symbol));`;
const newSort = `flatList.sort((a, b) => {
        const isAmf = String(a.symbol || '').endsWith('-MF');
        const isBmf = String(b.symbol || '').endsWith('-MF');
        if (isAmf && !isBmf) return 1;
        if (!isAmf && isBmf) return -1;
        return String(a.symbol || '').localeCompare(String(b.symbol || ''));
    });`;

code = code.replace(oldSort, newSort);

fs.writeFileSync('frontend/src/components/PositionsView.jsx', code);
console.log('Fixed PositionsView sorting for MF');
