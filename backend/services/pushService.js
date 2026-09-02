const webpush = require('web-push');
const path = require('path');
const fs = require('fs');
const db = require('../database/db');

// Load VAPID keys
let vapidKeys = {
  publicKey: process.env.VAPID_PUBLIC_KEY || 'BEcmTWGEu-kOR8KQTZ2vr-DhQpAYvNz6UQHFVsXaoZx9cg0gO_Qnqqd8VEO5Sz2GsCbBNOH0K8FPGSWK1j5JBTk',
  privateKey: process.env.VAPID_PRIVATE_KEY || 'opP1qZnwuiocr837GG8XfVcHOXANrnhyfwAgYKaBNYw'
};

try {
  const configPath = path.join(__dirname, '../config/vapid.json');
  if (fs.existsSync(configPath)) {
    vapidKeys = JSON.parse(fs.readFileSync(configPath, 'utf8'));
  }
} catch(e) {}

webpush.setVapidDetails(
  'mailto:support@shortedge.com',
  vapidKeys.publicKey,
  vapidKeys.privateKey
);

/**
 * Send push notification to a specific user
 * Fire-and-forget: does NOT throw errors or block caller
 */
async function sendPushNotification(userId, payload) {
  if (!userId) return;
  try {
    const subscriptions = await db('push_subscriptions').where({ user_id: userId });
    if (!subscriptions || subscriptions.length === 0) return;

    const notificationPayload = JSON.stringify({
      title: payload.title || 'Short Edge Alert',
      body: payload.body || 'You have a new market update',
      icon: payload.icon || '/favicon.ico',
      badge: payload.badge || '/favicon.ico',
      data: {
        url: payload.url || '/orders',
        timestamp: Date.now(),
        ...(payload.data || {})
      }
    });

    const sendPromises = subscriptions.map(async (sub) => {
      const pushSubscription = {
        endpoint: sub.endpoint,
        keys: {
          p256dh: sub.p256dh,
          auth: sub.auth
        }
      };

      try {
        await webpush.sendNotification(pushSubscription, notificationPayload);
      } catch (err) {
        // If subscription is expired or unsubscribed (410 Gone / 404 Not Found), purge it
        if (err.statusCode === 410 || err.statusCode === 404) {
          await db('push_subscriptions').where({ endpoint: sub.endpoint }).delete().catch(() => {});
        }
      }
    });

    await Promise.allSettled(sendPromises);
  } catch (err) {
    console.error('[PUSH NOTIFICATION ERROR]', err.message);
  }
}

module.exports = {
  sendPushNotification,
  vapidPublicKey: vapidKeys.publicKey
};
