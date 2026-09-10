const webpush = require('web-push');
const path = require('path');
const fs = require('fs');
const db = require('../database/db');

// 🔑 Load VAPID keys for Web Push
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

// 📱 Firebase Admin SDK for Native Android / iOS Push Notifications (FCM)
let fcmMessaging = null;
try {
  const admin = require('firebase-admin');
  const { getMessaging } = require('firebase-admin/messaging');
  const serviceAccountPath = path.join(__dirname, '../config/firebase-service-account.json');
  
  const getCert = (sa) => {
    if (admin.cert) return admin.cert(sa);
    if (admin.credential && admin.credential.cert) return admin.credential.cert(sa);
    return null;
  };

  let credential = null;
  if (fs.existsSync(serviceAccountPath)) {
    const serviceAccount = JSON.parse(fs.readFileSync(serviceAccountPath, 'utf8'));
    credential = getCert(serviceAccount);
    if (credential) {
      console.log('[PUSH] Loaded Firebase service account config file.');
    }
  } else if (process.env.FIREBASE_SERVICE_ACCOUNT) {
    try {
      const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
      credential = getCert(serviceAccount);
    } catch(e) {
      console.warn('[PUSH] Failed parsing FIREBASE_SERVICE_ACCOUNT env:', e.message);
    }
  } else if (process.env.GOOGLE_APPLICATION_CREDENTIALS && fs.existsSync(process.env.GOOGLE_APPLICATION_CREDENTIALS)) {
    credential = admin.applicationDefault ? admin.applicationDefault() : admin.credential?.applicationDefault();
  }

  if (credential) {
    const app = admin.initializeApp({ credential });
    fcmMessaging = getMessaging(app);
    console.log('[PUSH] Firebase Admin FCM initialized successfully.');
  }
} catch (err) {
  console.warn('[PUSH] firebase-admin setup note:', err.message);
}

/**
 * Send push notification to a specific user across both:
 * 1. Web Push (Google Chrome, Firefox, Safari, Edge)
 * 2. Native Mobile App via Firebase Cloud Messaging (Android APK / iOS)
 * Fire-and-forget: does NOT throw errors or block caller
 */
async function sendPushNotification(userId, payload) {
  if (!userId) return;

  // 1. Dispatch Web Push (Browsers)
  try {
    const subscriptions = await db('push_subscriptions').where({ user_id: userId });
    if (subscriptions && subscriptions.length > 0) {
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
    }
  } catch (err) {
    console.error('[WEB PUSH ERROR]', err.message);
  }

  // 2. Dispatch FCM Push (Native Mobile App)
  if (fcmMessaging) {
    try {
      const fcmRecords = await db('fcm_device_tokens').where({ user_id: userId });
      if (fcmRecords && fcmRecords.length > 0) {
        const tokens = fcmRecords.map(r => r.token).filter(Boolean);
        if (tokens.length > 0) {
          const rawData = payload.data || {};
          const stringifiedData = {
            url: String(payload.url || '/orders'),
            timestamp: String(Date.now())
          };
          for (const [key, val] of Object.entries(rawData)) {
            stringifiedData[key] = typeof val === 'object' ? JSON.stringify(val) : String(val);
          }

          const message = {
            notification: {
              title: payload.title || 'Short Edge Alert',
              body: payload.body || 'You have a new market update'
            },
            data: stringifiedData,
            tokens
          };

          const response = await fcmMessaging.sendEachForMulticast(message);

          // Purge stale or invalid tokens automatically
          if (response.failureCount > 0) {
            const tokensToDelete = [];
            response.responses.forEach((resp, idx) => {
              if (!resp.success) {
                const code = resp.error?.code;
                if (
                  code === 'messaging/invalid-registration-token' ||
                  code === 'messaging/registration-token-not-registered'
                ) {
                  tokensToDelete.push(tokens[idx]);
                }
              }
            });
            if (tokensToDelete.length > 0) {
              await db('fcm_device_tokens').whereIn('token', tokensToDelete).delete().catch(() => {});
            }
          }
        }
      }
    } catch (fcmErr) {
      console.error('[FCM PUSH ERROR]', fcmErr.message);
    }
  }
}

function isFcmConfigured() {
  return !!fcmMessaging;
}

module.exports = {
  sendPushNotification,
  vapidPublicKey: vapidKeys.publicKey,
  isFcmConfigured
};
