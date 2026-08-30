const fs = require('fs');
let code = fs.readFileSync('backend/services/autoSquareOff.js', 'utf8');

const autoRegex = /for \(const pos of openPositions\) \{[\s\S]*?console\.log\(`? Auto Square-Off Complete.*?\\n`\);/m;
console.log("Auto Regex Matches:", autoRegex.test(code));

const intradayRegex = /for \(const pos of openPositions\) \{[\s\S]*?console\.log\(`? Intraday Square-Off Complete.*?\\n`\);/m;
console.log("Intraday Regex Matches:", intradayRegex.test(code));

