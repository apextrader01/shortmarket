const fs = require('fs');
let code = fs.readFileSync('backend/services/autoSquareOff.js', 'utf8');

// I will replace `for (const pos of openPositions) {` and just rely on splitting or indexing.
// Let's rewrite the file completely. We only need to overwrite `runAutoSquareOff` and `runIntradaySquareOff`.
// We can use string split.

const parts = code.split('async function runWatchlistCleanup() {');
let topPart = parts[0];
const bottomPart = 'async function runWatchlistCleanup() {' + parts[1];

// topPart contains runAutoSquareOff and runIntradaySquareOff
// Let's replace them completely.

const baseCode = topPart.split('async function runAutoSquareOff(exchangeFilter) {')[0];

const newFunctions = `async function runAutoSquareOff(exchangeFilter) {
    console.log(\`\\n=========================================\`);
    console.log(\`?? Auto Square-Off Initiated for \${exchangeFilter}\`);
    console.log(\`=========================================\\n\`);

    const now = new Date();
    const istTime = new Date(now.toLocaleString("en-US", {timeZone: "Asia/Kolkata"}));
    const todayStr = formatDate(istTime);

    try {
        const openPositions = await db('positions').whereRaw('quantity != closed_quantity');
        
        console.log(\`Found \${openPositions.length} open positions total. Checking for expiries...\`);
        
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

        console.log(\`Filtered down to \${positionsToClose.length} expiring positions for \${exchangeFilter}.\`);
        console.log('Starting 50-order-per-second Throttle Queue...');

        let closedCount = 0;
        const BATCH_SIZE = 50;

        for (let i = 0; i < positionsToClose.length; i += BATCH_SIZE) {
            const batch = positionsToClose.slice(i, i + BATCH_SIZE);
            
            await Promise.all(batch.map(async (pos) => {
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
                    const res = await fetch(\`http://localhost:\${port}/api/order\`, {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            'Authorization': \`Bearer \${userToken}\`
                        },
                        body: JSON.stringify(orderPayload)
                    });
                    const data = await res.json();
                    if (data.success) {
                        closedCount++;
                        console.log(\`[Auto-Close] User \${pos.user_id} on \${pos.symbol}\`);
                    }
                } catch(e) {
                    console.error(\`[Error] Failed to reach API for User \${pos.user_id} on \${pos.symbol}:\`, e.message);
                }
            }));

            if (i + BATCH_SIZE < positionsToClose.length) {
                await new Promise(resolve => setTimeout(resolve, 1000));
            }
        }
        
        console.log(\`? Auto Square-Off Complete. Closed \${closedCount} positions.\\n\`);
    } catch (err) {
        console.error('? Auto Square-Off Error:', err);
    }
}

async function runIntradaySquareOff(exchangeFilter) {
    console.log(\`\\n=========================================\`);
    console.log(\`?? INTRADAY Square-Off Initiated for \${exchangeFilter}\`);
    console.log(\`=========================================\\n\`);

    try {
        const openPositions = await db('positions')
            .whereRaw('quantity != closed_quantity')
            .andWhere({ product_type: 'INT' });
        
        console.log(\`Found \${openPositions.length} open INTRADAY positions total.\`);
        
        const systemToken = jwt.sign({ id: 0, is_system: true }, process.env.JWT_SECRET || 'secret');
        const port = process.env.PORT || 5000;

        const positionsToClose = openPositions.filter(pos => {
            const isMcx = pos.symbol.includes('MCX');
            if (exchangeFilter === 'MCX' && !isMcx) return false;
            if (exchangeFilter === 'NSE_NFO_BFO' && isMcx) return false;
            return true;
        });

        console.log(\`Filtered down to \${positionsToClose.length} intraday positions for \${exchangeFilter}.\`);
        console.log('Starting 50-order-per-second Throttle Queue...');

        let closedCount = 0;
        const BATCH_SIZE = 50;

        for (let i = 0; i < positionsToClose.length; i += BATCH_SIZE) {
            const batch = positionsToClose.slice(i, i + BATCH_SIZE);
            
            await Promise.all(batch.map(async (pos) => {
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
                    const res = await fetch(\`http://localhost:\${port}/api/order\`, {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            'Authorization': \`Bearer \${userToken}\`
                        },
                        body: JSON.stringify(orderPayload)
                    });
                    const data = await res.json();
                    if (data.success) {
                        closedCount++;
                        console.log(\`[Auto-Close] User \${pos.user_id} on \${pos.symbol}\`);
                    }
                } catch(e) {
                    console.error(\`[Error] Failed to reach API for User \${pos.user_id} on \${pos.symbol}:\`, e.message);
                }
            }));

            if (i + BATCH_SIZE < positionsToClose.length) {
                await new Promise(resolve => setTimeout(resolve, 1000));
            }
        }
        console.log(\`? Intraday Square-Off Complete. Closed \${closedCount} positions.\\n\`);
    } catch (err) {
        console.error('? Intraday Square-Off Error:', err);
    }
}

`;

const finalCode = baseCode + newFunctions + bottomPart;
fs.writeFileSync('backend/services/autoSquareOff.js', finalCode);
console.log('Perfectly replaced both functions using string splitting.');
