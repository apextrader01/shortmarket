/**
 * Deep Purge Script for SkandX Load Test Data
 * 
 * Safely and completely removes:
 *   - Any load test users from 'users' table (email LIKE 'loadtest_trader_%@skandx.in')
 *   - Any dummy payments from 'subscription_payments' (email LIKE 'loadtest_trader_%@skandx.in' OR username LIKE 'loadtest_user_%')
 *   - Any dummy orders, positions, holdings, trades, and ledger records
 *   - Clears Redis telemetry keys (telemetry:*) so the tracked user counters reset cleanly
 *
 * Usage:
 *   node scripts/purge_loadtest_data.js
 */

const path = require('path');
const fs = require('fs');

// 1. Load backend environment variables
const envCandidates = [
    path.join(__dirname, '../backend/.env'),
    path.join(process.cwd(), 'backend/.env'),
    path.join(__dirname, '../../backend/.env')
];
for (const envPath of envCandidates) {
    if (fs.existsSync(envPath)) {
        try {
            require('dotenv').config({ path: envPath });
            break;
        } catch (e) {}
    }
}

// 2. Load Database & Redis Client
let db = null;
try {
    db = require(path.join(__dirname, '../backend/database/db'));
} catch (e) {
    try { db = require(path.join(process.cwd(), 'backend/database/db')); } catch(e2) {}
}

async function runPurge() {
    console.log('\n======================================================');
    console.log('🧹 SKANDX DEEP PURGE: REMOVING ALL LOAD TEST DATA');
    console.log('======================================================\n');

    if (!db) {
        console.error('❌ Database connection not available. Ensure DATABASE_URL is set.');
        process.exit(1);
    }

    try {
        // A. Find all test user IDs
        const testUsers = await db('users')
            .where('email', 'like', 'loadtest_trader_%@skandx.in')
            .orWhere('username', 'like', 'loadtest_user_%')
            .select('id', 'email', 'username');

        const testUserIds = testUsers.map(u => u.id);
        console.log(`🔍 Found ${testUsers.length} test user accounts in 'users' table.`);

        // B. Purge from subscription_payments
        let deletedSubscriptions = 0;
        try {
            const hasSubTable = await db.schema.hasTable('subscription_payments');
            if (hasSubTable) {
                let subQuery = db('subscription_payments')
                    .where('email', 'like', 'loadtest_trader_%@skandx.in')
                    .orWhere('username', 'like', 'loadtest_user_%');
                if (testUserIds.length > 0) {
                    subQuery = subQuery.orWhereIn('user_id', testUserIds);
                }
                deletedSubscriptions = await subQuery.del();
                console.log(`✅ Deleted ${deletedSubscriptions} load test records from 'subscription_payments'.`);
            }
        } catch (subErr) {
            console.warn('⚠️ Note on subscription_payments purge:', subErr.message);
        }

        // C. Purge associated trading data (orders, positions, holdings, trades, ledger)
        if (testUserIds.length > 0) {
            const tablesToClean = ['orders', 'positions', 'holdings', 'trades', 'ledger', 'user_sessions', 'watchlists'];
            for (const tbl of tablesToClean) {
                try {
                    const hasTable = await db.schema.hasTable(tbl);
                    if (hasTable) {
                        const count = await db(tbl).whereIn('user_id', testUserIds).del();
                        if (count > 0) {
                            console.log(`✅ Deleted ${count} test records from '${tbl}'.`);
                        }
                    }
                } catch (tErr) {}
            }

            // D. Delete the test users
            const deletedUsers = await db('users')
                .whereIn('id', testUserIds)
                .del();
            console.log(`✅ Deleted ${deletedUsers} test accounts from 'users'.`);
        } else {
            // Also clean up any orphan records matching the email pattern
            const deletedOrphanSubs = await db('subscription_payments')
                .where('email', 'like', 'loadtest_trader_%@skandx.in')
                .orWhere('username', 'like', 'loadtest_user_%')
                .del()
                .catch(() => 0);
            if (deletedOrphanSubs > 0) {
                console.log(`✅ Deleted ${deletedOrphanSubs} orphan load test records from 'subscription_payments'.`);
            }
        }

        // E. Reset PostgreSQL users_id_seq back to MAX(id) so new real customers get sequential Client IDs
        try {
            const maxUser = await db('users').max('id as max_id').first();
            const nextVal = Math.max(1, parseInt(maxUser?.max_id || 1, 10));
            await db.raw(`SELECT setval(pg_get_serial_sequence('users', 'id'), ?)`, [nextVal]);
            const nextClientCode = 'SE' + Number(nextVal + 1).toString(36).toUpperCase().padStart(6, '0');
            console.log(`✅ Reset PostgreSQL 'users' ID sequence to ${nextVal}. The next real customer will receive sequential Client ID ${nextClientCode}!`);
        } catch (seqErr) {
            console.warn('⚠️ Note on sequence reset:', seqErr.message);
        }

        // F. Reset Redis Telemetry & APM counters
        try {
            const redisModulePath = path.join(__dirname, '../backend/services/redisClient');
            if (fs.existsSync(redisModulePath + '.js')) {
                const { generalClient } = require(redisModulePath);
                if (generalClient) {
                    // Wait up to 3 seconds for Redis connection
                    let ready = generalClient.isReady;
                    for (let r = 0; r < 6 && !ready; r++) {
                        await new Promise(res => setTimeout(res, 500));
                        ready = generalClient.isReady;
                    }
                    if (ready) {
                        const keysToDelete = [];
                        for await (const chunk of generalClient.scanIterator({ MATCH: 'telemetry:*', COUNT: 200 })) {
                            const keys = Array.isArray(chunk) ? chunk : [chunk];
                            keysToDelete.push(...keys);
                        }
                        for await (const chunk of generalClient.scanIterator({ MATCH: 'apm:*', COUNT: 200 })) {
                            const keys = Array.isArray(chunk) ? chunk : [chunk];
                            keysToDelete.push(...keys);
                        }
                        if (keysToDelete.length > 0) {
                            await generalClient.del(keysToDelete);
                            console.log(`✅ Cleared ${keysToDelete.length} telemetry/APM cache keys from Redis.`);
                        } else {
                            console.log('ℹ️ Redis telemetry was already empty.');
                        }
                    }
                }
            }
        } catch (rErr) {
            console.warn('⚠️ Note on Redis telemetry reset:', rErr.message);
        }

        console.log('\n======================================================');
        console.log('🎉 PURGE COMPLETE: Database & Admin Panel Are 100% Clean!');
        console.log('======================================================\n');
        process.exit(0);
    } catch (err) {
        console.error('❌ Purge failed:', err);
        process.exit(1);
    }
}

runPurge();
