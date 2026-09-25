const db = require('../database/db');

async function restoreRelianceToHoldings() {
  console.log(`================================================================`);
  console.log(`⚡ SHORT EDGE: RESTORE RELIANCE TO HOLDINGS & CLEAN CLOSED TAB`);
  console.log(`================================================================\n`);

  try {
    const user = await db('users')
      .where({ username: 'Hari@123' })
      .orWhere({ client_id: 'SE000002' })
      .first();

    if (!user) {
      console.error('❌ User Hari@123 / SE000002 not found in database.');
      process.exit(1);
    }
    console.log(`👤 Target User: ${user.username} (Client ID: ${user.client_id || 'N/A'}, ID: ${user.id})`);
    console.log(`💰 Current Balance: ₹${parseFloat(user.balance).toLocaleString('en-IN')}\n`);

    // 1. Locate RELIANCE records in positions
    const reliancePositions = await db('positions')
      .where({ user_id: user.id })
      .where(function() {
        this.where('symbol', 'like', '%RELIANCE%')
          .andWhereNot('symbol', 'like', '%FUT%')
          .andWhereNot('symbol', 'like', '%CE%')
          .andWhereNot('symbol', 'like', '%PE%');
      });

    console.log(`📊 Found ${reliancePositions.length} RELIANCE position row(s) in DB:`);
    reliancePositions.forEach(p => {
      console.log(`   - ID: ${p.id} | Symbol: ${p.symbol} | Qty: ${p.quantity} | ClosedQty: ${p.closed_quantity} | Avg: ₹${p.average_price} | Exit: ${p.exit_price}`);
    });

    // 2. Locate any exit orders from the liquidation batch
    const relianceExitOrders = await db('orders')
      .where({ user_id: user.id })
      .where(function() {
        this.where('symbol', 'like', '%RELIANCE%')
          .andWhereNot('symbol', 'like', '%FUT%')
          .andWhereNot('symbol', 'like', '%CE%')
          .andWhereNot('symbol', 'like', '%PE%');
      })
      .where(function() {
        this.where('remarks', 'like', '%Exit%')
          .orWhere('remarks', 'like', '%Square%')
          .orWhere('created_at', '>=', '2026-09-20 21:40:00+05:30')
          .orWhere('created_at', '>=', '2026-09-20 16:10:00Z');
      });

    console.log(`\n📋 Found ${relianceExitOrders.length} RELIANCE exit order(s) placed during liquidation.`);

    // 3. Check existing holdings
    const existingHolding = await db('holdings')
      .where({ user_id: user.id })
      .where(function() {
        this.where('symbol', 'like', '%RELIANCE%');
      })
      .first();

    const targetQty = 11;
    const targetAvg = 1322.00;
    const targetSymbol = (reliancePositions[0] && reliancePositions[0].symbol) || 'BSE:RELIANCE';

    await db.transaction(async (trx) => {
      // 4. Restore into Holdings table
      if (existingHolding) {
        console.log(`\n📦 Updating existing holding ID ${existingHolding.id} (${existingHolding.symbol}): setting qty = ${targetQty}, avg = ₹${targetAvg}`);
        await trx('holdings').where({ id: existingHolding.id }).update({
          quantity: targetQty,
          average_price: targetAvg,
          asset_class: 'STOCK',
          updated_at: new Date()
        });
      } else {
        console.log(`\n📦 Inserting new holding: ${targetSymbol} | Qty: ${targetQty} | Avg: ₹${targetAvg}`);
        await trx('holdings').insert({
          user_id: user.id,
          symbol: targetSymbol,
          quantity: targetQty,
          average_price: targetAvg,
          asset_class: 'STOCK',
          created_at: new Date(),
          updated_at: new Date()
        });
      }

      // 5. Remove zero-quantity closed positions from positions table so it disappears from Closed tab
      if (reliancePositions.length > 0) {
        const posIds = reliancePositions.map(p => p.id);
        await trx('positions').whereIn('id', posIds).del();
        console.log(`🗑️ Removed ${posIds.length} zero-quantity position row(s) from 'positions' table.`);
      }

      // 6. Remove exit orders from orders table
      if (relianceExitOrders.length > 0) {
        const orderIds = relianceExitOrders.map(o => o.id);
        await trx('orders').whereIn('id', orderIds).del();
        console.log(`🗑️ Removed ${orderIds.length} liquidation order(s) from 'orders' table.`);
      }

      // 7. Clean up any liquidation ledger entries
      const deletedLedgers = await trx('ledger')
        .where({ user_id: user.id })
        .where('description', 'like', '%RELIANCE%')
        .where(function() {
          this.where('created_at', '>=', '2026-09-20 21:40:00+05:30')
            .orWhere('created_at', '>=', '2026-09-20 16:10:00Z');
        })
        .del();

      if (deletedLedgers > 0) {
        console.log(`🗑️ Cleaned up ${deletedLedgers} ledger record(s).`);
      }
    });

    console.log(`\n✅ SUCCESS! RELIANCE (${targetQty} Qty @ ₹${targetAvg}) has been restored to your HOLDINGS!`);
    console.log(`It has been completely cleaned up from the [CLOSED] tab.`);
    process.exit(0);

  } catch (err) {
    console.error('❌ Failed to restore RELIANCE to holdings:', err);
    process.exit(1);
  }
}

restoreRelianceToHoldings();
