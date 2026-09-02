const db = require('../database/db');
const cron = require('node-cron');
const https = require('https');

// Helper to fetch JSON from external APIs safely
const fetchJson = (url) => {
  return new Promise((resolve) => {
    https.get(url, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch (e) {
          resolve(null);
        }
      });
    }).on('error', () => resolve(null));
  });
};

class SIPEngine {
  /**
   * Fetch the latest NAV for a mutual fund from official mfapi or priceCache
   */
  static async getLatestNav(symbol, priceCache = {}) {
    const cleanCode = (symbol || '').replace(/[^0-9]/g, '');
    if (cleanCode && cleanCode.length >= 4) {
      try {
        const data = await fetchJson(`https://api.mfapi.in/mf/${cleanCode}`);
        if (data && data.data && data.data[0] && data.data[0].nav) {
          const nav = parseFloat(data.data[0].nav);
          if (nav > 0) return nav;
        }
      } catch (e) {
        console.error(`[SIPEngine] Error fetching NAV for ${cleanCode}:`, e.message);
      }
    }
    
    // Check priceCache if equity/ETF
    if (priceCache && priceCache[symbol]?.ltp > 0) {
      return priceCache[symbol].ltp;
    }
    return 100.00; // safe default fallback
  }

  /**
   * Calculate next execution date based on frequency
   */
  static getNextExecutionDate(currentDate, frequency) {
    const nextDate = new Date(currentDate || new Date());
    const freq = (frequency || 'MONTHLY').toUpperCase();
    
    if (freq === 'DAILY') {
      nextDate.setDate(nextDate.getDate() + 1);
    } else if (freq === 'WEEKLY') {
      nextDate.setDate(nextDate.getDate() + 7);
    } else if (freq === 'YEARLY') {
      nextDate.setFullYear(nextDate.getFullYear() + 1);
    } else {
      // Default: MONTHLY
      nextDate.setMonth(nextDate.getMonth() + 1);
    }

    // Skip Saturday (6) and Sunday (0) to Monday
    while (nextDate.getDay() === 0 || nextDate.getDay() === 6) {
      nextDate.setDate(nextDate.getDate() + 1);
    }

    return nextDate;
  }

  /**
   * Execute a single SIP installment
   */
  static async executeSingleSip(sipId, priceCache = {}) {
    return await db.transaction(async (trx) => {
      const sip = await trx('sips').where({ id: sipId }).first();
      if (!sip) throw new Error('SIP not found');
      if (sip.status !== 'ACTIVE') throw new Error('SIP is not ACTIVE');

      const user = await trx('users').where({ id: sip.user_id }).first();
      if (!user) throw new Error('User not found');

      const amount = parseFloat(sip.amount);
      if (parseFloat(user.balance) < amount) {
        console.warn(`[SIPEngine] User ${user.username} has insufficient balance (₹${user.balance} < ₹${amount}) for SIP #${sip.id}`);
        return { success: false, reason: 'INSUFFICIENT_FUNDS', required: amount, available: parseFloat(user.balance) };
      }

      // Fetch latest NAV
      const nav = await SIPEngine.getLatestNav(sip.symbol, priceCache);
      const units = parseFloat((amount / nav).toFixed(4));

      // 1. Deduct user balance
      const newBalance = parseFloat(user.balance) - amount;
      await trx('users').where({ id: user.id }).update({ balance: newBalance });

      // 2. Insert into ledger
      await trx('ledger').insert({
        user_id: user.id,
        amount: -amount,
        type: 'SIP_DEBIT',
        description: `SIP Installment (${sip.frequency}): Bought ${units} units of ${sip.symbol} @ NAV ₹${nav.toFixed(2)}`
      });

      // 3. Create executed order entry
      await trx('orders').insert({
        user_id: user.id,
        symbol: sip.symbol,
        type: 'MARKET',
        side: 'BUY',
        quantity: units,
        price: nav,
        status: 'EXECUTED',
        product_type: 'DEL',
        margin: amount,
        created_at: new Date(),
        updated_at: new Date()
      });

      // 4. Update or Insert Holding
      const existingHolding = await trx('holdings').where({ user_id: user.id, symbol: sip.symbol }).first();
      if (existingHolding) {
        const prevQty = parseFloat(existingHolding.quantity) || 0;
        const prevAvg = parseFloat(existingHolding.average_price) || nav;
        const totalQty = prevQty + units;
        const newAvg = totalQty > 0 ? ((prevQty * prevAvg) + (units * nav)) / totalQty : nav;

        await trx('holdings').where({ id: existingHolding.id }).update({
          quantity: parseFloat(totalQty.toFixed(4)),
          average_price: parseFloat(newAvg.toFixed(2)),
          asset_class: 'MUTUAL_FUND',
          updated_at: new Date()
        });
      } else {
        await trx('holdings').insert({
          user_id: user.id,
          symbol: sip.symbol,
          quantity: units,
          average_price: parseFloat(nav.toFixed(2)),
          asset_class: 'MUTUAL_FUND',
          created_at: new Date(),
          updated_at: new Date()
        });
      }

      // 5. Update next execution date
      const nextDate = SIPEngine.getNextExecutionDate(new Date(), sip.frequency);
      await trx('sips').where({ id: sip.id }).update({
        next_execution_date: nextDate,
        updated_at: new Date()
      });

      console.log(`[SIPEngine] ✅ Successfully executed SIP #${sip.id} (${sip.symbol}) for ${user.username}: ${units} units @ NAV ₹${nav}`);
      return { success: true, units, nav, amount, nextExecutionDate: nextDate };
    });
  }

  /**
   * Batch process all due active SIPs across all users
   */
  static async processDueSips(priceCache = {}) {
    console.log('[SIPEngine] 🔄 Checking for due SIP installments...');
    try {
      const todayStr = new Date().toISOString().split('T')[0];
      const dueSips = await db('sips')
        .where('status', 'ACTIVE')
        .where('next_execution_date', '<=', todayStr);

      console.log(`[SIPEngine] Found ${dueSips.length} active SIP(s) due on or before ${todayStr}`);

      let successCount = 0;
      let failedCount = 0;

      for (const sip of dueSips) {
        try {
          const result = await SIPEngine.executeSingleSip(sip.id, priceCache);
          if (result && result.success) {
            successCount++;
          } else {
            failedCount++;
          }
        } catch (err) {
          console.error(`[SIPEngine] ❌ Error executing SIP #${sip.id}:`, err.message);
          failedCount++;
        }
      }

      console.log(`[SIPEngine] 🎯 Finished processing SIPs. Success: ${successCount}, Failed/Skipped: ${failedCount}`);
      return { total: dueSips.length, success: successCount, failed: failedCount };
    } catch (e) {
      console.error('[SIPEngine] Global process error:', e);
      return { error: e.message };
    }
  }

  /**
   * Initialize automated cron jobs
   */
  static init(priceCache = {}) {
    console.log('🚀 [SIPEngine] Initialized automated Daily/Weekly/Monthly SIP processor');

    // Run at 09:30 AM IST every day (Monday to Friday)
    cron.schedule('30 9 * * *', () => {
      console.log('[SIPEngine] [CRON 09:30 AM] Running scheduled daily SIP execution cycle...');
      SIPEngine.processDueSips(priceCache);
    }, { timezone: 'Asia/Kolkata' });

    // Also run a 03:30 PM closing sweep
    cron.schedule('30 15 * * *', () => {
      console.log('[SIPEngine] [CRON 03:30 PM] Running afternoon SIP catch-up cycle...');
      SIPEngine.processDueSips(priceCache);
    }, { timezone: 'Asia/Kolkata' });

    // Initial check on server startup (delayed 8 seconds for DB/network warmup)
    setTimeout(() => {
      SIPEngine.processDueSips(priceCache);
    }, 8000);
  }
}

module.exports = SIPEngine;
