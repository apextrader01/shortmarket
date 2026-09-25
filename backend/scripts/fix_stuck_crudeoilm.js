/**
 * Script to safely resolve and close stuck CRUDEOILM short positions
 * caused by PostgreSQL string concatenation before the engine patch.
 */

const knex = require('knex');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const db = knex({
  client: 'pg',
  connection: process.env.DATABASE_URL || 'postgres://dummy:dummy@localhost:5432/dummy'
});

async function run() {
  console.log('🔍 Searching for stuck CRUDEOILM positions...');
  try {
    const stuck = await db('positions')
      .where('symbol', 'like', '%CRUDEOILM%')
      .whereNot({ quantity: 0 });

    if (stuck.length === 0) {
      console.log('✅ No stuck CRUDEOILM positions found.');
      process.exit(0);
    }

    console.log(`Found ${stuck.length} stuck CRUDEOILM position(s). Closing...`);

    for (const pos of stuck) {
      console.log(`  Fixing position ID: ${pos.id} | User ID: ${pos.user_id} | Qty: ${pos.quantity} | Avg: ${pos.average_price}`);
      
      const marginBlocked = parseFloat(pos.margin) || 0;
      if (marginBlocked > 0) {
        await db('users').where({ id: pos.user_id }).increment('balance', marginBlocked);
        await db('ledger').insert({
          user_id: pos.user_id,
          amount: marginBlocked,
          type: 'MARGIN_RELEASE',
          description: `Margin release for resolved CRUDEOILM position ${pos.id}`
        }).catch(() => {});
        console.log(`  -> Released ₹${marginBlocked} margin to user ${pos.user_id}`);
      }

      await db('positions').where({ id: pos.id }).update({
        quantity: 0,
        closed_quantity: Math.max(1, Math.abs(Number(pos.quantity))),
        exit_price: pos.exit_price || 9827.00,
        margin: 0,
        updated_at: new Date()
      });
      console.log(`  -> Position ${pos.id} marked CLOSED.`);
    }

    console.log('🎉 All stuck CRUDEOILM positions resolved successfully.');
    process.exit(0);
  } catch (err) {
    console.error('❌ Error fixing stuck positions:', err.message);
    process.exit(1);
  }
}

run();
