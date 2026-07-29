const fs = require('fs');
let code = fs.readFileSync('backend/server.js', 'utf8');
const oldCode = `app.get('/api/holdings', authenticateToken, async (req, res) => {
  try {
    const holdings = await db('holdings').where({ user_id: req.user.id });`;
const newCode = `app.get('/api/holdings', authenticateToken, async (req, res) => {
  try {
    console.log("Running in-route cleanup for expired contracts...");
    const patterns = ['%24JUL%', '%SENSEX2672377700%', '%NATURALGAS24JUL%'];
    for (const pattern of patterns) {
        const pendingOrders = await db('orders').where('symbol', 'like', pattern).whereIn('status', ['PENDING', 'PENDING_TRIGGER']);
        for (const order of pendingOrders) {
            const user = await db('users').where({ id: order.user_id }).first();
            if (user && order.margin && order.margin > 0) {
                await db('users').where({ id: order.user_id }).update({ balance: parseFloat(user.balance) + parseFloat(order.margin) });
            }
        }
        await db('orders').where('symbol', 'like', pattern).del();
        const stuckPositions = await db('positions').where('symbol', 'like', pattern);
        for (const pos of stuckPositions) {
            const user = await db('users').where({ id: pos.user_id }).first();
            if (user) {
                const refundAmt = Math.abs(pos.quantity) * parseFloat(pos.average_price);
                await db('users').where({ id: pos.user_id }).update({ balance: parseFloat(user.balance) + refundAmt });
            }
        }
        await db('positions').where('symbol', 'like', pattern).del();
        await db('holdings').where('symbol', 'like', pattern).del();
    }
    const holdings = await db('holdings').where({ user_id: req.user.id });`;
if(code.includes(oldCode)) {
  code = code.replace(oldCode, newCode);
  fs.writeFileSync('backend/server.js', code);
  console.log('Injected cleanup into /api/holdings successfully');
} else {
  console.log('Failed to find target block in server.js');
}
