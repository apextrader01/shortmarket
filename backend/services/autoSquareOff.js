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
            if (exchangeFilter === 'NSE_NFO' && isMcx) continue;

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

function startExpiryJobs() {
    schedule.scheduleJob({ rule: '25 15 * * 1-5', tz: 'Asia/Kolkata' }, () => {
        runAutoSquareOff('NSE_NFO');
    });
    schedule.scheduleJob({ rule: '30 23 * * 1-5', tz: 'Asia/Kolkata' }, () => {
        runAutoSquareOff('MCX');
    });
    console.log('⏰ Auto Square-Off schedules initialized (3:25 PM for NSE/NFO, 11:30 PM for MCX).');
}

module.exports = { startExpiryJobs, runAutoSquareOff };
