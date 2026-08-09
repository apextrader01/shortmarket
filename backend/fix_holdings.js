/**
 * One-Time Fix: Manually trigger T+1 Holdings Migration
 * Run: node fix_holdings.js
 * Safe to run multiple times — it correctly averages prices.
 */
require('dotenv').config();
const db = require('./database/db');

const COMMODITIES = ['CRUDEOIL', 'GOLD', 'SILVER', 'NATURALGAS', 'COPPER', 'ZINC', 'LEAD', 'ALUMINIUM', 'MENTHAOIL', 'COTTON'];

async function fixHoldings() {
    console.log('🔧 Starting Manual Holdings Migration...');
    try {
        // Find all DEL positions with quantity > 0 (these are stuck delivery buys)
        const deliveryPositions = await db('positions')
            .where('product_type', 'DEL')
            .where('quantity', '>', 0);

        console.log(`📦 Found ${deliveryPositions.length} stuck delivery position(s) to migrate.`);

        if (deliveryPositions.length === 0) {
            console.log('✅ Nothing to migrate. Holdings are already up to date!');
            await db.destroy();
            return;
        }

        await db.transaction(async (trx) => {
            for (const pos of deliveryPositions) {
                const isCommodity = COMMODITIES.some(c => pos.symbol.startsWith(c));
                const assetClass = isCommodity ? 'COMMODITY' : 'STOCK';

                const existingHolding = await trx('holdings')
                    .where({ user_id: pos.user_id, symbol: pos.symbol })
                    .first();

                if (existingHolding) {
                    const newTotalQty = existingHolding.quantity + pos.quantity;
                    const totalCost = (existingHolding.quantity * existingHolding.average_price) + (pos.quantity * pos.average_price);
                    const newAvgPrice = totalCost / newTotalQty;

                    await trx('holdings')
                        .where({ id: existingHolding.id })
                        .update({ quantity: newTotalQty, average_price: newAvgPrice });

                    console.log(`📈 Updated existing holding: ${pos.symbol} for user ${pos.user_id} -> Qty: ${newTotalQty}, Avg: ${newAvgPrice.toFixed(2)}`);
                } else {
                    await trx('holdings').insert({
                        user_id: pos.user_id,
                        symbol: pos.symbol,
                        quantity: pos.quantity,
                        average_price: pos.average_price,
                        asset_class: assetClass
                    });
                    console.log(`✅ Created new holding: ${pos.symbol} for user ${pos.user_id} -> Qty: ${pos.quantity}, Avg: ${pos.average_price}`);
                }
            }

            // Wipe the migrated DEL positions
            const ids = deliveryPositions.map(p => p.id);
            await trx('positions').whereIn('id', ids).del();
            console.log(`🗑️  Removed ${ids.length} migrated position(s) from positions table.`);
        });

        console.log('🎉 Holdings migration complete! Users will now see their stocks in Holdings.');
    } catch (err) {
        console.error('❌ Migration failed:', err);
    } finally {
        await db.destroy();
    }
}

fixHoldings();
