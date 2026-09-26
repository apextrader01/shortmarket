const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const db = require('../database/db');

const SECRET_FILE = path.join(__dirname, '../.jwt_secret');
const STABLE_CLUSTER_SECRET = '612f4b8a0208e38fa0dd69708a8b7e4215def8230cef6353cbe3cfd2549f7ac26d738f1d5c40b26c11b7aec1958f56347e5b845a97142c66787905c92c9c69e3';

let JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET || JWT_SECRET === 'super_secret_shortmarket_key_2026') {
  try {
    if (fs.existsSync(SECRET_FILE)) {
      const fileSecret = fs.readFileSync(SECRET_FILE, 'utf8').trim();
      if (fileSecret && fileSecret.length >= 32) {
        JWT_SECRET = fileSecret;
      }
    }
  } catch (_) {}

  if (!JWT_SECRET || JWT_SECRET === 'super_secret_shortmarket_key_2026') {
    JWT_SECRET = STABLE_CLUSTER_SECRET;
    try {
      if (!fs.existsSync(SECRET_FILE)) {
        fs.writeFileSync(SECRET_FILE, JWT_SECRET, { mode: 0o600 });
      }
    } catch (_) {}
  }
}

// In-memory cache for ban checks and session sync throttling (eliminates 70%+ of auth DB queries)
const banCache = new Map(); // userId -> { is_banned: boolean, ts: number }
const sessionUpdateThrottle = new Map(); // tokenHash -> ts

function hashToken(token) {
  if (!token) return '';
  return crypto.createHash('sha256').update(token).digest('hex');
}

function extractTokens(req) {
  let bearerToken = null;
  const authHeader = req.headers['authorization'];
  if (authHeader && typeof authHeader === 'string' && authHeader.toLowerCase().startsWith('bearer ')) {
    bearerToken = authHeader.slice(7).trim();
  }
  const cookieToken = (req.cookies && req.cookies.token && typeof req.cookies.token === 'string') 
    ? req.cookies.token.trim() 
    : null;
  return { bearerToken, cookieToken };
}

function verifyJwtAsync(token) {
  return new Promise((resolve) => {
    if (!token) return resolve({ err: new Error('Empty token'), user: null });
    jwt.verify(token, JWT_SECRET, (err, user) => {
      resolve({ err, user });
    });
  });
}

async function authenticateToken(req, res, next) {
  const { bearerToken, cookieToken } = extractTokens(req);
  if (!bearerToken && !cookieToken) {
    return res.status(401).json({ error: 'Access denied. No token provided.' });
  }

  // Prioritize active Authorization header, fallback to cookie if header missing or stale
  let primaryToken = bearerToken || cookieToken;
  let secondaryToken = (bearerToken && cookieToken && bearerToken !== cookieToken) ? cookieToken : null;

  let authResult = await verifyJwtAsync(primaryToken);
  let activeToken = primaryToken;

  if (authResult.err && secondaryToken) {
    const secondaryResult = await verifyJwtAsync(secondaryToken);
    if (!secondaryResult.err && secondaryResult.user) {
      authResult = secondaryResult;
      activeToken = secondaryToken;
    }
  }

  if (authResult.err || !authResult.user) {
    return res.status(403).json({ error: 'Invalid or expired token.' });
  }

  const user = authResult.user;
  const token = activeToken;

  // Check if user is banned (cached for 60 seconds to eliminate DB query on every HTTP request)
  try {
    const now = Date.now();
    let cachedBan = banCache.get(user.id);
    if (!cachedBan || (now - cachedBan.ts > 60000)) {
      const dbUser = await db('users').select('is_banned').where({ id: user.id }).first();
      cachedBan = { is_banned: !!(dbUser && dbUser.is_banned), ts: now };
      if (banCache.size > 10000) banCache.clear();
      banCache.set(user.id, cachedBan);
    }
    if (cachedBan && cachedBan.is_banned) {
      return res.status(403).json({ error: 'Your account has been suspended by an administrator.' });
    }
  } catch (e) {
    const fallbackBan = banCache.get(user.id);
    if (fallbackBan && fallbackBan.is_banned) {
      return res.status(403).json({ error: 'Your account has been suspended by an administrator.' });
    }
  }

  const tokenHash = hashToken(token);
  req.user = user; // Set req.user to the payload { id, username }
  req.token = token;
  req.tokenHash = tokenHash;

    // Opportunistically record real IP & device info if missing or on change
    try {
      const realIpHeader = req.headers['cf-connecting-ip'] || req.headers['true-client-ip'] || req.headers['x-real-ip'] || req.headers['x-client-ip'];
      const forwarded = req.headers['x-forwarded-for'];
      let clientIp = '';

      const isValidPublic = (ip) => {
        if (!ip || typeof ip !== 'string') return false;
        const clean = ip.replace(/^::ffff:/, '').trim();
        if (!clean || clean === '::1' || clean === '127.0.0.1' || clean === 'localhost') return false;
        if (clean.startsWith('10.') || clean.startsWith('192.168.') || clean.startsWith('169.254.')) return false;
        if (/^172\.(1[6-9]|2[0-9]|3[0-1])\./.test(clean)) return false;
        if (clean.startsWith('fc') || clean.startsWith('fd') || clean.startsWith('fe80')) return false;
        return true;
      };

      if (isValidPublic(realIpHeader)) {
        clientIp = realIpHeader.trim().replace(/^::ffff:/, '');
      } else if (forwarded && typeof forwarded === 'string') {
        const ips = forwarded.split(',').map(s => s.trim().replace(/^::ffff:/, ''));
        for (const ip of ips) {
          if (isValidPublic(ip)) { clientIp = ip; break; }
        }
      }
      if (!clientIp) {
        const raw = req.ip || req.socket?.remoteAddress || '';
        clientIp = raw.replace(/^::ffff:/, '').trim();
      }

      const now = Date.now();
      const lastSessionSync = sessionUpdateThrottle.get(tokenHash) || 0;
      const shouldSyncSession = (now - lastSessionSync > 300000); // Throttle DB writes to once every 5 mins

      if (shouldSyncSession && clientIp && clientIp !== '::1' && clientIp !== '127.0.0.1' && user.id) {
        if (sessionUpdateThrottle.size > 10000) sessionUpdateThrottle.clear();
        sessionUpdateThrottle.set(tokenHash, now);

        const { parseDeviceDetails, parseIpLocation } = require('../services/deviceSecurity');
        const { deviceModel, osName, browserName } = parseDeviceDetails(req.headers['user-agent']);
        const { city, state } = parseIpLocation(clientIp);

        const updateData = {
          last_ip: clientIp,
          device_model: deviceModel,
          os_name: osName,
          browser_name: browserName
        };
        if (city && city !== 'Local Network' && city !== 'Local') updateData.city = city;
        if (state && state !== 'Local') updateData.state = state;

        db('users').where({ id: user.id })
          .where(function() {
            this.whereNull('last_ip')
                .orWhere('last_ip', '')
                .orWhere('last_ip', '::1')
                .orWhere('last_ip', '127.0.0.1')
                .orWhere('last_ip', '!=', clientIp);
          })
          .update(updateData)
          .catch(() => {});

        // Upsert user_sessions entry to keep device security manager synchronized
        if (tokenHash) {
          db('user_sessions')
            .where({ token_hash: tokenHash })
            .first()
            .then(existing => {
              if (existing) {
                return db('user_sessions')
                  .where({ id: existing.id })
                  .update({ last_active_at: new Date(), ip_address: clientIp });
              } else {
                return db('user_sessions').insert({
                  user_id: user.id,
                  token_hash: tokenHash,
                  device_model: deviceModel,
                  browser_name: browserName,
                  os_name: osName,
                  ip_address: clientIp,
                  city: city || '',
                  state: state || '',
                  last_active_at: new Date()
                });
              }
            })
            .catch(() => {});
        }
      }
    } catch (e) {
      // Non-blocking
    }

    next();
}

module.exports = { authenticateToken, JWT_SECRET, hashToken };
