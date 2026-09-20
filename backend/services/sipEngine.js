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
    const isMf = Boolean((symbol || '').includes('-MF') || (symbol || '').includes('MUTUALFUND'));
    const cleanCode = (symbol || '').replace(/[^0-9]/g, '');

    if (cleanCode && cleanCode.length >= 4 && (isMf || /^\d+$/.test(symbol))) {
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
    
    // Check priceCache if equity/ETF/stock
    const cleanSym = (symbol || '').replace(/^(NSE:|BSE:|MCX:)/i, '');
    if (priceCache) {
      if (priceCache[symbol]?.ltp > 0) return priceCache[symbol].ltp;
      if (priceCache[cleanSym]?.ltp > 0) return priceCache[cleanSym].ltp;
      if (priceCache[`NSE:${cleanSym}`]?.ltp > 0) return priceCache[`NSE:${cleanSym}`].ltp;
      if (priceCache[`BSE:${cleanSym}`]?.ltp > 0) return priceCache[`BSE:${cleanSym}`].ltp;
    }

    // Try live Fyers quote fallback if available
    try {
      const { fetchBatchLTPs } = require('./fyers');
      if (fetchBatchLTPs) {
        const quotes = await fetchBatchLTPs([symbol]);
        if (quotes && quotes[symbol]?.ltp > 0) {
          priceCache[symbol] = quotes[symbol];
          return quotes[symbol].ltp;
        }
      }
    } catch (e) {}

    return null; // Return null if live quote/NAV is temporarily unavailable to retry later
  }

  /**
   * Calculate next execution date based on frequency with anchor mandate day clamping (Defect 35)
   */
  static getNextExecutionDate(currentDate, frequency, anchorDay = null) {
    const now = currentDate ? new Date(currentDate) : new Date();
    // Parse current date in Asia/Kolkata timezone to avoid UTC drift
    const istDateStr = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(now);
    const [y, m, d] = istDateStr.split('-').map(Number);
    const targetAnchor = anchorDay || d;

    const freq = (frequency || 'MONTHLY').toUpperCase();
    let targetYear = y;
    let targetMonth = m - 1; // 0-indexed month

    if (freq === 'DAILY') {
      const nextDate = new Date(Date.UTC(y, m - 1, d, 4, 0, 0));
      nextDate.setUTCDate(nextDate.getUTCDate() + 1);
      while (nextDate.getUTCDay() === 0 || nextDate.getUTCDay() === 6) {
        nextDate.setUTCDate(nextDate.getUTCDate() + 1);
      }
      return nextDate;
    } else if (freq === 'WEEKLY') {
      const nextDate = new Date(Date.UTC(y, m - 1, d, 4, 0, 0));
      nextDate.setUTCDate(nextDate.getUTCDate() + 7);
      while (nextDate.getUTCDay() === 0 || nextDate.getUTCDay() === 6) {
        nextDate.setUTCDate(nextDate.getUTCDate() + 1);
      }
      return nextDate;
    } else if (freq === 'YEARLY') {
      targetYear += 1;
    } else {
      // Default: MONTHLY
      targetMonth += 1;
      if (targetMonth > 11) {
        targetMonth = 0;
        targetYear += 1;
      }
    }

    // Clamped mandate day in target month (Defect 35: ensures 29th-31st clamps cleanly without skipping Feb)
    const daysInTargetMonth = new Date(Date.UTC(targetYear, targetMonth + 1, 0)).getUTCDate();
    const clampedDay = Math.min(targetAnchor, daysInTargetMonth);

    const nextDate = new Date(Date.UTC(targetYear, targetMonth, clampedDay, 4, 0, 0));
    // Skip Saturday (6) and Sunday (0) to Monday
    while (nextDate.getUTCDay() === 0 || nextDate.getUTCDay() === 6) {
      nextDate.setUTCDate(nextDate.getUTCDate() + 1);
    }

    return nextDate;
  }

  /**
   * Execute a single SIP installment
   */
  static async executeSingleSip(sipId, priceCache = {}, isManualPayNow = false) {
    return await db.transaction(async (trx) => {
      const sip = await trx('sips').where({ id: sipId }).forUpdate().first();
      if (!sip) throw new Error('SIP not found');
      if (sip.status !== 'ACTIVE') throw new Error('SIP is not ACTIVE');

      // Advisory transaction lock per-user to prevent balance race conditions
      await trx.raw('SELECT pg_advisory_xact_lock(?)', [sip.user_id]);

      // Atomic Idempotency Guard: Ensure this installment has not already been processed today (unless explicit manual Pay Now)
      const istDateStr = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(new Date());
      const endOfToday = new Date(`${istDateStr}T23:59:59.999+05:30`);
      if (!isManualPayNow && sip.next_execution_date && new Date(sip.next_execution_date) > endOfToday) {
        return { success: false, reason: 'ALREADY_PROCESSED_OR_NOT_DUE' };
      }

      const user = await trx('users').where({ id: sip.user_id }).first();
      if (!user) throw new Error('User not found');

      const amount = parseFloat(sip.amount);
      const isMf = Boolean(sip.is_mf || sip.scheme_code || (sip.symbol && (sip.symbol.endsWith('-MF') || sip.symbol.includes('MUTUALFUND'))));
      const assetClass = isMf ? 'MUTUAL_FUND' : 'EQUITY';

      // Anchor day for mandate month-end handling (Defect 35)
      const anchorDay = sip.anchor_day || (sip.next_execution_date ? new Date(sip.next_execution_date).getUTCDate() : new Date().getUTCDate());

      // Defect 36: Insufficient balance retry backoff & pause after 3 failures
      if (parseFloat(user.balance) < amount) {
        const failureCount = (sip.failure_count || 0) + 1;
        const shouldPause = failureCount >= 3;
        const nextDate = SIPEngine.getNextExecutionDate(sip.next_execution_date || new Date(), sip.frequency, anchorDay);

        const updateData = {
          failure_count: failureCount,
          next_execution_date: nextDate,
          updated_at: new Date()
        };
        if (shouldPause) {
          updateData.status = 'PAUSED';
          console.warn(`[SIPEngine] ⚠️ SIP #${sip.id} paused due to ${failureCount} consecutive balance failures.`);
        }

        await trx('sips').where({ id: sip.id }).update(updateData);
        console.warn(`[SIPEngine] User ${user.username} has insufficient balance (₹${user.balance} < ₹${amount}) for SIP #${sip.id}. Failure count: ${failureCount}. Rescheduled to ${nextDate.toISOString()}`);
        return {
          success: false,
          reason: shouldPause ? 'SIP_PAUSED_INSUFFICIENT_FUNDS' : 'INSUFFICIENT_FUNDS',
          failureCount,
          nextExecutionDate: nextDate
        };
      }

      // Fetch latest NAV
      const nav = await SIPEngine.getLatestNav(sip.symbol, priceCache);
      if (!nav || nav <= 0) {
        console.warn(`[SIPEngine] Latest NAV unavailable for ${sip.symbol}. Skipping SIP #${sip.id} for retry.`);
        return { success: false, reason: 'NAV_UNAVAILABLE' };
      }

      // Defect 38: Fractional Share Allocation in Cash Equity SIP
      let units = 0;
      let actualDebitAmount = amount;
      if (isMf) {
        // Mutual funds allow fractional units (up to 4 decimal places)
        units = parseFloat((amount / nav).toFixed(4));
        if (units <= 0) {
          console.warn(`[SIPEngine] Calculated units zero for SIP #${sip.id} (amount: ₹${amount}, NAV: ₹${nav})`);
          return { success: false, reason: 'ZERO_UNITS_ALLOCATED' };
        }
      } else {
        // Cash Equities require integer shares on Indian exchanges
        units = Math.floor(amount / nav);
        if (units < 1) {
          console.warn(`[SIPEngine] SIP amount ₹${amount} insufficient to purchase 1 whole share of ${sip.symbol} @ ₹${nav}`);
          return { success: false, reason: 'INSUFFICIENT_FUNDS_FOR_FULL_SHARE', sharePrice: nav, sipAmount: amount };
        }
        actualDebitAmount = parseFloat((units * nav).toFixed(2));
      }

      // 1. Deduct user balance for actual purchase amount (paise rounded)
      const newBalance = Math.round((parseFloat(user.balance) - actualDebitAmount) * 100) / 100;
      await trx('users').where({ id: user.id }).update({ balance: newBalance });

      // Check if order qualifies for Same-Day NAV (09:00 AM - 02:00 PM IST on Mon-Fri)
      let isSameDayNav = true;
      if (isMf) {
        try {
          const istDateStr = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false }).format(new Date());
          const [dPart, tPart] = istDateStr.split(', ');
          const [y, m, d] = dPart.split('-').map(Number);
          const [h, min] = tPart.split(':').map(Number);
          const day = new Date(Date.UTC(y, m - 1, d)).getUTCDay();
          const curM = h * 60 + min;
          isSameDayNav = (day >= 1 && day <= 5) && (curM >= 540 && curM < 840);
        } catch (e) { isSameDayNav = true; }
      }

      // 2. Insert into ledger with proper description & MARGIN_BLOCK
      await trx('ledger').insert({
        user_id: user.id,
        amount: -actualDebitAmount,
        type: 'MARGIN_BLOCK',
        description: isSameDayNav
          ? `SIP Installment Purchase (${sip.frequency}): Bought ${units} ${isMf ? 'units' : 'shares'} of ${sip.symbol} @ ₹${nav.toFixed(2)}${actualDebitAmount < amount ? ` (Unused cash ₹${(amount - actualDebitAmount).toFixed(2)} retained in balance)` : ''}`
          : `SIP Installment Queued (${sip.frequency}): ₹${actualDebitAmount.toFixed(2)} for ${sip.symbol} (Next Business Day NAV)`
      });

      if (isSameDayNav) {
        // 3A. Immediate Execution (Before 2:00 PM Cut-off)
        await trx('orders').insert({
          user_id: user.id,
          symbol: sip.symbol,
          type: 'MARKET',
          side: 'BUY',
          quantity: units,
          filled_quantity: units,
          pending_quantity: 0,
          price: nav,
          average_price: nav,
          status: 'COMPLETED',
          order_variety: 'SIP',
          product_type: 'DEL',
          margin: actualDebitAmount,
          remarks: `SIP Installment (${sip.frequency}): Today's NAV (Before 2:00 PM Cut-off)`,
          created_at: new Date(),
          updated_at: new Date()
        });

        // Credit or update Holdings
        const existingHolding = await trx('holdings')
          .where({ user_id: user.id, symbol: sip.symbol })
          .first();

        if (existingHolding) {
          const currentQty = parseFloat(existingHolding.quantity);
          const currentAvg = Math.abs(parseFloat(existingHolding.average_price) || 0);
          const newQty = isMf ? parseFloat((currentQty + units).toFixed(4)) : (currentQty + units);
          const newAvg = ((currentQty * currentAvg) + actualDebitAmount) / newQty;

          await trx('holdings').where({ id: existingHolding.id }).update({
            quantity: newQty,
            average_price: parseFloat(newAvg.toFixed(4)),
            updated_at: new Date()
          });
        } else {
          await trx('holdings').insert({
            user_id: user.id,
            symbol: sip.symbol,
            quantity: units,
            average_price: nav,
            asset_class: assetClass,
            created_at: new Date(),
            updated_at: new Date()
          });
        }
      } else {
        // 3B. Queued for Next Business Day (After 2:00 PM Cut-off / Weekend)
        await trx('orders').insert({
          user_id: user.id,
          symbol: sip.symbol,
          type: 'MARKET',
          side: 'BUY',
          quantity: units,
          filled_quantity: 0,
          pending_quantity: units,
          price: nav,
          average_price: null,
          status: 'AMO_PENDING',
          order_variety: 'AMO',
          product_type: 'DEL',
          margin: actualDebitAmount,
          remarks: `SIP Installment (${sip.frequency}): Queued for Next Business Day NAV (After 2:00 PM Cut-off)`,
          created_at: new Date(),
          updated_at: new Date()
        });
        // Do NOT credit holdings yet
      }

      // 5. Update next execution date and reset failure_count on success
      const nextDate = SIPEngine.getNextExecutionDate(sip.next_execution_date || new Date(), sip.frequency, anchorDay);
      await trx('sips').where({ id: sip.id }).update({
        next_execution_date: nextDate,
        failure_count: 0,
        anchor_day: anchorDay,
        updated_at: new Date()
      });

      console.log(`[SIPEngine] ✅ Successfully executed SIP #${sip.id} (${sip.symbol}) for ${user.username}: ${units} ${isMf ? 'units' : 'shares'} @ ₹${nav} (debited: ₹${actualDebitAmount})`);
      return { success: true, units, nav, amount: actualDebitAmount, nextExecutionDate: nextDate };
    });
  }

  /**
   * Batch process all due active SIPs across all users
   */
  static async processDueSips(priceCache = {}) {
    const lockKey = 'cron_sip_engine';
    let connection = null;
    let isLocked = false;

    try {
      if (db.client && db.client.acquireConnection) {
        connection = await db.client.acquireConnection();
        const lockRes = await connection.query('SELECT pg_try_advisory_lock(hashtext($1)) as locked', [lockKey]).catch(() => null);
        isLocked = Boolean(lockRes && lockRes.rows && lockRes.rows[0] && lockRes.rows[0].locked);
        if (!isLocked) {
          console.log('[SIPEngine] SIP execution already running on another cluster worker. Skipping.');
          return { total: 0, success: 0, failed: 0, skipped: true };
        }
      }

      console.log('[SIPEngine] 🔄 Checking for due SIP installments...');
      // Ensure date comparison uses Asia/Kolkata timezone
      const istDateStr = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(new Date()); // "YYYY-MM-DD"
      const endOfTodayIst = new Date(new Date(`${istDateStr}T23:59:59.999+05:30`).toISOString());

      const dueSips = await db('sips')
        .where('status', 'ACTIVE')
        .where('next_execution_date', '<=', endOfTodayIst);

      console.log(`[SIPEngine] Found ${dueSips.length} active SIP(s) due on or before ${istDateStr} (IST)`);

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
    } finally {
      if (connection) {
        try {
          if (isLocked) {
            await connection.query('SELECT pg_advisory_unlock(hashtext($1))', [lockKey]).catch(() => {});
          }
        } finally {
          await db.client.releaseConnection(connection).catch(() => {});
        }
      }
    }
  }

  /**
   * Batch process all queued After-Cutoff Mutual Fund orders (AMO_PENDING) on next business day
   */
  static async processPendingMutualFundOrders(priceCache = {}) {
    const lockKey = 'cron_mf_settlement_engine';
    let connection = null;
    let isLocked = false;

    try {
      if (db.client && db.client.acquireConnection) {
        connection = await db.client.acquireConnection();
        const lockRes = await connection.query('SELECT pg_try_advisory_lock(hashtext($1)) as locked', [lockKey]).catch(() => null);
        isLocked = Boolean(lockRes && lockRes.rows && lockRes.rows[0] && lockRes.rows[0].locked);
        if (!isLocked) {
          console.log('[SIPEngine] MF settlement already running on another cluster worker. Skipping.');
          return { total: 0, settled: 0, failed: 0, skipped: true };
        }
      }

      console.log('[SIPEngine] 🔄 Checking for queued After-Cutoff Mutual Fund orders to settle...');
      
      const pendingOrders = await db('orders')
        .where('status', 'AMO_PENDING')
        .andWhere(builder => {
          builder.where('symbol', 'like', '%-MF').orWhere('symbol', 'like', '%MUTUALFUND%');
        })
        .orderBy('created_at', 'asc');

      if (pendingOrders.length === 0) {
        console.log('[SIPEngine] No pending mutual fund orders waiting for settlement.');
        return { total: 0, settled: 0, failed: 0 };
      }

      console.log(`[SIPEngine] Found ${pendingOrders.length} queued mutual fund order(s) for settlement.`);
      let settledCount = 0;
      let failedCount = 0;
      const affectedUserIds = new Set();

      for (const ord of pendingOrders) {
        try {
          const nav = await SIPEngine.getLatestNav(ord.symbol, priceCache);
          if (!nav || nav <= 0) {
            console.warn(`[SIPEngine] Latest NAV still unavailable for ${ord.symbol}. Order #${ord.id} retained in queue.`);
            continue;
          }

          const marginAmount = parseFloat(ord.margin || 0);
          if (marginAmount <= 0) continue;

          const units = parseFloat((marginAmount / nav).toFixed(4));
          if (units <= 0) continue;

          await db.transaction(async (trx) => {
            await trx.raw('SELECT pg_advisory_xact_lock(?)', [ord.user_id]);

            // Update order status to EXECUTED
            await trx('orders').where({ id: ord.id }).update({
              status: 'EXECUTED',
              quantity: units,
              filled_quantity: units,
              pending_quantity: 0,
              price: nav,
              average_price: nav,
              remarks: `Settled @ Next Day NAV ₹${nav.toFixed(2)}`,
              updated_at: new Date()
            });

            // Credit units to holdings
            const existingHolding = await trx('holdings')
              .where({ user_id: ord.user_id, symbol: ord.symbol })
              .first();

            if (existingHolding) {
              const curQty = parseFloat(existingHolding.quantity) || 0;
              const curAvg = Math.abs(parseFloat(existingHolding.average_price) || 0) || nav;
              const newQty = parseFloat((curQty + units).toFixed(4));
              const newAvg = parseFloat((((curQty * curAvg) + marginAmount) / newQty).toFixed(4));

              await trx('holdings').where({ id: existingHolding.id }).update({
                quantity: newQty,
                average_price: newAvg,
                asset_class: 'MUTUAL_FUND',
                updated_at: new Date()
              });
            } else {
              await trx('holdings').insert({
                user_id: ord.user_id,
                symbol: ord.symbol,
                quantity: units,
                average_price: nav,
                asset_class: 'MUTUAL_FUND',
                created_at: new Date(),
                updated_at: new Date()
              });
            }
          });

          settledCount++;
          affectedUserIds.add(ord.user_id);
          console.log(`[SIPEngine] 🟢 Settled MF Order #${ord.id}: Credited ${units} units of ${ord.symbol} @ NAV ₹${nav}`);
        } catch (err) {
          console.error(`[SIPEngine] ❌ Failed to settle MF Order #${ord.id}:`, err.message);
          failedCount++;
        }
      }

      // Sync user data via WebSocket
      try {
        const volumeMatchingEngine = require('./volumeMatchingEngine');
        if (volumeMatchingEngine && volumeMatchingEngine.io && affectedUserIds.size > 0) {
          for (const uid of affectedUserIds) {
            volumeMatchingEngine.io.to(uid.toString()).emit('sync_user_data');
            volumeMatchingEngine.io.to(uid.toString()).emit('trade_alert', {
              event: 'EXECUTED',
              symbol: 'MUTUAL_FUND',
              message: 'Your queued mutual fund order has been settled with Next Day NAV!'
            });
          }
        }
      } catch (e) {}

      return { total: pendingOrders.length, settled: settledCount, failed: failedCount };
    } catch (err) {
      console.error('[SIPEngine] processPendingMutualFundOrders error:', err.message);
      return { error: err.message };
    } finally {
      if (connection) {
        try {
          if (isLocked) {
            await connection.query('SELECT pg_advisory_unlock(hashtext($1))', [lockKey]).catch(() => {});
          }
        } finally {
          await db.client.releaseConnection(connection).catch(() => {});
        }
      }
    }
  }

  /**
   * Initialize automated cron jobs
   */
  static init(priceCache = {}) {
    console.log('🚀 [SIPEngine] Initialized automated Daily/Weekly/Monthly SIP & Mutual Fund Settlement processor');

    // 1. Run at 09:00 AM IST every business day: Morning Next-Day MF settlement cycle
    cron.schedule('0 9 * * 1-5', () => {
      console.log('[SIPEngine] [CRON 09:00 AM] Running morning Next-Day Mutual Fund settlement cycle...');
      SIPEngine.processPendingMutualFundOrders(priceCache);
    }, { timezone: 'Asia/Kolkata' });

    // 2. Run at 09:30 AM IST every day: Scheduled daily SIP execution cycle
    cron.schedule('30 9 * * *', () => {
      console.log('[SIPEngine] [CRON 09:30 AM] Running scheduled daily SIP execution cycle...');
      SIPEngine.processDueSips(priceCache);
    }, { timezone: 'Asia/Kolkata' });

    // 3. Run at 03:30 PM IST: Afternoon SIP catch-up cycle
    cron.schedule('30 15 * * *', () => {
      console.log('[SIPEngine] [CRON 03:30 PM] Running afternoon SIP catch-up cycle...');
      SIPEngine.processDueSips(priceCache);
    }, { timezone: 'Asia/Kolkata' });

    // 4. Run at 10:30 PM IST every business day: Evening Next-Day MF settlement cycle (as AMCs publish official NAV)
    cron.schedule('30 22 * * 1-5', () => {
      console.log('[SIPEngine] [CRON 10:30 PM] Running evening Next-Day Mutual Fund settlement cycle...');
      SIPEngine.processPendingMutualFundOrders(priceCache);
    }, { timezone: 'Asia/Kolkata' });

    // Initial check on server startup (delayed 8-10 seconds for DB/network warmup)
    setTimeout(() => {
      SIPEngine.processDueSips(priceCache);
      SIPEngine.processPendingMutualFundOrders(priceCache);
    }, 8000);
  }
}

module.exports = SIPEngine;
