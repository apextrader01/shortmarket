const fs = require('fs');
let code = fs.readFileSync('frontend/src/components/MutualFundsView.jsx', 'utf8');

const regexCategory = /<th[^>]*>Category<\/th>/g;
const regexRisk = /<th[^>]*>Risk<\/th>/g;
const regexNAV = /<th[^>]*>NAV<\/th>/g;

// Let's only replace the ones that have color: 'var(--text-secondary)'
const safeReplace = (content, regex, newString) => {
    let count = 0;
    return content.replace(regex, (match) => {
        if (match.includes('var(--text-secondary)')) {
            count++;
            return newString;
        }
        return match;
    });
};

code = safeReplace(code, regexCategory, `<th style={{ padding: '16px', textAlign: 'left', fontWeight: '600', color: 'var(--text-secondary)', cursor: 'pointer', userSelect: 'none' }} onClick={() => handleSort('category')}>
                                    Category {sortConfig.key === 'category' ? (sortConfig.direction === 'desc' ? '\u2193' : '\u2191') : '\u2195'}
                                </th>`);

code = safeReplace(code, regexRisk, `<th style={{ padding: '16px', textAlign: 'center', fontWeight: '600', color: 'var(--text-secondary)', cursor: 'pointer', userSelect: 'none' }} onClick={() => handleSort('risk')}>
                                    Risk {sortConfig.key === 'risk' ? (sortConfig.direction === 'desc' ? '\u2193' : '\u2191') : '\u2195'}
                                </th>`);

code = safeReplace(code, regexNAV, `<th style={{ padding: '16px', textAlign: 'right', fontWeight: '600', color: 'var(--text-secondary)', cursor: 'pointer', userSelect: 'none' }} onClick={() => handleSort('nav')}>
                                    NAV {sortConfig.key === 'nav' ? (sortConfig.direction === 'desc' ? '\u2193' : '\u2191') : '\u2195'}
                                </th>`);

fs.writeFileSync('frontend/src/components/MutualFundsView.jsx', code);
console.log('Fixed MutualFundsView headers!');
