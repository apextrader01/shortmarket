/**
 * Utility functions for robust API response parsing and user-friendly error formatting.
 * Protects the UI from displaying technical exceptions like "Unexpected token '<', "<!DOCTYPE "..."
 * when edge proxies (Cloudflare, Nginx) return HTML error or challenge pages.
 */

/**
 * Safely parses a Fetch Response object as JSON.
 * If the response is HTML (e.g. Cloudflare WAF, Nginx 429/502/504 error pages),
 * it returns a clean, user-friendly error object instead of throwing a SyntaxError.
 *
 * @param {Response} res - The fetch Response object
 * @param {string} [fallbackMessage] - Optional fallback error message
 * @returns {Promise<Object>} The parsed JSON data or a standardized error object
 */
export async function safeParseJsonResponse(res, fallbackMessage = 'An unexpected error occurred. Please try again.') {
  if (!res) {
    return { success: false, error: 'No response from server. Please check your internet connection.' };
  }

  const contentType = (res.headers && typeof res.headers.get === 'function')
    ? (res.headers.get('content-type') || '')
    : '';

  // 1. If explicitly JSON content-type, attempt to parse JSON
  if (contentType.includes('application/json')) {
    try {
      const data = await res.json();
      return data;
    } catch (_) {
      // JSON parsing failed despite header, fall through to safe text inspection
    }
  }

  // 2. Handle non-JSON or malformed responses (HTML error pages, plain text)
  try {
    const rawText = await res.text();
    const trimmed = (rawText || '').trim();

    // Check if response is an HTML document (Cloudflare challenge, 429 rate limit, 502/504 gateway)
    const isHtml = trimmed.startsWith('<!DOCTYPE') ||
                   trimmed.startsWith('<html') ||
                   trimmed.includes('<body') ||
                   trimmed.startsWith('<');

    if (isHtml) {
      if (res.status === 429) {
        return {
          success: false,
          error: 'Too many requests. Please wait a moment before trying again.'
        };
      }
      if (res.status === 403) {
        return {
          success: false,
          error: 'Access temporarily restricted by security check. Please try again or log in with Google.'
        };
      }
      if (res.status === 502 || res.status === 503 || res.status === 504) {
        return {
          success: false,
          error: 'Server is temporarily unavailable. Please try again in a few moments.'
        };
      }
      return {
        success: false,
        error: fallbackMessage || 'Network error occurred. Please try again.'
      };
    }

    // If plain text and short, use it as error message
    if (trimmed.length > 0 && trimmed.length < 250 && !trimmed.includes('<')) {
      return { success: false, error: trimmed };
    }
  } catch (_) {}

  // 3. Fallback based on HTTP status code
  if (res.status === 429) {
    return { success: false, error: 'Too many requests. Please wait a moment before trying again.' };
  }
  if (res.status === 403) {
    return { success: false, error: 'Access restricted. Please verify your credentials or use Google Login.' };
  }
  if (res.status === 502 || res.status === 503 || res.status === 504) {
    return { success: false, error: 'Server connection timed out. Please try again shortly.' };
  }

  return { success: false, error: fallbackMessage };
}

/**
 * Sanitizes any raw exception or error message before displaying to the user.
 * Intercepts technical browser parser errors (SyntaxError, DOCTYPE, Failed to fetch)
 * and turns them into clean, human-readable explanations.
 *
 * @param {string|Error|null|undefined} errOrMsg - The error object or message string
 * @param {string} [fallback] - Fallback message if empty
 * @returns {string} User-friendly message
 */
export function formatAuthErrorMessage(errOrMsg, fallback = 'Operation failed. Please try again.') {
  if (!errOrMsg) return fallback;
  const rawMsg = typeof errOrMsg === 'string'
    ? errOrMsg
    : (errOrMsg.message || String(errOrMsg));

  if (!rawMsg || typeof rawMsg !== 'string') return fallback;

  // Intercept HTML/JSON syntax errors from Cloudflare / Nginx
  if (
    rawMsg.includes("Unexpected token '<'") ||
    rawMsg.includes('<!DOCTYPE') ||
    rawMsg.includes('is not valid JSON') ||
    rawMsg.includes('JSON.parse') ||
    rawMsg.includes('SyntaxError')
  ) {
    return 'Connection temporarily interrupted by network security check. Please try logging in with Google or try again in a moment.';
  }

  // Intercept raw network fetch drops
  if (
    rawMsg.includes('Failed to fetch') ||
    rawMsg.includes('NetworkError') ||
    rawMsg.includes('Load failed') ||
    rawMsg.includes('Network request failed')
  ) {
    return 'Unable to reach the server. Please check your internet connection and try again.';
  }

  return rawMsg;
}
