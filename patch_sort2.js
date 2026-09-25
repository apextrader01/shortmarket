const fs = require('fs');
let code = fs.readFileSync('frontend/src/components/MutualFundsView.jsx', 'utf8');

const start = code.indexOf('    const sortedFunds = [...filteredFunds].sort((a, b) => {');
const end = code.indexOf('    });', start) + 7;

const oldSort = code.substring(start, end);

const newSort = `    const sortedFunds = [...filteredFunds].sort((a, b) => {
        if (!sortConfig.key) return 0;
        
        let valA = a[sortConfig.key];
        let valB = b[sortConfig.key];
        
        if (sortConfig.key === 'category' || sortConfig.key === 'risk') {
            valA = String(valA || '').toLowerCase();
            valB = String(valB || '').toLowerCase();
            if (valA < valB) return sortConfig.direction === 'asc' ? -1 : 1;
            if (valA > valB) return sortConfig.direction === 'asc' ? 1 : -1;
            return 0;
        } else {
            valA = valA !== undefined && valA !== null ? valA : -999999;
            valB = valB !== undefined && valB !== null ? valB : -999999;
            if (valA < valB) return sortConfig.direction === 'asc' ? -1 : 1;
            if (valA > valB) return sortConfig.direction === 'asc' ? 1 : -1;
            return 0;
        }
    });`;

code = code.replace(oldSort, newSort);
fs.writeFileSync('frontend/src/components/MutualFundsView.jsx', code);
console.log('Fixed sortedFunds logic');
