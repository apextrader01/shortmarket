require('dotenv').config();

// Attempt to fetch DATABASE_URL from PM2 if it's missing in .env
if (!process.env.DATABASE_URL) {
  const { execSync } = require('child_process');
  try {
     console.log("No DATABASE_URL found in .env. Attempting to fetch it from PM2...");
     const pm2Output = execSync('npx pm2 jlist').toString();
     const match = pm2Output.match(/"DATABASE_URL":"([^"]+)"/);
     if (match && match[1]) {
         process.env.DATABASE_URL = match[1];
         console.log("Successfully fetched DATABASE_URL from PM2!");
     }
  } catch(e) {
     console.log("Failed to fetch from PM2.");
  }
}

const db = require('./database/db');
const { calculateRequiredMargin } = require('./services/marginEngine'); // Needed if we recalculate margin for positions

async function run() {
  console.log("Cleaning up expired contracts from the database and refunding margins...");
  try {
     const patterns = [
        '%24JUL%', 
        '%SENSEX2672377700%'
     ]; 

     for (const pattern of patterns) {
         // 1. Refund and Delete Pending Orders
         const pendingOrders = await db('orders')
             .where('symbol', 'like', pattern)
             .whereIn('status', ['PENDING', 'PENDING_TRIGGER']);
             
         for (const order of pendingOrders) {
             const user = await db('users').where({ id: order.user_id }).first();
             if (user && order.margin > 0) {
                 await db('users').where({ id: order.user_id }).update({
                     balance: parseFloat(user.balance) + parseFloat(order.margin)
                 });
                 console.log(`Refunded ?${order.margin} to User ${user.username} for Pending Order ${order.id}`);
             }
         }
         const deletedOrders = await db('orders').where('symbol', 'like', pattern).del();
         console.log(`Deleted ${deletedOrders} old orders matching ${pattern}`);
         
         // 2. Refund and Delete Stuck Positions
         // Note: For a mock paper trading app, we will just refund the original margin required to open it.
         // We won't calculate settlement P&L for expired options here.
         const stuckPositions = await db('positions').where('symbol', 'like', pattern);
         for (const pos of stuckPositions) {
             const user = await db('users').where({ id: pos.user_id }).first();
             if (user) {
                 // Roughly estimate the margin they used to open this
                 // For options buying, it's roughly avg_price * qty.
                 // We will refund a generic amount based on marginEngine, or just avg_price * qty for options
                 const refundAmt = Math.abs(pos.quantity) * parseFloat(pos.average_price);
                 await db('users').where({ id: pos.user_id }).update({
                     balance: parseFloat(user.balance) + refundAmt
                 });
                 console.log(`Refunded estimated ?${refundAmt.toFixed(2)} to User ${user.username} for Position ${pos.id}`);
             }
         }
         
         const deletedPositions = await db('positions').where('symbol', 'like', pattern).del();
         console.log(`Deleted ${deletedPositions} stuck positions matching ${pattern}`);

         // 3. Delete from holdings
         const deletedHoldings = await db('holdings').where('symbol', 'like', pattern).del();
         console.log(`Deleted ${deletedHoldings} stuck holdings matching ${pattern}`);
     }
     
     console.log("\nCleanup and margin refund complete! You can now restart your server.");
  } catch (err) {
     console.error("Error during cleanup:", err);
  } finally {
     process.exit(0);
  }
}
run();
