const schedule = require('node-schedule');
const db = require('../database/db').default || require('../database/db');
const jwt = require('jsonwebtoken');
const fs = require('fs');
const path = require('path');

const MONTH_MAP = {
    'JAN': 0, 'FEB': 1, 'MAR': 2, 'APR': 3, 'MAY': 4, 'JUN': 5,
    'JUL': 6, 'AUG': 7, 'SEP': 8, 'OCT': 9, 'NOV': 10, 'DEC': 11
};

let _symbolToExpiryMap = null;
let _lastMapLoadTime = 0;
let _isLoadingMap = false;

function buildExpiryMapFromRaw(futRaw, optRaw) {
    const newMap = {};
    if (futRaw) {
        try {
            const futData = typeof futRaw === 'string' ? JSON.parse(futRaw) : futRaw;
            Object.values(futData).flat().forEach(f => {
                if (f && f.symbol && f.expiry) newMap[f.symbol] = f.expiry;
            });
        } catch (e) {}
    }
    if (optRaw) {
        try {
            const optData = typeof optRaw === 'string' ? JSON.parse(optRaw) : optRaw;
            for (const name in optData) {
                for (const expiry in optData[name]) {
                    for (const strike in optData[name][expiry]) {
                        const contract = optData[name][expiry][strike];
                        if (contract && contract.CE && contract.CE.symbol) newMap[contract.CE.symbol] = expiry;
                        if (contract && contract.PE && contract.PE.symbol) newMap[contract.PE.symbol] = expiry;
                    }
                }
            }
        } catch (e) {}
    }
    return newMap;
}

function reloadSymbolToExpiryMapAsync() {
    if (_isLoadingMap) return;
    _isLoadingMap = true;
    const futPath = path.join(__dirname, '../database/futures.json');
    const optPath = path.join(__dirname, '../database/options.json');

    Promise.all([
        fs.promises.readFile(futPath, 'utf8').catch(() => null),
        fs.promises.readFile(optPath, 'utf8').catch(() => null)
    ]).then(([futRaw, optRaw]) => {
        if (futRaw || optRaw) {
            _symbolToExpiryMap = buildExpiryMapFromRaw(futRaw, optRaw);
            _lastMapLoadTime = Date.now();
        }
    }).catch(err => {
        console.error("Error building symbolToExpiryMap async:", err.message);
    }).finally(() => {
        _isLoadingMap = false;
    });
}

// Warm up map asynchronously on boot
reloadSymbolToExpiryMapAsync();

function getSymbolToExpiryMap() {
    if (_symbolToExpiryMap) {
        return _symbolToExpiryMap;
    }
    
    // One-time fallback if called before first async load completes
    try {
        const futRaw = fs.readFileSync(path.join(__dirname, '../database/futures.json'), 'utf8');
        const optRaw = fs.readFileSync(path.join(__dirname, '../database/options.json'), 'utf8');
        _symbolToExpiryMap = buildExpiryMapFromRaw(futRaw, optRaw);
        _lastMapLoadTime = now;
    } catch (e) {
        console.error("Error building symbolToExpiryMap fallback:", e.message);
        _symbolToExpiryMap = {};
    }
    return _symbolToExpiryMap;
}

function parseExpiryDate(symbol) {
    const map = getSymbolToExpiryMap();
    const expiryStr = map[symbol];
    if (!expiryStr) return null;
    
    // Fyers expiryStr format is "YYYY-MM-DD"
    const match = expiryStr.match(/^([0-9]{4})-([0-9]{2})-([0-9]{2})$/);
    if (match) {
        const year = parseInt(match[1], 10);
        const month = parseInt(match[2], 10) - 1; // 0-indexed month
        const day = parseInt(match[3], 10);
        return new Date(year, month, day);
    }

    // Fallback for legacy Angel One format "28JUL2026" (just in case)
    const matchLegacy = expiryStr.match(/^([0-9]{2})(JAN|FEB|MAR|APR|MAY|JUN|JUL|AUG|SEP|OCT|NOV|DEC)([0-9]{4})$/i);
    if (matchLegacy) {
        const day = parseInt(matchLegacy[1], 10);
        const monthStr = matchLegacy[2].toUpperCase();
        const year = parseInt(matchLegacy[3], 10); 
        const month = MONTH_MAP[monthStr];
        return new Date(year, month, day);
    }
    
    return null;
}

function formatDate(date) {
    return `${date.getDate().toString().padStart(2, '0')}-${(date.getMonth() + 1).toString().padStart(2, '0')}-${date.getFullYear()}`;
}

async function runAutoSquareOff(exchangeFilter) {
    console.log(`\n=========================================`);
    console.log(`?? Auto Square-Off Initiated for ${exchangeFilter}`);
    console.log(`=========================================\n`);

    const now = new Date();
    const istTime = new Date(now.toLocaleString("en-US", {timeZone: "Asia/Kolkata"}));
    const todayStr = formatDate(istTime);

    try {
        const openPositions = await db('positions').whereNot({ quantity: 0 });
        
        console.log(`Found ${openPositions.length} open positions total. Checking for expiries...`);
        
        const systemToken = jwt.sign({ id: 0, is_system: true }, process.env.JWT_SECRET || 'secret');
        const port = process.env.PORT || 5000;

        const positionsToClose = openPositions.filter(pos => {
            const isMcx = pos.symbol.includes('MCX');
            if (exchangeFilter === 'MCX' && !isMcx) return false;
            if (exchangeFilter === 'NSE_NFO_BFO' && isMcx) return false;
            
            const expiryDateObj = parseExpiryDate(pos.symbol);
            if (!expiryDateObj) return false; 
            const expiryStr = formatDate(expiryDateObj);
            return expiryStr === todayStr;
        });

        console.log(`Filtered down to ${positionsToClose.length} expiring positions for ${exchangeFilter}.`);
        console.log('Starting 50-order-per-second Throttle Queue...');

        let closedCount = 0;
        const BATCH_SIZE = 50;

        for (let i = 0; i < positionsToClose.length; i += BATCH_SIZE) {
            const batch = positionsToClose.slice(i, i + BATCH_SIZE);
            
            await Promise.all(batch.map(async (pos) => {
                const remainingQty = Math.abs(Number(pos.quantity));
                const side = Number(pos.quantity) > 0 ? 'SELL' : 'BUY';

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
                        closedCount++;
                        console.log(`[Auto-Close] User ${pos.user_id} on ${pos.symbol}`);
                    }
                } catch(e) {
                    console.error(`[Error] Failed to reach API for User ${pos.user_id} on ${pos.symbol}:`, e.message);
                }
            }));

            if (i + BATCH_SIZE < positionsToClose.length) {
                await new Promise(resolve => setTimeout(resolve, 1000));
            }
        }
        
        console.log(`? Auto Square-Off Complete. Closed ${closedCount} positions.\n`);
    } catch (err) {
        console.error('? Auto Square-Off Error:', err);
    }
}

async function runIntradaySquareOff(exchangeFilter) {
    console.log(`\n=========================================`);
    console.log(`?? INTRADAY Square-Off Initiated for ${exchangeFilter}`);
    console.log(`=========================================\n`);

    try {
        const openPositions = await db('positions')
            .whereNot({ quantity: 0 })
            .whereIn('product_type', ['INT', 'BO', 'CO']);
        
        console.log(`Found ${openPositions.length} open INTRADAY/BO/CO positions total.`);
        
        const systemToken = jwt.sign({ id: 0, is_system: true }, process.env.JWT_SECRET || 'secret');
        const port = process.env.PORT || 5000;

        const positionsToClose = openPositions.filter(pos => {
            const isMcx = pos.symbol.includes('MCX');
            if (exchangeFilter === 'MCX' && !isMcx) return false;
            if (exchangeFilter === 'NSE_NFO_BFO' && isMcx) return false;
            return true;
        });

        console.log(`Filtered down to ${positionsToClose.length} intraday positions for ${exchangeFilter}.`);
        console.log('Starting 50-order-per-second Throttle Queue...');

        let closedCount = 0;
        const BATCH_SIZE = 50;

        for (let i = 0; i < positionsToClose.length; i += BATCH_SIZE) {
            const batch = positionsToClose.slice(i, i + BATCH_SIZE);
            
            await Promise.all(batch.map(async (pos) => {
                const remainingQty = Math.abs(Number(pos.quantity));
                const side = Number(pos.quantity) > 0 ? 'SELL' : 'BUY';

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
                        closedCount++;
                        console.log(`[Auto-Close] User ${pos.user_id} on ${pos.symbol}`);
                    }
                } catch(e) {
                    console.error(`[Error] Failed to reach API for User ${pos.user_id} on ${pos.symbol}:`, e.message);
                }
            }));

            if (i + BATCH_SIZE < positionsToClose.length) {
                await new Promise(resolve => setTimeout(resolve, 1000));
            }
        }
        console.log(`? Intraday Square-Off Complete. Closed ${closedCount} positions.\n`);
    } catch (err) {
        console.error('? Intraday Square-Off Error:', err);
    }
}

async function runWatchlistCleanup() {
    console.log(`\n=========================================`);
    console.log(`🧹 Midnight Watchlist Cleanup Initiated`);
    console.log(`=========================================\n`);

    try {
        const formatter = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata', year: 'numeric', month: '2-digit', day: '2-digit' });
        const parts = formatter.formatToParts(new Date());
        const yearPart = parts.find(p => p.type === 'year').value;
        const monthPart = parts.find(p => p.type === 'month').value;
        const dayPart = parts.find(p => p.type === 'day').value;
        const istTime = new Date(`${yearPart}-${monthPart}-${dayPart}T00:00:00+05:30`);

        const users = await db('users').select('id', 'watchlists');
        let totalRemoved = 0;

        for (const user of users) {
            if (!user.watchlists) continue;
            let watchlists = [];
            try {
                watchlists = typeof user.watchlists === 'string' ? JSON.parse(user.watchlists) : user.watchlists;
            } catch (e) {
                continue;
            }

            let modified = false;

            for (const wl of watchlists) {
                if (!wl.symbols || !Array.isArray(wl.symbols)) continue;
                
                const originalLength = wl.symbols.length;
                wl.symbols = wl.symbols.filter(symbol => {
                    const expiryDateObj = parseExpiryDate(symbol);
                    if (!expiryDateObj) return true; // Keep non-expiring assets

                    // If the expiry date is strictly before today's midnight, it is expired
                    // E.g., if it expired yesterday, its midnight is < today's midnight
                    if (expiryDateObj.getTime() < istTime.getTime()) {
                        return false; // Remove it
                    }
                    return true;
                });

                if (wl.symbols.length !== originalLength) {
                    modified = true;
                    totalRemoved += (originalLength - wl.symbols.length);
                }
            }

            if (modified) {
                await db('users').where({ id: user.id }).update({ watchlists: JSON.stringify(watchlists) });
            }
        }
        
        console.log(`✅ Watchlist Cleanup Complete. Removed ${totalRemoved} expired contracts.\n`);
    } catch (err) {
        console.error('❌ Watchlist Cleanup Error:', err);
    }
}

function startSquareOffJobs() {
    // Note: Automated EOD sweeps and intraday/BO/CO square-offs (15:15, 15:19, 15:20 EQ / 22:50, 22:59, 23:00 MCX)
    // are exclusively and atomically handled by cronJobs.js via db transactions (to prevent duplicate order execution,
    // double RMS penalties, or reverse short position races).
    // Expiry settlements are handled by positionsEngine.js.

    // MIDNIGHT WATCHLIST CLEANUP (12:00 AM IST)
    schedule.scheduleJob({ rule: '0 0 * * *', tz: 'Asia/Kolkata' }, () => {
        runWatchlistCleanup();
    });

    // Run watchlist cleanup once immediately on startup to clear any stragglers missed while server was asleep
    runWatchlistCleanup();

    console.log('✅ Watchlist daily cleanup schedule initialized (EOD square-offs unified under cronJobs.js).');
}


async function runMasterSquareOff() {
    console.log(`\n=========================================`);
    console.log(`?? MASTER SQUARE-OFF INITIATED (ALL POSITIONS)`);
    console.log(`=========================================\n`);

    try {
        const openPositions = await db('positions').whereNot({ quantity: 0 });
        
        console.log(`Found ${openPositions.length} open positions total.`);
        
        const systemToken = jwt.sign({ id: 0, is_system: true }, process.env.JWT_SECRET || 'secret');
        const port = process.env.PORT || 5000;

        let closedCount = 0;
        const BATCH_SIZE = 50;

        for (let i = 0; i < openPositions.length; i += BATCH_SIZE) {
            const batch = openPositions.slice(i, i + BATCH_SIZE);
            
            await Promise.all(batch.map(async (pos) => {
                const remainingQty = Math.abs(Number(pos.quantity));
                const side = Number(pos.quantity) > 0 ? 'SELL' : 'BUY';

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
                        closedCount++;
                        console.log(`[Master-Close] User ${pos.user_id} on ${pos.symbol}`);
                    }
                } catch(e) {
                    console.error(`[Error] Failed to reach API for User ${pos.user_id} on ${pos.symbol}:`, e.message);
                }
            }));

            if (i + BATCH_SIZE < openPositions.length) {
                await new Promise(resolve => setTimeout(resolve, 1000));
            }
        }
        
        console.log(`? Master Square-Off Complete. Closed ${closedCount} positions.\n`);
        return { success: true, count: closedCount };
    } catch (err) {
        console.error('? Master Square-Off Error:', err);
        throw err;
    }
}

module.exports = { runMasterSquareOff, startSquareOffJobs, runAutoSquareOff, runIntradaySquareOff, parseExpiryDate, formatDate };
