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
    next();
  });
}

module.exports = { authenticateToken, JWT_SECRET };
