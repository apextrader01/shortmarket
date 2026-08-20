const fs = require('fs');
let c = fs.readFileSync('backend/services/fyers.js', 'utf8');

c = c.replace('const response = await fyers.getQuotes(chunk);', 'const response = await fyers.getQuotes(chunk.join(\',\'));');
c = c.replace('const indRes = await fyers.getQuotes([fSym]);', 'const indRes = await fyers.getQuotes(fSym);');

fs.writeFileSync('backend/services/fyers.js', c, 'utf8');
console.log('Done replacement!');
