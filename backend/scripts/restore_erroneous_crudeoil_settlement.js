/**
 * Remediation Script: Restore Erroneous 12:05 AM Expiry Execution for MCX:CRUDEOIL26OCT8800PE
 *
 * Usage:
 *   Dry-run (safe preview): node backend/scripts/restore_erroneous_crudeoil_settlement.js
 *   Execute:                node backend/scripts/restore_erroneous_crudeoil_settlement.js --execute
 */

const db = require('../database/db');

async function main() {
    const isExecute = process.argv.includes('--execute');

    console.log('========================================================================');
    console.log(`[RESTITUTION] Erroneous 12:05 AM Expiry Settlement Remediation Tool`);
    console.log(`[RESTITUTION] Mode: ${isExecute ? '⚡ LIVE EXECUTION' : '🔍 DRY-RUN PREVIEW'}`);
    console.log('========================================================================\n');

    try {
        // 1. Locate the erroneous order
        const erroneousOrders = await db('orders')
            .where(builder => {
                builder.where('symbol', 'like', '%CRUDEOIL26OCT8800PE%');
            })
            .where({ status: 'EXECUTED' })
            .where('price', '>', 5000) // The erroneous settlement was executed at 8781.20
            .orderBy('created_at', 'desc');

        if (erroneousOrders.length === 0) {
            console.log('⚠️  No executed orders found matching CRUDEOIL26OCT8800PE with price > ₹5,000.');
            console.log('   Either it was already reversed, or check your database connection.');
            process.exit(0);
        }

        console.log(`Found ${erroneousOrders.length} erroneous order(s) to process:\n`);

        for (const order of erroneousOrders) {
            console.log(`------------------------------------------------------------------------`);
            console.log(`Order ID:       ${order.id}`);
            console.log(`User ID:        ${order.user_id}`);
            console.log(`Symbol:         ${order.symbol}`);
            console.log(`Side:           ${order.side}`);
            console.log(`Quantity:       ${order.quantity}`);
            console.log(`Executed Price: ₹${order.price}`);
            console.log(`Realized P&L:   ₹${order.realized_pnl}`);
            console.log(`Executed At:    ${order.created_at}`);

            const user = await db('users').where({ id: order.user_id }).first();
            if (!user) {
                console.log(`❌ User ${order.user_id} not found in database!`);
                continue;
            }

            console.log(`User:           ${user.username} (${user.email})`);
            console.log(`Current Balance:₹${parseFloat(user.balance).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`);

            // Find associated position / holding
            const closedPos = await db('positions')
                .where({ user_id: order.user_id })
                .where(b => b.where('symbol', 'like', '%CRUDEOIL26OCT8800PE%'))
                .orderBy('updated_at', 'desc')
                .first();

            const closedHolding = await db('holdings')
                .where({ user_id: order.user_id })
                .where(b => b.where('symbol', 'like', '%CRUDEOIL26OCT8800PE%'))
                .first();

            const pnlDamage = Math.abs(parseFloat(order.realized_pnl || 0));
            const refundAmount = pnlDamage > 0 ? pnlDamage : (parseFloat(order.price) * parseFloat(order.quantity));
            const newBalance = Math.round((parseFloat(user.balance) + refundAmount + Number.EPSILON) * 100) / 100;

            console.log(`\nRemediation Plan:`);
            console.log(`  1. Balance Refund:   +₹${refundAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`);
            console.log(`  2. Restored Balance:  ₹${newBalance.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`);
            console.log(`  3. Order Status:      EXECUTED -> REVERSED`);
            console.log(`  4. Position Status:   Restore 100 qty position/holding`);

            if (!isExecute) {
                console.log(`\n👉 This was a DRY-RUN. To apply this remediation to the database, run:`);
                console.log(`   node backend/scripts/restore_erroneous_crudeoil_settlement.js --execute\n`);
                continue;
            }

            // Live execution in transaction
            await db.transaction(async (trx) => {
                // Step A: Lock user and restore balance
                const u = await trx('users').where({ id: order.user_id }).forUpdate().first();
                if (u) {
                    await trx('users').where({ id: order.user_id }).update({ balance: newBalance });
                }

                // Step B: Insert compensatory ledger entry
                await trx('ledger').insert({
                    user_id: order.user_id,
                    amount: refundAmount,
                    type: 'BALANCE_CORRECTION',
                    description: `Restitution for erroneous 12:05 AM expiry square-off of ${order.symbol} (Order #${order.id})`
                });

                // Step C: Update the erroneous order to REVERSED
                await trx('orders').where({ id: order.id }).update({
                    status: 'REVERSED',
                    realized_pnl: 0,
                    remarks: `REVERSED: Premature 12:05 AM settlement reversed. Refunded ₹${refundAmount}`,
                    updated_at: new Date()
                });

                // Step D: Re-open the position
                if (closedPos) {
                    const originalQty = order.side === 'BUY' ? -Math.abs(order.quantity) : Math.abs(order.quantity);
                    await trx('positions').where({ id: closedPos.id }).update({
                        quantity: originalQty,
                        closed_quantity: Math.max(0, (parseFloat(closedPos.closed_quantity) || 0) - Math.abs(order.quantity)),
                        exit_price: null,
                        realized_pnl: Math.round(((parseFloat(closedPos.realized_pnl) || 0) - parseFloat(order.realized_pnl || 0)) * 100) / 100,
                        updated_at: new Date()
                    });
                    console.log(`  ✅ Position #${closedPos.id} restored to quantity ${originalQty}`);
                } else if (!closedHolding) {
                    // Re-create position if deleted
                    const originalQty = order.side === 'BUY' ? -Math.abs(order.quantity) : Math.abs(order.quantity);
                    await trx('positions').insert({
                        user_id: order.user_id,
                        symbol: order.symbol,
                        quantity: originalQty,
                        closed_quantity: 0,
                        average_price: 134.70, // Original sell entry
                        margin: 0,
                        realized_pnl: 0,
                        product_type: order.product_type || 'DEL',
                        created_at: new Date(),
                        updated_at: new Date()
                    });
                    console.log(`  ✅ Position re-created with quantity ${originalQty}`);
                }

                console.log(`  ✅ User ${user.username} balance restored to ₹${newBalance.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`);
                console.log(`  ✅ Ledger entry inserted.`);
                console.log(`  ✅ Order #${order.id} marked as REVERSED.`);
            });
        }

        console.log(`\n========================================================================`);
        console.log(`[RESTITUTION] Completed successfully!`);
        console.log(`========================================================================\n`);

    } catch (err) {
        console.error('[RESTITUTION ERROR]:', err);
    } finally {
        await db.destroy();
    }
}

main();
