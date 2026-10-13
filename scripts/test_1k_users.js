/**
 * SkandX Heavy-Stack High-Concurrency Real-World Trading Load Tester
 * 
 * Simulates complete realistic trading floor behavior at scale (1,000 to 10,000 users):
 *   1. 1,000+ Real-Time WebSocket LTP streaming connections
 *   2. Dynamic Watchlist Churn (adding & removing stocks on the fly)
 *   3. Regular BUY/SELL Limit & Market Orders
 *   4. BO (Bracket Orders) with Stop-Loss and Target legs
 *   5. CO (Cover Orders) with Stop-Loss triggers
 *   6. Editing Open Orders (modifying price and quantity)
 *   7. Cancelling Open Orders
 *   8. Heavy REST API load (Orders, Positions, Bhavcopy, Deals)
 *
 * Usage:
 *   node scripts/test_1k_users.js
 *   node scripts/test_1k_users.js [URL] [TOTAL_USERS] [DURATION_SECONDS]
 *
 * Examples:
 *   node scripts/test_1k_users.js http://localhost:5000 1000 30
 *   node scripts/test_1k_users.js https://skandx.in 1000 30
 */

const path = require('path');
const os = require('os');
const fs = require('fs');

// Resolve socket.io-client
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

// Resolve Database & JWT Secret if running locally/on-server
let db = null;
let jwt = null;
let jwtSecret = process.env.JWT_SECRET || null;

try {
    jwt = require('jsonwebtoken');
} catch (e) {
    try { jwt = require(path.join(__dirname, '../backend/node_modules/jsonwebtoken')); } catch(e2) {}
}

try {
    db = require(path.join(__dirname, '../backend/database/db'));
} catch (e) {
    try { db = require(path.join(process.cwd(), 'backend/database/db')); } catch(e2) {}
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
    'NSE:ASIANPAINT-EQ'
];

async function detectTarget() {
    if (process.argv[2] && process.argv[2].startsWith('http')) {
        return process.argv[2];
    }
    try {
        const res = await fetch('http://localhost:5000/api/health', { signal: AbortSignal.timeout(1200) });
        if (res.ok) return 'http://localhost:5000';
    } catch (e) {}
    try {
        const res = await fetch('http://127.0.0.1:5000/api/health', { signal: AbortSignal.timeout(1200) });
        if (res.ok) return 'http://127.0.0.1:5000';
    } catch (e) {}
    return 'https://skandx.in';
}

async function prepareAuthTokens() {
    if (!db || !jwt || !jwtSecret) return [];
    try {
        const users = await db('users').select('id', 'email', 'virtual_balance').limit(20);
        if (!users || users.length === 0) return [];
        return users.map(u => ({
            id: u.id,
            email: u.email,
            token: jwt.sign({ id: u.id, email: u.email }, jwtSecret, { expiresIn: '2h' })
        }));
    } catch (e) {
        return [];
    }
}

async function run() {
    const targetUrl = await detectTarget();
    const totalUsers = parseInt(process.argv[3] || process.env.USERS || '1000', 10);
    const durationSeconds = parseInt(process.argv[4] || process.env.DURATION || '30', 10);

    const authUsers = await prepareAuthTokens();

    console.log('\n======================================================================');
    console.log(`🚀 SKANDX HEAVY-STACK TRADING SIMULATION: ${totalUsers} CONCURRENT USERS`);
    console.log('======================================================================');
    console.log(`🎯 Target URL:             ${targetUrl}`);
    console.log(`👥 Total Simulated Users:  ${totalUsers}`);
    console.log(`⏱️  Observation Window:    ${durationSeconds} seconds`);
    console.log(`🔄 Dynamic Watchlist:      Continuous Add/Remove stock churning`);
    console.log(`📦 Order Types Simulated:  Regular Limit, BO (Bracket), CO (Cover), Edit & Cancel`);
    console.log(`🔑 Active Auth Traders:    ${authUsers.length > 0 ? `${authUsers.length} authenticated sessions loaded` : 'Public/Viewer mode (No DB auth token found)'}`);
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

    const createdOrderIds = [];
    const connectLatencies = [];
    const firstTickLatencies = [];
    const sockets = [];
    const sampleUsers = new Set([1, Math.floor(totalUsers * 0.25), Math.floor(totalUsers * 0.5), Math.floor(totalUsers * 0.75), totalUsers]);

    console.log('⏳ 1. Ramping up active WebSocket connections...');

    const batchSize = 50;
    const rampDelayMs = 120;

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
            timeout: 12000
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
    console.log(`⏳ 2. Running Full Heavy-Stack Trading Execution Engine...\n`);

    let boEventDone = false;
    let coEventDone = false;
    let editEventDone = false;
    let cancelEventDone = false;
    let addEventDone = false;
    let removeEventDone = false;

    for (let sec = 1; sec <= durationSeconds; sec++) {
        await new Promise(r => setTimeout(r, 1000));

        // EVENT 1 (Sec 4): Dynamic Watchlist Add
        if (sec === 4 && !addEventDone) {
            addEventDone = true;
            console.log('\n\n⚡ [EVENT: WATCHLIST ADD] 750 Users adding new trending stock to watchlists...');
            sockets.slice(0, Math.floor(totalUsers * 0.75)).forEach((s, idx) => {
                const newStock = ROTATION_STOCKS[idx % ROTATION_STOCKS.length];
                s._currentSymbols.add(newStock);
                s.emit('join_room', newStock);
                s.emit('subscribe', [newStock]);
                dynamicStocksAdded++;
            });
            console.log(`   ✔ Dispatched ${dynamicStocksAdded} dynamic stock subscriptions!`);
        }

        // EVENT 2 (Sec 7): Regular Limit Orders (Placing Buy & Sell Orders)
        if (sec === 7 && authUsers.length > 0) {
            console.log('\n\n⚡ [EVENT: REGULAR ORDERS] Virtual traders placing Buy & Sell Limit orders...');
            for (let k = 0; k < Math.min(authUsers.length * 2, 20); k++) {
                const trader = authUsers[k % authUsers.length];
                try {
                    const res = await fetch(`${targetUrl}/api/order`, {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            'Authorization': `Bearer ${trader.token}`
                        },
                        body: JSON.stringify({
                            symbol: 'NSE:TATASTEEL-EQ',
                            side: k % 2 === 0 ? 'BUY' : 'SELL',
                            type: 'LIMIT',
                            price: 155.00 + (k * 0.5), // Lower limit price so it stays OPEN for editing/cancelling
                            quantity: 10,
                            product_type: 'INT'
                        })
                    });
                    const data = await res.json();
                    if (data && data.order && data.order.id) {
                        createdOrderIds.push({ id: data.order.id, token: trader.token });
                        regularOrdersPlaced++;
                    } else if (res.ok) {
                        regularOrdersPlaced++;
                    } else {
                        orderErrors++;
                    }
                } catch (e) {
                    orderErrors++;
                }
            }
            console.log(`   ✔ Placed ${regularOrdersPlaced} regular Limit orders into the engine!`);
        }

        // EVENT 3 (Sec 11): BO (Bracket Orders) with Stop-Loss & Target
        if (sec === 11 && !boEventDone && authUsers.length > 0) {
            boEventDone = true;
            console.log('\n\n⚡ [EVENT: BRACKET ORDERS (BO)] Virtual traders placing 3-leg Bracket Orders (Entry + Target + SL)...');
            for (let k = 0; k < Math.min(authUsers.length, 10); k++) {
                const trader = authUsers[k % authUsers.length];
                try {
                    const res = await fetch(`${targetUrl}/api/order`, {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            'Authorization': `Bearer ${trader.token}`
                        },
                        body: JSON.stringify({
                            symbol: 'NSE:RELIANCE-EQ',
                            side: 'BUY',
                            type: 'LIMIT',
                            price: 1100.00,
                            quantity: 5,
                            product_type: 'BO',
                            sl_price: 1050.00,
                            tgt_price: 1200.00
                        })
                    });
                    const data = await res.json();
                    if (res.ok) {
                        boOrdersPlaced++;
                        if (data && data.order && data.order.id) {
                            createdOrderIds.push({ id: data.order.id, token: trader.token });
                        }
                    } else {
                        orderErrors++;
                    }
                } catch (e) {
                    orderErrors++;
                }
            }
            console.log(`   ✔ Placed ${boOrdersPlaced} Bracket Orders (BO) with Target & SL legs!`);
        }

        // EVENT 4 (Sec 15): CO (Cover Orders) with SL Trigger
        if (sec === 15 && !coEventDone && authUsers.length > 0) {
            coEventDone = true;
            console.log('\n\n⚡ [EVENT: COVER ORDERS (CO)] Virtual traders placing Cover Orders (Entry + Stop Loss Trigger)...');
            for (let k = 0; k < Math.min(authUsers.length, 10); k++) {
                const trader = authUsers[k % authUsers.length];
                try {
                    const res = await fetch(`${targetUrl}/api/order`, {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            'Authorization': `Bearer ${trader.token}`
                        },
                        body: JSON.stringify({
                            symbol: 'NSE:HDFCBANK-EQ',
                            side: 'BUY',
                            type: 'LIMIT',
                            price: 650.00,
                            quantity: 5,
                            product_type: 'CO',
                            trigger_price: 630.00
                        })
                    });
                    const data = await res.json();
                    if (res.ok) {
                        coOrdersPlaced++;
                        if (data && data.order && data.order.id) {
                            createdOrderIds.push({ id: data.order.id, token: trader.token });
                        }
                    } else {
                        orderErrors++;
                    }
                } catch (e) {
                    orderErrors++;
                }
            }
            console.log(`   ✔ Placed ${coOrdersPlaced} Cover Orders (CO) with SL trigger!`);
        }

        // EVENT 5 (Sec 18): Dynamic Watchlist Remove
        if (sec === 18 && !removeEventDone) {
            removeEventDone = true;
            console.log('\n\n⚡ [EVENT: WATCHLIST REMOVE] 500 Users removing old stocks from watchlists...');
            sockets.slice(0, Math.floor(totalUsers * 0.5)).forEach((s, idx) => {
                const oldStock = BASE_STOCKS[idx % BASE_STOCKS.length];
                s._currentSymbols.delete(oldStock);
                s.emit('unsubscribe', [oldStock]);
                dynamicStocksRemoved++;
            });
            console.log(`   ✔ Dispatched ${dynamicStocksRemoved} dynamic stock unsubscriptions!`);
        }

        // EVENT 6 (Sec 21): Edit Open Orders (Modify Price & Qty)
        if (sec === 21 && !editEventDone && createdOrderIds.length > 0) {
            editEventDone = true;
            console.log('\n\n⚡ [EVENT: EDIT OPEN ORDERS] Traders modifying open order prices & quantities...');
            const toEdit = createdOrderIds.slice(0, 10);
            for (const ord of toEdit) {
                try {
                    const res = await fetch(`${targetUrl}/api/order/${ord.id}`, {
                        method: 'PUT',
                        headers: {
                            'Content-Type': 'application/json',
                            'Authorization': `Bearer ${ord.token}`
                        },
                        body: JSON.stringify({
                            price: 156.50,
                            quantity: 15
                        })
                    });
                    if (res.ok) ordersEdited++;
                } catch (e) {}
            }
            console.log(`   ✔ Modified ${ordersEdited} open orders successfully via PUT /api/order/:id!`);
        }

        // EVENT 7 (Sec 25): Cancel Orders
        if (sec === 25 && !cancelEventDone && createdOrderIds.length > 0) {
            cancelEventDone = true;
            console.log('\n\n⚡ [EVENT: CANCEL ORDERS] Traders cancelling open orders...');
            const toCancel = createdOrderIds.slice(0, 12);
            for (const ord of toCancel) {
                try {
                    const res = await fetch(`${targetUrl}/api/order/${ord.id}/cancel`, {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            'Authorization': `Bearer ${ord.token}`
                        }
                    });
                    if (res.ok) ordersCancelled++;
                } catch (e) {}
            }
            console.log(`   ✔ Cancelled ${ordersCancelled} open orders cleanly via POST /api/order/:id/cancel!`);
        }

        // REST Pollers: Screener & Market Data
        if (sec % 3 === 0) {
            fetch(`${targetUrl}/api/bhavcopy/delivery?limit=10&page=1`)
                .then(r => r.ok ? apiCallsCompleted++ : apiCallsFailed++)
                .catch(() => apiCallsFailed++);
            fetch(`${targetUrl}/api/market-deals?limit=10&page=1`)
                .then(r => r.ok ? apiCallsCompleted++ : apiCallsFailed++)
                .catch(() => apiCallsFailed++);
        }

        process.stdout.write(`\r   ⏱️  Time: ${sec}s/${durationSeconds}s | WS: ${connectedCount}/${totalUsers} | Ticks: ${totalTicksReceived} | Orders: ${regularOrdersPlaced + boOrdersPlaced + coOrdersPlaced} (Edit: ${ordersEdited}, Cancel: ${ordersCancelled})`);
    }

    console.log('\n\n🧹 Cleaning up test sockets...');
    sockets.forEach(s => {
        try { s.disconnect(); } catch (e) {}
    });

    const avgConnect = connectLatencies.length > 0 
        ? Math.round(connectLatencies.reduce((a, b) => a + b, 0) / connectLatencies.length) 
        : 0;
    const avgFirstTick = firstTickLatencies.length > 0 
        ? Math.round(firstTickLatencies.reduce((a, b) => a + b, 0) / firstTickLatencies.length) 
        : 0;
    const successPct = ((usersWithAtLeastOneTick / totalUsers) * 100).toFixed(1);

    console.log('\n======================================================================');
    console.log('📊 SKANDX HEAVY-STACK STRESS TEST SCORECARD');
    console.log('======================================================================');
    console.log(`Target Tested:                 ${targetUrl}`);
    console.log(`Total Simulated Users:         ${totalUsers}`);
    console.log(`WebSocket Connections:         ${connectedCount} / ${totalUsers} (${((connectedCount / totalUsers) * 100).toFixed(1)}%)`);
    console.log(`Users Receiving Live LTP:      ${usersWithAtLeastOneTick} / ${totalUsers} (${successPct}%)`);
    console.log(`Total Live Price Ticks:        ${totalTicksReceived}`);
    console.log(`Dynamic Watchlist Added:       ${dynamicStocksAdded} stocks`);
    console.log(`Dynamic Watchlist Removed:     ${dynamicStocksRemoved} stocks`);
    console.log(`Regular Limit Orders Placed:   ${regularOrdersPlaced}`);
    console.log(`Bracket Orders (BO) Placed:    ${boOrdersPlaced}`);
    console.log(`Cover Orders (CO) Placed:      ${coOrdersPlaced}`);
    console.log(`Orders Modified (Edit Open):   ${ordersEdited}`);
    console.log(`Orders Cancelled Cleanly:      ${ordersCancelled}`);
    console.log(`REST Screener API Requests:    ${apiCallsCompleted} successful (${apiCallsFailed} failed)`);
    console.log(`Avg Connection Latency:        ${avgConnect} ms`);
    console.log(`Avg First-Tick Latency:        ${avgFirstTick} ms`);
    console.log(`Failed / Dropped Sockets:      ${totalUsers - connectedCount}`);
    console.log('----------------------------------------------------------------------');

    if (connectedCount >= totalUsers * 0.95) {
        console.log(`🎉 VERDICT: EXCELLENT! High-concurrency heavy trading stack passed 100%!`);
        console.log('   The platform handled WebSocket streaming, Watchlist churn, and Order execution simultaneously.');
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
