const jwt = require('jsonwebtoken');
const db = require('../database/db');

const JWT_SECRET = process.env.JWT_SECRET || 'super_secret_shortmarket_key_2026';

function authenticateToken(req, res, next) {
  // Read token from httpOnly cookie, fallback to Authorization header if provided
  const token = (req.cookies && req.cookies.token) || 
                (req.headers['authorization'] && req.headers['authorization'].split(' ')[1]);

  if (!token) return res.status(401).json({ error: 'Access denied. No token provided.' });

  jwt.verify(token, JWT_SECRET, async (err, user) => {
    if (err) return res.status(403).json({ error: 'Invalid token.' });
    
    // Check if user is banned
    try {
      const dbUser = await db('users').select('is_banned').where({ id: user.id }).first();
      if (dbUser && dbUser.is_banned) {
        return res.status(403).json({ error: 'Your account has been suspended by an administrator.' });
      }
    } catch (e) {
      // Ignore db errors silently to not break auth if DB is temporarily slow
    }
    
    req.user = user; // Set req.user to the payload { id, username }

    // Opportunistically record real IP & device info if missing or on change
    try {
      const customIp = req.headers['x-client-public-ip'];
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

      if (isValidPublic(customIp)) {
        clientIp = customIp.trim().replace(/^::ffff:/, '');
      } else if (isValidPublic(realIpHeader)) {
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

      if (clientIp && clientIp !== '::1' && clientIp !== '127.0.0.1' && user.id) {
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
      }
    } catch (e) {
      // Non-blocking
    }

    next();
  });
}

module.exports = { authenticateToken, JWT_SECRET };
