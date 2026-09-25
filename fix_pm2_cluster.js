const fs = require('fs');

// 1. Fix positionsEngine.js
let pe = fs.readFileSync('backend/services/positionsEngine.js', 'utf8');
pe = pe.replace(/this\.initCronJobs\(\);/g, `if (process.env.NODE_APP_INSTANCE === '0' || !process.env.NODE_APP_INSTANCE) {
            this.initCronJobs();
        }`);
fs.writeFileSync('backend/services/positionsEngine.js', pe);

// 2. Fix autoSquareOff.js
let aso = fs.readFileSync('backend/services/autoSquareOff.js', 'utf8');
aso = aso.replace(/function startSquareOffJobs\(\) \{/g, `function startSquareOffJobs() {
    if (process.env.NODE_APP_INSTANCE && process.env.NODE_APP_INSTANCE !== '0') return;`);
fs.writeFileSync('backend/services/autoSquareOff.js', aso);

// 3. Fix cronJobs.js (SIPs and Phase 1 blocks) - Actually wait, initCronJobs isn't even called anymore!
// Let's add the missing initCronJobs to server.js inside the isMaster block.
let srv = fs.readFileSync('backend/server.js', 'utf8');
const insertPoint = `startSquareOffJobs();`;
if (!srv.includes('initCronJobs(priceCache, triggerEngine);')) {
    srv = srv.replace(insertPoint, `startSquareOffJobs();
    initCronJobs(priceCache, triggerEngine);`);
}
fs.writeFileSync('backend/server.js', srv);

console.log("Fixed PM2 Cluster Race Conditions");
