let cachedClientIp = null;
let cachedGeo = { city: '', state: '', country: '' };
let hasReportedTelemetry = false;
let initPromise = null;

/**
 * Fetch client's public IP and location using fast zero-cost public lookup
 */
export async function fetchClientPublicInfo() {
  if (cachedClientIp) {
    return { ip: cachedClientIp, ...cachedGeo };
  }

  if (initPromise) {
    return initPromise;
  }

  initPromise = (async () => {
    // 1. Try ipapi.co (returns IP + City + Region/State + Country) with 1800ms timeout
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 1800);
      const res = await fetch('https://ipapi.co/json/', { signal: controller.signal });
      clearTimeout(timeoutId);
      if (res.ok) {
        const data = await res.json();
        if (data && data.ip && !data.error) {
          cachedClientIp = String(data.ip).trim();
          cachedGeo = {
            city: data.city || '',
            state: data.region || '',
            country: data.country_name || 'India'
          };
          return { ip: cachedClientIp, ...cachedGeo };
        }
      }
    } catch (e) {
      // Fallback
    }

    // 2. Fallback to ipify.org (ultrafast, high uptime) with 1500ms timeout
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 1500);
      const res = await fetch('https://api.ipify.org?format=json', { signal: controller.signal });
      clearTimeout(timeoutId);
      if (res.ok) {
        const data = await res.json();
        if (data && data.ip) {
          cachedClientIp = String(data.ip).trim();
          return { ip: cachedClientIp, ...cachedGeo };
        }
      }
    } catch (e) {
      // Fallback
    }

    // 3. Fallback to api64.ipify.org
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 1200);
      const res = await fetch('https://api64.ipify.org?format=json', { signal: controller.signal });
      clearTimeout(timeoutId);
      if (res.ok) {
        const data = await res.json();
        if (data && data.ip) {
          cachedClientIp = String(data.ip).trim();
          return { ip: cachedClientIp, ...cachedGeo };
        }
      }
    } catch (e) {}

    return { ip: cachedClientIp, ...cachedGeo };
  })();

  return initPromise;
}

export function getCachedPublicIp() {
  return cachedClientIp;
}

/**
 * Report client telemetry (public IP, device metadata, geo) to backend server
 */
export async function syncClientTelemetry(apiBaseUrl, force = false) {
  if (hasReportedTelemetry && !force) return;
  try {
    const info = await fetchClientPublicInfo();
    const token = localStorage.getItem('token');
    
    const headers = { 'Content-Type': 'application/json' };
    if (token) headers['Authorization'] = `Bearer ${token}`;
    if (info.ip) headers['X-Client-Public-IP'] = info.ip;

    const res = await fetch(`${apiBaseUrl}/api/user/telemetry`, {
      method: 'POST',
      credentials: 'include',
      headers,
      body: JSON.stringify({
        client_ip: info.ip || undefined,
        city: info.city || undefined,
        state: info.state || undefined
      })
    });
    if (res.ok) {
      hasReportedTelemetry = true;
    }
  } catch (e) {
    // Non-blocking
  }
}

// Kick off async lookup immediately on module import
if (typeof window !== 'undefined') {
  fetchClientPublicInfo().catch(() => {});
}
