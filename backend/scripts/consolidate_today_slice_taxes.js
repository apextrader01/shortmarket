/**
 * Consolidates fragmented micro-slice Taxes & Brokerage ledger entries for today
 * into unified, clean order-level ledger records.
 */

const db = require('../database/db');

async function consolidateTodaySliceTaxes(knexInstance = db) {
  try {
    if (!knexInstance || typeof knexInstance !== 'function') return 0;

    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    // Find all fragmented slice TAXES entries created today
    const sliceTaxEntries = await knexInstance('ledger')
      .where('type', 'TAXES')
      .where('created_at', '>=', todayStart)
      .where('description', 'like', 'Taxes & Brokerage for %')
      .whereNot('description', 'like', '%Order #%')
      .whereNot('description', 'like', '%Consolidated%');

    if (!sliceTaxEntries || sliceTaxEntries.length <= 1) {
      return 0;
    }

    // Group entries by user_id, symbol, and side
    const groups = {};
    for (const entry of sliceTaxEntries) {
      const match = entry.description.match(/Taxes\s+&\s+Brokerage\s+for\s+(BUY|SELL)\s+([\d.]+)\s+(.+)/i);
      const side = match ? match[1].toUpperCase() : 'TRADE';
      const qty = match ? parseFloat(match[2]) : 0;
      const symbol = match ? match[3].trim() : 'SCRIP';
      const key = `${entry.user_id}_${symbol}_${side}`;

      if (!groups[key]) {
        groups[key] = {
          user_id: entry.user_id,
          symbol,
          side,
          totalQty: 0,
          totalAmount: 0,
          ids: [],
          firstCreatedAt: entry.created_at
        };
      }
      groups[key].totalQty += qty;
      groups[key].totalAmount += Number(entry.amount || 0);
      groups[key].ids.push(entry.id);
    }

    let consolidatedRows = 0;
    for (const key of Object.keys(groups)) {
      const g = groups[key];
      if (g.ids.length > 1) {
        await knexInstance.transaction(async (trx) => {
          // Delete fragmented slice entries
          await trx('ledger').whereIn('id', g.ids).del();

          // Insert 1 consolidated entry with identical total debit amount
          await trx('ledger').insert({
            user_id: g.user_id,
            amount: Math.round((g.totalAmount + Number.EPSILON) * 100) / 100,
            type: 'TAXES',
            description: `Taxes & Brokerage for ${g.side} ${g.totalQty} ${g.symbol} (Consolidated)`,
            created_at: g.firstCreatedAt
          });
        });
        consolidatedRows += g.ids.length;
      }
    }

    if (consolidatedRows > 0) {
      console.log(`[LEDGER CLEANUP] Successfully consolidated ${consolidatedRows} micro-slice tax entries into clean order-level records.`);
    }
    return consolidatedRows;
  } catch (err) {
    console.error('[LEDGER CLEANUP ERROR]', err.message);
    return 0;
  }
}

if (require.main === module) {
  consolidateTodaySliceTaxes()
    .then(count => {
      console.log(`Consolidation completed. Rows consolidated: ${count}`);
      process.exit(0);
    })
    .catch(err => {
      console.error(err);
      process.exit(1);
    });
}

module.exports = { consolidateTodaySliceTaxes };
