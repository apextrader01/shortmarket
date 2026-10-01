/**
 * Consolidates fragmented micro-slice Taxes & Brokerage, Margin Block, and Margin Release
 * ledger entries for today into unified, clean order-level ledger records across ALL instruments
 * (Index F&O, Stock Equity, Stock F&O, MCX Commodities).
 */

const db = require('../database/db');

async function consolidateTodaySliceTaxes(knexInstance = db) {
  try {
    if (!knexInstance || typeof knexInstance !== 'function') return 0;

    const { getTradingSessionStartIST } = require('../services/autoSquareOff');
    const todayStart = getTradingSessionStartIST();

    let consolidatedRows = 0;

    // ─────────────────────────────────────────────────────────────────────────
    // 1. Consolidate fragmented slice TAXES entries
    // ─────────────────────────────────────────────────────────────────────────
    const sliceTaxEntries = await knexInstance('ledger')
      .where('type', 'TAXES')
      .where('created_at', '>=', todayStart)
      .where('description', 'like', 'Taxes & Brokerage for %')
      .whereNot('description', 'like', '%Order #%')
      .whereNot('description', 'like', '%Consolidated%');

    if (sliceTaxEntries && sliceTaxEntries.length > 1) {
      const taxGroups = {};
      for (const entry of sliceTaxEntries) {
        const desc = entry.description || '';
        const groupMatch = desc.match(/\[(slice_[^\]]+)\]/);
        const sliceGroupId = groupMatch ? groupMatch[1] : null;

        const match = desc.match(/Taxes\s+&\s+Brokerage\s+for\s+(BUY|SELL)\s+([\d.]+)\s+(.+?)(?:\s+\((\d+)\s+Slices\))?(?:\s+\[.+\])?$/i);
        const side = match ? match[1].toUpperCase() : 'TRADE';
        const qty = match ? parseFloat(match[2]) : 0;
        const symbol = match ? match[3].trim() : 'SCRIP';

        const timeBucket = Math.floor(new Date(entry.created_at).getTime() / 180000);
        const key = sliceGroupId ? `tax_grp_${entry.user_id}_${sliceGroupId}` : `tax_${entry.user_id}_${symbol}_${side}_${timeBucket}`;

        if (!taxGroups[key]) {
          taxGroups[key] = {
            user_id: entry.user_id,
            symbol,
            side,
            totalQty: 0,
            totalAmount: 0,
            ids: [],
            firstCreatedAt: entry.created_at
          };
        }
        taxGroups[key].totalQty += qty;
        taxGroups[key].totalAmount += Number(entry.amount || 0);
        taxGroups[key].ids.push(entry.id);
      }

      for (const key of Object.keys(taxGroups)) {
        const g = taxGroups[key];
        if (g.ids.length > 1) {
          await knexInstance.transaction(async (trx) => {
            await trx('ledger').whereIn('id', g.ids).del();
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
    }

    // ─────────────────────────────────────────────────────────────────────────
    // 2. Consolidate fragmented MARGIN_BLOCK entries
    // ─────────────────────────────────────────────────────────────────────────
    const sliceBlockEntries = await knexInstance('ledger')
      .where('type', 'MARGIN_BLOCK')
      .where('created_at', '>=', todayStart)
      .whereNot('description', 'like', '%Consolidated%');

    if (sliceBlockEntries && sliceBlockEntries.length > 1) {
      const blockGroups = {};
      for (const entry of sliceBlockEntries) {
        const desc = entry.description || '';
        const groupMatch = desc.match(/\[(slice_[^\]]+)\]/);
        const sliceGroupId = groupMatch ? groupMatch[1] : null;

        const detailMatch = desc.match(/Margin\s+blocked\s+for\s+(BUY|SELL)\s+(?:([\d.]+)\s+)?([^\s\[]+)(?:\s+\((.+?)\))?/i);
        const side = detailMatch ? detailMatch[1].toUpperCase() : 'TRADE';
        const qty = detailMatch && detailMatch[2] ? parseFloat(detailMatch[2]) : 0;
        const symbol = detailMatch ? detailMatch[3].trim() : 'SCRIP';
        const productType = detailMatch && detailMatch[4] ? detailMatch[4].trim() : '';

        const timeBucket = Math.floor(new Date(entry.created_at).getTime() / 180000);
        const key = sliceGroupId ? `block_grp_${entry.user_id}_${sliceGroupId}` : `block_${entry.user_id}_${symbol}_${side}_${productType}_${timeBucket}`;

        if (!blockGroups[key]) {
          blockGroups[key] = {
            user_id: entry.user_id,
            symbol,
            side,
            productType,
            totalQty: 0,
            totalAmount: 0,
            ids: [],
            firstCreatedAt: entry.created_at
          };
        }
        blockGroups[key].totalQty += qty;
        blockGroups[key].totalAmount += Number(entry.amount || 0);
        blockGroups[key].ids.push(entry.id);
      }

      for (const key of Object.keys(blockGroups)) {
        const g = blockGroups[key];
        if (g.ids.length > 1) {
          await knexInstance.transaction(async (trx) => {
            await trx('ledger').whereIn('id', g.ids).del();
            await trx('ledger').insert({
              user_id: g.user_id,
              amount: Math.round((g.totalAmount + Number.EPSILON) * 100) / 100,
              type: 'MARGIN_BLOCK',
              description: `Margin blocked for ${g.side} ${g.totalQty > 0 ? g.totalQty + ' ' : ''}${g.symbol}${g.productType ? ' (' + g.productType + ')' : ''} (Consolidated)`,
              created_at: g.firstCreatedAt
            });
          });
          consolidatedRows += g.ids.length;
        }
      }
    }

    // ─────────────────────────────────────────────────────────────────────────
    // 3. Consolidate fragmented MARGIN_RELEASE entries
    // ─────────────────────────────────────────────────────────────────────────
    const sliceReleaseEntries = await knexInstance('ledger')
      .where('type', 'MARGIN_RELEASE')
      .where('created_at', '>=', todayStart)
      .whereNot('description', 'like', '%Consolidated%');

    if (sliceReleaseEntries && sliceReleaseEntries.length > 1) {
      const releaseGroups = {};
      for (const entry of sliceReleaseEntries) {
        const desc = entry.description || '';
        const groupMatch = desc.match(/\[(slice_[^\]]+)\]/);
        const sliceGroupId = groupMatch ? groupMatch[1] : null;

        const orderMatch = desc.match(/\(Order\s+#(\d+)\)/i);
        const orderId = orderMatch ? orderMatch[1] : null;

        let symbol = 'SCRIP';
        let qty = 0;
        const symMatch = desc.match(/(?:partial close:\s*|close:\s*|cancelled orders|dangling order|exit order|cancelled order:\s+(?:[\d.]+\s+)?)\s*(?:[\d.]+\s+)?([^\s\[:]+(?::[^\s\[:]+)?)/i);
        if (symMatch) {
          symbol = symMatch[1].trim();
        }

        const qtyMatch = desc.match(/(?:partial close:\s*|close:\s*|cancelled order:\s+)([\d.]+)/i);
        if (qtyMatch) {
          qty = parseFloat(qtyMatch[1]) || 0;
        }

        const timeBucket = Math.floor(new Date(entry.created_at).getTime() / 180000);
        const key = sliceGroupId 
          ? `rel_grp_${entry.user_id}_${sliceGroupId}` 
          : (orderId ? `rel_ord_${entry.user_id}_${orderId}` : `rel_${entry.user_id}_${symbol}_${timeBucket}`);

        if (!releaseGroups[key]) {
          releaseGroups[key] = {
            user_id: entry.user_id,
            symbol,
            orderId,
            sliceGroupId,
            totalQty: 0,
            totalAmount: 0,
            ids: [],
            firstCreatedAt: entry.created_at
          };
        }
        releaseGroups[key].totalQty += qty;
        releaseGroups[key].totalAmount += Number(entry.amount || 0);
        releaseGroups[key].ids.push(entry.id);
      }

      for (const key of Object.keys(releaseGroups)) {
        const g = releaseGroups[key];
        if (g.ids.length > 1) {
          await knexInstance.transaction(async (trx) => {
            await trx('ledger').whereIn('id', g.ids).del();
            const tag = g.sliceGroupId ? ` [${g.sliceGroupId}]` : (g.orderId ? ` (Order #${g.orderId})` : ' (Consolidated)');
            await trx('ledger').insert({
              user_id: g.user_id,
              amount: Math.round((g.totalAmount + Number.EPSILON) * 100) / 100,
              type: 'MARGIN_RELEASE',
              description: `Margin released for close: ${g.totalQty > 0 ? g.totalQty + ' ' : ''}${g.symbol}${tag.includes('Consolidated') ? tag : tag + ' (Consolidated)'}`,
              created_at: g.firstCreatedAt
            });
          });
          consolidatedRows += g.ids.length;
        }
      }
    }

    // ─────────────────────────────────────────────────────────────────────────
    // 4. Consolidate fragmented REALIZED_PNL entries
    // ─────────────────────────────────────────────────────────────────────────
    const slicePnlEntries = await knexInstance('ledger')
      .where('type', 'REALIZED_PNL')
      .where('created_at', '>=', todayStart)
      .whereNot('description', 'like', '%Consolidated%');

    if (slicePnlEntries && slicePnlEntries.length > 1) {
      const pnlGroups = {};
      for (const entry of slicePnlEntries) {
        const desc = entry.description || '';
        const groupMatch = desc.match(/\[(slice_[^\]]+)\]/);
        const sliceGroupId = groupMatch ? groupMatch[1] : null;

        const orderMatch = desc.match(/\(Order\s+#(\d+)\)/i);
        const orderId = orderMatch ? orderMatch[1] : null;

        let symbol = 'SCRIP';
        let qty = 0;
        const pnlMatch = desc.match(/Realized\s+P&L\s+(?:on|for)\s+(?:([\d.]+)\s+)?([^\s\[:\(]+(?::[^\s\[:\(]+)?)/i);
        if (pnlMatch) {
          qty = parseFloat(pnlMatch[1]) || 0;
          symbol = pnlMatch[2].trim();
        }

        const timeBucket = Math.floor(new Date(entry.created_at).getTime() / 180000);
        const key = sliceGroupId 
          ? `pnl_grp_${entry.user_id}_${sliceGroupId}` 
          : (orderId ? `pnl_ord_${entry.user_id}_${orderId}` : `pnl_${entry.user_id}_${symbol}_${timeBucket}`);

        if (!pnlGroups[key]) {
          pnlGroups[key] = {
            user_id: entry.user_id,
            symbol,
            orderId,
            sliceGroupId,
            totalQty: 0,
            totalAmount: 0,
            ids: [],
            firstCreatedAt: entry.created_at
          };
        }
        pnlGroups[key].totalQty += qty;
        pnlGroups[key].totalAmount += Number(entry.amount || 0);
        pnlGroups[key].ids.push(entry.id);
      }

      for (const key of Object.keys(pnlGroups)) {
        const g = pnlGroups[key];
        if (g.ids.length > 1) {
          await knexInstance.transaction(async (trx) => {
            await trx('ledger').whereIn('id', g.ids).del();
            const tag = g.sliceGroupId ? ` [${g.sliceGroupId}]` : (g.orderId ? ` (Order #${g.orderId})` : ' (Consolidated)');
            await trx('ledger').insert({
              user_id: g.user_id,
              amount: Math.round((g.totalAmount + Number.EPSILON) * 100) / 100,
              type: 'REALIZED_PNL',
              description: `Realized P&L on ${g.totalQty > 0 ? g.totalQty + ' ' : ''}${g.symbol}${tag.includes('Consolidated') ? tag : tag + ' (Consolidated)'}`,
              created_at: g.firstCreatedAt
            });
          });
          consolidatedRows += g.ids.length;
        }
      }
    }

    if (consolidatedRows > 0) {
      console.log(`[LEDGER CLEANUP] Successfully consolidated ${consolidatedRows} micro-slice ledger entries across all instruments into clean order-level records.`);
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
