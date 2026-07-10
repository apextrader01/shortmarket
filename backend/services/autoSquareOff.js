const schedule = require('node-schedule');
const db = require('../database/db').default || require('../database/db');
const fetch = require('node-fetch');
const jwt = require('jsonwebtoken');

const MONTH_MAP = {
    'JAN': 0, 'FEB': 1, 'MAR': 2, 'APR': 3, 'MAY': 4, 'JUN': 5,
    'JUL': 6, 'AUG': 7, 'SEP': 8, 'OCT': 9, 'NOV': 10, 'DEC': 11
};

function parseExpiryDate(symbol) {
    const match = symbol.match(/([0-9]{2})(JAN|FEB|MAR|APR|MAY|JUN|JUL|AUG|SEP|OCT|NOV|DEC)([0-9]{2})/i);
    if (!match) return null;
    
    const day = parseInt(match[1], 10);
    const monthStr = match[2].toUpperCase();
    const year = 2000 + parseInt(match[3], 10); 
    
    const month = MONTH_MAP[monthStr];
    return new Date(year, month, day);
}

function formatDate(date) {
    return `${date.getDate().toString().padStart(2, '0')}-${(date.getMonth() + 1).toString().padStart(2, '0')}-${date.getFullYear()}`;
}

async function runAutoSquareOff(exchangeFilter) {
    console.log(`\n=========================================`);
    console.log(`🕒 Auto Square-Off Initiated for ${exchangeFilter}`);
    console.log(`=========================================\n`);

    const now = new Date();
    const istTime = new Date(now.toLocaleString("en-US", {timeZone: "Asia/Kolkata"}));
    const todayStr = formatDate(istTime);

    try {
        const openPositions = await db('positions').whereRaw('quantity != closed_quantity');
        
        console.log(`Found ${openPositions.length} open positions total. Checking for expiries...`);
        let expiredCount = 0;
        
        // Generate a system token to bypass API auth
        const systemToken = jwt.sign({ id: 0, is_system: true }, process.env.JWT_SECRET || 'secret');
        const port = process.env.PORT || 5000;

        for (const pos of openPositions) {
            const isMcx = pos.symbol.includes('MCX');
            if (exchangeFilter === 'MCX' && !isMcx) continue;
            if (exchangeFilter === 'NSE_NFO_BFO' && isMcx) continue;

            const expiryDateObj = parseExpiryDate(pos.symbol);
            if (!expiryDateObj) continue; 

            const expiryStr = formatDate(expiryDateObj);

            if (expiryStr === todayStr) {
                console.log(`⚠️ Expiring Contract Detected: User ${pos.user_id} | ${pos.symbol}`);
                expiredCount++;
                
                // Construct the market order payload to close the exact remaining quantity
                const remainingQty = Math.abs(pos.quantity - pos.closed_quantity);
                const side = pos.quantity > 0 ? 'SELL' : 'BUY';

                const orderPayload = {
                    symbol: pos.symbol,
                    type: 'MARKET',
                    side: side,
                    quantity: remainingQty,
                    product_type: pos.product_type,
                    is_system_close: true // Optional flag if the backend wants to ignore margin blocks
                };

                try {
                    // We must generate a token FOR the specific user so the order endpoint works correctly
                    const userToken = jwt.sign({ id: pos.user_id }, process.env.JWT_SECRET || 'secret');
                    
                    const res = await fetch(`http://localhost:${port}/api/order`, {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            'Authorization': `Bearer ${userToken}`
                        },
                        body: JSON.stringify(orderPayload)
                    });
                    
                    const data = await res.json();
                    if (data.success) {
                        console.log(`✅ Auto-closed position for User ${pos.user_id} on ${pos.symbol}`);
                    } else {
                        console.error(`❌ API rejected auto-close for User ${pos.user_id} on ${pos.symbol}:`, data.error);
                    }
                } catch(e) {
                    console.error(`❌ Failed to reach API for User ${pos.user_id} on ${pos.symbol}:`, e.message);
                }
            }
        }
        
        console.log(`✅ Auto Square-Off Complete. Closed ${expiredCount} positions.\n`);
    } catch (err) {
        console.error('❌ Auto Square-Off Error:', err);
    }
}

async function runIntradaySquareOff(exchangeFilter) {
    console.log(`\n=========================================`);
    console.log(`🕒 INTRADAY Square-Off Initiated for ${exchangeFilter}`);
    console.log(`=========================================\n`);

    try {
        // Find open positions that are explicitly INT
        const openPositions = await db('positions')
            .whereRaw('quantity != closed_quantity')
            .andWhere({ product_type: 'INT' });
        
        console.log(`Found ${openPositions.length} open INTRADAY positions total.`);
        let closedCount = 0;
        
        const systemToken = jwt.sign({ id: 0, is_system: true }, process.env.JWT_SECRET || 'secret');
        const port = process.env.PORT || 5000;

        for (const pos of openPositions) {
            const isMcx = pos.symbol.includes('MCX');
            if (exchangeFilter === 'MCX' && !isMcx) continue;
            if (exchangeFilter === 'NSE_NFO_BFO' && isMcx) continue;

            console.log(`⚠️ Intraday Auto-Close Triggered: User ${pos.user_id} | ${pos.symbol}`);
            closedCount++;
            
            const remainingQty = Math.abs(pos.quantity - pos.closed_quantity);
            const side = pos.quantity > 0 ? 'SELL' : 'BUY';

            const orderPayload = {
                symbol: pos.symbol,
                type: 'MARKET',
                side: side,
                quantity: remainingQty,
                product_type: pos.product_type,
                is_system_close: true
            };

            try {
                const userToken = jwt.sign({ id: pos.user_id }, process.env.JWT_SECRET || 'secret');
                const res = await fetch(`http://localhost:${port}/api/order`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${userToken}`
                    },
                    body: JSON.stringify(orderPayload)
                });
                const data = await res.json();
                if (data.success) {
                    console.log(`✅ Auto-closed intraday position for User ${pos.user_id} on ${pos.symbol}`);
                }
            } catch(e) {
                console.error(`❌ Failed to reach API for User ${pos.user_id} on ${pos.symbol}:`, e.message);
            }
        }
        console.log(`✅ Intraday Square-Off Complete. Closed ${closedCount} positions.\n`);
    } catch (err) {
        console.error('❌ Intraday Square-Off Error:', err);
    }
}

function startSquareOffJobs() {
    // EXPIRY JOBS (3:25 PM / 3:25 PM MCX)
    schedule.scheduleJob({ rule: '25 15 * * 1-5', tz: 'Asia/Kolkata' }, () => {
        runAutoSquareOff('NSE_NFO_BFO');
        runAutoSquareOff('MCX'); // Using identical times based on earlier discussion
    });

    // INTRADAY JOBS (3:20 PM NSE/NFO/BFO)
    schedule.scheduleJob({ rule: '20 15 * * 1-5', tz: 'Asia/Kolkata' }, () => {
        runIntradaySquareOff('NSE_NFO_BFO');
    });

    // INTRADAY JOBS (11:20 PM MCX)
    schedule.scheduleJob({ rule: '20 23 * * 1-5', tz: 'Asia/Kolkata' }, () => {
        runIntradaySquareOff('MCX');
    });

    console.log('⏰ Auto Square-Off schedules initialized (Intraday: 3:20pm / 11:20pm) (Expiry: 3:25pm).');
}

module.exports = { startSquareOffJobs, runAutoSquareOff, runIntradaySquareOff, parseExpiryDate, formatDate };
