const fs = require('fs');
let code = fs.readFileSync('backend/database/db.js', 'utf8');

// Insert Index Creation at the end of initSchema
const insertLocation = "console.log('Database initialization complete.');";
const indexesCode = `
      // Add Database Indexes for scaling to 1 Lakh+ users
      try {
        const positionsIndexExists = await db.raw("SELECT 1 FROM pg_indexes WHERE indexname = 'positions_user_id_idx'");
        if (positionsIndexExists.rows && positionsIndexExists.rows.length === 0) {
          await db.schema.alterTable('positions', table => { table.index('user_id'); });
          console.log('Added index on positions(user_id)');
        }
      } catch (e) { if(e.message && !e.message.includes('sqlite')) console.log(e.message); }

      try {
        const ordersIndexExists = await db.raw("SELECT 1 FROM pg_indexes WHERE indexname = 'orders_user_id_idx'");
        if (ordersIndexExists.rows && ordersIndexExists.rows.length === 0) {
          await db.schema.alterTable('orders', table => { table.index('user_id'); table.index('status'); });
          console.log('Added index on orders(user_id) and orders(status)');
        }
      } catch (e) { if(e.message && !e.message.includes('sqlite')) console.log(e.message); }

      try {
        const holdingsIndexExists = await db.raw("SELECT 1 FROM pg_indexes WHERE indexname = 'holdings_user_id_idx'");
        if (holdingsIndexExists.rows && holdingsIndexExists.rows.length === 0) {
          await db.schema.alterTable('holdings', table => { table.index('user_id'); });
          console.log('Added index on holdings(user_id)');
        }
      } catch (e) { if(e.message && !e.message.includes('sqlite')) console.log(e.message); }
      
      try {
        const ledgerExists = await db.schema.hasTable('ledger');
        if (ledgerExists) {
            const ledgerIndexExists = await db.raw("SELECT 1 FROM pg_indexes WHERE indexname = 'ledger_user_id_idx'");
            if (ledgerIndexExists.rows && ledgerIndexExists.rows.length === 0) {
              await db.schema.alterTable('ledger', table => { table.index('user_id'); });
              console.log('Added index on ledger(user_id)');
            }
        }
      } catch (e) { if(e.message && !e.message.includes('sqlite')) console.log(e.message); }

      console.log('Database initialization complete.');
`;

if (!code.includes("Added index on positions(user_id)")) {
    code = code.replace(insertLocation, indexesCode);
    fs.writeFileSync('backend/database/db.js', code);
    console.log("Indexes injected.");
} else {
    console.log("Indexes already present.");
}
