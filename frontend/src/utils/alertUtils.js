/**
 * Price Alert Utility Functions
 * Handles daily 08:19 AM IST alert lifecycle and stale alert pruning.
 */

/**
 * Calculates the most recent 08:19 AM IST cutoff timestamp in UTC milliseconds.
 * Alerts created before this timestamp are considered stale from previous trading days.
 */
export function getLatest819CutoffMs(now = new Date()) {
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Kolkata',
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
    hour: 'numeric',
    minute: 'numeric',
    second: 'numeric',
    hour12: false
  });
  const parts = formatter.formatToParts(now);
  const p = {};
  parts.forEach(({ type, value }) => { p[type] = parseInt(value, 10); });

  let cutoffYear = p.year;
  let cutoffMonth = p.month - 1; // 0-indexed month
  let cutoffDay = p.day;

  // If current IST time is before 08:19, the last cutoff occurred yesterday at 08:19 IST
  const isBefore819 = (p.hour < 8) || (p.hour === 8 && p.minute < 19);
  if (isBefore819) {
    const yesterday = new Date(Date.UTC(cutoffYear, cutoffMonth, cutoffDay - 1));
    cutoffYear = yesterday.getUTCFullYear();
    cutoffMonth = yesterday.getUTCMonth();
    cutoffDay = yesterday.getUTCDate();
  }

  // 08:19 IST in UTC is 08:19 - 5:30 = 02:49 UTC
  return Date.UTC(cutoffYear, cutoffMonth, cutoffDay, 2, 49, 0, 0);
}

/**
 * Filters alerts to keep only those created since the last 08:19 AM IST cutoff.
 */
export function filterStaleAlerts(alerts = []) {
  if (!Array.isArray(alerts)) return [];
  const cutoffMs = getLatest819CutoffMs();
  return alerts.filter(alert => {
    if (!alert || !alert.createdAt) return false;
    const createdMs = new Date(alert.createdAt).getTime();
    if (isNaN(createdMs)) return false;
    return createdMs >= cutoffMs;
  });
}
