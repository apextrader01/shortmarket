const fs = require('fs');
let code = fs.readFileSync('backend/services/autoSquareOff.js', 'utf8');

const regex = /for \(const pos of openPositions\) \{[\s\S]*?console\.log\(`.*Intraday Square-Off Complete.*?Closed \$\{closedCount\} positions\.\\n`\);/m;

const newCode = `const positionsToClose = openPositions.filter(pos => {
            const isMcx = pos.symbol.includes('MCX');
            if (exchangeFilter === 'MCX' && !isMcx) return false;
            if (exchangeFilter === 'NSE_NFO_BFO' && isMcx) return false;
            return true;
        });

        console.log(\`Filtered down to \${positionsToClose.length} positions for \${exchangeFilter}.\`);
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
                        console.log(\`? Auto-closed intraday position for User \${pos.user_id} on \${pos.symbol}\`);
                    }
                } catch(e) {
                    console.error(\`? Failed to reach API for User \${pos.user_id} on \${pos.symbol}:\`, e.message);
                }
            }));

            // Throttle: Wait exactly 1 second before firing the next batch to protect Broker API limits
            if (i + BATCH_SIZE < positionsToClose.length) {
                await new Promise(resolve => setTimeout(resolve, 1000));
            }
        }
        console.log(\`? Intraday Square-Off Complete. Closed \${closedCount} positions.\\n\`);`;

if (regex.test(code)) {
    code = code.replace(regex, newCode);
    fs.writeFileSync('backend/services/autoSquareOff.js', code);
    console.log('Successfully patched runIntradaySquareOff using regex');
} else {
    console.log('Regex did not match!');
}
