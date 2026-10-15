/**
 * User Activity & Clickstream Tracker (Client Telemetry)
 * Tracks user navigation, page visits, button clicks, and actions.
 * Buffers in memory and flushes to /api/telemetry/user-activity.
 */

const pendingEvents = [];
let flushTimeout = null;
let isFlushing = false;

export function trackUserAction(type, action, meta = {}) {
  try {
    if (typeof window === 'undefined') return;
    const token = localStorage.getItem('token');
    if (!token) return; // Only track authenticated users

    const event = {
      type: type || 'CLICK',
      action: String(action || '').slice(0, 100),
      meta: meta || {},
      timestamp: Date.now(),
      url: window.location.pathname
    };

    pendingEvents.push(event);
    if (pendingEvents.length > 50) pendingEvents.shift();

    // Priority events (NAVIGATE, TRADE, FORM) flush immediately; others debounced every 3.5s
    if (type === 'NAVIGATE' || type === 'TRADE' || pendingEvents.length >= 5) {
      flushActivityEvents();
    } else if (!flushTimeout) {
      flushTimeout = setTimeout(flushActivityEvents, 3500);
    }
  } catch (_) {}
}

export async function flushActivityEvents(apiBase = '') {
  if (flushTimeout) {
    clearTimeout(flushTimeout);
    flushTimeout = null;
  }
  if (pendingEvents.length === 0 || isFlushing) return;
  if (typeof window === 'undefined') return;

  const token = localStorage.getItem('token');
  if (!token) {
    pendingEvents.length = 0;
    return;
  }

  const batch = pendingEvents.splice(0, 25);
  isFlushing = true;
  try {
    const baseUrl = apiBase || window.location.origin || '';
    await fetch(`${baseUrl}/api/telemetry/user-activity`, {
      method: 'POST',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({ events: batch }),
      keepalive: true
    });
  } catch (_) {
    // Non-blocking
  } finally {
    isFlushing = false;
  }
}

// Global passive click listener to automatically capture button and link clicks
if (typeof window !== 'undefined') {
  window.addEventListener('click', (e) => {
    try {
      const el = e.target.closest('button, a, [role="button"], input[type="submit"]');
      if (!el) return;
      if (el.closest('input[type="password"]')) return;

      const label = el.getAttribute('data-track') ||
                    el.getAttribute('aria-label') ||
                    el.getAttribute('title') ||
                    el.innerText?.trim()?.replace(/\s+/g, ' ')?.slice(0, 40);

      if (!label || label.length < 2) return;

      trackUserAction('CLICK', `Clicked "${label}"`, {
        tag: el.tagName.toLowerCase(),
        id: el.id || undefined
      });
    } catch (_) {}
  }, { passive: true });

  window.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') {
      flushActivityEvents();
    }
  });
}
