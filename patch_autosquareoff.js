const fs = require('fs');
const file = 'backend/services/autoSquareOff.js';
let content = fs.readFileSync(file, 'utf8');

const masterSquareOffCode = `
async function runMasterSquareOff() {
    console.log(\`\\n=========================================\`);
    console.log(\`?? MASTER SQUARE-OFF INITIATED (ALL POSITIONS)\`);
    console.log(\`=========================================\\n\`);

    try {
        const openPositions = await db('positions').whereRaw('quantity != closed_quantity');
        
        console.log(\`Found \${openPositions.length} open positions total.\`);
        
        const systemToken = jwt.sign({ id: 0, is_system: true }, process.env.JWT_SECRET || 'secret');
        const port = process.env.PORT || 5000;

        let closedCount = 0;
        const BATCH_SIZE = 50;

        for (let i = 0; i < openPositions.length; i += BATCH_SIZE) {
            const batch = openPositions.slice(i, i + BATCH_SIZE);
            
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
                        console.log(\`[Master-Close] User \${pos.user_id} on \${pos.symbol}\`);
                    }
                } catch(e) {
                    console.error(\`[Error] Failed to reach API for User \${pos.user_id} on \${pos.symbol}:\`, e.message);
                }
            }));

            if (i + BATCH_SIZE < openPositions.length) {
                await new Promise(resolve => setTimeout(resolve, 1000));
            }
        }
        
        console.log(\`? Master Square-Off Complete. Closed \${closedCount} positions.\\n\`);
        return { success: true, count: closedCount };
    } catch (err) {
        console.error('? Master Square-Off Error:', err);
        throw err;
    }
}
`;

// Inject before module.exports
content = content.replace('module.exports = {', masterSquareOffCode + '\nmodule.exports = { runMasterSquareOff,');
fs.writeFileSync(file, content);
