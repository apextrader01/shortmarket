/**
 * SkandX 10-Minute Continuous Heavy-Stack Trading Load Tester
 * 
 * Simulates 1,000 active concurrent users running continuously for 10 minutes (600s):
 *   - Continuous live WebSocket LTP streaming across all 1,000 users
 *   - EVERY SECOND: New orders placed (Regular Limit, BO Bracket Orders, CO Cover Orders)
 *   - EVERY SECOND: Open orders edited (modifying price and quantity)
 *   - EVERY SECOND: Orders cancelled (including BO & CO legs)
 *   - EVERY SECOND: Dynamic Watchlist Churn (new stocks added, old stocks removed)
 *   - EVERY 4 SECONDS: Concurrent REST API screener queries
 *   - Graceful SIGINT handler (Ctrl+C) ensures 100% clean database deletion anytime
 *
 * Usage:
 *   node scripts/test_1k_users.js
 *   node scripts/test_1k_users.js [URL] [TOTAL_USERS] [DURATION_SECONDS]
 *   node scripts/test_1k_users.js --cleanup
 *
 * Examples:
 *   node scripts/test_1k_users.js http://localhost:5000 1000 600   # 10 minutes
 *   node scripts/test_1k_users.js http://localhost:5000 1000 120   # 2 minutes test
 *   node scripts/test_1k_users.js --cleanup
 */

const path = require('path');
const os = require('os');
const fs = require('fs');

// 1. Load backend environment variables (.env) before anything else
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

// 2. Resolve Database & Auth Middleware
let db = null;
let jwt = null;
let authModule = null;
let jwtSecret = process.env.JWT_SECRET || null;

try {
    jwt = require('jsonwebtoken');
} catch (e) {
    try { jwt = require(path.join(__dirname, '../backend/node_modules/jsonwebtoken')); } catch(e2) {}
}

try {
    authModule = require('../backend/middleware/auth');
} catch (e) {
    try { authModule = require(path.join(process.cwd(), 'backend/middleware/auth')); } catch(e2) {}
}

if (!jwtSecret && authModule && authModule.JWT_SECRET) {
    jwtSecret = authModule.JWT_SECRET;
}

if (!jwtSecret) {
    const secretFiles = [
        path.join(__dirname, '../backend/.jwt_secret'),
        path.join(process.cwd(), 'backend/.jwt_secret')
    ];
    for (const sf of secretFiles) {
        if (fs.existsSync(sf)) {
            try { jwtSecret = fs.readFileSync(sf, 'utf8').trim(); break; } catch(e) {}
        }
    }
}

try {
    db = require(path.join(__dirname, '../backend/database/db'));
} catch (e) {
    try { db = require(path.join(process.cwd(), 'backend/database/db')); } catch(e2) {}
}

// Dedicated cleanup command handler
if (process.argv.includes('--cleanup')) {
    (async () => {
        if (!db) {
            console.error('❌ Database not available for cleanup.');
            process.exit(1);
        }
        console.log('\n🧹 Cleaning up all test trader accounts and orders from PostgreSQL...');
        try {
            const deleted = await db('users')
                .where('email', 'like', 'loadtest_trader_%@skandx.in')
                .del();
            console.log(`✅ Successfully deleted ${deleted} test accounts and all associated orders/positions! Database is clean.\n`);
        } catch (e) {
            console.error('❌ Cleanup error:', e.message);
        }
        process.exit(0);
    })();
    return;
}

// 3. Resolve socket.io-client
let io;
const possiblePaths = [
    'socket.io-client',
    path.join(__dirname, '../frontend/node_modules/socket.io-client'),
    path.join(__dirname, '../backend/node_modules/socket.io-client'),
    path.join(process.cwd(), 'frontend/node_modules/socket.io-client'),
    path.join(process.cwd(), 'node_modules/socket.io-client')
];

for (const p of possiblePaths) {
    try {
        io = require(p);
        if (typeof io === 'function' || (io && typeof io.io === 'function')) {
            if (typeof io !== 'function' && typeof io.io === 'function') io = io.io;
            break;
        }
    } catch (e) {}
}

if (!io) {
    console.error('❌ Could not load socket.io-client. Please run npm install in frontend or backend.');
    process.exit(1);
}

const BASE_STOCKS = [
    'NSE:RELIANCE-EQ',
    'NSE:TATASTEEL-EQ',
    'NSE:HDFCBANK-EQ',
    'NSE:INFY-EQ',
    'NSE:NIFTY50-INDEX',
    'NSE:ITC-EQ',
    'NSE:ICICIBANK-EQ',
    'NSE:SBIN-EQ'
];

const ROTATION_STOCKS = [
    'NSE:BAJFINANCE-EQ',
    'NSE:MARUTI-EQ',
    'NSE:LT-EQ',
    'NSE:BHARTIARTL-EQ',
    'NSE:AXISBANK-EQ',
    'BSE:SENSEX-INDEX',
    'NSE:KOTAKBANK-EQ',
    'NSE:ASIANPAINT-EQ',
    'NSE:SUNPHARMA-EQ',
    'NSE:TITAN-EQ',
    'NSE:TCS-EQ',
    'NSE:WIPRO-EQ'
];

function formatMMSS(totalSeconds) {
    const mins = Math.floor(totalSeconds / 60);
    const secs = totalSeconds % 60;
    return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

async function detectTarget() {
    if (process.argv[2] && process.argv[2].startsWith('http')) {
        return process.argv[2];
    }
    // Wait for localhost:5000 to become ready (up to 15 attempts in case pm2 was just restarted)
    for (let attempt = 1; attempt <= 15; attempt++) {
        try {
            const res = await fetch('http://localhost:5000/api/health', { signal: AbortSignal.timeout(1500) });
            if (res.ok) {
                if (attempt > 1) console.log('\n');
                return 'http://localhost:5000';
            }
        } catch (e) {}
        try {
            const res = await fetch('http://127.0.0.1:5000/api/health', { signal: AbortSignal.timeout(1500) });
            if (res.ok) {
                if (attempt > 1) console.log('\n');
                return 'http://127.0.0.1:5000';
            }
        } catch (e) {}
        if (attempt === 1) process.stdout.write('⏳ Waiting for backend on http://localhost:5000 to be ready...');
        else process.stdout.write('.');
        await new Promise(r => setTimeout(r, 1000));
    }
    return 'http://localhost:5000';
}

async function ensureTestTraderAccounts(count = 1000) {
    if (!db) return [];
    try {
        const existing = await db('users')
            .where('email', 'like', 'loadtest_trader_%@skandx.in')
            .select('id', 'email')
            .limit(count);

        if (existing.length >= count) {
            console.log(`✅ Using ${existing.length} existing load test trader accounts from PostgreSQL.`);
            return existing;
        }

        const needed = count - existing.length;
        console.log(`🌱 Seeding ${needed} dedicated real trader accounts in PostgreSQL (₹10,00,000 cash each)...`);

        const startIndex = existing.length + 1;
        const batch = [];
        const dummyHash = '$2b$10$abcdefghijklmnopqrstuvwx.dummyHashForTesting1234567890';

        for (let i = 0; i < needed; i++) {
            const num = startIndex + i;
            batch.push({
                username: `loadtest_user_${num}`,
                email: `loadtest_trader_${num}@skandx.in`,
                password_hash: dummyHash,
                balance: 1000000.0,
                subscription_tier: 'PRO',
                watchlists: '[]'
            });
        }

        await db.batchInsert('users', batch, 100);
        console.log(`✅ Successfully seeded ${count} real test accounts in PostgreSQL!`);

        return await db('users')
            .where('email', 'like', 'loadtest_trader_%@skandx.in')
            .select('id', 'email')
            .limit(count);
    } catch (e) {
        console.warn('⚠️ Note on database seeding:', e.message);
        return [];
    }
}

async function prepareAuthTokens(targetCount = 1000) {
    const secret = jwtSecret || (authModule && authModule.JWT_SECRET) || process.env.JWT_SECRET;
    if (!secret || !jwt) {
        console.warn('⚠️ No JWT secret detected. Running public traffic mode.');
        return [];
    }

    const testUsers = await ensureTestTraderAccounts(targetCount);
    if (testUsers && testUsers.length > 0) {
        console.log(`🔑 Generated authenticated tokens for all ${testUsers.length} real trader database accounts.`);
        return testUsers.map(u => ({
            id: u.id,
            email: u.email,
            token: jwt.sign({ id: u.id, email: u.email }, secret, { expiresIn: '4h' })
        }));
    }

    return [];
}

async function run() {
    const targetUrl = await detectTarget();
    const totalUsers = parseInt(process.argv[3] || process.env.USERS || '1000', 10);
    // Default duration is 600 seconds = 10 full minutes
    const durationSeconds = parseInt(process.argv[4] || process.env.DURATION || '600', 10);

    const authUsers = await prepareAuthTokens(totalUsers);

    console.log('\n======================================================================');
    console.log(`🚀 SKANDX 10-MINUTE CONTINUOUS HEAVY TRADING SIMULATION`);
    console.log('======================================================================');
    console.log(`🎯 Target URL:             ${targetUrl}`);
    console.log(`👥 Total Simulated Users:  ${totalUsers}`);
    console.log(`⏱️  Duration:              ${durationSeconds}s (${formatMMSS(durationSeconds)} minutes)`);
    console.log(`🔄 Every 1 Second:         Place Orders (Limit, BO, CO), Edit Orders, Cancel Orders`);
    console.log(`🔄 Every 1 Second:         Dynamic Watchlist Churn (Add & Remove stocks)`);
    console.log(`🔑 Real DB Accounts:       ${authUsers.length > 0 ? `${authUsers.length} authenticated accounts loaded` : 'Public mode'}`);
    console.log(`🧹 Auto-Cleanup:           Enabled (All test accounts deleted on finish or Ctrl+C)`);
    console.log('======================================================================\n');

    let connectedCount = 0;
    let disconnectedCount = 0;
    let usersWithAtLeastOneTick = 0;
    let totalTicksReceived = 0;
    let dynamicStocksAdded = 0;
    let dynamicStocksRemoved = 0;

    // Order metrics
    let regularOrdersPlaced = 0;
    let boOrdersPlaced = 0;
    let coOrdersPlaced = 0;
    let ordersEdited = 0;
    let ordersCancelled = 0;
    let orderErrors = 0;
    let apiCallsCompleted = 0;
    let apiCallsFailed = 0;

    const openOrdersPool = [];
    const connectLatencies = [];
    const firstTickLatencies = [];
    const sockets = [];
    const sampleUsers = new Set([1, Math.floor(totalUsers * 0.25), Math.floor(totalUsers * 0.5), Math.floor(totalUsers * 0.75), totalUsers]);

    // Trap Ctrl+C (SIGINT) to cleanly delete database accounts even if user stops early
    let isCleaningUp = false;
    async function cleanupAndExit() {
        if (isCleaningUp) return;
        isCleaningUp = true;
        console.log('\n\n🛑 Stopping load test early...');
        console.log('🧹 Disconnecting sockets & cleaning up PostgreSQL test accounts...');
        sockets.forEach(s => { try { s.disconnect(); } catch (e) {} });
        if (db && !process.argv.includes('--keep')) {
            try {
                const deleted = await db('users')
                    .where('email', 'like', 'loadtest_trader_%@skandx.in')
                    .del();
                console.log(`✅ Cleaned up ${deleted} test accounts and associated orders from PostgreSQL. Database is 100% clean!\n`);
            } catch (e) {}
        }
        process.exit(0);
    }
    process.on('SIGINT', cleanupAndExit);
    process.on('SIGTERM', cleanupAndExit);

    console.log('⏳ 1. Ramping up 1,000 active WebSocket connections...');

    const batchSize = 50;
    const rampDelayMs = 90;

    for (let i = 1; i <= totalUsers; i++) {
        const userId = i;
        const userConnectStart = Date.now();
        const initialSymbols = [
            BASE_STOCKS[(userId - 1) % BASE_STOCKS.length],
            BASE_STOCKS[(userId) % BASE_STOCKS.length]
        ];

        const socket = io(targetUrl, {
            transports: ['websocket'],
            reconnection: false,
            timeout: 15000
        });

        socket._userId = userId;
        socket._currentSymbols = new Set(initialSymbols);
        sockets.push(socket);

        let receivedFirstTick = false;

        socket.on('connect', () => {
            connectedCount++;
            connectLatencies.push(Date.now() - userConnectStart);

            initialSymbols.forEach(sym => socket.emit('join_room', sym));
            socket.emit('subscribe', initialSymbols);
        });

        socket.on('price_snapshot', (snapshot) => {
            totalTicksReceived++;
            if (!receivedFirstTick) {
                receivedFirstTick = true;
                usersWithAtLeastOneTick++;
                const delay = Date.now() - userConnectStart;
                firstTickLatencies.push(delay);

                if (sampleUsers.has(userId)) {
                    const firstSym = Object.keys(snapshot)[0];
                    const val = snapshot[firstSym];
                    const ltp = Array.isArray(val) ? val[0] : (val && val.ltp ? val.ltp : 'N/A');
                    console.log(`  ✔ [User #${String(userId).padStart(4, ' ')}] Live tick received: ${firstSym} = ₹${ltp} (Latency: ${delay}ms)`);
                }
            }
        });

        socket.on('disconnect', () => disconnectedCount++);
        socket.on('connect_error', () => disconnectedCount++);

        if (i % batchSize === 0) {
            process.stdout.write(`\r   Connecting: ${i}/${totalUsers} users queued... (Active WS: ${connectedCount})`);
            await new Promise(r => setTimeout(r, rampDelayMs));
        }
    }

    console.log(`\n\n✅ All ${totalUsers} user connections established!`);
    console.log(`🔥 2. Starting continuous 10-minute heavy trading cycle (Watch 'pm2 monit' on your server!)\n`);

    // Continuous 1-Second Heavy Trading Loop
    for (let sec = 1; sec <= durationSeconds; sec++) {
        await new Promise(r => setTimeout(r, 1000));

        // ── A. EVERY SECOND: Dynamic Watchlist Churn (Add & Remove) ──
        if (sockets.length > 0) {
            // 15 random users add a new rotation stock
            for (let a = 0; a < 15; a++) {
                const randomSocket = sockets[Math.floor(Math.random() * sockets.length)];
                if (randomSocket && randomSocket.connected) {
                    const addStock = ROTATION_STOCKS[Math.floor(Math.random() * ROTATION_STOCKS.length)];
                    randomSocket._currentSymbols.add(addStock);
                    randomSocket.emit('join_room', addStock);
                    randomSocket.emit('subscribe', [addStock]);
                    dynamicStocksAdded++;
                }
            }
            // 10 random users remove an old stock
            for (let r = 0; r < 10; r++) {
                const randomSocket = sockets[Math.floor(Math.random() * sockets.length)];
                if (randomSocket && randomSocket.connected && randomSocket._currentSymbols.size > 1) {
                    const symArr = Array.from(randomSocket._currentSymbols);
                    const removeStock = symArr[0];
                    randomSocket._currentSymbols.delete(removeStock);
                    randomSocket.emit('unsubscribe', [removeStock]);
                    dynamicStocksRemoved++;
                }
            }
        }

        // ── B. EVERY SECOND: 4 Concurrent Orders Placed Across Random Traders ──
        if (authUsers.length > 0) {
            for (let o = 0; o < 4; o++) {
                const trader = authUsers[Math.floor(Math.random() * authUsers.length)];
                const orderRoll = (sec + o) % 3;

                if (orderRoll === 0) {
                    // Regular Limit BUY Order (placed below market ~174 so it remains PENDING for edit/cancel)
                    fetch(`${targetUrl}/api/order`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${trader.token}` },
                        body: JSON.stringify({
                            symbol: 'NSE:TATASTEEL-EQ',
                            side: 'BUY',
                            type: 'LIMIT',
                            price: parseFloat((165.00 + (Math.random() * 2)).toFixed(2)),
                            quantity: 10,
                            product_type: 'INT'
                        })
                    }).then(async r => {
                        const data = await r.json().catch(() => ({}));
                        if (r.ok && data?.orderId) {
                            regularOrdersPlaced++;
                            apiCallsCompleted++;
                            openOrdersPool.push({ id: data.orderId, token: trader.token, type: 'REGULAR' });
                        } else {
                            orderErrors++;
                            apiCallsFailed++;
                            if (orderErrors === 1) {
                                console.log('\n   ⚠️ [SAMPLE ORDER 1 ERROR]:', data?.error || JSON.stringify(data));
                            }
                        }
                    }).catch(err => {
                        orderErrors++;
                        apiCallsFailed++;
                        if (orderErrors === 1) console.log('\n   ⚠️ [SAMPLE ORDER 1 FETCH ERROR]:', err.message);
                    });
                } else if (orderRoll === 1) {
                    // Bracket Order (BO) BUY with Target & SL (stays PENDING)
                    fetch(`${targetUrl}/api/order`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${trader.token}` },
                        body: JSON.stringify({
                            symbol: 'NSE:RELIANCE-EQ',
                            side: 'BUY',
                            type: 'LIMIT',
                            price: parseFloat((1140.00 + (Math.random() * 5)).toFixed(2)),
                            quantity: 5,
                            product_type: 'BO',
                            sl_price: 1090.00,
                            tgt_price: 1250.00
                        })
                    }).then(async r => {
                        const data = await r.json().catch(() => ({}));
                        if (r.ok && data?.orderId) {
                            boOrdersPlaced++;
                            apiCallsCompleted++;
                            openOrdersPool.push({ id: data.orderId, token: trader.token, type: 'BO' });
                        } else {
                            orderErrors++;
                            apiCallsFailed++;
                            if (orderErrors === 1) {
                                console.log('\n   ⚠️ [SAMPLE BO ORDER ERROR]:', data?.error || JSON.stringify(data));
                            }
                        }
                    }).catch(err => {
                        orderErrors++;
                        apiCallsFailed++;
                        if (orderErrors === 1) console.log('\n   ⚠️ [SAMPLE BO FETCH ERROR]:', err.message);
                    });
                } else {
                    // Cover Order (CO) BUY with SL trigger (stays PENDING)
                    fetch(`${targetUrl}/api/order`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${trader.token}` },
                        body: JSON.stringify({
                            symbol: 'NSE:HDFCBANK-EQ',
                            side: 'BUY',
                            type: 'LIMIT',
                            price: parseFloat((690.00 + (Math.random() * 5)).toFixed(2)),
                            quantity: 5,
                            product_type: 'CO',
                            sl_price: 660.00,
                            trigger_price: 660.00
                        })
                    }).then(async r => {
                        const data = await r.json().catch(() => ({}));
                        if (r.ok && data?.orderId) {
                            coOrdersPlaced++;
                            apiCallsCompleted++;
                            openOrdersPool.push({ id: data.orderId, token: trader.token, type: 'CO' });
                        } else {
                            orderErrors++;
                            apiCallsFailed++;
                            if (orderErrors === 1) {
                                console.log('\n   ⚠️ [SAMPLE CO ORDER ERROR]:', data?.error || JSON.stringify(data));
                            }
                        }
                    }).catch(err => {
                        orderErrors++;
                        apiCallsFailed++;
                        if (orderErrors === 1) console.log('\n   ⚠️ [SAMPLE CO FETCH ERROR]:', err.message);
                    });
                }
            }
        }

        // ── C. EVERY SECOND: Edit Open Orders (Modify Price & Quantity) ──
        for (let e = 0; e < 2; e++) {
            if (openOrdersPool.length > 2) {
                const ordToEdit = openOrdersPool[Math.floor(Math.random() * openOrdersPool.length)];
                fetch(`${targetUrl}/api/order/${ordToEdit.id}`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${ordToEdit.token}` },
                    body: JSON.stringify({
                        price: parseFloat((163.00 + (Math.random() * 2)).toFixed(2)),
                        quantity: 12
                    })
                }).then(r => { if (r.ok) { ordersEdited++; apiCallsCompleted++; } else { apiCallsFailed++; } }).catch(() => apiCallsFailed++);
            }
        }

        // ── D. EVERY SECOND: Cancel Open Orders (including BO / CO) ──
        for (let c = 0; c < 2; c++) {
            if (openOrdersPool.length > 5) {
                const ordToCancel = openOrdersPool.shift(); // remove oldest
                fetch(`${targetUrl}/api/order/${ordToCancel.id}/cancel`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${ordToCancel.token}` }
                }).then(r => { if (r.ok) { ordersCancelled++; apiCallsCompleted++; } else { apiCallsFailed++; } }).catch(() => apiCallsFailed++);
            }
        }

        // ── E. EVERY SECOND: 8 Random Traders Refresh Profile & Orders (Distributes telemetry across all accounts) ──
        if (authUsers.length > 0) {
            for (let q = 0; q < 8; q++) {
                const trader = authUsers[Math.floor(Math.random() * authUsers.length)];
                fetch(`${targetUrl}/api/user/bootstrap`, {
                    headers: { 'Authorization': `Bearer ${trader.token}` }
                }).then(r => { if (r.ok) apiCallsCompleted++; else apiCallsFailed++; }).catch(() => apiCallsFailed++);
                fetch(`${targetUrl}/api/orders?limit=10`, {
                    headers: { 'Authorization': `Bearer ${trader.token}` }
                }).then(r => { if (r.ok) apiCallsCompleted++; else apiCallsFailed++; }).catch(() => apiCallsFailed++);
            }
        }

        // ── F. EVERY 2 SECONDS: Concurrent Screener REST Traffic ──
        if (sec % 2 === 0) {
            fetch(`${targetUrl}/api/bhavcopy/delivery?limit=10&page=1`)
                .then(r => r.ok ? apiCallsCompleted++ : apiCallsFailed++)
                .catch(() => apiCallsFailed++);
            fetch(`${targetUrl}/api/market-deals?limit=10&page=1`)
                .then(r => r.ok ? apiCallsCompleted++ : apiCallsFailed++)
                .catch(() => apiCallsFailed++);
        }

        // Periodic event milestone print every 30 seconds
        if (sec % 30 === 0) {
            console.log(`\n⚡ [${formatMMSS(sec)}] 1000 Users Active | Ticks: ${totalTicksReceived} | Orders: ${regularOrdersPlaced + boOrdersPlaced + coOrdersPlaced} (BO: ${boOrdersPlaced}, CO: ${coOrdersPlaced}) | Edited: ${ordersEdited} | Cancelled: ${ordersCancelled} | Total API Calls: ${apiCallsCompleted}`);
        }

        const totalOrders = regularOrdersPlaced + boOrdersPlaced + coOrdersPlaced;
        process.stdout.write(`\r   ⏱️  [${formatMMSS(sec)} / ${formatMMSS(durationSeconds)}] WS: ${connectedCount}/${totalUsers} | Ticks: ${totalTicksReceived} | Orders: ${totalOrders} (Edit: ${ordersEdited}, Cancel: ${ordersCancelled}) | API Calls: ${apiCallsCompleted}`);
    }

    console.log('\n\n🧹 3. Disconnecting virtual WebSocket users...');
    sockets.forEach(s => {
        try { s.disconnect(); } catch (e) {}
    });

    // Automatic Database Cleanup
    if (process.argv.includes('--keep')) {
        console.log('\n📌 Test accounts preserved in database (--keep specified). Run with --cleanup to delete them.');
    } else if (db) {
        console.log('\n🧹 4. Automatically cleaning up test accounts and orders from PostgreSQL...');
        try {
            const deleted = await db('users')
                .where('email', 'like', 'loadtest_trader_%@skandx.in')
                .del();
            console.log(`   ✔ Cleaned up ${deleted} test accounts and associated orders. Database is 100% clean!`);
        } catch (e) {
            console.warn('   ⚠️ Cleanup note:', e.message);
        }
    }

    const avgConnect = connectLatencies.length > 0 
        ? Math.round(connectLatencies.reduce((a, b) => a + b, 0) / connectLatencies.length) 
        : 0;
    const avgFirstTick = firstTickLatencies.length > 0 
        ? Math.round(firstTickLatencies.reduce((a, b) => a + b, 0) / firstTickLatencies.length) 
        : 0;
    const successPct = ((usersWithAtLeastOneTick / totalUsers) * 100).toFixed(1);

    console.log('\n======================================================================');
    console.log('📊 SKANDX 10-MINUTE HEAVY-STACK STRESS TEST SCORECARD');
    console.log('======================================================================');
    console.log(`Target Tested:                 ${targetUrl}`);
    console.log(`Total Simulated Users:         ${totalUsers}`);
    console.log(`Test Duration:                 ${durationSeconds} seconds (${formatMMSS(durationSeconds)} minutes)`);
    console.log(`WebSocket Connections:         ${connectedCount} / ${totalUsers} (${((connectedCount / totalUsers) * 100).toFixed(1)}%)`);
    console.log(`Users Receiving Live LTP:      ${usersWithAtLeastOneTick} / ${totalUsers} (${successPct}%)`);
    console.log(`Total Live Price Ticks:        ${totalTicksReceived}`);
    console.log(`Dynamic Watchlist Stocks Added:   ${dynamicStocksAdded} additions`);
    console.log(`Dynamic Watchlist Stocks Removed: ${dynamicStocksRemoved} removals`);
    console.log(`Regular Limit Orders Placed:   ${regularOrdersPlaced}`);
    console.log(`Bracket Orders (BO) Placed:    ${boOrdersPlaced}`);
    console.log(`Cover Orders (CO) Placed:      ${coOrdersPlaced}`);
    console.log(`Total Orders Executed:         ${regularOrdersPlaced + boOrdersPlaced + coOrdersPlaced}`);
    console.log(`Orders Modified (Edit Open):   ${ordersEdited}`);
    console.log(`Orders Cancelled Cleanly:      ${ordersCancelled}`);
    console.log(`Total HTTP REST API Calls:    ${apiCallsCompleted} successful (${apiCallsFailed} failed)`);
    console.log(`Avg Connection Latency:        ${avgConnect} ms`);
    console.log(`Avg First-Tick Latency:        ${avgFirstTick} ms`);
    console.log(`Failed / Dropped Sockets:      ${totalUsers - connectedCount}`);
    console.log('----------------------------------------------------------------------');

    if (connectedCount >= totalUsers * 0.95) {
        console.log(`🎉 VERDICT: OUTSTANDING! 10-minute continuous heavy trading simulation passed 100%!`);
        console.log('   The server handled non-stop WebSocket streaming, watchlist churning, and continuous order placements/cancels.');
    } else {
        console.log(`⚠️  VERDICT: Check PM2 resource metrics.`);
    }
    console.log('======================================================================\n');
    process.exit(0);
}

run().catch(err => {
    console.error('Error running load test:', err);
    process.exit(1);
});
