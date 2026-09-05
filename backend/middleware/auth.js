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
      const forwarded = req.headers['x-forwarded-for'];
      const realIpHeader = req.headers['x-real-ip'] || req.headers['cf-connecting-ip'] || req.headers['x-client-ip'];
      let clientIp = '';
      if (forwarded) {
        const first = forwarded.split(',')[0].trim();
        if (first && first !== '::1' && first !== '127.0.0.1' && !first.startsWith('127.')) {
          clientIp = first.replace(/^::ffff:/, '');
        }
      }
      if (!clientIp && realIpHeader && realIpHeader !== '::1' && realIpHeader !== '127.0.0.1') {
        clientIp = realIpHeader.trim().replace(/^::ffff:/, '');
      }
      if (!clientIp) {
        const raw = req.ip || req.socket?.remoteAddress || '';
        clientIp = raw.replace(/^::ffff:/, '');
      }

      if (clientIp && clientIp !== '::1' && clientIp !== '127.0.0.1' && user.id) {
        const { parseDeviceDetails, parseIpLocation } = require('../services/deviceSecurity');
        const { deviceModel, osName, browserName } = parseDeviceDetails(req.headers['user-agent']);
        const { city, state } = parseIpLocation(clientIp);

        db('users').where({ id: user.id })
          .where(function() {
            this.whereNull('last_ip')
                .orWhere('last_ip', '')
                .orWhere('last_ip', '::1')
                .orWhere('last_ip', '127.0.0.1');
          })
          .update({
            last_ip: clientIp,
            device_model: deviceModel,
            os_name: osName,
            browser_name: browserName,
            city: city,
            state: state
          })
          .catch(() => {});
      }
    } catch (e) {
      // Non-blocking
    }

    next();
  });
}

module.exports = { authenticateToken, JWT_SECRET };
