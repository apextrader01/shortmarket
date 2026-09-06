const db = require('../database/db');

// Global System Configuration for Telegram Engine
let systemConfig = {
  global_enabled: true,
  peak_protection_active: true,
  peak_start_time: '09:15',
  peak_end_time: '10:15',
  peak_mode: 'BATCH_DELAY', // 'MUTE_DURING_PEAK' | 'BATCH_DELAY' | 'DIRECT_INSTANT'
  batch_delay_seconds: 10,
  bot_token: process.env.TELEGRAM_BOT_TOKEN || '7891234567:AAExamplePlaceholderTokenForShortEdge',
  bot_username: process.env.TELEGRAM_BOT_USERNAME || 'ShortEdgeAlerts_bot'
};

// Queue for Non-Blocking Asynchronous Telegram Delivery
const alertQueue = [];
let isProcessingQueue = false;
let stats = {
  totalSentToday: 0,
  lastSentAt: null,
  peakDropsCount: 0
};

/**
 * Check if current IST time falls in peak traffic hours (e.g. 09:15 to 10:15)
 */
function isPeakHourActive() {
  if (!systemConfig.peak_protection_active) return false;
  try {
    const now = new Date();
    const istTime = new Date(now.toLocaleString("en-US", { timeZone: "Asia/Kolkata" }));
    const curMins = istTime.getHours() * 60 + istTime.getMinutes();

    const [sH, sM] = (systemConfig.peak_start_time || '09:15').split(':').map(Number);
    const [eH, eM] = (systemConfig.peak_end_time || '10:15').split(':').map(Number);
    const startMins = (sH * 60) + (sM || 0);
    const endMins = (eH * 60) + (eM || 0);

    return curMins >= startMins && curMins < endMins;
  } catch (e) {
    return false;
  }
}

/**
 * Raw Telegram API call
 */
async function callTelegramApi(chatId, messageText, parseMode = 'HTML') {
  if (!chatId || !messageText) return { success: false, error: 'Missing chatId or text' };

  if (!systemConfig.bot_token || systemConfig.bot_token.includes('ExamplePlaceholder')) {
    console.log(`[TelegramService] (Simulated / Dev mode) Message to ${chatId}:\n${messageText}`);
    stats.totalSentToday++;
    stats.lastSentAt = new Date().toISOString();
    return { success: true, simulated: true };
  }

  try {
    const url = `https://api.telegram.org/bot${systemConfig.bot_token}/sendMessage`;
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text: messageText,
        parse_mode: parseMode,
        disable_web_page_preview: true
      })
    });

    const data = await response.json();
    if (data.ok) {
      stats.totalSentToday++;
      stats.lastSentAt = new Date().toISOString();
      return { success: true, messageId: data.result?.message_id };
    } else {
      console.warn('[TelegramService] Telegram API response error:', data.description);
      return { success: false, error: data.description };
    }
  } catch (err) {
    console.error('[TelegramService] HTTP dispatch error:', err.message);
    return { success: false, error: err.message };
  }
}

/**
 * Background Queue Worker - Processes messages smoothly without blocking Node.js event loop
 */
async function processQueue() {
  if (isProcessingQueue || alertQueue.length === 0) return;
  isProcessingQueue = true;

  try {
    while (alertQueue.length > 0) {
      if (!systemConfig.global_enabled) {
        alertQueue.length = 0; // Clear queue if disabled
        break;
      }

      const item = alertQueue.shift();
      const isPeak = isPeakHourActive();

      if (isPeak && systemConfig.peak_mode === 'MUTE_DURING_PEAK') {
        stats.peakDropsCount++;
        continue; // Drop alert during peak to preserve 100% CPU
      }

      if (isPeak && systemConfig.peak_mode === 'BATCH_DELAY') {
        const elapsed = (Date.now() - item.queuedAt) / 1000;
        if (elapsed < (systemConfig.batch_delay_seconds || 10)) {
          // Re-queue and wait delay
          alertQueue.unshift(item);
          await new Promise(r => setTimeout(r, 1000));
          continue;
        }
      }

      await callTelegramApi(item.chatId, item.text);
      // Small 40ms pacing to stay under rate limits
      await new Promise(r => setTimeout(r, 40));
    }
  } catch (err) {
    console.error('[TelegramService] Error in queue worker:', err);
  } finally {
    isProcessingQueue = false;
  }
}

// Queue worker interval
setInterval(processQueue, 250);

/**
 * Send Telegram alert to user
 */
async function sendTelegramAlert(userId, alertType, payload = {}) {
  if (!userId || !systemConfig.global_enabled) return;

  try {
    const user = await db('users').where({ id: userId }).first();
    if (!user || !user.telegram_chat_id || !user.telegram_alerts_enabled) return;

    if (alertType === 'ORDER' && user.telegram_alert_orders === false) return;
    if (alertType === 'TARGET' && user.telegram_alert_targets === false) return;
    if (alertType === 'STOPLOSS' && user.telegram_alert_stoploss === false) return;
    if (alertType === 'RISK' && user.telegram_alert_risk === false) return;

    const timeStr = new Date().toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata', hour: '2-digit', minute: '2-digit', second: '2-digit' });
    let message = '';

    switch (alertType) {
      case 'ORDER': {
        const sideEmoji = payload.side === 'BUY' ? '🟢 BUY' : '🔴 SELL';
        message = `⚡ <b>Short Edge · Order Executed</b>\n` +
          `━━━━━━━━━━━━━━━━━━\n` +
          `<b>Instrument:</b> <code>${payload.symbol || 'N/A'}</code>\n` +
          `<b>Side:</b> ${sideEmoji} | <b>Type:</b> ${payload.product_type || 'INT'}\n` +
          `<b>Quantity:</b> ${payload.quantity} shares/lots\n` +
          `<b>Price:</b> ₹${Number(payload.price || 0).toFixed(2)}\n` +
          `<b>Status:</b> ✅ EXECUTED\n` +
          `<b>Time:</b> ${timeStr} IST\n` +
          `━━━━━━━━━━━━━━━━━━\n` +
          `<i>Trade safe · Short Edge Platform</i>`;
        break;
      }

      case 'TARGET': {
        message = `🎯 <b>Short Edge · Target Price Hit!</b>\n` +
          `━━━━━━━━━━━━━━━━━━\n` +
          `<b>Instrument:</b> <code>${payload.symbol || 'N/A'}</code>\n` +
          `<b>Target Hit Price:</b> ₹${Number(payload.exit_price || payload.price || 0).toFixed(2)}\n` +
          (payload.pnl !== undefined ? `<b>Realized P&L:</b> 🟢 +₹${Number(payload.pnl).toFixed(2)}\n` : '') +
          `<b>Quantity Exited:</b> ${payload.quantity || 'Full'}\n` +
          `<b>Time:</b> ${timeStr} IST\n` +
          `━━━━━━━━━━━━━━━━━━\n` +
          `🏆 <i>Great trade! Profits locked.</i>`;
        break;
      }

      case 'STOPLOSS': {
        message = `🛑 <b>Short Edge · Stop-Loss Triggered</b>\n` +
          `━━━━━━━━━━━━━━━━━━\n` +
          `<b>Instrument:</b> <code>${payload.symbol || 'N/A'}</code>\n` +
          `<b>Trigger Price:</b> ₹${Number(payload.exit_price || payload.price || 0).toFixed(2)}\n` +
          (payload.pnl !== undefined ? `<b>Realized P&L:</b> 🔴 -₹${Math.abs(Number(payload.pnl)).toFixed(2)}\n` : '') +
          `<b>Quantity Exited:</b> ${payload.quantity || 'Full'}\n` +
          `<b>Time:</b> ${timeStr} IST\n` +
          `━━━━━━━━━━━━━━━━━━\n` +
          `🛡️ <i>Capital protected by Stop-Loss rule.</i>`;
        break;
      }

      case 'RISK': {
        message = `⚠️ <b>Short Edge · Risk Guardian Alert</b>\n` +
          `━━━━━━━━━━━━━━━━━━\n` +
          `<b>Alert Reason:</b> ${payload.reason || 'Daily risk threshold reached'}\n` +
          (payload.details ? `<b>Details:</b> ${payload.details}\n` : '') +
          `<b>Time:</b> ${timeStr} IST\n` +
          `━━━━━━━━━━━━━━━━━━\n` +
          `🔒 <i>Trading is locked for today to preserve your capital. Take a break and review tomorrow!</i>`;
        break;
      }

      default: {
        message = `📢 <b>Short Edge Alert</b>\n\n${payload.text || 'You have a new account update.'}\n\n<i>${timeStr} IST</i>`;
      }
    }

    // Push into non-blocking queue
    alertQueue.push({
      chatId: user.telegram_chat_id,
      text: message,
      queuedAt: Date.now()
    });

  } catch (err) {
    console.error('[TelegramService] Error queuing alert:', err.message);
  }
}

/**
 * Send an immediate verification test message (bypasses queue for instant feedback)
 */
async function sendTestAlert(chatId, username = 'Trader') {
  const timeStr = new Date().toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata', hour: '2-digit', minute: '2-digit', second: '2-digit' });
  const testMessage = `🚀 <b>Telegram Alerts Connected!</b>\n` +
    `━━━━━━━━━━━━━━━━━━\n` +
    `Hello <b>${username}</b> 👋\n\n` +
    `Your Short Edge trading account is successfully linked to this Telegram channel.\n\n` +
    `You will now receive instant notifications for:\n` +
    `• ⚡ Live Order Executions\n` +
    `• 🎯 Target / Take-Profit Hits\n` +
    `• 🛑 Stop-Loss Triggers\n` +
    `• ⚠️ Risk Guardian Daily Limits\n` +
    `━━━━━━━━━━━━━━━━━━\n` +
    `<b>Status:</b> 🟢 Active & Ready\n` +
    `<b>Connected At:</b> ${timeStr} IST`;

  return await callTelegramApi(chatId, testMessage);
}

/**
 * Admin: Broadcast a message to all users who have Telegram connected
 */
async function broadcastTelegramMessage(messageText) {
  if (!messageText) return { success: false, error: 'Message text required' };
  try {
    const users = await db('users').whereNotNull('telegram_chat_id').where('telegram_alerts_enabled', true);
    let count = 0;
    for (const u of users) {
      if (u.telegram_chat_id) {
        alertQueue.push({
          chatId: u.telegram_chat_id,
          text: `📢 <b>Short Edge Official Announcement</b>\n━━━━━━━━━━━━━━━━━━\n${messageText}`,
          queuedAt: Date.now()
        });
        count++;
      }
    }
    return { success: true, queuedCount: count };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

function getSystemConfig() {
  return {
    ...systemConfig,
    isPeakHourNow: isPeakHourActive(),
    queueLength: alertQueue.length,
    stats
  };
}

function updateSystemConfig(newCfg) {
  systemConfig = {
    ...systemConfig,
    ...newCfg
  };
  return getSystemConfig();
}

module.exports = {
  sendTelegramAlert,
  sendTestAlert,
  broadcastTelegramMessage,
  getSystemConfig,
  updateSystemConfig
};