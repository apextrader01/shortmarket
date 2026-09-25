const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });
const db = require('./database/db');

(async function runCleanup() {
  try {
     console.log("Running direct cleanup script for expired contracts...");
     if (!process.env.DATABASE_URL) {
         console.warn("WARNING: DATABASE_URL not found. Script might fail if local DB is missing.");
     }
     
     const patterns = ['%24JUL%', '%SENSEX2672377700%', '%NATURALGAS24JUL%'];
     let results = {};
     
     for (const pattern of patterns) {
         let pResults = { ordersDeleted: 0, positionsDeleted: 0, holdingsDeleted: 0, marginRefunded: 0 };
         
         const pendingOrders = await db('orders').where('symbol', 'like', pattern).whereIn('status', ['PENDING', 'PENDING_TRIGGER']);
         for (const order of pendingOrders) {
             const user = await db('users').where({ id: order.user_id }).first();
             if (user && order.margin && order.margin > 0) {
                 await db('users').where({ id: order.user_id }).update({ balance: parseFloat(user.balance) + parseFloat(order.margin) });
                 pResults.marginRefunded += parseFloat(order.margin);
             }
         }
         pResults.ordersDeleted = await db('orders').where('symbol', 'like', pattern).del();
         
         const stuckPositions = await db('positions').where('symbol', 'like', pattern);
         for (const pos of stuckPositions) {
             const user = await db('users').where({ id: pos.user_id }).first();
             if (user) {
                 const refundAmt = Math.abs(pos.quantity) * parseFloat(pos.average_price);
                 await db('users').where({ id: pos.user_id }).update({ balance: parseFloat(user.balance) + refundAmt });
                 pResults.marginRefunded += refundAmt;
             }
         }
         pResults.positionsDeleted = await db('positions').where('symbol', 'like', pattern).del();
         pResults.holdingsDeleted = await db('holdings').where('symbol', 'like', pattern).del();
         
         results[pattern] = pResults;
     }
     console.log("Cleanup complete!");
     console.log(JSON.stringify(results, null, 2));
     process.exit(0);
  } catch (e) {
     console.error("Cleanup failed:", e.message, e.stack);
     process.exit(1);
  }
})();
