const fs = require('fs');
let code = fs.readFileSync('backend/server.js', 'utf8');

// Fix initMutualFundsList definition
code = code.replace(
    /async function initMutualFundsList\(\) \{\s+if \(allMutualFunds\.length > 0\) return; \/\/ already loaded/,
    "async function initMutualFundsList(force = false) {\n    if (!force && allMutualFunds.length > 0) return; // already loaded"
);

// Add setInterval
code = code.replace(
    /initMutualFundsList\(\);\n/,
    "initMutualFundsList();\n\n// Auto-refresh the AMFI master list every 24 hours\nsetInterval(() => initMutualFundsList(true), 86400000);\n"
);

// Fix history cache if it missed
if (!code.includes('Date.now() - mfCache[schemeCode].timestamp < 86400000)) { // 24 hours cache\n        return res.json(mfCache[schemeCode]')) {
    code = code.replace(
        /if \(mfCache\[schemeCode\] && \(Date\.now\(\) - mfCache\[schemeCode\]\.timestamp < 3600000\)\) \{\n\s+return res\.json\(mfCache\[schemeCode\]\.data\);\n\s+\}/,
        "if (mfCache[schemeCode] && (Date.now() - mfCache[schemeCode].timestamp < 86400000)) { // 24 hours cache\n        return res.json(mfCache[schemeCode].data);\n    }"
    );
}

fs.writeFileSync('backend/server.js', code);
console.log('Fixed regex replacements');
