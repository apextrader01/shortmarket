const fs = require('fs');
let code = fs.readFileSync('backend/server.js', 'utf8');

if (!code.includes('setInterval(() => initMutualFundsList(true), 86400000)')) {
    code = code.replace(
        "initMutualFundsList();\r\n",
        "initMutualFundsList();\r\n\r\n// Auto-refresh the AMFI master list every 24 hours\r\nsetInterval(() => initMutualFundsList(true), 86400000);\r\n"
    );
    if (!code.includes('setInterval(() => initMutualFundsList(true), 86400000)')) {
        // Fallback for LF
        code = code.replace(
            "initMutualFundsList();\n",
            "initMutualFundsList();\n\n// Auto-refresh the AMFI master list every 24 hours\nsetInterval(() => initMutualFundsList(true), 86400000);\n"
        );
    }
}

fs.writeFileSync('backend/server.js', code);
console.log('Fixed interval');
