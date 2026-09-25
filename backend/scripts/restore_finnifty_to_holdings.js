const db = require('../database/db');

async function addFinniftyToHoldings() {
  console.log(`================================================================`);
  console.log(`⚡ SHORT EDGE: RESTORE FINNIFTY TO HOLDINGS`);
  console.log(`================================================================\n`);

  try {
    const user = await db('users')
      .where({ username: 'Hari@123' })
      .orWhere({ client_id: 'SE000002' })
      .first();

    if (!user) {
      console.error('❌ User Hari@123 / SE000002 not found.');
      process.exit(1);
    }
    console.log(`👤 Target User: ${user.username} (Client ID: ${user.client_id || 'N/A'}, ID: ${user.id})`);

    // 1. Find all FINNIFTY records in positions and orders
    const finniftyPositions = await db('positions')
      .where({ user_id: user.id })
      .where('symbol', 'like', '%FINNIFTY%');

    console.log(`📊 Found ${finniftyPositions.length} FINNIFTY position row(s) in DB.`);

    const finniftyExitOrders = await db('orders')
      .where({ user_id: user.id })
      .where('symbol', 'like', '%FINNIFTY%')
      .where(function() {
        this.where('remarks', 'like', '%Exit%')
          .orWhere('created_at', '>=', '2026-09-20 21:40:00+05:30')
          .orWhere('created_at', '>=', '2026-09-20 16:10:00Z');
      });

    console.log(`📋 Found ${finniftyExitOrders.length} FINNIFTY exit order(s) placed during exit-all.`);

    await db.transaction(async (trx) => {
      // 2. Reopen / Restore FINNIFTY positions as active Delivery holdings
      for (const pos of finniftyPositions) {
        // If it was closed (quantity = 0), restore its original quantity
        let targetQty = Number(pos.quantity);
        if (targetQty === 0) {
          const closedQty = Number(pos.closed_quantity || 0);
          // If 25650CE it was short (-60 or -120), if 25550CE it was long (+60)
          if (pos.symbol.includes('25650CE')) {
            targetQty = closedQty > 0 ? -closedQty : -60;
          } else if (pos.symbol.includes('25550CE')) {
            targetQty = closedQty > 0 ? closedQty : 60;
          } else {
            targetQty = closedQty !== 0 ? closedQty : 60;
          }
        }

        console.log(`   + Reopening Position ${pos.symbol}: setting quantity = ${targetQty}, product_type = 'DEL'`);
        await trx('positions').where({ id: pos.id }).update({
          quantity: targetQty,
          closed_quantity: 0,
          exit_price: null,
          realized_pnl: 0,
          product_type: 'DEL',
          updated_at: new Date()
        });

        // Also add directly into holdings table for guaranteed Holdings tab display
        const holdingExists = await trx('holdings').where({ user_id: user.id, symbol: pos.symbol }).first();
        if (holdingExists) {
          await trx('holdings').where({ id: holdingExists.id }).update({
            quantity: Math.abs(targetQty),
            average_price: pos.average_price,
            asset_class: 'OPTIONS',
            updated_at: new Date()
          });
        } else {
          await trx('holdings').insert({
            user_id: user.id,
            symbol: pos.symbol,
            quantity: Math.abs(targetQty),
            average_price: pos.average_price,
            asset_class: 'OPTIONS',
            created_at: new Date(),
            updated_at: new Date()
          });
        }
      }

      // 3. Remove the exit orders from 'orders' so it completely clears out of Closed tab
      if (finniftyExitOrders.length > 0) {
        const orderIds = finniftyExitOrders.map(o => o.id);
        await trx('orders').whereIn('id', orderIds).del();
        console.log(`   - Deleted ${orderIds.length} exit orders from 'orders' table.`);
      }

      // 4. Also clean up any ledger records created for FINNIFTY exit
      await trx('ledger')
        .where({ user_id: user.id })
        .where('description', 'like', '%FINNIFTY%')
        .where(function() {
          this.where('created_at', '>=', '2026-09-20 21:40:00+05:30')
            .orWhere('created_at', '>=', '2026-09-20 16:10:00Z');
        })
        .del();
    });

    console.log(`\n✅ SUCCESS! FINNIFTY is now restored and added to your HOLDINGS tab!`);
    console.log(`It has been completely removed from the [CLOSED] tab.`);
    process.exit(0);

  } catch (err) {
    console.error('❌ Failed to restore FINNIFTY to holdings:', err);
    process.exit(1);
  }
}

addFinniftyToHoldings();
