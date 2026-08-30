const fs = require('fs');
let code = fs.readFileSync('backend/services/cronJobs.js', 'utf8');

const regex = /\/\/ Sweep all intraday-type orders: INT, BO, CO[\s\S]*?if \(order\.product_type === 'INT' \|\| order\.product_type === 'BO' \|\| order\.product_type === 'CO'\) \{([\s\S]*?)\}\s*\}/m;

const replacement = `// Sweep ALL pending entry orders (INT, BO, CO, DEL, CNC)
                    await trx('orders').where({ id: order.id }).update({ status: 'CANCELLED' });
                    if (parseFloat(order.margin) > 0) {
                        await LedgerService.releaseMargin(trx, order.user_id, order.margin, \`End of Day Sweep Cancelled: \${order.symbol}\`);
                    }
                    triggerEngine.removeOrderFromMemory(order.id, order.symbol);
                    console.log(\`[CRON] Phase 2: Cancelled pending \${order.product_type || 'DEL'} order \${order.id} for \${order.symbol}\`);
                }`;

if (code.match(regex)) {
    code = code.replace(regex, replacement);
    fs.writeFileSync('backend/services/cronJobs.js', code);
    console.log('Successfully patched phase2Sweep to include ALL orders');
} else {
    console.log('Regex failed to match');
}
