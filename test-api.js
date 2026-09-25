require('dotenv').config({path: './backend/.env'});
const db = require('./backend/database/db');

async function test() {
  try {
    const count = await db('instruments').count('token as c').first();
    console.log("Total tokens in DB:", count.c);

    const dbResults = await db('instruments')
      .whereIn('exchange', ['NSE', 'BSE'])
      .whereRaw("symbol NOT LIKE '%FUT%'")
      .whereRaw("symbol NOT LIKE '%CE%'")
      .whereRaw("symbol NOT LIKE '%PE%'");
      
    console.log("Count from API query:", dbResults.length);
    if(dbResults.length > 0) {
      console.log("Sample API result:", dbResults[0]);
    }
    
    // Check if there are ANY records with exchange = NSE
    const nseCount = await db('instruments').where('exchange', 'NSE').count('token as c').first();
    console.log("Total NSE in DB:", nseCount.c);
    
    // Check sample NSE symbol
    const nseSample = await db('instruments').where('exchange', 'NSE').first();
    console.log("Sample NSE record:", nseSample);

  } catch(e) {
    console.error(e);
  }
  process.exit();
}

test();
