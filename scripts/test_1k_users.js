/**
 * SkandX 1,000 Concurrent Users Live WebSocket Load Tester
 * Simulates 1,000 active trading users subscribing to live stocks and receiving ticks.
 *
 * Usage:
 *   node scripts/test_1k_users.js
 *   node scripts/test_1k_users.js [URL] [TOTAL_USERS]
 *
 * Examples:
 *   node scripts/test_1k_users.js
 *   node scripts/test_1k_users.js http://localhost:5000 1000
 *   node scripts/test_1k_users.js https://skandx.in 500
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

const TEST_SYMBOLS = [
    'NSE:RELIANCE-EQ',
    'NSE:TATASTEEL-EQ',
    'NSE:HDFCBANK-EQ',
    'NSE:INFY-EQ',
    'NSE:NIFTY50-INDEX',
    'NSE:ITC-EQ',
    'NSE:ICICIBANK-EQ',
    'NSE:SBIN-EQ'
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
    const durationSeconds = parseInt(process.env.DURATION || '15', 10);

    console.log('\n======================================================================');
    console.log(`🚀 SKANDX LIVE WEBSOCKET LOAD TEST: ${totalUsers} CONCURRENT USERS`);
    console.log('======================================================================');
    console.log(`🎯 Target URL:           ${targetUrl}`);
    console.log(`👥 Total Virtual Users:  ${totalUsers}`);
    console.log(`⏱️  Observation Window:  ${durationSeconds} seconds`);
    console.log(`📡 Monitored Symbols:    ${TEST_SYMBOLS.slice(0, 4).join(', ')} ...`);
    console.log('======================================================================\n');

    let connectedCount = 0;
    let disconnectedCount = 0;
    let usersWithAtLeastOneTick = 0;
    let totalTicksReceived = 0;
    const connectLatencies = [];
    const firstTickLatencies = [];
    const sockets = [];
    const sampleUsers = new Set([1, Math.floor(totalUsers * 0.25), Math.floor(totalUsers * 0.5), Math.floor(totalUsers * 0.75), totalUsers]);

    console.log('⏳ Ramping up users...');

    const startTime = Date.now();
    const batchSize = 50;
    const rampDelayMs = 150;

    for (let i = 1; i <= totalUsers; i++) {
        const userId = i;
        const userConnectStart = Date.now();
        const assignedSymbols = [
            TEST_SYMBOLS[(userId - 1) % TEST_SYMBOLS.length],
            TEST_SYMBOLS[(userId) % TEST_SYMBOLS.length]
        ];

        const socket = io(targetUrl, {
            transports: ['websocket'],
            reconnection: false,
            timeout: 10000
        });
        sockets.push(socket);

        let receivedFirstTick = false;

        socket.on('connect', () => {
            connectedCount++;
            connectLatencies.push(Date.now() - userConnectStart);

            // Subscribe to assigned stocks
            assignedSymbols.forEach(sym => {
                socket.emit('join_room', sym);
            });
            socket.emit('subscribe', assignedSymbols);
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

        socket.on('disconnect', () => {
            disconnectedCount++;
        });

        socket.on('connect_error', () => {
            disconnectedCount++;
        });

        if (i % batchSize === 0) {
            process.stdout.write(`\r   Connecting: ${i}/${totalUsers} users queued... (Active WS: ${connectedCount})`);
            await new Promise(r => setTimeout(r, rampDelayMs));
        }
    }

    console.log(`\n\n✅ All ${totalUsers} user bots initiated!`);
    console.log(`⏳ Monitoring live market price updates for ${durationSeconds} seconds... (Watch 'pm2 monit' on your server!)\n`);

    // Progress counter
    const waitInterval = 1000;
    const steps = durationSeconds;
    for (let s = 1; s <= steps; s++) {
        await new Promise(r => setTimeout(r, waitInterval));
        process.stdout.write(`\r   ⏱️  Remaining: ${steps - s}s | Connected: ${connectedCount}/${totalUsers} | Ticks: ${totalTicksReceived} | Users with LTP: ${usersWithAtLeastOneTick}/${totalUsers}`);
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
    console.log('📊 SKANDX CONCURRENCY STRESS TEST RESULTS');
    console.log('======================================================================');
    console.log(`Target Tested:              ${targetUrl}`);
    console.log(`Total Simulated Users:      ${totalUsers}`);
    console.log(`Successfully Connected:     ${connectedCount} / ${totalUsers} (${((connectedCount / totalUsers) * 100).toFixed(1)}%)`);
    console.log(`Users Receiving Live LTP:   ${usersWithAtLeastOneTick} / ${totalUsers} (${successPct}%)`);
    console.log(`Total Price Ticks Delivered: ${totalTicksReceived}`);
    console.log(`Avg Connection Latency:     ${avgConnect} ms`);
    console.log(`Avg First-Tick Latency:     ${avgFirstTick} ms`);
    console.log(`Failed / Dropped Users:     ${totalUsers - connectedCount}`);
    console.log('----------------------------------------------------------------------');

    if (usersWithAtLeastOneTick >= totalUsers * 0.95) {
        console.log(`🎉 VERDICT: OUTSTANDING! ${successPct}% of users received real-time live prices.`);
        console.log('   Your server easily supports high-concurrency real-time trading!');
    } else {
        console.log(`⚠️  VERDICT: ${successPct}% success rate. Check PM2 CPU/RAM limits.`);
    }
    console.log('======================================================================\n');
    process.exit(0);
}

run().catch(err => {
    console.error('Error running load test:', err);
    process.exit(1);
});
