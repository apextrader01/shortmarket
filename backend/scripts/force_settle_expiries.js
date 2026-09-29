const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env'), override: true });
process.env.TZ = 'Asia/Kolkata';

const db = require('../database/db');
const positionsEngine = require('../services/positionsEngine');

async function main() {
    console.log('═══════════════════════════════════════════════════════════════');
    console.log('⚡ [MANUAL / IMMEDIATE EXPIRY SETTLEMENT SCRIPT]');
    console.log(`⏰ Current IST Time: ${new Date().toLocaleString('en-US', { timeZone: 'Asia/Kolkata' })}`);
    console.log('═══════════════════════════════════════════════════════════════');

    try {
        console.log('\n🔍 1. Settling Equities, Index Options & Stock Futures Expiries...');
        await positionsEngine.settleExpiries(false, false);

        console.log('\n🔍 2. Settling MCX Commodity Expiries...');
        await positionsEngine.settleExpiries(true, true);

        console.log('\n✅ All expired contracts (Positions & Holdings) processed successfully.');
    } catch (err) {
        console.error('❌ Expiry Settlement failed:', err);
    } finally {
        setTimeout(async () => {
            try {
                if (db.destroy) await db.destroy();
            } catch (e) {}
            process.exit(0);
        }, 3000);
    }
}

main();
