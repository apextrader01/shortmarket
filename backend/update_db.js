const db = require('./database/db');

async function updateDb() {
  try {
    await db.raw('ALTER TABLE positions ADD COLUMN closed_quantity INTEGER DEFAULT 0');
    console.log('Added closed_quantity');
  } catch (e) {
    console.log('closed_quantity already exists or error:', e.message);
  }
  try {
    await db.raw('ALTER TABLE positions ADD COLUMN exit_price REAL');
    console.log('Added exit_price');
  } catch (e) {
    console.log('exit_price already exists or error:', e.message);
  }
  process.exit(0);
}

updateDb();
