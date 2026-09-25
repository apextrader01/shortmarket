const db = require('../database/db');

async function restoreExitedHoldings() {
  const isConfirm = process.argv.includes('--confirm');
  console.log(`================================================================`);
  console.log(`🔄 SHORT EDGE: UNDO "EXIT ALL HOLDINGS" RESTORATION TOOL`);
  console.log(`Mode: ${isConfirm ? '⚡ LIVE EXECUTION (--confirm)' : '🔍 DRY-RUN PREVIEW (pass --confirm to apply)'}`);
  console.log(`================================================================\n`);

  try {
    // 1. Locate User Hari@123 or SE000002
    const user = await db('users')
      .where({ username: 'Hari@123' })
      .orWhere({ client_id: 'SE000002' })
      .first();

    if (!user) {
      console.error('❌ User Hari@123 / SE000002 not found.');
      process.exit(1);
    }
    console.log(`👤 User Found: ${user.username} (Client ID: ${user.client_id || 'N/A'}, ID: ${user.id})`);
    console.log(`💰 Current Balance: ₹${parseFloat(user.balance).toLocaleString('en-IN')}\n`);

    // 2. Identify exit orders created around 09:43 PM on 20 Sept 2026
    // Search window: between 21:40 and 21:47 IST (or remarks = 'Exit All Holdings')
    const exitOrders = await db('orders')
      .where({ user_id: user.id })
      .where('status', 'EXECUTED')
      .where(function() {
        this.where('remarks', 'Exit All Holdings')
          .orWhere(function() {
            this.where('created_at', '>=', '2026-09-20 21:40:00+05:30')
              .andWhere('created_at', '<=', '2026-09-20 21:50:00+05:30');
          })
          .orWhere(function() {
            // Also check UTC timestamps (~16:10 to 16:20 UTC)
            this.where('created_at', '>=', '2026-09-20 16:10:00Z')
              .andWhere('created_at', '<=', '2026-09-20 16:20:00Z');
          });
      })
      .orderBy('id', 'asc');

    if (!exitOrders || exitOrders.length === 0) {
      console.log('⚠️ No exit orders found matching the batch window.');
      console.log('Checking recent orders:');
      const recent = await db('orders').where({ user_id: user.id }).orderBy('id', 'desc').limit(10);
      console.log(recent.map(o => ({ id: o.id, symbol: o.symbol, side: o.side, qty: o.quantity, status: o.status, created_at: o.created_at })));
      process.exit(0);
    }

    console.log(`📋 Found ${exitOrders.length} exit orders from the 09:43 PM liquidation batch.\n`);

    // 3. Find closed positions created during the batch
    const closedPositions = await db('positions')
      .where({ user_id: user.id })
      .where('quantity', 0)
      .where('closed_quantity', '>', 0)
      .where(function() {
        this.where('created_at', '>=', '2026-09-20 21:40:00+05:30')
          .orWhere('updated_at', '>=', '2026-09-20 21:40:00+05:30')
          .orWhere('created_at', '>=', '2026-09-20 16:10:00Z')
          .orWhere('updated_at', '>=', '2026-09-20 16:10:00Z');
      });

    console.log(`📊 Found ${closedPositions.length} position records associated with the liquidation batch.`);

    let totalBalanceToDeduct = 0;
    const holdingsToRestore = [];
    const positionsToReopen = [];
    const closedPositionsToDelete = [];

    // Separate stock/MF holdings vs derivative positions
    for (const order of exitOrders) {
      const sym = order.symbol || '';
      const isDerivative = sym.includes('CE') || sym.includes('PE') || sym.includes('FUT') || sym.startsWith('MCX:');

      if (!isDerivative) {
        // Stock / MF Holding
        // Find matching closed position created for this symbol
        const matchPos = closedPositions.find(p => p.symbol === sym && Number(p.closed_quantity) === Number(order.quantity));
        const avgPrice = matchPos ? parseFloat(matchPos.average_price) : parseFloat(order.price);
        const assetClass = sym.endsWith('-MF') || /^\d{5,6}$/.test(sym) ? 'MUTUAL_FUND' : 'STOCK';

        holdingsToRestore.push({
          user_id: user.id,
          symbol: sym,
          quantity: parseFloat(order.quantity),
          average_price: avgPrice,
          asset_class: assetClass
        });

        if (matchPos) {
          closedPositionsToDelete.push(matchPos.id);
        }

        const saleValue = parseFloat(order.quantity) * parseFloat(order.price);
        totalBalanceToDeduct += saleValue;
      } else {
        // F&O Position (e.g. FINNIFTY)
        // If order was BUY, the original position was SHORT (-qty)
        // If order was SELL, the original position was LONG (+qty)
        const originalQty = order.side === 'BUY' ? -parseFloat(order.quantity) : parseFloat(order.quantity);
        const matchPos = closedPositions.find(p => p.symbol === sym);
        const posId = matchPos ? matchPos.id : null;

        positionsToReopen.push({
          id: posId,
          symbol: sym,
          quantity: originalQty,
          exitOrder: order
        });

        // Net PnL was added or subtracted
        if (order.realized_pnl) {
          totalBalanceToDeduct += parseFloat(order.realized_pnl);
        }
      }
    }

    console.log(`\n--- Plan Summary ---`);
    console.log(`📦 Holdings to restore into 'holdings' table: ${holdingsToRestore.length} item(s)`);
    holdingsToRestore.forEach(h => {
      console.log(`   + RESTORE HOLDING: ${h.symbol} | Qty: ${h.quantity} | Avg: ₹${h.average_price}`);
    });

    console.log(`\n📈 F&O Positions to reopen: ${positionsToReopen.length} item(s)`);
    positionsToReopen.forEach(p => {
      console.log(`   + REOPEN POSITION: ${p.symbol} | Restore Qty: ${p.quantity}`);
    });

    console.log(`\n🗑️ Exit orders to remove from 'orders': ${exitOrders.length} order(s)`);
    console.log(`🗑️ Synthetic closed position rows to delete: ${closedPositionsToDelete.length} row(s)`);
    console.log(`💵 Total Balance adjustment (deduct sale proceeds credited): ₹${totalBalanceToDeduct.toLocaleString('en-IN')}`);
    console.log(`💰 Projected Balance after undo: ₹${(parseFloat(user.balance) - totalBalanceToDeduct).toLocaleString('en-IN')}\n`);

    if (!isConfirm) {
      console.log(`⚠️ DRY RUN COMPLETE. NO CHANGES MADE TO DATABASE.`);
      console.log(`To execute this restoration, run with --confirm:`);
      console.log(`node scripts/restore_exited_holdings.js --confirm\n`);
      process.exit(0);
    }

    // 4. ATOMIC TRANSACTION EXECUTION
    console.log(`🚀 Executing transaction...`);
    await db.transaction(async (trx) => {
      // Re-insert holdings
      for (const h of holdingsToRestore) {
        // Check if already present to avoid duplicates
        const exists = await trx('holdings').where({ user_id: h.user_id, symbol: h.symbol }).first();
        if (exists) {
          await trx('holdings').where({ id: exists.id }).update({
            quantity: parseFloat(exists.quantity) + h.quantity,
            average_price: h.average_price,
            updated_at: new Date()
          });
        } else {
          await trx('holdings').insert({
            user_id: h.user_id,
            symbol: h.symbol,
            quantity: h.quantity,
            average_price: h.average_price,
            asset_class: h.asset_class,
            created_at: new Date(),
            updated_at: new Date()
          });
        }
      }

      // Reopen F&O positions
      for (const p of positionsToReopen) {
        if (p.id) {
          await trx('positions').where({ id: p.id }).update({
            quantity: p.quantity,
            closed_quantity: 0,
            exit_price: null,
            realized_pnl: 0,
            updated_at: new Date()
          });
        } else {
          // Re-insert position if record was deleted
          await trx('positions').insert({
            user_id: user.id,
            symbol: p.symbol,
            quantity: p.quantity,
            closed_quantity: 0,
            average_price: p.exitOrder.price || 0,
            exit_price: null,
            realized_pnl: 0,
            product_type: 'DEL',
            created_at: new Date(),
            updated_at: new Date()
          });
        }
      }

      // Delete synthetic closed positions
      if (closedPositionsToDelete.length > 0) {
        await trx('positions').whereIn('id', closedPositionsToDelete).del();
      }

      // Delete exit orders
      const orderIds = exitOrders.map(o => o.id);
      await trx('orders').whereIn('id', orderIds).del();

      // Clean up ledger entries from the batch
      await trx('ledger')
        .where({ user_id: user.id })
        .where(function() {
          this.where('description', 'like', '%Holding principal released%')
            .orWhere('description', 'like', '%Short delivery margin released%')
            .orWhere('description', 'like', '%Exit All Holdings%')
            .orWhere('description', 'like', '%Realized P&L for exited holding%');
        })
        .where(function() {
          this.where('created_at', '>=', '2026-09-20 21:40:00+05:30')
            .orWhere('created_at', '>=', '2026-09-20 16:10:00Z');
        })
        .del();

      // Deduct credited balance
      if (totalBalanceToDeduct > 0) {
        await trx('users').where({ id: user.id }).decrement('balance', totalBalanceToDeduct);
      }
    });

    const updatedUser = await db('users').where({ id: user.id }).first();
    console.log(`✅ SUCCESS! All holdings and positions have been restored!`);
    console.log(`💰 New Account Balance: ₹${parseFloat(updatedUser.balance).toLocaleString('en-IN')}`);
    process.exit(0);

  } catch (err) {
    console.error('❌ Restoration failed:', err);
    process.exit(1);
  }
}

restoreExitedHoldings();
