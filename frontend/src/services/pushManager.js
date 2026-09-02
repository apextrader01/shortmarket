import { API } from '../store';

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

export async function getPushSubscriptionStatus() {
  if (typeof window === 'undefined') return false;
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

export async function subscribeUserToPush(token) {
  if (typeof window === 'undefined') return false;
  if (!('serviceWorker' in navigator) || !('PushManager' in window) || !('Notification' in window)) {
    throw new Error('Push notifications are not supported in this browser.');
  }

  // 1. Request user permission
  let permission = Notification.permission;
  if (permission !== 'granted') {
    permission = await Notification.requestPermission();
  }
  if (permission !== 'granted') {
    throw new Error('Notification permission was denied. Please allow notifications in your browser address bar.');
  }

  // 2. Ensure Service Worker is registered & active
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

  // 3. Fetch VAPID public key
  const res = await fetch(`${API}/api/push/vapid-public-key`);
  const data = await res.json().catch(() => ({}));
  const publicKey = data.publicKey;
  if (!publicKey) throw new Error('VAPID public key unavailable from server.');

  // 4. Register push subscription
  let subscription = await reg.pushManager.getSubscription();
  if (!subscription) {
    subscription = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(publicKey)
    });
  }

  // 5. Send subscription to backend
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
