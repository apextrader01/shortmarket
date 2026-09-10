import { API } from '../store';
import { Capacitor } from '@capacitor/core';
import { PushNotifications } from '@capacitor/push-notifications';

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
export async function getPushSubscriptionStatus() {
  if (typeof window === 'undefined') return false;

  // 1. Native Mobile App (Android APK / iOS)
  if (Capacitor.isNativePlatform()) {
    try {
      const perm = await PushNotifications.checkPermissions();
      const hasStoredToken = !!localStorage.getItem('fcm_device_token');
      return perm.receive === 'granted' && hasStoredToken;
    } catch (e) {
      return false;
    }
  }

  // 2. Web Browser (Chrome, Firefox, Edge, Safari)
  if (!('serviceWorker' in navigator) || !('PushManager' in window) || !('Notification' in window)) return false;
  if (Notification.permission !== 'granted') return false;
  
  try {
    const reg = await navigator.serviceWorker.getRegistration();
    if (!reg) return false;
    const sub = await reg.pushManager.getSubscription();
    return !!sub;
  } catch (e) {
    return false;
  }
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
    // Request permission from Android / iOS
    let perm = await PushNotifications.checkPermissions();
    if (perm.receive === 'prompt') {
      perm = await PushNotifications.requestPermissions();
    }
    if (perm.receive !== 'granted') {
      throw new Error('Notification permission was denied. Please allow notifications in device Settings -> Apps -> Short Edge -> Notifications.');
    }

    // Register with FCM and wait for token
    const fcmToken = await new Promise((resolve, reject) => {
      let resolved = false;
      const timeout = setTimeout(() => {
        if (!resolved) {
          resolved = true;
          reject(new Error('Push notification registration timed out. Ensure Google Play Services are active.'));
        }
      }, 12000);

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

    if (!fcmToken) {
      throw new Error('Could not obtain push registration token from device.');
    }

    // Save token locally
    localStorage.setItem('fcm_device_token', fcmToken);

    // Register foreground & background listeners
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
      })
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

  // Request user permission
  let permission = Notification.permission;
  if (permission !== 'granted') {
    permission = await Notification.requestPermission();
  }
  if (permission !== 'granted') {
    throw new Error('Notification permission was denied. Please allow notifications in your browser address bar.');
  }

  // Ensure Service Worker is registered & active
  let reg = await navigator.serviceWorker.getRegistration();
  if (!reg) {
    reg = await navigator.serviceWorker.register('/sw.js', { scope: '/' });
  }

  // Wait with 3-second fallback timeout for activation so it NEVER hangs
  await Promise.race([
    navigator.serviceWorker.ready,
    new Promise(resolve => setTimeout(resolve, 3000))
  ]);

  reg = (await navigator.serviceWorker.getRegistration()) || reg;

  // Fetch VAPID public key
  const res = await fetch(`${API}/api/push/vapid-public-key`);
  const data = await res.json().catch(() => ({}));
  const publicKey = data.publicKey;
  if (!publicKey) throw new Error('VAPID public key unavailable from server.');

  // Register push subscription
  let subscription = await reg.pushManager.getSubscription();
  if (!subscription) {
    subscription = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(publicKey)
    });
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
    })
  });

  if (!subRes.ok) {
    const errData = await subRes.json().catch(() => ({}));
    throw new Error(errData.error || 'Failed to save push subscription on server.');
  }

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
          body: JSON.stringify({ token: fcmToken })
        }).catch(() => {});
        localStorage.removeItem('fcm_device_token');
      }
      await PushNotifications.removeAllListeners().catch(() => {});
      return true;
    } catch (err) {
      console.warn('FCM unsubscribe error:', err);
      return false;
    }
  }

  // 2. Web Browser Unsubscribe
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) return false;

  try {
    const reg = await navigator.serviceWorker.getRegistration();
    if (reg) {
      const subscription = await reg.pushManager.getSubscription();
      if (subscription) {
        const subJson = subscription.toJSON();
        await subscription.unsubscribe().catch(() => {});
        await fetch(`${API}/api/push/unsubscribe`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(token ? { 'Authorization': `Bearer ${token}` } : {})
          },
          body: JSON.stringify({ endpoint: subJson.endpoint })
        }).catch(() => {});
      }
    }
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
    }
  });
  return res.json();
}

