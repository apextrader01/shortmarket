const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });
require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });

const db = require('../database/db');

async function fixDecimalQuantities() {
  if (!process.env.DATABASE_URL) {
    console.warn('⚠️  DATABASE_URL not set. Skipping decimal cleanup.');
    process.exit(0);
  }

  console.log('🧹 Starting decimal quantity cleanup for non-MF symbols...');
  try {
    // 1. Orders: Round quantity, filled_quantity, pending_quantity for non-MF symbols
    const orderRes = await db.raw(`
      UPDATE orders
      SET
        quantity = ROUND(quantity),
        filled_quantity = ROUND(filled_quantity),
        pending_quantity = ROUND(pending_quantity)
      WHERE
        symbol NOT LIKE '%-MF'
        AND symbol NOT LIKE '%:MF'
        AND (
          quantity != ROUND(quantity)
          OR filled_quantity != ROUND(filled_quantity)
          OR pending_quantity != ROUND(pending_quantity)
        )
    `);
    console.log(`  ✅ Cleaned orders with decimal quantities: ${orderRes.rowCount || 0} row(s) updated.`);

    // 2. Positions: Round quantity, closed_quantity for non-MF symbols
    const posRes = await db.raw(`
      UPDATE positions
      SET
        quantity = ROUND(quantity),
        closed_quantity = ROUND(closed_quantity)
      WHERE
        symbol NOT LIKE '%-MF'
        AND symbol NOT LIKE '%:MF'
        AND (
          quantity != ROUND(quantity)
          OR closed_quantity != ROUND(closed_quantity)
        )
    `);
    console.log(`  ✅ Cleaned positions with decimal quantities: ${posRes.rowCount || 0} row(s) updated.`);

    // 3. Holdings: Round quantity for non-MF symbols
    const holdRes = await db.raw(`
      UPDATE holdings
      SET
        quantity = ROUND(quantity)
      WHERE
        symbol NOT LIKE '%-MF'
        AND symbol NOT LIKE '%:MF'
        AND quantity != ROUND(quantity)
    `);
    console.log(`  ✅ Cleaned holdings with decimal quantities: ${holdRes.rowCount || 0} row(s) updated.`);

    console.log('🎉 Decimal quantity cleanup completed successfully!');
    if (require.main === module) process.exit(0);
  } catch (err) {
    console.error('❌ Decimal quantity cleanup error:', err.message);
    if (require.main === module) process.exit(1);
  }
}

if (require.main === module) {
  fixDecimalQuantities();
}

module.exports = { fixDecimalQuantities };
