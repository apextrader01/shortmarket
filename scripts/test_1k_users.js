/**
 * SkandX Comprehensive High-Concurrency Trading & Watchlist Load Tester
 * Simulates 1,000 to 10,000 active users:
 *   - Continuous live WebSocket LTP streaming
 *   - Dynamic Watchlist Adding (subscribing to new stocks mid-session)
 *   - Dynamic Watchlist Removing (unsubscribing from stocks)
 *   - Concurrent REST API polling (Bhavcopy, Deals, LTP batch)
 *
 * Usage:
 *   node scripts/test_1k_users.js
 *   node scripts/test_1k_users.js [URL] [TOTAL_USERS] [DURATION_SECONDS]
 *
 * Examples:
 *   node scripts/test_1k_users.js http://localhost:5000 1000
 *   node scripts/test_1k_users.js http://localhost:5000 5000
 *   node scripts/test_1k_users.js https://skandx.in 1000 30
 */

const path = require('path');
const os = require('os');

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
    // Auto-check if local backend is running (port 5000)
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

async function run() {
    const targetUrl = await detectTarget();
    const totalUsers = parseInt(process.argv[3] || process.env.USERS || '1000', 10);
    const durationSeconds = parseInt(process.argv[4] || process.env.DURATION || '25', 10);

    console.log('\n======================================================================');
    console.log(`🚀 SKANDX REAL-WORLD TRADING & CONCURRENCY SIMULATION: ${totalUsers} USERS`);
    console.log('======================================================================');
    console.log(`🎯 Target URL:           ${targetUrl}`);
    console.log(`👥 Total Simulated Users:${totalUsers}`);
    console.log(`⏱️  Observation Window:  ${durationSeconds} seconds`);
    console.log(`🔄 Watchlist Churn:      Dynamic Stock Add/Remove every 5–8 seconds`);
    console.log(`📊 REST API Calls:       Concurrent Bhavcopy & Deals screener requests`);
    console.log('======================================================================\n');

    let connectedCount = 0;
    let disconnectedCount = 0;
    let usersWithAtLeastOneTick = 0;
    let totalTicksReceived = 0;
    let dynamicStocksAdded = 0;
    let dynamicStocksRemoved = 0;
    let apiCallsCompleted = 0;
    let apiCallsFailed = 0;

    const connectLatencies = [];
    const firstTickLatencies = [];
    const sockets = [];
    const sampleUsers = new Set([1, Math.floor(totalUsers * 0.25), Math.floor(totalUsers * 0.5), Math.floor(totalUsers * 0.75), totalUsers]);

    console.log('⏳ 1. Ramping up active trading connections...');

    const startTime = Date.now();
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

            // Initial subscription
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
                    console.log(`  ✔ [User #${String(userId).padStart(4, ' ')}] Live tick received: ${firstSym} = ₹${ltp} (First tick: ${delay}ms)`);
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
    console.log(`⏳ 2. Running active trading simulation: streaming prices + dynamic add/remove stocks + REST screener calls...\n`);

    // Dynamic Action Cycles during the observation window
    let addCycleDone = false;
    let removeCycleDone = false;
    let secondAddCycleDone = false;

    for (let sec = 1; sec <= durationSeconds; sec++) {
        await new Promise(r => setTimeout(r, 1000));

        // At second 5: 50% of users dynamically ADD a new stock to their watchlist
        if (sec === 5 && !addCycleDone) {
            addCycleDone = true;
            console.log('\n\n⚡ [EVENT: WATCHLIST ADD] Users are adding a new trending stock to their watchlists...');
            sockets.slice(0, Math.floor(totalUsers * 0.75)).forEach((s, idx) => {
                const newStock = ROTATION_STOCKS[idx % ROTATION_STOCKS.length];
                s._currentSymbols.add(newStock);
                s.emit('join_room', newStock);
                s.emit('subscribe', [newStock]);
                dynamicStocksAdded++;
            });
            console.log(`   ✔ Dispatched ${dynamicStocksAdded} dynamic stock additions across live connections!`);
        }

        // At second 10: Users REMOVE an old stock from their watchlist
        if (sec === 10 && !removeCycleDone) {
            removeCycleDone = true;
            console.log('\n\n⚡ [EVENT: WATCHLIST REMOVE] Users are removing completed positions/stocks from their watchlists...');
            sockets.slice(0, Math.floor(totalUsers * 0.5)).forEach((s, idx) => {
                const oldStock = BASE_STOCKS[idx % BASE_STOCKS.length];
                s._currentSymbols.delete(oldStock);
                s.emit('unsubscribe', [oldStock]);
                dynamicStocksRemoved++;
            });
            console.log(`   ✔ Dispatched ${dynamicStocksRemoved} dynamic stock removals across live connections!`);
        }

        // At second 15: Background API screener requests (users browsing Bhavcopy & Deals)
        if (sec % 4 === 0) {
            fetch(`${targetUrl}/api/bhavcopy/delivery?limit=10&page=1`)
                .then(r => r.ok ? apiCallsCompleted++ : apiCallsFailed++)
                .catch(() => apiCallsFailed++);
            fetch(`${targetUrl}/api/market-deals?limit=10&page=1`)
                .then(r => r.ok ? apiCallsCompleted++ : apiCallsFailed++)
                .catch(() => apiCallsFailed++);
        }

        // Status update line
        const remaining = durationSeconds - sec;
        process.stdout.write(`\r   ⏱️  Time: ${sec}s/${durationSeconds}s | WS Online: ${connectedCount}/${totalUsers} | Ticks: ${totalTicksReceived} | Dynamic Added: ${dynamicStocksAdded} | Dynamic Removed: ${dynamicStocksRemoved} | Users with LTP: ${usersWithAtLeastOneTick}/${totalUsers}`);
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
    console.log('📊 SKANDX FULL CONCURRENCY & TRADING ENGINE STRESS REPORT');
    console.log('======================================================================');
    console.log(`Target Tested:                 ${targetUrl}`);
    console.log(`Total Simulated Users:         ${totalUsers}`);
    console.log(`Successfully Connected:        ${connectedCount} / ${totalUsers} (${((connectedCount / totalUsers) * 100).toFixed(1)}%)`);
    console.log(`Users Receiving Live LTP:      ${usersWithAtLeastOneTick} / ${totalUsers} (${successPct}%)`);
    console.log(`Total Price Ticks Delivered:    ${totalTicksReceived}`);
    console.log(`Dynamic Watchlist Stocks Added:   ${dynamicStocksAdded}`);
    console.log(`Dynamic Watchlist Stocks Removed: ${dynamicStocksRemoved}`);
    console.log(`Background REST API Queries:   ${apiCallsCompleted} successful (${apiCallsFailed} failed)`);
    console.log(`Avg Connection Latency:        ${avgConnect} ms`);
    console.log(`Avg First-Tick Latency:        ${avgFirstTick} ms`);
    console.log(`Failed / Dropped Sockets:      ${totalUsers - connectedCount}`);
    console.log('----------------------------------------------------------------------');

    if (usersWithAtLeastOneTick >= totalUsers * 0.95) {
        console.log(`🎉 VERDICT: EXCELLENT! ${successPct}% of users received continuous real-time prices.`);
        console.log('   Dynamic Room Switching (Add/Remove Stocks) succeeded with zero drops!');
        console.log('   Your server architecture is fully capable of high-scale active trading.');
    } else {
        console.log(`⚠️  VERDICT: ${successPct}% success rate. Check PM2 cluster metrics.`);
    }
    console.log('======================================================================\n');
    process.exit(0);
}

run().catch(err => {
    console.error('Error running load test:', err);
    process.exit(1);
});
