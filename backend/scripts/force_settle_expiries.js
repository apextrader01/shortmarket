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
        console.log('\n🔄 0. Verifying database columns and indexes...');
        try {
            await db.raw('ALTER TABLE orders ADD COLUMN IF NOT EXISTS is_exit BOOLEAN DEFAULT false;');
            await db.raw('ALTER TABLE orders_archive ADD COLUMN IF NOT EXISTS is_exit BOOLEAN DEFAULT false;');
            await db.raw('ALTER TABLE journal_trades ADD COLUMN IF NOT EXISTS trade_date VARCHAR(20);');
        } catch (dbErr) {
            console.warn('DB alter warning (non-fatal):', dbErr.message);
        }
        if (typeof db.ensureCriticalColumns === 'function') {
            await db.ensureCriticalColumns();
        }

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
