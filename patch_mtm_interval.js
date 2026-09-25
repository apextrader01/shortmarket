const fs = require('fs');
let code = fs.readFileSync('backend/services/mtmRiskManager.js', 'utf8');

code = code.replace(/setInterval\(\(\) => this\.evaluateMTM\(\), 2000\);/g, 'setInterval(() => this.evaluateMTM(), 60000);');
code = code.replace(/console\.log\('MTM Risk Manager started checking every 2 seconds\.'\);/g, 'console.log(\'MTM Risk Manager started checking every 60 seconds (1 minute).\');');

fs.writeFileSync('backend/services/mtmRiskManager.js', code);
console.log('Patched MTM Risk Manager to 1 minute interval');
