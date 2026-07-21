const db = require('../database/db');

async function cleanup() {
  console.log('🧹 Starting cleanup of duplicate open positions...');
  try {
    const duplicates = await db('positions')
      .select('user_id', 'symbol', 'product_type')
      .whereNot('quantity', 0)
      .groupBy('user_id', 'symbol', 'product_type')
      .having(db.raw('count(*)'), '>', 1);

    console.log(`Found ${duplicates.length} symbols with duplicate open positions.`);

    for (const dup of duplicates) {
      const records = await db('positions')
        .where({
          user_id: dup.user_id,
          symbol: dup.symbol,
          product_type: dup.product_type
        })
        .whereNot('quantity', 0)
        .orderBy('id', 'asc');

      console.log(`Processing ${dup.symbol} (${dup.product_type}) - Found ${records.length} open records.`);

      let netQty = 0;
      let netMargin = 0;
      let primaryRecord = records[0];

      for (const rec of records) {
        netQty += Number(rec.quantity);
        netMargin += Number(rec.margin || 0);
      }

      await db.transaction(async (trx) => {
        // Update the primary record to have the net aggregated quantity and margin
        await trx('positions')
          .where({ id: primaryRecord.id })
          .update({
            quantity: netQty,
            margin: netMargin,
            updated_at: new Date()
          });

        console.log(`  Updated primary position ID ${primaryRecord.id} to Net Qty: ${netQty}, Net Margin: ${netMargin}`);

        // Mark all subsequent records as closed (quantity = 0)
        for (let i = 1; i < records.length; i++) {
          const rec = records[i];
          await trx('positions')
            .where({ id: rec.id })
            .update({
              quantity: 0,
              closed_quantity: Math.abs(rec.quantity),
              margin: 0,
              updated_at: new Date()
            });
          console.log(`  Closed duplicate position ID ${rec.id}`);
        }
      });
    }

    console.log('✅ Cleanup completed successfully.');
    process.exit(0);
  } catch (err) {
    console.error('❌ Cleanup failed:', err);
    process.exit(1);
  }
}

cleanup();
