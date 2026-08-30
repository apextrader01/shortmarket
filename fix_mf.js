const db = require('./backend/database/db.js');
async function fixMFAmounts() {
  try {
    const wrongPositions = await db('positions').where({ symbol: '151565-MF' });
    console.log('Wrong Positions:', wrongPositions);
    const wrongHoldings = await db('holdings').where({ symbol: '151565-MF' });
    console.log('Wrong Holdings:', wrongHoldings);
    
    // Update them to 12.68
    if (wrongPositions.length > 0) {
      await db('positions').where({ symbol: '151565-MF' }).update({ average_price: 12.68 });
      console.log('Updated positions');
    }
    if (wrongHoldings.length > 0) {
      await db('holdings').where({ symbol: '151565-MF' }).update({ average_price: 12.68 });
      console.log('Updated holdings');
    }
  } catch(e) {
    console.error(e);
  } finally {
    process.exit(0);
  }
}
fixMFAmounts();
