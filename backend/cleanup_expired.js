require('dotenv').config();
const db = require('./database/db');

async function run() {
  console.log("Cleaning up expired contracts from the database...");
  try {
     // You can add more patterns here. % is a wildcard.
     // For example, %24JUL% matches any symbol containing 24JUL
     const patterns = [
        '%24JUL%', 
        '%SENSEX2672377700%'
     ]; 

     for (const pattern of patterns) {
         // Delete from orders
         const deletedOrders = await db('orders').where('symbol', 'like', pattern).del();
         console.log(`Deleted ${deletedOrders} old orders matching ${pattern}`);
         
         // Delete from positions
         const deletedPositions = await db('positions').where('symbol', 'like', pattern).del();
         console.log(`Deleted ${deletedPositions} stuck positions matching ${pattern}`);

         // Delete from holdings
         const deletedHoldings = await db('holdings').where('symbol', 'like', pattern).del();
         console.log(`Deleted ${deletedHoldings} stuck holdings matching ${pattern}`);
     }
     
     console.log("\nCleanup complete! You can now restart your server.");
  } catch (err) {
     console.error("Error during cleanup:", err);
  } finally {
     process.exit(0);
  }
}
run();
