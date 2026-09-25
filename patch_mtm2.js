const fs = require('fs');
let code = fs.readFileSync('backend/services/mtmRiskManager.js', 'utf8');

const regex = /async evaluateMTM\(\) \{[\s\S]*?const openPositions = await db\('positions'\)[\s\S]*?\.whereNotIn\('product_type', \['DEL'\]\);/m;

const newCode = `async evaluateMTM() {
        if (this.isChecking) return;
        this.isChecking = true;
        try {
            const now = Date.now();
            if (!this.cachedPositions || now - (this.lastCacheTime || 0) > 15000) {
                this.cachedPositions = await db('positions')
                    .whereNot({ quantity: 0 })
                    .whereNotIn('product_type', ['DEL']);
                this.lastCacheTime = now;
            }
            
            const openPositions = this.cachedPositions;`;

if (regex.test(code)) {
    code = code.replace(regex, newCode);
    fs.writeFileSync('backend/services/mtmRiskManager.js', code);
    console.log('Successfully patched mtmRiskManager.js using regex');
} else {
    console.log('Regex did not match!');
}
