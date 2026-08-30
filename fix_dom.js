const fs = require('fs');
let code = fs.readFileSync('frontend/src/components/DOMLadderModal.jsx', 'utf8');

code = code.replace(/prices: state\.prices,?\s*/g, '');
code = code.replace(/, prices \} = useStore/, ' } = useStore');
code = code.replace(/prices,/g, '');

code = code.replace(/const basicData = prices\[symbol\] \|\| \{\};/, 'const basicData = useStore(state => state.prices[symbol] || {});');

fs.writeFileSync('frontend/src/components/DOMLadderModal.jsx', code);
console.log('Fixed DOMLadderModal');
