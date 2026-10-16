import { API } from '../store';
import { Capacitor } from '@capacitor/core';

let _pushPlugin = null;
async function getPushPlugin() {
  if (_pushPlugin) return _pushPlugin;
  try {
    if (Capacitor.isNativePlatform()) {
      const mod = await import('@capacitor/push-notifications');
      _pushPlugin = mod.PushNotifications || mod.default?.PushNotifications || mod.default;
      return _pushPlugin;
    }
  } catch (e) {
    console.warn('[PUSH] @capacitor/push-notifications not available:', e);
  }
  return null;
}

function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

/**
 * Universal safe permission requester: supports both modern Promise and legacy callback APIs,
 * with a 15-second timeout guard so UI never hangs indefinitely if the permission modal is dismissed.
 */
async function requestNotificationPermission() {
  if (typeof window === 'undefined' || !('Notification' in window)) return 'denied';
  if (Notification.permission === 'granted') return 'granted';
  if (Notification.permission === 'denied') return 'denied';

  try {
    const permPromise = new Promise((resolve) => {
      let resolved = false;
      const done = (p) => {
        if (!resolved) {
          resolved = true;
          resolve(p || Notification.permission);
        }
      };
      try {
        const res = Notification.requestPermission(done);
        if (res && typeof res.then === 'function') {
          res.then(done).catch(() => done(Notification.permission));
        }
      } catch (e) {
        done(Notification.permission);
      }
    });

    return await Promise.race([
      permPromise,
      new Promise((resolve) => setTimeout(() => resolve(Notification.permission), 15000))
    ]);
  } catch (e) {
    return Notification.permission;
  }
}

export async function registerServiceWorker() {
  if (typeof window === 'undefined') return null;
  // If running inside native Android/iOS app, service worker push is not needed
  if (Capacitor.isNativePlatform()) return null;

  if ('serviceWorker' in navigator) {
    try {
      const reg = await navigator.serviceWorker.register('/sw.js', { scope: '/' });
      return reg;
    } catch (error) {
      console.warn('[SW] Service Worker registration failed:', error);
      return null;
    }
  }
  return null;
}

/**
 * Returns true if push notifications are enabled on this device/browser
 */
export async function getPushSubscriptionStatus(token) {
  if (typeof window === 'undefined') return false;

  // 1. Native Mobile App (Android APK / iOS)
  if (Capacitor.isNativePlatform()) {
    try {
      const PushNotifications = await getPushPlugin();
      if (!PushNotifications) return false;
      const perm = await PushNotifications.checkPermissions();
      const hasStoredToken = !!localStorage.getItem('fcm_device_token');
      return perm.receive === 'granted' && hasStoredToken;
    } catch (e) {
      return false;
    }
  }

  // 2. Web Browser (Chrome, Firefox, Edge, Safari)
  if (!('Notification' in window)) return false;

  // If user blocked notifications in browser, definitely false
  if (Notification.permission === 'denied') {
    localStorage.setItem('web_push_enabled', 'false');
    return false;
  }

  // If user explicitly disabled push in app settings, honor preference immediately
  if (localStorage.getItem('web_push_enabled') === 'false') {
    return false;
  }

  // If user hasn't granted permission yet
  if (Notification.permission !== 'granted') {
    return false;
  }

  const localPref = localStorage.getItem('web_push_enabled') === 'true';

  // Check active Service Worker Push Subscription
  try {
    if ('serviceWorker' in navigator && 'PushManager' in window) {
      let reg = await navigator.serviceWorker.getRegistration();
      if (!reg) {
        reg = await navigator.serviceWorker.register('/sw.js', { scope: '/' }).catch(() => null);
      }

      // Wait with fallback timeout for SW ready
      const readyReg = await Promise.race([
        navigator.serviceWorker.ready,
        new Promise(resolve => setTimeout(resolve, 2000))
      ]);
      const activeReg = readyReg || reg;

      if (activeReg && activeReg.pushManager) {
        const sub = await activeReg.pushManager.getSubscription().catch(() => null);
        if (sub) {
          localStorage.setItem('web_push_enabled', 'true');
          return true;
        }
      }
    }
  } catch (e) {
    console.warn('[PUSH] Status check error:', e);
  }

  // Backend status check fallback if token provided
  if (token) {
    try {
      const res = await fetch(`${API}/api/push/status`, {
        headers: { 'Authorization': `Bearer ${token}` },
        signal: AbortSignal.timeout(3000)
      });
      const data = await res.json().catch(() => ({}));
      if (data && data.success && (data.hasWebPush || data.enabled)) {
        localStorage.setItem('web_push_enabled', 'true');
        return true;
      }
    } catch (e) {}
  }

  return localPref;
}

/**
 * Subscribes current user to push notifications:
 * - If Android/iOS native app -> Requests native permission, gets FCM token, sends to /api/push/fcm-subscribe
 * - If Web browser -> Requests browser permission, creates PushSubscription, sends to /api/push/subscribe
 */
export async function subscribeUserToPush(token) {
  if (typeof window === 'undefined') return false;

  // 1. Native Mobile App Flow (Capacitor APK)
  if (Capacitor.isNativePlatform()) {
    const PushNotifications = await getPushPlugin();
    if (!PushNotifications) {
      throw new Error('Push notifications plugin not available on this device.');
    }
    // Request permission from Android / iOS
    let perm = await PushNotifications.checkPermissions();
    if (perm.receive === 'prompt') {
      perm = await PushNotifications.requestPermissions();
    }
    if (perm.receive !== 'granted') {
      throw new Error('Notification permission was denied. Please allow notifications in device Settings -> Apps -> SkandX -> Notifications.');
    }

    // Check if we already have a saved FCM token
    let fcmToken = localStorage.getItem('fcm_device_token');
    if (!fcmToken) {
      // Register with FCM and wait for token
      fcmToken = await new Promise((resolve, reject) => {
        let resolved = false;
        const timeout = setTimeout(() => {
          if (!resolved) {
            resolved = true;
            reject(new Error('Push notification registration timed out. Ensure Google Play Services are active.'));
          }
        }, 10000);

        PushNotifications.addListener('registration', (tokenObj) => {
          if (!resolved) {
            resolved = true;
            clearTimeout(timeout);
            resolve(tokenObj.value);
          }
        });

        PushNotifications.addListener('registrationError', (err) => {
          if (!resolved) {
            resolved = true;
            clearTimeout(timeout);
            reject(new Error(err.error || 'Failed to register with Google Push service.'));
          }
        });

        PushNotifications.register().catch((err) => {
          if (!resolved) {
            resolved = true;
            clearTimeout(timeout);
            reject(err);
          }
        });
      });
    }

    if (!fcmToken) {
      throw new Error('Could not obtain push registration token from device.');
    }

    // Save token locally
    localStorage.setItem('fcm_device_token', fcmToken);

    // Register foreground & background listeners
    try {
      PushNotifications.removeAllListeners('pushNotificationReceived').catch(() => {});
      PushNotifications.addListener('pushNotificationReceived', (notification) => {
        console.log('[PUSH] Received foreground push notification:', notification);
      });

      PushNotifications.removeAllListeners('pushNotificationActionPerformed').catch(() => {});
      PushNotifications.addListener('pushNotificationActionPerformed', (action) => {
        console.log('[PUSH] Push action performed:', action);
        const url = action.notification?.data?.url;
        if (url && typeof window !== 'undefined') {
          window.location.hash = url.startsWith('/') ? url.slice(1) : url;
        }
      });
    } catch (_) {}

    // Send FCM token to backend
    const subRes = await fetch(`${API}/api/push/fcm-subscribe`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { 'Authorization': `Bearer ${token}` } : {})
      },
      body: JSON.stringify({
        token: fcmToken,
        platform: Capacitor.getPlatform(),
        deviceName: navigator.userAgent.slice(0, 100)
      }),
      signal: AbortSignal.timeout(8000)
    });

    if (!subRes.ok) {
      const errData = await subRes.json().catch(() => ({}));
      throw new Error(errData.error || 'Failed to register mobile device on server.');
    }

    return true;
  }

  // 2. Web Browser Flow (Chrome, Firefox, Safari, Edge)
  if (!('serviceWorker' in navigator) || !('PushManager' in window) || !('Notification' in window)) {
    throw new Error('Push notifications are not supported in this browser.');
  }

  // Check if previously blocked
  if (Notification.permission === 'denied') {
    throw new Error('Notifications are blocked in your browser settings. Please click the tune/lock icon in your browser address bar and enable Notifications.');
  }

  // Request user permission
  let permission = Notification.permission;
  if (permission !== 'granted') {
    permission = await requestNotificationPermission();
  }
  if (permission !== 'granted') {
    throw new Error('Notification permission was not granted. Please allow notifications when prompted.');
  }

  // Ensure Service Worker is registered & active
  let reg = await navigator.serviceWorker.getRegistration();
  if (!reg) {
    reg = await navigator.serviceWorker.register('/sw.js', { scope: '/' });
  }

  // Wait with 4-second fallback timeout for activation so it NEVER hangs
  const readyReg = await Promise.race([
    navigator.serviceWorker.ready,
    new Promise(resolve => setTimeout(resolve, 4000))
  ]);

  const activeReg = readyReg || reg || (await navigator.serviceWorker.getRegistration());
  if (!activeReg || !activeReg.pushManager) {
    throw new Error('Push manager is not ready on this browser. Please refresh the page and try again.');
  }

  // Fetch VAPID public key with timeout
  const res = await fetch(`${API}/api/push/vapid-public-key`, {
    signal: AbortSignal.timeout(6000)
  });
  const data = await res.json().catch(() => ({}));
  const publicKey = data.publicKey;
  if (!publicKey) throw new Error('Push encryption key unavailable from server.');

  // Check existing push subscription
  let subscription = await activeReg.pushManager.getSubscription().catch(() => null);

  // If a subscription already exists, check if applicationServerKey matches current server key
  if (subscription) {
    try {
      const rawKey = subscription.options?.applicationServerKey;
      if (rawKey) {
        const existingKeyBase64 = btoa(String.fromCharCode.apply(null, new Uint8Array(rawKey)))
          .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
        const cleanPublicKey = publicKey.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
        if (existingKeyBase64 !== cleanPublicKey) {
          // Stale/mismatched VAPID key: cleanly unsubscribe first
          await subscription.unsubscribe().catch(() => {});
          subscription = null;
        }
      }
    } catch (_) {}
  }

  // Register push subscription if needed
  if (!subscription) {
    const subscribePromise = activeReg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(publicKey)
    });

    subscription = await Promise.race([
      subscribePromise,
      new Promise((_, reject) => setTimeout(() => reject(new Error('Push subscription timed out. Please check your internet connection.')), 10000))
    ]);
  }

  if (!subscription) {
    throw new Error('Unable to generate push notification subscription.');
  }

  // Send subscription to backend
  const subJson = subscription.toJSON();
  const subRes = await fetch(`${API}/api/push/subscribe`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { 'Authorization': `Bearer ${token}` } : {})
    },
    body: JSON.stringify({
      endpoint: subJson.endpoint,
      keys: subJson.keys
    }),
    signal: AbortSignal.timeout(8000)
  });

  if (!subRes.ok) {
    const errData = await subRes.json().catch(() => ({}));
    throw new Error(errData.error || 'Failed to save push subscription on server.');
  }

  localStorage.setItem('web_push_enabled', 'true');
  return true;
}

export async function unsubscribeUserFromPush(token) {
  if (typeof window === 'undefined') return false;

  // 1. Native Mobile App Unsubscribe
  if (Capacitor.isNativePlatform()) {
    try {
      const fcmToken = localStorage.getItem('fcm_device_token');
      if (fcmToken) {
        await fetch(`${API}/api/push/fcm-unsubscribe`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(token ? { 'Authorization': `Bearer ${token}` } : {})
          },
          body: JSON.stringify({ token: fcmToken }),
          signal: AbortSignal.timeout(6000)
        }).catch(() => {});
        localStorage.removeItem('fcm_device_token');
      }
      const PushNotifications = await getPushPlugin();
      if (PushNotifications) {
        await PushNotifications.removeAllListeners().catch(() => {});
      }
      return true;
    } catch (err) {
      console.warn('FCM unsubscribe error:', err);
      return false;
    }
  }

  // 2. Web Browser Unsubscribe
  localStorage.setItem('web_push_enabled', 'false');

  try {
    let endpoint = null;
    if ('serviceWorker' in navigator && 'PushManager' in window) {
      const reg = await navigator.serviceWorker.getRegistration();
      if (reg) {
        const subscription = await reg.pushManager.getSubscription();
        if (subscription) {
          const subJson = subscription.toJSON();
          endpoint = subJson.endpoint;
          await subscription.unsubscribe().catch(() => {});
        }
      }
    }

    // Always inform backend to remove push subscriptions for this user
    await fetch(`${API}/api/push/unsubscribe`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { 'Authorization': `Bearer ${token}` } : {})
      },
      body: JSON.stringify({ endpoint }),
      signal: AbortSignal.timeout(6000)
    }).catch(() => {});

    return true;
  } catch (err) {
    console.warn('Unsubscribe error:', err);
    return false;
  }
}

export async function triggerTestPushNotification(token) {
  const res = await fetch(`${API}/api/push/test`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { 'Authorization': `Bearer ${token}` } : {})
    },
    signal: AbortSignal.timeout(8000)
  });
  return res.json();
}
