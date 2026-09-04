process.on('unhandledRejection', (reason, promise) => { console.error('Unhandled Rejection at:', promise, 'reason:', reason); });
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });
process.env.TZ = 'Asia/Kolkata';

// Ultimate Crash Reporter
const logger = require('./services/logger');

// Override global console methods for Winston integration
console.log = (...args) => logger.info(args.map(a => typeof a === 'object' ? JSON.stringify(a) : a).join(' '));
console.error = (...args) => logger.error(args.map(a => typeof a === 'object' ? JSON.stringify(a) : a).join(' '));
console.warn = (...args) => logger.warn(args.map(a => typeof a === 'object' ? JSON.stringify(a) : a).join(' '));

process.on('uncaughtException', err => {
  console.error('FATAL UNCAUGHT EXCEPTION:', err);
  // Do not exit, just log it so Railway doesn't crash
});
process.on('unhandledRejection', err => {
  console.error('FATAL UNHANDLED REJECTION:', err);
});

const express = require('express');
const compression = require('compression');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const db = require('./database/db');
const fs = require('fs');
const SIPEngine = require('./services/sipEngine');

const { pubClient, subClient, generalClient } = require('./services/redisClient');
const { createAdapter } = require('@socket.io/redis-adapter');

const adapterPubClient = generalClient.duplicate();
const adapterSubClient = generalClient.duplicate();
// CRITICAL: Must attach error handlers BEFORE connect() or unhandled
// Redis reconnection timeouts will throw UnhandledRejection and kill the process.
adapterPubClient.on('error', (err) => console.error('[Redis Adapter Pub] Error:', err.message));
adapterSubClient.on('error', (err) => console.error('[Redis Adapter Sub] Error:', err.message));
adapterPubClient.connect().catch((err) => console.error('[Redis Adapter Pub] Connect failed:', err.message));
adapterSubClient.connect().catch((err) => console.error('[Redis Adapter Sub] Connect failed:', err.message));


// --- TEMPORARY HOTFIX FOR TODAY'S ZERO PNL ORDERS ---
// (This script automatically patches today's missing P&L on startup)
(async function patchTodayRealizedPnl() {
    try {
        const db = require('./database/db'); // assuming db export
        if (!db || typeof db !== 'function') return;
        
        const todayStart = new Date();
        todayStart.setHours(0,0,0,0);
        
        const ordersWithZeroPnl = await db('orders')
            .where('status', 'EXECUTED')
            .where('is_rms', true)
            .where('created_at', '>=', todayStart);
            
        let patched = 0;
        for (const o of ordersWithZeroPnl) {
            if (!o.realized_pnl || Number(o.realized_pnl) === 0) {
                const ledger = await db('ledger')
                    .where('user_id', o.user_id)
                    .where('type', 'REALIZED_PNL')
                    .where('description', 'like', '%' + o.symbol)
                    .where('created_at', '>=', todayStart)
                    .orderBy('created_at', 'desc')
                    .first();
                    
                if (ledger && Number(ledger.amount) !== 0) {
                    await db('orders').where({ id: o.id }).update({ realized_pnl: ledger.amount });
                    patched++;
                }
            }
        }
        if (patched > 0) {
            console.log(`[HOTFIX] Successfully retroactively patched ${patched} orders with their correct Realized P&L from the Ledger.`);
        }
    } catch (e) {
        // fail silently
    }
})();
// ----------------------------------------------------
const app = express();
const server = http.createServer(app);

// ─── Price Cache (lives in server.js to avoid module issues) ─────────────────
const priceCache = {};

function isDerivativeContract(sym) {
  if (!sym || typeof sym !== 'string') return false;
  const clean = sym.includes(':') ? sym.split(':')[1] : sym;
  return /(?:\d+|[-_\s])(CE|PE)(?:[-_\s].*)?$/i.test(clean) || /(?:\d+|[A-Z]{3}|[-_\s])FUT(?:[-_\s].*)?$/i.test(clean) || clean.endsWith('-FUT');
}

function isCommodityContract(sym) {
  if (!sym || typeof sym !== 'string') return false;
  if (sym.includes('MCX') || sym.includes('NCDEX')) return true;
  const clean = sym.replace(/^(NSE:|BSE:|MCX:)/i, '');
  return ['CRUDEOIL', 'GOLD', 'SILVER', 'NATURALGAS', 'COPPER', 'ZINC', 'LEAD', 'ALUMINIUM', 'MENTHAOIL', 'COTTON', 'NICKEL'].some(c => clean.startsWith(c));
}

// When running in PM2 Cluster Mode, NODE_APP_INSTANCE tells us the worker ID
const isMaster = process.env.NODE_APP_INSTANCE === '0' || !process.env.NODE_APP_INSTANCE;

const io = new Server(server, {
  cors: { origin: true, credentials: true, methods: ['GET', 'POST'] },
  adapter: createAdapter(adapterPubClient, adapterSubClient)
});

// Listen for Fyers token updates on all cluster nodes
const { subClient: globalSubClient } = require('./services/redisClient');
if (globalSubClient) {
    const setupTokenSync = () => {
        globalSubClient.subscribe('fyers_token_updated', () => {
            try {
                const { reloadFyersToken } = require('./services/fyers');
                if (reloadFyersToken) reloadFyersToken();
            } catch(e) {}
        }).catch((err) => { console.error('Redis token sync subscribe error:', err); });
    };
    
    if (globalSubClient.isReady) setupTokenSync();
    else globalSubClient.on('ready', setupTokenSync);
}

// Redis Pub/Sub for syncing priceCache across cluster nodes
if (isMaster) {
  // Master node also needs to listen to reload_triggers (when an order is placed via API on Master)
  const { subClient: cacheSubClient } = require('./services/redisClient');
  const triggerEngine = require('./services/triggerEngine');
  const setupMasterSync = () => {
    cacheSubClient.subscribe('reload_triggers', (message) => {
        console.log('[Master] Reloading triggers from DB');
        triggerEngine.loadPendingOrders();
    }).catch(err => console.error(err));
  };
  if (cacheSubClient.isReady) setupMasterSync();
  else cacheSubClient.on('ready', setupMasterSync);
}
if (!isMaster) {
  const { subClient: cacheSubClient } = require('./services/redisClient');
  
  const setupCacheSync = () => {
    cacheSubClient.subscribe('price_cache_batch_sync', (message) => {
      try {
        const batchUpdate = JSON.parse(message);
        // Workers only update their local priceCache — trigger evaluation ONLY runs on master
        Object.keys(batchUpdate).forEach(symbol => {
          const priceObj = batchUpdate[symbol];
          if (symbol && priceObj) {
            priceCache[symbol] = priceObj;
          }
        });
      } catch(e){}
    }).catch(err => { console.error('Redis cache sync subscribe error:', err); });
    
    // Subscribe to trigger reloads
    cacheSubClient.subscribe('reload_triggers', () => {
        const triggerEngine = require('./services/triggerEngine');
        triggerEngine.loadPendingOrders();
    }).catch(err => console.error(err));
  };
  
  if (cacheSubClient.isReady) setupCacheSync();
  else cacheSubClient.on('ready', setupCacheSync);
}

app.use(cors({ origin: true, credentials: true }));
app.use(cookieParser());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ limit: '10mb', extended: true }));
app.use(compression()); // Compress all API responses to fix frontend loading lag

const recordTelemetry = require('./middleware/telemetry');
app.use(recordTelemetry);


// ─── Health ────────────────────────────────────────────────────────────────
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', symbols: Object.keys(priceCache).length });
});

// ─── Prices (all cached LTPs) ─────────────────────────────────────────────
app.get('/api/prices', (req, res) => {
  res.json(priceCache);
});

app.get('/api/prices/batch', async (req, res) => {
  const symbols = req.query.symbols?.split(',') || [];
  if (symbols.length === 0) return res.json({});
  
  const { fetchBatchLTPs } = require('./services/fyers');
  if (fetchBatchLTPs) {
    const prices = await fetchBatchLTPs(symbols);
    Object.assign(priceCache, prices);
    res.json(prices);
  } else {
    res.json({});
  }
});

// ─── Stocks (full instrument master) ──────────────────────────────────────
app.get('/api/stocks/lotsizes', async (req, res) => {
  const symbols = req.query.symbols?.split(',') || [];
  if (symbols.length === 0) return res.json({});
  
  try {
    const { getLotSizes } = require('./services/instrumentsCache');
    const result = getLotSizes(symbols);
    res.json(result);
  } catch (err) {
    console.error('/api/lotsizes Error:', err);
    res.json({});
  }
});

app.get('/api/stocks', async (req, res) => {
  try {
    const { generalClient } = require('./services/redisClient');
    const cacheKey = 'api:stocks:nse_bse';
    
    // 1. Try Redis cache first
    if (generalClient && generalClient.isReady) {
      const cached = await generalClient.get(cacheKey);
      if (cached) {
        res.setHeader('Content-Type', 'application/json');
        return res.send(cached);
      }
    }
    
    // 2. Compute if not in cache (Query In-Memory JSON)
    const { getAllStocks } = require('./services/instrumentsCache');
    const stocksArray = getAllStocks();
      
    if (!stocksArray || stocksArray.length === 0) return res.json([]);
      
    const responseData = JSON.stringify(stocksArray);
    
    // 3. Save to Redis (cache for 6 hours)
    if (generalClient && generalClient.isReady) {
      generalClient.set(cacheKey, responseData, { EX: 21600 }).catch(console.error);
    }
    
    res.setHeader('Content-Type', 'application/json');
    res.send(responseData);
  } catch (err) {
    console.error('Stocks API Error:', err);
    res.status(500).json([]);
  }
});

  app.get('/api/stocks/search', async (req, res) => {
    const q = req.query.q;
    if (!q || q.length < 2) return res.json([]);
    
    const qLower = q.toLowerCase();
        try {
        const { generalClient } = require('./services/redisClient');
        const cacheKey = `api:search:v4:${qLower}`;
      
      if (generalClient && generalClient.isReady) {
        const cached = await generalClient.get(cacheKey);
        if (cached) {
          res.setHeader('Content-Type', 'application/json');
          return res.send(cached);
        }
      }

      // 2. Compute if not in cache (Query In-Memory JSON)
      const { searchInstruments } = require('./services/instrumentsCache');
      
      const dbResults = searchInstruments(qLower);

      dbResults.sort((a, b) => {
        const aExact = a.symbol.toLowerCase() === qLower || (a.name && a.name.toLowerCase() === qLower);
        const bExact = b.symbol.toLowerCase() === qLower || (b.name && b.name.toLowerCase() === qLower);
        if (aExact && !bExact) return -1;
        if (!aExact && bExact) return 1;
        
        const aIsCash = (a.exchange === 'NSE' || a.exchange === 'BSE');
        const bIsCash = (b.exchange === 'NSE' || b.exchange === 'BSE');
        if (aIsCash && !bIsCash) return -1;
        if (!aIsCash && bIsCash) return 1;
        
        const aIsFut = a.symbol.includes('FUT');
        const bIsFut = b.symbol.includes('FUT');
        if (aIsFut && !bIsFut) return -1;
        if (!aIsFut && bIsFut) return 1;
        
        // Sorting by length handles "prioritize shorter symbols"
        if (a.symbol.length !== b.symbol.length) return a.symbol.length - b.symbol.length;
        
        return 0;
      });

      const results = dbResults.slice(0, 50).map(item => ({
          token: item.token,
          symbol: item.symbol,
          name: item.name,
          exchange: item.exchange,
          lotsize: item.lotsize,
          expiryTimestamp: item.expiry_timestamp,
          uniqueSymbol: item.unique_symbol || item.symbol,
          searchString: item.search_string
      }));
      
      const responseData = JSON.stringify(results);
      
      if (generalClient && generalClient.isReady) {
        generalClient.set(cacheKey, responseData, { EX: 3600 }).catch(console.error); // 1 hour cache
      }
      
      res.setHeader('Content-Type', 'application/json');
      res.send(responseData);
    } catch (err) {
      console.error('Search API Error:', err);
      res.json([]);
    }
  });

// ─── Auth ───────────────────────────────────────────────────────────────────
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { authenticateToken, JWT_SECRET } = require('./middleware/auth');
const { parseDeviceDetails, parseIpLocation, syncBannedEntities, isIpBanned, isPhoneBanned } = require('./services/deviceSecurity');
const rateLimit = require('express-rate-limit');

// Rate Limiting Config
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 20, // limit each IP to 20 auth requests per windowMs
  message: { error: 'Too many requests from this IP, please try again after 15 minutes' }
});

const orderLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 120, // limit each IP to 120 orders per minute
  message: { error: 'Order rate limit exceeded (max 120/min)' }
});

app.post('/api/auth/profile', authenticateToken, async (req, res) => {
  try {
    const data = req.body;
    
    // Delete existing to avoid conflicts
    await db('user_profiles').where({ user_id: req.user.id }).del();

    // Insert profile data
    await db('user_profiles').insert({
      user_id: req.user.id,
      dob: data.dob,
      gender: data.gender,
      state: data.state,
      city: data.city,
      occupation: data.occupation,
      annual_income: data.annual_income,
      financial_goal: data.financial_goal,
      trading_experience: data.trading_experience,
      preferred_segment: data.preferred_segment,
      trading_style: data.trading_style,
      primary_strategy: data.primary_strategy,
      hear_about_us: data.hear_about_us
    });

    // Update users table to set is_onboarded
    await db('users').where({ id: req.user.id }).update({ is_onboarded: true });

    res.json({ success: true });
  } catch (err) {
    console.error('Error saving profile:', err);
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/auth/register', authLimiter, async (req, res) => {
  const { username, email, phone, password, referral_code } = req.body;
  if (!username || !email || !password || !phone) return res.status(400).json({ error: 'Missing fields' });
  try {
    // Check for existing duplicates
    const existingUser = await db('users')
      .where('email', email)
      .orWhere('phone', phone)
      .orWhere('username', username)
      .first();

    if (existingUser) {
      if (existingUser.email === email) return res.status(400).json({ error: 'An account with this email already exists.' });
      if (existingUser.phone === phone) return res.status(400).json({ error: 'An account with this phone number already exists.' });
      if (existingUser.username === username) return res.status(400).json({ error: 'Username is already taken.' });
    }

    const password_hash = await bcrypt.hash(password, 10);
    const defaultWatchlist = JSON.stringify([{ id: 1, name: 'Watchlist 1', symbols: [] }]);
    
    const clientIp = req.headers['x-forwarded-for'] ? req.headers['x-forwarded-for'].split(',')[0].trim() : (req.socket?.remoteAddress || req.ip || '');
    
    // Check if IP or Phone is banned
    if (await isIpBanned(clientIp, generalClient)) {
      return res.status(403).json({ error: 'Registration blocked: Your IP address has been restricted.' });
    }
    if (await isPhoneBanned(phone, generalClient)) {
      return res.status(403).json({ error: 'Registration blocked: This phone number has been restricted.' });
    }

    const { deviceModel, osName, browserName } = parseDeviceDetails(req.headers['user-agent']);
    const { city, state } = parseIpLocation(clientIp);

    const [id] = await db('users').insert({ 
      username, email, phone, password_hash, watchlists: defaultWatchlist,
      registration_ip: clientIp, last_ip: clientIp,
      device_model: deviceModel, os_name: osName, browser_name: browserName,
      city: city, state: state
    }).returning('id');
    
    // Some db engines return an object from returning(), handle both
    const userId = typeof id === 'object' ? id.id : id;
    
    // Generate Professional Client ID: SE + Base36(userId) padded to 6 chars
    const clientId = 'SE' + Number(userId).toString(36).toUpperCase().padStart(6, '0');
    await db('users').where({ id: userId }).update({ client_id: clientId });
    // Handle Referral Logic
    if (referral_code) {
      try {
        const referrer = await db('users').where({ id: referral_code }).first();
        if (referrer && referrer.id !== userId) {
          await db('referrals').insert({
            referrer_id: referrer.id,
            referred_user_id: userId,
            status: 'pending',
            reward_amount: 0
          });
        }
      } catch (e) {
        console.error('Failed to process referral code', e);
      }
    }


    const token = jwt.sign({ id: userId, username }, JWT_SECRET, { expiresIn: '7d' });
    const isHttps = req.headers['x-forwarded-proto'] === 'https' || req.secure || req.headers['host']?.includes('sslip.io');
    res.cookie('token', token, {
      httpOnly: true,
      secure: isHttps,
      sameSite: isHttps ? 'none' : 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000
    });
    res.json({ success: true, token, user: { id: userId, client_id: clientId, username, balance: 1000000.0, is_onboarded: false, watchlists: JSON.parse(defaultWatchlist), subscription_tier: 'BASIC', subscription_expires: null } });
  } catch (err) {
    const errorMsg = err.message || String(err);
    if (errorMsg.includes('unique')) return res.status(400).json({ error: 'Username or email already exists' });
    
    // If it's a database connection error (like ECONNREFUSED from a missing DATABASE_URL)
    if (errorMsg.includes('ECONNREFUSED') || String(err).includes('ECONNREFUSED')) {
      return res.status(500).json({ error: 'Database not connected. Please add a PostgreSQL database in Railway.' });
    }
    
    res.status(500).json({ error: errorMsg || 'Unknown error occurred during registration' });
  }
});

app.post('/api/auth/pre-login', async (req, res) => {
  const { email, password } = req.body || {};
  if (!email || !password) return res.status(400).json({ error: 'Email and password are required' });
  try {
    const user = await db('users').where({ email }).first();
    if (!user) return res.status(400).json({ error: 'Invalid credentials' });
    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) return res.status(400).json({ error: 'Invalid credentials' });
    if (!user.phone) return res.status(400).json({ error: 'No phone number registered for this account. Please contact support.' });
    res.json({ success: true, phone: user.phone });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/auth/login', authLimiter, async (req, res) => {
  const { email, password } = req.body || {};
  if (!email || !password) return res.status(400).json({ error: 'Email and password are required' });
  try {
    const user = await db('users').where({ email }).first();
    if (!user) return res.status(400).json({ error: 'Invalid credentials' });
    
    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) return res.status(400).json({ error: 'Invalid credentials' });

    const clientIp = req.headers['x-forwarded-for'] ? req.headers['x-forwarded-for'].split(',')[0].trim() : (req.socket?.remoteAddress || req.ip || '');
    
    // Check if IP or Account is banned
    if (await isIpBanned(clientIp, generalClient)) {
      return res.status(403).json({ error: 'Access restricted: Your IP address has been restricted.' });
    }
    if (user.is_banned) {
      return res.status(403).json({ error: 'Your trading account has been suspended by administration.' });
    }

    const { deviceModel, osName, browserName } = parseDeviceDetails(req.headers['user-agent']);
    const { city, state } = parseIpLocation(clientIp);

    await db('users').where({ id: user.id }).update({
      last_ip: clientIp,
      device_model: deviceModel,
      os_name: osName,
      browser_name: browserName,
      city: city,
      state: state
    }).catch(e => console.error('Failed to update user login meta:', e));
    
    const token = jwt.sign({ id: user.id, username: user.username, is_admin: user.is_admin }, JWT_SECRET, { expiresIn: '7d' });
    const watchlists = typeof user.watchlists === 'string' ? JSON.parse(user.watchlists || '[]') : (user.watchlists || []);
    const isHttps = req.headers['x-forwarded-proto'] === 'https' || req.secure || req.headers['host']?.includes('sslip.io');
    res.cookie('token', token, {
      httpOnly: true,
      secure: isHttps,
      sameSite: isHttps ? 'none' : 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000
    });
    res.json({ success: true, token, user: { id: user.id, username: user.username, balance: user.balance || 1000000.0, is_admin: Boolean(user.is_admin), is_onboarded: Boolean(user.is_onboarded), watchlists, subscription_tier: user.subscription_tier || 'BASIC', subscription_expires: user.subscription_expires } });
  } catch (err) {
    const errorMsg = err.message || String(err);
    if (errorMsg.includes('ECONNREFUSED') || String(err).includes('ECONNREFUSED')) {
      return res.status(500).json({ error: 'Database not connected. Please add a PostgreSQL database in Railway.' });
    }
    res.status(500).json({ error: errorMsg || 'Unknown error occurred during login' });
  }
});

// Logout endpoint
app.post('/api/auth/skip-onboarding', authenticateToken, async (req, res) => {
  try {
    await db('users').where({ id: req.user.id }).update({ is_onboarded: true });
    res.json({ success: true });
  } catch (error) {
    console.error('Error skipping onboarding:', error);
    res.status(500).json({ error: 'Failed to skip onboarding' });
  }
});

app.post('/api/auth/logout', (req, res) => {
  const isHttps = req.headers['x-forwarded-proto'] === 'https' || req.secure || req.headers['host']?.includes('sslip.io');
  res.cookie('token', '', { expires: new Date(0), httpOnly: true, sameSite: isHttps ? 'none' : 'lax', secure: isHttps });
  res.json({ success: true });
});

// ─── Forgot Password ────────────────────────────────────────────────────────
app.post('/api/auth/forgot-password', async (req, res) => {
  const { email } = req.body;
  if (!email) return res.status(400).json({ error: 'Email is required' });

  try {
    const user = await db('users').where({ email }).first();
    if (!user) return res.status(404).json({ error: 'No account found with this email' });

    // Generate 6 digit OTP
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const expires = new Date(Date.now() + 15 * 60000); // 15 minutes

    await db('users').where({ id: user.id }).update({
      reset_otp: otp,
      reset_otp_expires: expires
    });

    // Send via EmailJS REST API
    const emailData = {
      service_id: 'service_apextrade',
      template_id: 'template_qfe0n8c',
      user_id: '5l4SSMcquuPO_XGId',
      accessToken: 'f0eGuMIvDNCxPoAf5CeZD',
      template_params: {
        otp: otp,
        otp_code: otp,
        to_email: email,
        user_email: email,
        email: email
      }
    };

    const response = await fetch('https://api.emailjs.com/api/v1.0/email/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(emailData)
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error('EmailJS Error:', errText);
      return res.status(500).json({ error: `Failed to send email: ${errText}` });
    }

    res.json({ success: true, message: 'OTP sent to email' });
  } catch (error) {
    console.error('Forgot Password Error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ─── Reset Password ─────────────────────────────────────────────────────────
app.post('/api/auth/reset-password', async (req, res) => {
  const { email, otp, newPassword } = req.body;
  if (!email || !otp || !newPassword) return res.status(400).json({ error: 'All fields required' });

  try {
    const user = await db('users').where({ email }).first();
    if (!user) return res.status(404).json({ error: 'User not found' });

    if (user.reset_otp !== otp) {
      return res.status(400).json({ error: 'Invalid OTP' });
    }
    
    if (new Date() > new Date(user.reset_otp_expires)) {
      return res.status(400).json({ error: 'OTP has expired' });
    }

    const password_hash = await bcrypt.hash(newPassword, 10);
    await db('users').where({ id: user.id }).update({
      password_hash,
      reset_otp: null,
      reset_otp_expires: null
    });

    res.json({ success: true, message: 'Password has been reset' });
  } catch (error) {
    console.error('Reset Password Error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ─── User ─────────────────────────────────────────────────────────────────

app.get('/api/debug-db', async (req, res) => {
    try {
        const columns = await db('users').columnInfo();
        res.json(columns);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

app.get('/api/user', authenticateToken, async (req, res) => {
  try {
    const user = await db('users').where({ id: req.user.id }).first();
    if (!user) return res.status(404).json({ error: 'User not found' });
    delete user.password_hash;
    if (typeof user.watchlists === 'string') user.watchlists = JSON.parse(user.watchlists);
    user.balance = parseFloat(user.balance || 0);
    user.is_admin = Boolean(user.is_admin);
    user.is_onboarded = Boolean(user.is_onboarded);
    res.json(user);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/user/profile_picture', authenticateToken, async (req, res) => {
  try {
    const { profile_picture_url } = req.body;
    await db('users').where({ id: req.user.id }).update({ profile_picture_url });
    res.json({ success: true, profile_picture_url });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── Razorpay Payment Integration ───────────────────────────────────────────
const Razorpay = require('razorpay');
const crypto = require('crypto');

const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID || 'rzp_test_placeholder',
  key_secret: process.env.RAZORPAY_KEY_SECRET || 'secret_placeholder'
});

app.post('/api/payment/create-order', authenticateToken, async (req, res) => {
  try {
    const { plan } = req.body || {};
    let amount = 999 * 100;
    if (plan === 'monthly') amount = 99 * 100;
    else if (plan === 'yearly') amount = 499 * 100;
    
    const options = {
      amount,
      currency: "INR",
      receipt: "receipt_order_" + req.user.id + "_" + Date.now()
    };
    const order = await razorpay.orders.create(options);
    res.json({ ...order, key_id: process.env.RAZORPAY_KEY_ID || 'rzp_test_placeholder' });
  } catch (error) {
    const errMsg = error.error ? error.error.description : (error.message || 'Unknown error');
    res.status(500).json({ error: 'Razorpay API Rejected: ' + errMsg });
  }
});

app.post('/api/payment/create-subscription', authenticateToken, async (req, res) => {
  try {
    const { plan } = req.body || {};
    
    // These must be created in Razorpay Dashboard -> Subscriptions -> Plans
    const planId = plan === 'monthly' ? (process.env.RAZORPAY_PLAN_ID_MONTHLY || 'plan_placeholder_monthly') : (process.env.RAZORPAY_PLAN_ID_YEARLY || 'plan_placeholder_yearly');

    if (planId.includes('placeholder')) {
      console.warn('WARNING: Using placeholder Plan ID. Real Razorpay recurring payments will fail until you configure RAZORPAY_PLAN_ID_MONTHLY in .env');
    }

    // 7 days from now in Unix timestamp
    const startAt = Math.floor(Date.now() / 1000) + (7 * 24 * 60 * 60);

    const options = {
      plan_id: planId,
      customer_notify: 1,
      total_count: plan === 'monthly' ? 120 : 10, // Max billing cycles (10 years)
      start_at: startAt, // This creates the 7-day free trial delay
    };

    const subscription = await razorpay.subscriptions.create(options);
    res.json({ subscription_id: subscription.id, key_id: process.env.RAZORPAY_KEY_ID || 'rzp_test_placeholder' });
  } catch (error) {
    const errMsg = error.error ? error.error.description : (error.message || 'Unknown error');
    res.status(500).json({ error: 'Razorpay API Rejected: ' + errMsg });
  }
});

app.post('/api/payment/verify', authenticateToken, async (req, res) => {
  try {
    const { razorpay_order_id, razorpay_subscription_id, razorpay_payment_id, razorpay_signature, plan } = req.body;
    // For subscriptions, Razorpay generates signature using payment_id + '|' + subscription_id
    // For normal orders, it uses order_id + '|' + payment_id
    let body = razorpay_order_id + "|" + razorpay_payment_id;
    if (razorpay_subscription_id) {
      body = razorpay_payment_id + "|" + razorpay_subscription_id;
    }
    
    const expectedSignature = crypto
      .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET || 'secret_placeholder')
      .update(body.toString())
      .digest('hex');
      
    const isAuthentic = expectedSignature === razorpay_signature;
    if (isAuthentic) {
      const expires = new Date();
      if (plan === 'monthly') {
        expires.setMonth(expires.getMonth() + 1);
      } else {
        expires.setFullYear(expires.getFullYear() + 1);
      }
      
      await db('users').where({ id: req.user.id }).update({
        subscription_tier: 'PRO',
        subscription_expires: expires
        });

        // --- Referral Reward Logic ---
        try {
          const pendingRef = await db('referrals')
            .where({ referred_user_id: req.user.id, status: 'pending' })
            .first();

          if (pendingRef) {
            const rewardAmount = plan === 'monthly' ? 9.9 : 49.9;
            
            // Mark as completed
            await db('referrals')
              .where({ id: pendingRef.id })
              .update({ status: 'completed', reward_amount: rewardAmount });
            
            // Credit referrer
            await db('users')
              .where({ id: pendingRef.referrer_id })
              .increment('balance', rewardAmount);
          }
        } catch (e) {
          console.error('Failed to process referral reward', e);
        }
        // -----------------------------

        res.json({ success: true, message: 'Upgraded to PRO successfully!' });
    } else {
      res.status(400).json({ error: 'Invalid Payment Signature' });
    }
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ─── Analytics ─────────────────────────────────────────────────────────────
app.get('/api/analytics', authenticateToken, async (req, res) => {
  try {
    const orders = await db('orders')
      .where({ user_id: req.user.id })
      .whereNot('realized_pnl', 0)
      .orderBy('created_at', 'asc');
      
    let totalTrades = orders.length;
    let winningTrades = 0;
    let losingTrades = 0;
    let totalProfit = 0;
    let totalLoss = 0;
    
    // Group by Date for Equity Curve
    const dailyPnL = {};
    
    orders.forEach(o => {
       const pnl = parseFloat(o.realized_pnl);
       if (pnl > 0) {
          winningTrades++;
          totalProfit += pnl;
       } else {
          losingTrades++;
          totalLoss += Math.abs(pnl);
       }
       
       const date = new Date(o.created_at).toLocaleDateString('en-CA'); // YYYY-MM-DD local
       if (!dailyPnL[date]) dailyPnL[date] = 0;
       dailyPnL[date] += pnl;
    });
    
    const winRate = totalTrades > 0 ? (winningTrades / totalTrades) * 100 : 0;
    const avgWinner = winningTrades > 0 ? totalProfit / winningTrades : 0;
    const avgLoser = losingTrades > 0 ? totalLoss / losingTrades : 0;
    
    let cumulative = 0;
    const equityCurve = Object.keys(dailyPnL).sort().map(date => {
       cumulative += dailyPnL[date];
       return { date, pnl: dailyPnL[date], cumulative };
    });

    res.json({
       totalTrades,
       winningTrades,
       losingTrades,
       winRate: winRate.toFixed(1),
       avgWinner: avgWinner.toFixed(2),
       avgLoser: avgLoser.toFixed(2),
       equityCurve,
       recentTrades: orders.slice(-50).reverse() // Last 50 trades for the log
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/user/details', authenticateToken, async (req, res) => {
  try {
    const { phone, pan_card, aadhar_number } = req.body;
    await db('users').where({ id: req.user.id }).update({ phone, pan_card, aadhar_number });
    res.json({ success: true, phone, pan_card, aadhar_number });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/user/kyc', authenticateToken, async (req, res) => {
  try {
    const { kyc_pan_url, kyc_aadhar_url } = req.body;
    await db('users').where({ id: req.user.id }).update({ kyc_pan_url, kyc_aadhar_url });
    res.json({ success: true, kyc_pan_url, kyc_aadhar_url });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/user/password', authenticateToken, async (req, res) => {
  try {
    const { oldPassword, newPassword } = req.body;
    const bcrypt = require('bcrypt');
    
    const user = await db('users').where({ id: req.user.id }).first();
    if (!user) return res.status(404).json({ error: 'User not found' });
    
    const valid = await bcrypt.compare(oldPassword, user.password_hash);
    if (!valid) return res.status(400).json({ error: 'Incorrect old password' });
    
    const newHash = await bcrypt.hash(newPassword, 10);
    await db('users').where({ id: req.user.id }).update({ password_hash: newHash });
    
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/wallet/deposit', authenticateToken, async (req, res) => {
  try {
    const { amount } = req.body;
    if (!amount || amount <= 0) return res.status(400).json({ error: 'Invalid amount' });
    
    await db('deposit_requests').insert({
      user_id: req.user.id,
      amount: Number(amount),
      status: 'PENDING'
    });
    
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── Admin ────────────────────────────────────────────────────────────────

app.post('/api/admin/users/:id/toggle_ban', authenticateToken, async (req, res) => {
  try {
    const db = require('./database/db');
    const caller = await db('users').where({ id: req.user.id }).first();
    if (!caller.is_admin) return res.status(403).json({ error: 'Admin access required' });

    const targetUserId = req.params.id;
    const targetUser = await db('users').where({ id: targetUserId }).first();
    
    if (!targetUser) return res.status(404).json({ error: 'User not found' });
    if (targetUser.is_admin) return res.status(403).json({ error: 'Cannot ban another admin' });

    const newStatus = !targetUser.is_banned;
    await db('users').where({ id: targetUserId }).update({ is_banned: newStatus });
    
    res.json({ success: true, message: 'User status updated', is_banned: newStatus });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});


app.get('/api/admin/telemetry', authenticateToken, async (req, res) => {
    try {
        const caller = await db('users').where({ id: req.user.id }).first();
        if (!caller || !caller.is_admin) return res.status(403).json({ error: 'Unauthorized' });

        const { generalClient } = require('./services/redisClient');
        if (!generalClient || !generalClient.isReady) return res.json({ api: [], users: [] });

        const tf = req.query.timeframe || 'all';
        let minutes = 0;
        const match = tf.match(/^(\d+)([mh])$/);
        if (match) {
            const val = parseInt(match[1], 10);
            minutes = match[2] === 'h' ? val * 60 : val;
        }

        if (minutes === 0 || tf === 'all') {
            // Cumulative All-Time Stats
            const apiKeys = await generalClient.keys('telemetry:api:*');
            const userKeys = await generalClient.keys('telemetry:user:*');

            const apiStats = [];
            for (const k of apiKeys) {
                const data = await generalClient.hGetAll(k);
                apiStats.push({
                    route: k.replace('telemetry:api:', ''),
                    count: parseInt(data.count || 0),
                    totalTime: parseInt(data.time_ms || 0),
                    totalBytes: parseInt(data.bytes || 0)
                });
            }

            const userStats = [];
            for (const k of userKeys) {
                const userId = k.replace('telemetry:user:', '');
                const data = await generalClient.hGetAll(k);
                const dbUser = await db('users').where({ id: userId }).first();
                userStats.push({
                    userId,
                    username: dbUser ? dbUser.username : 'Unknown',
                    apiCalls: parseInt(data.api_calls || 0),
                    apiBytes: parseInt(data.api_bytes || 0),
                    wsMinutes: parseInt(data.ws_minutes || 0)
                });
            }
            return res.json({ api: apiStats, users: userStats, timeframe: 'all' });
        } else {
            // Timeframe / Minute-Bucket Aggregation
            const now = Date.now();
            const targetBuckets = new Set();
            const pad = (n) => String(n).padStart(2, '0');
            for (let i = 0; i < minutes; i++) {
                const d = new Date(now - i * 60 * 1000);
                const bucket = `${d.getUTCFullYear()}${pad(d.getUTCMonth()+1)}${pad(d.getUTCDate())}${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}`;
                targetBuckets.add(bucket);
            }

            const mbKeys = await generalClient.keys('telemetry:mb:*');
            const validKeys = [];
            for (const k of mbKeys) {
                const parts = k.split(':');
                if (parts.length >= 5 && targetBuckets.has(parts[2])) {
                    validKeys.push({ key: k, type: parts[3], identifier: parts.slice(4).join(':') });
                }
            }

            const pipeline = generalClient.multi();
            validKeys.forEach(vk => pipeline.hGetAll(vk.key));
            const results = validKeys.length > 0 ? await pipeline.exec() : [];

            const apiMap = {};
            const userMap = {};

            validKeys.forEach((vk, idx) => {
                const data = results[idx] || {};
                if (vk.type === 'api') {
                    if (!apiMap[vk.identifier]) apiMap[vk.identifier] = { route: vk.identifier, count: 0, totalTime: 0, totalBytes: 0 };
                    apiMap[vk.identifier].count += parseInt(data.count || 0, 10);
                    apiMap[vk.identifier].totalTime += parseInt(data.time_ms || 0, 10);
                    apiMap[vk.identifier].totalBytes += parseInt(data.bytes || 0, 10);
                } else if (vk.type === 'user') {
                    if (!userMap[vk.identifier]) userMap[vk.identifier] = { userId: vk.identifier, apiCalls: 0, apiBytes: 0, apiTimeMs: 0, wsMinutes: 0 };
                    userMap[vk.identifier].apiCalls += parseInt(data.api_calls || 0, 10);
                    userMap[vk.identifier].apiTimeMs += parseInt(data.api_time_ms || 0, 10);
                    userMap[vk.identifier].apiBytes += parseInt(data.api_bytes || 0, 10);
                }
            });

            const apiStats = Object.values(apiMap);
            const userStats = [];
            for (const u of Object.values(userMap)) {
                const dbUser = await db('users').where({ id: u.userId }).first();
                userStats.push({
                    userId: u.userId,
                    username: dbUser ? dbUser.username : 'Unknown',
                    apiCalls: u.apiCalls,
                    apiBytes: u.apiBytes,
                    wsMinutes: u.wsMinutes
                });
            }

            return res.json({ api: apiStats, users: userStats, timeframe: tf });
        }
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Failed to fetch telemetry' });
    }
});

app.post('/api/admin/telemetry/reset', authenticateToken, async (req, res) => {
    try {
        const caller = await db('users').where({ id: req.user.id }).first();
        if (!caller || !caller.is_admin) return res.status(403).json({ error: 'Unauthorized' });

        const { generalClient } = require('./services/redisClient');
        if (!generalClient || !generalClient.isReady) return res.status(503).json({ error: 'Redis offline' });

        const keys = await generalClient.keys('telemetry:*');
        if (keys.length > 0) {
            await generalClient.del(keys);
        }
        res.json({ success: true, message: 'Telemetry metrics reset successfully' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Failed to reset telemetry' });
    }
});

app.post('/api/admin/master_square_off', authenticateToken, async (req, res) => {
  try {
    const caller = await db('users').where({ id: req.user.id }).first();
    if (!caller.is_admin) return res.status(403).json({ error: 'Admin access required' });

    const { runMasterSquareOff } = require('./services/autoSquareOff');
    // Run it asynchronously in the background so it doesn't block the request if there are thousands of positions
    runMasterSquareOff().catch(e => console.error("Master square off failed:", e));
    
    res.json({ success: true, message: 'Master Square-Off initiated in the background' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/admin/users', authenticateToken, async (req, res) => {
  try {
    const caller = await db('users').where({ id: req.user.id }).first();
    if (!caller || !caller.is_admin) return res.status(403).json({ error: 'Unauthorized' });

    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 50;
    const offset = (page - 1) * limit;
    const search = req.query.search || '';

    let query = db('users').leftJoin('user_profiles', 'users.id', 'user_profiles.user_id');
    let countQuery = db('users');

    if (search) {
      query = query.where('users.username', 'ilike', `%${search}%`)
                   .orWhere('users.email', 'ilike', `%${search}%`)
                   .orWhere('users.client_id', 'ilike', `%${search}%`);
                   
      countQuery = countQuery.where('username', 'ilike', `%${search}%`)
                             .orWhere('email', 'ilike', `%${search}%`)
                             .orWhere('client_id', 'ilike', `%${search}%`);
    }

    const [countResult] = await countQuery.count('id as total');
    const total = countResult ? parseInt(countResult.total) : 0;

    const rawUsers = await query
      .select('users.id', 'users.client_id', 'users.username', 'users.email', 'users.balance', 'users.is_banned', 'users.phone', 'users.pan_card', 'users.aadhar_number', 'users.kyc_pan_url', 'users.kyc_aadhar_url', 'users.is_admin', 'users.created_at', 'users.last_ip', 'users.registration_ip', 'users.device_model', 'users.os_name', 'users.browser_name', 'users.city', 'users.state', 'user_profiles.dob', 'user_profiles.gender', 'user_profiles.state', 'user_profiles.city', 'user_profiles.occupation', 'user_profiles.annual_income', 'user_profiles.financial_goal', 'user_profiles.trading_experience', 'user_profiles.preferred_segment', 'user_profiles.trading_style')
      .orderBy('users.created_at', 'desc')
      .limit(limit)
      .offset(offset);

    // Group users by IP to detect multi-account fraud across all users
    const ipCounts = await db('users')
      .whereNotNull('last_ip')
      .whereNot('last_ip', '')
      .groupBy('last_ip')
      .select('last_ip')
      .count('id as count');

    const ipMap = {};
    ipCounts.forEach(r => {
      ipMap[r.last_ip] = parseInt(r.count, 10);
    });

    const enhancedUsers = [];
    for (const u of rawUsers) {
      const ip = u.last_ip || u.registration_ip;
      const sharedCount = ip ? (ipMap[ip] || 1) : 1;
      let sharedUsers = [];
      if (sharedCount > 1 && ip) {
        const matching = await db('users')
          .where(function() {
            this.where('last_ip', ip).orWhere('registration_ip', ip);
          })
          .whereNot('id', u.id)
          .select('id', 'username')
          .limit(5);
        sharedUsers = matching.map(m => m.username);
      }
      enhancedUsers.push({
        ...u,
        shared_ip_count: sharedCount,
        shared_users: sharedUsers
      });
    }

    res.json({ users: enhancedUsers, total, page, totalPages: Math.ceil(total / limit) });
  } catch (err) {
    console.error("Admin Users Error:", err);
    res.status(500).json({ error: err.message });
  }
});

app.put('/api/admin/user/:id', authenticateToken, async (req, res) => {
  try {
    const caller = await db('users').where({ id: req.user.id }).first();
    if (!caller || !caller.is_admin) return res.status(403).json({ error: 'Unauthorized' });

    const targetUserId = req.params.id;
    const { username, email, phone } = req.body;
    
    const updates = {};
    if (username !== undefined) updates.username = username;
    if (email !== undefined) updates.email = email;
    if (phone !== undefined) updates.phone = phone;

    if (Object.keys(updates).length > 0) {
      await db('users').where({ id: targetUserId }).update(updates);
    }
    
    res.json({ message: 'User updated successfully' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/admin/user/:id/reset', authenticateToken, async (req, res) => {
  try {
    const caller = await db('users').where({ id: req.user.id }).first();
    if (!caller.is_admin) return res.status(403).json({ error: 'Unauthorized' });

    const targetUserId = req.params.id;
    await db.transaction(async (trx) => {
      await trx('orders').where({ user_id: targetUserId }).del();
      await trx('positions').where({ user_id: targetUserId }).del();
      await trx('ledger').where({ user_id: targetUserId }).del();
      await trx('users').where({ id: targetUserId }).update({ balance: 1000000.0 });
    });
    res.json({ success: true, message: 'User account reset to ₹10,00,000.' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to reset user' });
  }
});

// 🗑️ Delete User Account (Admin only)
app.delete('/api/admin/user/:id', authenticateToken, async (req, res) => {
  try {
    const caller = await db('users').where({ id: req.user.id }).first();
    if (!caller || !caller.is_admin) return res.status(403).json({ error: 'Unauthorized' });

    const targetUserId = req.params.id;

    // Prevent admin from deleting themselves
    if (String(targetUserId) === String(req.user.id)) {
      return res.status(400).json({ error: 'Cannot delete your own admin account.' });
    }

    await db.transaction(async (trx) => {
      await trx('orders').where({ user_id: targetUserId }).del();
      await trx('positions').where({ user_id: targetUserId }).del();
      await trx('ledger').where({ user_id: targetUserId }).del();
      await trx('holdings').where({ user_id: targetUserId }).del().catch(() => {});
      await trx('sips').where({ user_id: targetUserId }).del().catch(() => {});
      await trx('deposit_requests').where({ user_id: targetUserId }).del().catch(() => {});
      await trx('user_profiles').where({ user_id: targetUserId }).del().catch(() => {});
      await trx('users').where({ id: targetUserId }).del();
    });

    res.json({ success: true, message: 'User account permanently deleted.' });
  } catch (err) {
    console.error('Delete User Error:', err);
    res.status(500).json({ error: 'Failed to delete user account: ' + (err.message || String(err)) });
  }
});

app.post('/api/admin/user/:id/subscription', authenticateToken, async (req, res) => {
  try {
    const admin = await db('users').where({ id: req.user.id }).first();
    if (!admin || !admin.is_admin) return res.status(403).json({ error: 'Unauthorized' });

    const { tier, expires } = req.body;
    await db('users').where({ id: req.params.id }).update({
      subscription_tier: tier,
      subscription_expires: expires || null
    });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/admin/user/:id/balance', authenticateToken, async (req, res) => {
  try {
    const caller = await db('users').where({ id: req.user.id }).first();
    if (!caller || !caller.is_admin) return res.status(403).json({ error: 'Unauthorized' });

    const { balance } = req.body;
    if (balance === undefined) return res.status(400).json({ error: 'Balance required' });

    await db('users').where({ id: req.params.id }).update({ balance: Number(balance) });
    res.json({ success: true, balance: Number(balance) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/admin/deposits', authenticateToken, async (req, res) => {
  try {
    const caller = await db('users').where({ id: req.user.id }).first();
    if (!caller || !caller.is_admin) return res.status(403).json({ error: 'Unauthorized' });

    const deposits = await db('deposit_requests')
      .join('users', 'deposit_requests.user_id', 'users.id')
      .select('deposit_requests.*', 'users.username', 'users.email')
      .orderBy('deposit_requests.created_at', 'desc');
      
    res.json({ success: true, deposits });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/admin/deposits/:id/approve', authenticateToken, async (req, res) => {
  try {
    const caller = await db('users').where({ id: req.user.id }).first();
    if (!caller || !caller.is_admin) return res.status(403).json({ error: 'Unauthorized' });

    await db.transaction(async trx => {
      const deposit = await trx('deposit_requests').where({ id: req.params.id }).first();
      if (!deposit || deposit.status !== 'PENDING') throw new Error('Invalid deposit request');
      
      await trx('deposit_requests').where({ id: deposit.id }).update({ status: 'APPROVED' });
      await trx('users').where({ id: deposit.user_id }).increment('balance', deposit.amount);
      
      await trx('ledger').insert({
          user_id: deposit.user_id,
          amount: deposit.amount,
          type: 'DEPOSIT',
          description: `Deposit Approved (ID: ${deposit.id})`
      });
    });
    
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/admin/deposits/:id/reject', authenticateToken, async (req, res) => {
  try {
    const caller = await db('users').where({ id: req.user.id }).first();
    if (!caller || !caller.is_admin) return res.status(403).json({ error: 'Unauthorized' });

    const deposit = await db('deposit_requests').where({ id: req.params.id }).first();
    if (!deposit || deposit.status !== 'PENDING') return res.status(400).json({ error: 'Invalid deposit request' });
    
    await db('deposit_requests').where({ id: deposit.id }).update({ status: 'REJECTED' });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/admin/analytics', authenticateToken, async (req, res) => {
  try {
    const caller = await db('users').where({ id: req.user.id }).first();
    if (!caller || !caller.is_admin) return res.status(403).json({ error: 'Unauthorized' });

    // 1. Total AUM (Sum of all user balances)
    const { sum: totalAumRow } = await db('users').sum('balance as sum').first();
    const totalAum = parseFloat(totalAumRow || 0);

    // 2. Today's Volume and Realized P&L
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const todayOrders = await db('orders')
      .where('status', 'EXECUTED')
      .andWhere('created_at', '>=', today);

    let todayVolume = 0;
    let todayRealizedPnl = 0;
    const symbolVolume = {};

    todayOrders.forEach(o => {
      const vol = Math.abs(parseFloat(o.quantity)) * parseFloat(o.average_price || o.price);
      todayVolume += vol;
      
      const pnl = parseFloat(o.realized_pnl || 0);
      todayRealizedPnl += pnl;

      if (!symbolVolume[o.symbol]) symbolVolume[o.symbol] = 0;
      symbolVolume[o.symbol] += vol;
    });

    // 3. Top Traded Symbols
    const topSymbols = Object.entries(symbolVolume)
      .map(([symbol, volume]) => ({ symbol, volume }))
      .sort((a, b) => b.volume - a.volume)
      .slice(0, 5);

    // 4. All Open Positions (Frontend will calculate Unrealized P&L using live prices)
    const openPositions = await db('positions').where('quantity', '!=', 0);

    res.json({
      success: true,
      totalAum,
      todayVolume,
      todayRealizedPnl,
      topSymbols,
      openPositions
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/admin/orders', authenticateToken, async (req, res) => {
  try {
    const caller = await db('users').where({ id: req.user.id }).first();
    if (!caller || !caller.is_admin) return res.status(403).json({ error: 'Unauthorized' });
    
    const orders = await db('orders')
      .join('users', 'orders.user_id', '=', 'users.id')
      .select('orders.*', 'users.username', 'users.email')
      .orderBy('orders.created_at', 'desc')
      .limit(100);
    res.json({ success: true, orders });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/admin/positions', authenticateToken, async (req, res) => {
  try {
    const caller = await db('users').where({ id: req.user.id }).first();
    if (!caller || !caller.is_admin) return res.status(403).json({ error: 'Unauthorized' });
    
    const positions = await db('positions')
      .join('users', 'positions.user_id', '=', 'users.id')
      .select('positions.*', 'users.username', 'users.email')
      .where('positions.quantity', '!=', 0)
      .orderBy('positions.id', 'desc');
    res.json({ success: true, positions });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/admin/ledger', authenticateToken, async (req, res) => {
  try {
    const caller = await db('users').where({ id: req.user.id }).first();
    if (!caller || !caller.is_admin) return res.status(403).json({ error: 'Unauthorized' });
    
    const ledger = await db('ledger')
      .join('users', 'ledger.user_id', '=', 'users.id')
      .select('ledger.*', 'users.username', 'users.email')
      .orderBy('ledger.created_at', 'desc')
      .limit(100);
    res.json({ success: true, ledger });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/admin/force-close', authenticateToken, async (req, res) => {
  try {
    const caller = await db('users').where({ id: req.user.id }).first();
    if (!caller || !caller.is_admin) return res.status(403).json({ error: 'Unauthorized' });
    
    const { positionId } = req.body;
    const position = await db('positions').where({ id: positionId }).first();
    
    if (!position || position.quantity === 0) {
      return res.status(400).json({ error: 'Position not found or already closed' });
    }

    // Simulate a MARKET order to close the position
    const side = position.quantity > 0 ? 'SELL' : 'BUY';
    const quantity = Math.abs(position.quantity);
    
    // We don't execute it right away, we just insert a market order. 
    // The order execution logic runs periodically, or we can just mock it here directly.
    // To be safe and reuse exact P&L logic, we will just insert it as a MARKET order 
    // and let the orderExecutor pick it up in the next 1-second tick!
    
    const orderPayload = {
      user_id: position.user_id,
      symbol: position.symbol,
      type: 'MARKET',
      side: side,
      quantity: quantity,
      product_type: position.product_type,
      status: 'PENDING'
    };
    
    const [orderId] = await db('orders').insert(orderPayload).returning('id');
    const finalOrderId = typeof orderId === 'object' ? orderId.id : orderId;
    orderPayload.id = finalOrderId;

    const triggerEngine = require('./services/triggerEngine');
    triggerEngine.executeOrder(orderPayload, priceCache[position.symbol]?.ltp || 0).catch(console.error);

    res.json({ success: true, message: 'Force close order placed', orderId: finalOrderId });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/user/watchlists', authenticateToken, async (req, res) => {
  try {
    const { watchlists } = req.body;
    
    // Check subscription tier
    const user = await db('users').where({ id: req.user.id }).first();
    const isPro = user.subscription_tier === 'PRO' && (!user.subscription_expires || new Date(user.subscription_expires) > new Date());
    const limit = isPro ? 5 : 3;
    
    if (watchlists && watchlists.length > limit) {
      return res.status(403).json({ error: `Your ${isPro ? 'PRO' : 'BASIC'} plan allows a maximum of ${limit} watchlists. Please upgrade to add more.` });
    }

    await db('users').where({ id: req.user.id }).update({ watchlists: JSON.stringify(watchlists) });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── Reset Account ──────────────────────────────────────────────────────────
app.post('/api/user/reset', authenticateToken, async (req, res) => {
  try {
    await db.transaction(async (trx) => {
      // 1. Nullify self-referencing FK links first so the batch delete doesn't
      //    trip the orders.linked_order_id / parent_order_id constraints.
      await trx('orders').where({ user_id: req.user.id }).update({ linked_order_id: null, parent_order_id: null });
      // 2. Delete all trades (orders)
      await trx('orders').where({ user_id: req.user.id }).del();
      // 3. Delete all holdings/positions
      await trx('positions').where({ user_id: req.user.id }).del();
      // 4. Clear holdings table if it exists (T+1 delivery inventory)
      const hasHoldings = await trx.schema.hasTable('holdings');
      if (hasHoldings) {
        await trx('holdings').where({ user_id: req.user.id }).del();
      }
      // 5. Delete ledger history
      await trx('ledger').where({ user_id: req.user.id }).del();
      // 6. Reset balance to 10 Lakh (1,000,000)
      await trx('users').where({ id: req.user.id }).update({ balance: 1000000.0 });
    });
    res.json({ success: true, message: 'Account successfully reset to ₹10,00,000.' });
  } catch (err) {
    console.error('Reset Account Error:', err);
    res.status(500).json({ error: 'Failed to reset account' });
  }
});

// ─── Positions ────────────────────────────────────────────────────────────
app.get('/api/positions', authenticateToken, async (req, res) => {
  try {
    const positions = await db('positions').where({ user_id: req.user.id });
    const formatted = positions.map(p => ({
      ...p,
      quantity: Number(p.quantity),
      closed_quantity: Number(p.closed_quantity || 0),
      average_price: Number(p.average_price || 0),
      exit_price: p.exit_price !== null && p.exit_price !== undefined ? Number(p.exit_price) : null,
      margin: Number(p.margin || 0),
      realized_pnl: Number(p.realized_pnl || 0)
    }));
    res.json(formatted);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── Holdings ─────────────────────────────────────────────────────────────
app.get('/api/holdings', authenticateToken, async (req, res) => {
  try {
    // BUG FIX: Filter zero-qty holdings in SQL, not in JS after fetching
    const holdings = await db('holdings')
      .where({ user_id: req.user.id })
      .whereNot({ quantity: 0 })
      .orderBy('id', 'desc');

    // Auto-align legacy MF holdings (EDEL, MIRA, NIPP) with real AMFI NAVs and calculate correct units
    const LEGACY_FIX_MAP = {
      'EDEL-MF': { code: '118615', fallbackNav: 61.66 },
      'EDEL':    { code: '118615', fallbackNav: 61.66 },
      'MIRA-MF': { code: '118825', fallbackNav: 126.99 },
      'MIRA':    { code: '118825', fallbackNav: 126.99 },
      'NIPP-MF': { code: '118778', fallbackNav: 209.96 },
      'NIPP':    { code: '118778', fallbackNav: 209.96 }
    };

    for (const h of holdings) {
      if (LEGACY_FIX_MAP[h.symbol] && Math.round(Number(h.average_price)) === 100) {
        const item = LEGACY_FIX_MAP[h.symbol];
        const realNav = priceCache[h.symbol]?.ltp || item.fallbackNav;
        const invested = Number(h.quantity) * Number(h.average_price);
        const correctedQty = parseFloat((invested / realNav).toFixed(4));
        h.average_price = realNav;
        h.quantity = correctedQty;
        db('holdings').where({ id: h.id }).update({ average_price: realNav, quantity: correctedQty }).catch(() => {});
      }
    }

    res.json(holdings);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── ADMIN CLEANUP ENDPOINT ───────────────────────────────────────────────
app.get('/api/cleanup-expired', async (req, res) => {
  try {
    const patterns = ['%24JUL%', '%SENSEX2672377700%', '%NATURALGAS24JUL%'];
    const results = [];
    
    for (const pattern of patterns) {
        // Find them first
        const pendingOrders = await db('orders').where('symbol', 'like', pattern).whereIn('status', ['PENDING', 'PENDING_TRIGGER']);
        const stuckPositions = await db('positions').where('symbol', 'like', pattern);
        const stuckHoldings = await db('holdings').where('symbol', 'like', pattern);
        
        // Refund margin for orders
        for (const order of pendingOrders) {
            const user = await db('users').where({ id: order.user_id }).first();
            if (user && !isNaN(parseFloat(order.margin)) && parseFloat(order.margin) > 0) {
                await db('users').where({ id: order.user_id }).update({ balance: parseFloat(user.balance) + parseFloat(order.margin) });
            }
        }
        
        // Refund value for positions
        for (const pos of stuckPositions) {
            const user = await db('users').where({ id: pos.user_id }).first();
            if (user) {
                const refundAmt = Math.abs(pos.quantity) * (parseFloat(pos.average_price) || 0);
                await db('users').where({ id: pos.user_id }).update({ balance: parseFloat(user.balance) + refundAmt });
            }
        }
        
        // Delete them
        const delO = await db('orders').where('symbol', 'like', pattern).del();
        const delP = await db('positions').where('symbol', 'like', pattern).del();
        const delH = await db('holdings').where('symbol', 'like', pattern).del();
        
        results.push({
            pattern,
            found: { orders: pendingOrders.length, positions: stuckPositions.length, holdings: stuckHoldings.length },
            deleted: { orders: delO, positions: delP, holdings: delH }
        });
    }
    
    res.json({ success: true, results });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message, stack: err.stack });
  }
});

// ─── Convert Position (INT <-> DEL) ───────────────────────────────────────
app.post('/api/position/convert', authenticateToken, async (req, res) => {
  const { positionId, newProductType, requiredMargin } = req.body;
  if (!positionId || !newProductType) {
    return res.status(400).json({ error: 'Missing required fields' });
  }
  
  try {
    await db.transaction(async (trx) => {
      const position = await trx('positions').where({ id: positionId, user_id: req.user.id }).first();
      if (!position) return res.status(404).json({ error: 'Position not found' });
      if (position.product_type === newProductType) {
        return res.status(400).json({ error: 'Position is already in the requested product type' });
      }

      // If converting INT -> DEL, we must charge the remaining margin
      if (position.product_type === 'INT' && newProductType === 'DEL') {
        const user = await trx('users').where({ id: req.user.id }).first();
        if (parseFloat(user.balance) < requiredMargin) {
          throw new Error('Insufficient Funds to convert to Delivery');
        }
        await trx('users').where({ id: req.user.id }).update({ balance: parseFloat(user.balance) - requiredMargin });
      }

      // If converting DEL -> INT, we refund the 3x margin
      if (position.product_type === 'DEL' && newProductType === 'INT') {
        const user = await trx('users').where({ id: req.user.id }).first();
        const refund = requiredMargin; // the frontend passes the amount to refund
        await trx('users').where({ id: req.user.id }).update({ balance: parseFloat(user.balance) + refund });
      }

      // Update position product type
      await trx('positions').where({ id: positionId }).update({ product_type: newProductType });
      
      // Try to merge positions if there's already an existing position for the same symbol + product_type
      const existingPos = await trx('positions').where({ user_id: req.user.id, symbol: position.symbol, product_type: newProductType }).whereNot('id', positionId).first();
      if (existingPos) {
        // Merge them
        const newQty = existingPos.quantity + position.quantity;
        const newAvg = ((existingPos.quantity * parseFloat(existingPos.average_price)) + (position.quantity * parseFloat(position.average_price))) / newQty;
        await trx('positions').where({ id: existingPos.id }).update({ quantity: newQty, average_price: newAvg });
        await trx('positions').where({ id: positionId }).del();
      }
      
      res.json({ success: true });
    });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// ── MUTUAL FUNDS ENGINE ───────────────────────────────────────────────────────

const myFetch = async (...args) => {
    const { default: nf } = await import('node-fetch');
    return nf(...args);
};

// 1. Master List Cache
let allMutualFunds = [];

// Initialize by fetching all 10,000+ funds from mfapi.in

let mfInitializationPromise = null;

async function initMutualFundsList(force = false) {
    if (!force && allMutualFunds.length > 0) return; // already loaded
    
    // Prevent concurrent initialization attempts
    if (mfInitializationPromise) return mfInitializationPromise;

    mfInitializationPromise = (async () => {
        try {
            console.log('Fetching master list from amfiindia.com (Filtered for active direct growth only)...');
            const amfiRes = await myFetch('https://www.amfiindia.com/spages/NAVAll.txt');
            const amfiText = await amfiRes.text();
            
            const funds = [];
            const lines = amfiText.split('\n');
            for (const line of lines) {
                if (line.includes(';')) {
                    const parts = line.split(';');
                    if (parts.length >= 4 && parts[0] && !isNaN(parts[0])) {
                        let schemeName = parts[3].trim();
                        if (parts.length >= 6 && parts[4] && parts[5]) {
                            schemeName += ' - ' + parts[4].trim() + ' - ' + parts[5].trim();
                        } else if (parts.length >= 5 && parts[4]) {
                            schemeName += ' - ' + parts[4].trim();
                        }
                        
                        const n = schemeName.toLowerCase();
                        // FILTER: Keep only Direct Growth retail funds (< 2000 items)
                        if (
                            n.includes('growth') &&
                            n.includes('direct') &&
                            !n.includes('regular') &&
                            !n.includes('etf') &&
                            !n.includes('fmp') &&
                            !n.includes('fixed maturity')
                        ) {
                            funds.push({
                                schemeCode: parseInt(parts[0].trim()),
                                schemeName: schemeName
                            });
                        }
                    }
                }
            }
            
            allMutualFunds = funds;
            console.log(`Successfully parsed ${allMutualFunds.length} highly active retail mutual funds from AMFI.`);
            
        } catch (err) {
            console.error('Failed to fetch mutual funds master list:', err.message);
        } finally {
            mfInitializationPromise = null;
        }
    })();
    return mfInitializationPromise;
}

initMutualFundsList();

// Auto-refresh the AMFI master list every 24 hours
setInterval(() => initMutualFundsList(true), 86400000);

// Helper to calculate CAGR
function calculateReturn(historicalData, years) {
    if (!historicalData || historicalData.length === 0) return null;
    const latestNav = parseFloat(historicalData[0].nav);
    
    // Find the NAV from `years` ago
    const targetDate = new Date();
    targetDate.setFullYear(targetDate.getFullYear() - years);
    
    // Data is sorted descending (latest first)
    let pastNavObj = null;
    for (let i = 0; i < historicalData.length; i++) {
        const [dd, mm, yyyy] = historicalData[i].date.split('-');
        const itemDate = new Date(`${yyyy}-${mm}-${dd}`);
        if (itemDate <= targetDate) {
            pastNavObj = historicalData[i];
            break;
        }
    }

    if (!pastNavObj) return null; // Not enough history
    
    const pastNav = parseFloat(pastNavObj.nav);
    const cagr = (Math.pow((latestNav / pastNav), (1 / years)) - 1) * 100;
    return parseFloat(cagr.toFixed(2));
}

function calculateReturnAllTime(historicalData) {
    if (!historicalData || historicalData.length < 2) return null;
    const latestNav = parseFloat(historicalData[0].nav);
    const oldestData = historicalData[historicalData.length - 1];
    const oldestNav = parseFloat(oldestData.nav);
    
    const [d1, m1, y1] = historicalData[0].date.split('-');
    const [d2, m2, y2] = oldestData.date.split('-');
    const latestDate = new Date(`${y1}-${m1}-${d1}`);
    const oldestDate = new Date(`${y2}-${m2}-${d2}`);
    
    const years = (latestDate - oldestDate) / (1000 * 60 * 60 * 24 * 365.25);
    if (years <= 0) return null;
    
    const cagr = (Math.pow((latestNav / oldestNav), (1 / years)) - 1) * 100;
    return parseFloat(cagr.toFixed(2));
}

function determineRisk(return1y) {
    if (return1y === null) return 'Moderate';
    if (return1y > 25) return 'Very High';
    if (return1y > 15) return 'High';
    if (return1y > 8) return 'Moderate';
    return 'Low';
}

const mfCache = {};

const LEGACY_MF_NAMES = {
    'EDEL-MF': 'Edelweiss Balanced Advantage Fund - Direct Plan - Growth',
    'MIRA-MF': 'Mirae Asset Large Cap Fund - Direct Plan - Growth',
    'NIPP-MF': 'Nippon India Small Cap Fund - Direct Plan - Growth Option',
    'EDEL': 'Edelweiss Balanced Advantage Fund - Direct Plan - Growth',
    'MIRA': 'Mirae Asset Large Cap Fund - Direct Plan - Growth',
    'NIPP': 'Nippon India Small Cap Fund - Direct Plan - Growth Option',
    '118615-MF': 'Edelweiss Balanced Advantage Fund - Direct Plan - Growth',
    '118825-MF': 'Mirae Asset Large Cap Fund - Direct Plan - Growth',
    '118778-MF': 'Nippon India Small Cap Fund - Direct Plan - Growth Option',
    '120197-MF': 'ICICI Prudential Liquid Fund - Direct Plan - Growth'
};
const LEGACY_MF_CODES = {
    'EDEL': '118615',
    'MIRA': '118825',
    'NIPP': '118778'
};

app.post('/api/mf/names', async (req, res) => {
    try {
        if (!allMutualFunds || allMutualFunds.length === 0) {
            await initMutualFundsList();
        }
        const { ids } = req.body;
        const mapping = {};
        if (Array.isArray(ids)) {
            const axios = require('axios');
            for (const id of ids) {
                if (LEGACY_MF_NAMES[id]) {
                    mapping[id] = LEGACY_MF_NAMES[id];
                    continue;
                }
                let cleanId = String(id).replace('-MF', '');
                cleanId = LEGACY_MF_CODES[cleanId] || cleanId;
                const fund = allMutualFunds.find(f => String(f.schemeCode) === cleanId);
                if (fund) {
                    mapping[id] = fund.schemeName;
                } else if (LEGACY_MF_NAMES[cleanId]) {
                    mapping[id] = LEGACY_MF_NAMES[cleanId];
                } else if (/^\d+$/.test(cleanId)) {
                    // Fallback to direct mfapi fetch for any future mutual fund not yet in cache
                    try {
                        const mfRes = await axios.get(`https://api.mfapi.in/mf/${cleanId}`, { timeout: 3000 });
                        if (mfRes.data && mfRes.data.meta && mfRes.data.meta.scheme_name) {
                            mapping[id] = mfRes.data.meta.scheme_name;
                            allMutualFunds.push({ schemeCode: parseInt(cleanId), schemeName: mfRes.data.meta.scheme_name });
                        }
                    } catch (e) {}
                }
            }
        }
        res.json(mapping);
    } catch(err) {
        res.status(500).json({ error: err.message });
    }
});

// 2. FAST Search Endpoint — returns ALL matching funds instantly from memory (no mfapi calls)
app.get('/api/mf/search', async (req, res) => {
    try {
        if (allMutualFunds.length === 0) {
            await initMutualFundsList();
        }
        const query = (req.query.q || '').toLowerCase().trim();
        
        let matches = [];
        if (!query || query.length < 2) {
            // Default top funds across categories (Equity, Debt, Hybrid) if no search query
            const topKeywords = [
                'parag parikh flexi', 'quant small', 'quant active', 'sbi small cap', 
                'sbi magnum midcap', 'sbi liquid', 'hdfc balanced advantage', 'hdfc mid-cap', 
                'nippon india liquid', 'nippon india small cap', 'motilal oswal midcap', 
                'icici prudential equity & debt', 'icici prudential liquid', 'axis bluechip', 
                'kotak emerging equity', 'mirae asset large cap', 'ppfas', 'edelweiss balanced'
            ];
            matches = allMutualFunds.filter(f => {
                const n = f.schemeName.toLowerCase();
                return n.includes('direct') && n.includes('growth') && topKeywords.some(k => n.includes(k));
            });
        } else {
            // Instantly filter from the 37,000+ in-memory list
            matches = allMutualFunds.filter(f => f.schemeName.toLowerCase().includes(query) || String(f.schemeCode) === query || String(f.schemeCode) === query.replace('-MF', ''));
        }
        
        // Sort: Direct+Growth first, then Regular+Growth, then others
        matches.sort((a, b) => {
            const nameLower = (n) => n.schemeName.toLowerCase();
            const score = (f) => {
                let s = 0;
                const n = nameLower(f);
                if (n.includes('direct')) s += 4;
                if (n.includes('growth')) s += 2;
                // Penalize closed/FMP/maturity funds
                if (n.includes('fmp') || n.includes('fixed maturity') || n.includes('interval') || n.includes('series')) s -= 3;
                return s;
            };
            return score(b) - score(a);
        });

        // Return TOP 100 matches to prevent overwhelming the frontend
        const results = matches.slice(0, 100).map(fund => {
            const nameLower = fund.schemeName.toLowerCase();
            let category = 'Equity';
            if (nameLower.includes('debt') || nameLower.includes('liquid') || nameLower.includes('bond') || nameLower.includes('gilt') || nameLower.includes('money market') || nameLower.includes('overnight') || nameLower.includes('floating')) category = 'Debt';
            if (nameLower.includes('hybrid') || nameLower.includes('balanced') || nameLower.includes('dynamic asset') || nameLower.includes('multi asset') || nameLower.includes('aggressive')) category = 'Hybrid';
            
            const amc = fund.schemeName.split(' ')[0];
            
            // Check if we have cached data to show returns
            const cached = mfCache[fund.schemeCode];
            let nav = 0, return1y = 0, return3y = 0, return5y = 0, returnAllTime = 0, risk = 'Moderate';
            
            if (cached && cached.data && cached.data.data && cached.data.data.length > 0) {
                const historicalData = cached.data.data;
                nav = parseFloat(historicalData[0].nav);
                return1y = calculateReturn(historicalData, 1) || 0;
                return3y = calculateReturn(historicalData, 3) || 0;
                return5y = calculateReturn(historicalData, 5) || 0;
                returnAllTime = calculateReturnAllTime(historicalData) || 0;
                risk = determineRisk(return1y);
            }
            
            return {
                id: fund.schemeCode,
                name: fund.schemeName,
                amc,
                category,
                risk,
                nav,
                return1y,
                return3y,
                return5y,
                returnAllTime,
                enriched: !!cached
            };
        });

        res.json(results);
    } catch (err) {
        console.error('MF Search Error:', err.message);
        res.status(500).json({ error: 'Failed to search mutual funds' });
    }
});

// 2b. Enrich a batch of funds with live NAV and returns
app.get('/api/mf/enrich', async (req, res) => {
    try {
        const ids = (req.query.ids || '').split(',').filter(Boolean).slice(0, 50);
        if (ids.length === 0) return res.json([]);

        const results = await Promise.all(ids.map(async (schemeCode) => {
            try {
                let data = null;
                if (mfCache[schemeCode] && (Date.now() - mfCache[schemeCode].timestamp < 86400000)) { // 24 hours cache
                    data = mfCache[schemeCode].data;
                } else {
                    const response = await myFetch(`https://api.mfapi.in/mf/${schemeCode}`);
                    data = await response.json();
                    if (data && data.data) {
                        mfCache[schemeCode] = { timestamp: Date.now(), data };
                    }
                }

                if (!data || !data.data || data.data.length === 0) return null;

                const historicalData = data.data;
                return {
                    id: parseInt(schemeCode),
                    nav: parseFloat(historicalData[0].nav),
                    return1y: calculateReturn(historicalData, 1) || 0,
                    return3y: calculateReturn(historicalData, 3) || 0,
                    return5y: calculateReturn(historicalData, 5) || 0,
                    returnAllTime: calculateReturnAllTime(historicalData) || 0,
                    risk: determineRisk(calculateReturn(historicalData, 1))
                };
            } catch { return null; }
        }));

        res.json(results.filter(Boolean));
    } catch (err) {
        console.error('MF Enrich Error:', err.message);
        res.status(500).json({ error: 'Failed to enrich' });
    }
});

// 2c. Rich Details Endpoint (Proxies Groww API for AUM, Holdings, Ratings, Pros/Cons)
const mfDetailsCache = {};
app.get('/api/mf/details', async (req, res) => {
    try {
        const { name } = req.query;
        if (!name) return res.status(400).json({ error: 'Name required' });
        
        // Check cache first
        if (mfDetailsCache[name] && (Date.now() - mfDetailsCache[name].timestamp < 86400000)) { // 24 hours cache
            return res.json(mfDetailsCache[name].data);
        }

        // 1. Get search ID
        const searchUrl = `https://groww.in/v1/api/search/v1/entity?app=false&entity_type=scheme&size=5&q=${encodeURIComponent(name)}`;
        const searchRes = await myFetch(searchUrl);
        const searchData = await searchRes.json();
        
        if (!searchData || !searchData.content || searchData.content.length === 0) {
            return res.status(404).json({ error: 'Details not found for this fund' });
        }
        
        // Take the first matching ID
        const searchId = searchData.content[0].id;

        // 2. Fetch full details using the search ID
        const detailsUrl = `https://groww.in/v1/api/data/mf/web/v2/scheme/search/${searchId}`;
        const detailsRes = await myFetch(detailsUrl);
        const detailsData = await detailsRes.json();
        
        if (detailsData.errorCode) {
            return res.status(404).json({ error: detailsData.errorMessage || 'Details not found' });
        }

        mfDetailsCache[name] = { timestamp: Date.now(), data: detailsData };
        res.json(detailsData);
    } catch (err) {
        console.error('MF Details Error:', err.message);
        res.status(500).json({ error: 'Failed to fetch fund details' });
    }
});

// 3. Historical Data Endpoint (for charts)
app.get('/api/mf/:schemeCode', async (req, res) => {
    try {
        const { schemeCode } = req.params;
        
        if (mfCache[schemeCode] && (Date.now() - mfCache[schemeCode].timestamp < 3600000)) {
            return res.json(mfCache[schemeCode].data);
        }

        const response = await myFetch(`https://api.mfapi.in/mf/${schemeCode}`);
        const data = await response.json();
        
        mfCache[schemeCode] = { timestamp: Date.now(), data };
        res.json(data);
    } catch (err) {
        console.error('MF History Error:', err.message);
        res.status(500).json({ error: 'Failed to fetch mutual fund history' });
    }
});

// ─── Restricted Stocks ────────────────────────────────────────────────────
let restrictedStocksCache = [];
app.get('/api/restricted-stocks', async (req, res) => {
  res.json(restrictedStocksCache);
});
app.setRestrictedStocksCache = (list) => {
  restrictedStocksCache = list;
};
// ─── Option Chain ───────────────────────────────────────────────────────────
let cachedOptionsData = null;
let lastOptionsReadTime = 0;

app.get('/api/options/chain/:symbol', async (req, res) => {
  const symbol = req.params.symbol.toUpperCase();
  const optionsPath = path.join(__dirname, 'database', 'options.json');
  
  if (!fs.existsSync(optionsPath)) {
    return res.status(503).json({ error: 'Options database is currently being built. Please try again in a minute.' });
  }

  try {
    const stat = fs.statSync(optionsPath);
    if (!cachedOptionsData || stat.mtimeMs > lastOptionsReadTime) {
      const rawData = fs.readFileSync(optionsPath, 'utf8');
      cachedOptionsData = JSON.parse(rawData);
      lastOptionsReadTime = stat.mtimeMs;
    }

    if (!cachedOptionsData[symbol]) {
      return res.status(404).json({ error: `Option chain for ${symbol} not found.` });
    }

    res.json(cachedOptionsData[symbol]);
  } catch (err) {
    console.error('Error fetching option chain:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Endpoint to fetch all available underlying symbols for options (e.g., NIFTY, RELIANCE, CRUDEOIL)
app.get('/api/options/symbols', async (req, res) => {
  const optionsPath = path.join(__dirname, 'database', 'options.json');
  
  if (!fs.existsSync(optionsPath)) {
    return res.status(503).json({ error: 'Options database is currently being built.' });
  }

  try {
    const stat = fs.statSync(optionsPath);
    if (!cachedOptionsData || stat.mtimeMs > lastOptionsReadTime) {
      const rawData = fs.readFileSync(optionsPath, 'utf8');
      cachedOptionsData = JSON.parse(rawData);
      lastOptionsReadTime = stat.mtimeMs;
    }
    
    // Extract and sort the list of available symbols
    const symbols = Object.keys(cachedOptionsData).sort();
    res.json(symbols);
  } catch (err) {
    console.error('Error fetching option symbols:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.get('/api/options/futures/:symbol', async (req, res) => {
  const symbol = req.params.symbol.toUpperCase();
  const futuresPath = path.join(__dirname, 'database', 'futures.json');
  
  if (!fs.existsSync(futuresPath)) {
    return res.status(503).json({ error: 'Futures database not ready.' });
  }

  try {
    const fileData = fs.readFileSync(futuresPath, 'utf8');
    const data = JSON.parse(fileData);
    
    if (data[symbol] && data[symbol].length > 0) {
      // Find the first future that hasn't expired yet
      const now = new Date();
      // Reset time to start of day for accurate expiry comparison
      now.setHours(0, 0, 0, 0); 
      
      const validFutures = data[symbol].filter(f => {
        const expDate = new Date(f.expiry);
        return expDate >= now;
      });

      if (validFutures.length > 0) {
        res.json(validFutures[0]);
      } else {
        // Fallback to the last expired future if no active ones exist (e.g. edge cases)
        res.json(data[symbol][data[symbol].length - 1]);
      }
    } else {
      res.status(404).json({ error: 'No futures found for symbol' });
    }
  } catch (err) {
    console.error('Error fetching futures:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ─── Order Management ───────────────────────────────────────────────────────────────
app.get('/api/orders', authenticateToken, async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 5000;
    const orders = await db('orders').where({ user_id: req.user.id }).orderBy('created_at', 'desc').limit(limit);
    res.json(orders);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── Place Order ─────────────────────────────────────────────────────────
const { spawnBracketOrders } = require('./services/orderExecutor');

let lastOrderError = null;

app.post('/api/order', authenticateToken, orderLimiter, async (req, res) => {
  lastOrderError = null;
  const { symbol, type, side, quantity, price, sl_price, tgt_price, trigger_price, trail_amount, margin, product_type } = req.body;
  if (!symbol || !type || !side || !quantity) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  // Validate Quantity is a multiple of Lot Size for Options/Futures
  if (isDerivativeContract(symbol)) {
    const { getLotSizes } = require('./services/instrumentsCache');
    const lotSizes = getLotSizes([symbol]);
    const lotsize = lotSizes[symbol] || 1;
    if (Number(quantity) % lotsize !== 0) {
      return res.status(400).json({ error: `Quantity must be a multiple of lot size (${lotsize}).` });
    }
  }

  // Validate Bracket Order (BO) and Cover Order (CO) formats
  if (product_type === 'BO' || product_type === 'CO') {
    const entryPrice = parseFloat(price) || priceCache[symbol]?.ltp || 0;
    
    if (entryPrice <= 0) {
      return res.status(400).json({ error: 'Cannot place Bracket/Cover order when live price is unavailable. Please specify a limit price.' });
    }
    
    const parsedSL = sl_price ? parseFloat(sl_price) : 0;
    const parsedTgt = tgt_price ? parseFloat(tgt_price) : 0;
    
    if (side === 'BUY') {
      if (parsedSL && parsedSL >= entryPrice) {
        return res.status(400).json({ error: `Invalid Stop Loss: For a BUY order, Stop Loss price (${parsedSL}) must be lower than the entry price (${entryPrice.toFixed(2)}).` });
      }
      if (parsedTgt && parsedTgt <= entryPrice) {
        return res.status(400).json({ error: `Invalid Target: For a BUY order, Target price (${parsedTgt}) must be higher than the entry price (${entryPrice.toFixed(2)}).` });
      }
    } else if (side === 'SELL') {
      if (parsedSL && parsedSL <= entryPrice) {
        return res.status(400).json({ error: `Invalid Stop Loss: For a SELL order, Stop Loss price (${parsedSL}) must be higher than the entry price (${entryPrice.toFixed(2)}).` });
      }
      if (parsedTgt && parsedTgt >= entryPrice) {
        return res.status(400).json({ error: `Invalid Target: For a SELL order, Target price (${parsedTgt}) must be lower than the entry price (${entryPrice.toFixed(2)}).` });
      }
    }
  }

  // Determine if this order is strictly closing/reducing an existing open position or holding
  const effectiveProductType = product_type || 'DEL';
  const cleanSym = symbol.includes(':') ? symbol.split(':')[1] : symbol;
  let isClosingOrder = false;

  if (side === 'SELL') {
    // Check if user has open long position in this symbol
    const existingLongPos = await db('positions')
      .where({ user_id: req.user.id, product_type: effectiveProductType })
      .where(builder => {
        builder.where({ symbol }).orWhere({ symbol: cleanSym }).orWhere({ symbol: `NSE:${cleanSym}` }).orWhere({ symbol: `BSE:${cleanSym}` }).orWhere({ symbol: `MCX:${cleanSym}` });
      })
      .where('quantity', '>', 0)
      .first();

    if (existingLongPos && Number(existingLongPos.quantity) >= Number(quantity)) {
      isClosingOrder = true;
    } else if (effectiveProductType === 'DEL') {
      // Check holdings
      const holding = await db('holdings')
        .where({ user_id: req.user.id })
        .where(builder => {
          builder.where({ symbol }).orWhere({ symbol: cleanSym }).orWhere({ symbol: `NSE:${cleanSym}` }).orWhere({ symbol: `BSE:${cleanSym}` }).orWhere({ symbol: `MCX:${cleanSym}` });
        })
        .where('quantity', '>=', Number(quantity))
        .first();
      if (holding) {
        isClosingOrder = true;
      }
    }
  } else if (side === 'BUY') {
    // Check if user has open short position in this symbol
    const existingShortPos = await db('positions')
      .where({ user_id: req.user.id, product_type: effectiveProductType })
      .where(builder => {
        builder.where({ symbol }).orWhere({ symbol: cleanSym }).orWhere({ symbol: `NSE:${cleanSym}` }).orWhere({ symbol: `BSE:${cleanSym}` }).orWhere({ symbol: `MCX:${cleanSym}` });
      })
      .where('quantity', '<', 0)
      .first();

    if (existingShortPos && Math.abs(Number(existingShortPos.quantity)) >= Number(quantity)) {
      isClosingOrder = true;
    }
  }

  // 🛡️ RISK GUARDIAN ENFORCEMENT 🛡️
  // Note: Risk Guardian NEVER blocks closing/square-off orders for existing positions/holdings.
  const currentUser = await db('users').where({ id: req.user.id }).first();
  if (currentUser && currentUser.risk_guardian_active && !isClosingOrder) {
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    // 1. Check Max Daily Trades Limit
    if (currentUser.max_daily_trades && currentUser.max_daily_trades > 0) {
      const todayOrdersCount = await db('orders')
        .where({ user_id: req.user.id })
        .where('created_at', '>=', todayStart)
        .whereIn('status', ['COMPLETED', 'COMPLETE', 'EXECUTED'])
        .count('id as count')
        .first();
      
      const count = parseInt(todayOrdersCount?.count || 0);
      if (count >= currentUser.max_daily_trades) {
        return res.status(400).json({
          error: `🛡️ Risk Guardian Active: You have reached your limit of ${currentUser.max_daily_trades} trade(s) for today. Trading is locked to protect your discipline.`
        });
      }
    }

    // 2. Check Max Daily Loss Limit
    if (currentUser.max_daily_loss && currentUser.max_daily_loss > 0) {
      const todayOrders = await db('orders')
        .where({ user_id: req.user.id })
        .where('created_at', '>=', todayStart)
        .whereIn('status', ['COMPLETED', 'COMPLETE', 'EXECUTED']);

      let todayRealizedPnl = 0;
      for (const ord of todayOrders) {
        if (ord.realized_pnl !== null && ord.realized_pnl !== undefined) {
          todayRealizedPnl += parseFloat(ord.realized_pnl);
        }
      }

      if (todayRealizedPnl < 0 && Math.abs(todayRealizedPnl) >= parseFloat(currentUser.max_daily_loss)) {
        return res.status(400).json({
          error: `🛡️ Risk Guardian Active: You have hit your maximum daily loss limit of ₹${parseFloat(currentUser.max_daily_loss).toLocaleString('en-IN')}. Trading is locked for today to protect your capital.`
        });
      }
    }
  }

  // Block new Intraday orders outside valid time windows (square-off / closing orders are always permitted)
  if ((product_type === 'INT' || product_type === 'BO' || product_type === 'CO') && !isClosingOrder) {
    const isCommodity = isCommodityContract(symbol);
    const now = new Date();
    const istTime = new Date(now.getTime() + (5.5 * 60 * 60 * 1000));
    const hours = istTime.getUTCHours();
    const minutes = istTime.getUTCMinutes();
    
    if (!isCommodity) {
      // Equities: 9:15 AM to 3:15 PM
      const isBeforeOpen = hours < 9 || (hours === 9 && minutes < 15);
      const isAfterClose = hours > 15 || (hours === 15 && minutes >= 15);
      if (isBeforeOpen || isAfterClose) {
        return res.status(400).json({ error: 'Intraday/BO/CO trading for Equities is only allowed between 9:15 AM and 3:15 PM IST.' });
      }
    } else {
      // Commodities: 9:00 AM to 10:50 PM
      const isBeforeOpen = hours < 9;
      const isAfterClose = hours > 22 || (hours === 22 && minutes >= 50);
      if (isBeforeOpen || isAfterClose) {
        return res.status(400).json({ error: 'Intraday/BO/CO trading for Commodities is only allowed between 9:00 AM and 10:50 PM IST.' });
      }
    }
  }

  // BUG FIX 4: Block ALL new orders for F&O/FUT contracts on their expiry day after auto-square-off triggers.
  // Equities auto-square-off at 03:25 PM. MCX auto-square-off at 07:00 PM.
  // After these times, no manual intervention is allowed as the system forces settlement.
  const isDerivativeSymbol = isDerivativeContract(symbol);
  if (isDerivativeSymbol) {
    const now = new Date();
    const istNow = new Date(now.getTime() + (5.5 * 60 * 60 * 1000));
    const dayStr = String(istNow.getUTCDate()).padStart(2, '0');
    const monthNames = ['JAN','FEB','MAR','APR','MAY','JUN','JUL','AUG','SEP','OCT','NOV','DEC'];
    const monthStr = monthNames[istNow.getUTCMonth()];
    const yearStr = String(istNow.getUTCFullYear()).slice(-2);
    const todayExpiryToken = `${dayStr}${monthStr}${yearStr}`; // e.g. "10AUG26"
    
    const isExpiringToday = symbol.includes(todayExpiryToken);
    if (isExpiringToday) {
      const h = istNow.getUTCHours();
      const min = istNow.getUTCMinutes();
      const isMCXSymbol = symbol.endsWith('-MCX');
      // Equity/NFO/BFO: block after 03:25 PM; MCX: block after 07:00 PM
      const equityExpiryClosed = !isMCXSymbol && (h > 15 || (h === 15 && min >= 25));
      const mcxExpiryClosed   =  isMCXSymbol && (h >= 19);
      if (equityExpiryClosed || mcxExpiryClosed) {
        return res.status(400).json({
          error: `Cannot place orders on ${symbol.split('-')[0]}. This contract expires today and the Auto-Square-Off cutoff time has passed.`
        });
      }
    }
  }

  try {
    await db.transaction(async (trx) => {
      // 1. Determine execution status
      const hasTrigger = Boolean((type && (type.startsWith('SL') || type === 'GTT' || type === 'TRAILING_STOP')) || (trigger_price !== undefined && trigger_price !== null && Number(trigger_price) > 0));
      const isMarket = type === 'MARKET' && !hasTrigger;
      const isTriggerOrder = hasTrigger;
      const status = isTriggerOrder ? 'PENDING_TRIGGER' : 'PENDING';
      const execPrice = parseFloat(price) || priceCache[symbol]?.ltp || 0; // Fetch live LTP here for market orders
      const resolvedTriggerPrice = trigger_price ? parseFloat(trigger_price) : (type && type.startsWith('SL') && price ? parseFloat(price) : null);
      
      // 2. Deduct Margin from User Balance
      let requiresMargin = true;
      if (side === 'SELL') {
          const isDerivative = isDerivativeContract(symbol);
          if (effectiveProductType === 'DEL' && !isDerivative) {
              // 1. Fetch available Holdings
              const holding = await trx('holdings')
                  .where({ user_id: req.user.id })
                  .where(builder => {
                    builder.where({ symbol }).orWhere({ symbol: cleanSym }).orWhere({ symbol: `NSE:${cleanSym}` }).orWhere({ symbol: `BSE:${cleanSym}` }).orWhere({ symbol: `MCX:${cleanSym}` });
                  })
                  .first();
              const holdingQty = holding ? Number(holding.quantity) : 0;
              
              // 2. Fetch open Positions for today
              const existingPos = await trx('positions')
                  .where({ user_id: req.user.id, product_type: 'DEL' })
                  .where(builder => {
                    builder.where({ symbol }).orWhere({ symbol: cleanSym }).orWhere({ symbol: `NSE:${cleanSym}` }).orWhere({ symbol: `BSE:${cleanSym}` }).orWhere({ symbol: `MCX:${cleanSym}` });
                  })
                  .where('quantity', '>', 0)
                  .first();
              const posQty = existingPos && Number(existingPos.quantity) > 0 ? Number(existingPos.quantity) : 0;
              
              // 3. Fetch Pending Sell Orders for this symbol
              const pendingOrders = await trx('orders')
                  .where({ user_id: req.user.id, side: 'SELL', product_type: 'DEL' })
                  .where(builder => {
                    builder.where({ symbol }).orWhere({ symbol: cleanSym }).orWhere({ symbol: `NSE:${cleanSym}` }).orWhere({ symbol: `BSE:${cleanSym}` }).orWhere({ symbol: `MCX:${cleanSym}` });
                  })
                  .whereIn('status', ['PENDING', 'PENDING_TRIGGER']);
              const pendingSellQty = pendingOrders.reduce((sum, o) => sum + Number(o.quantity), 0);
              
              const totalAvailable = parseFloat((holdingQty + posQty - pendingSellQty).toFixed(4));
              
              if (Number(quantity) > totalAvailable) {
                  throw new Error(`Insufficient holdings. You only have ${totalAvailable} shares available to sell.`);
              }
              requiresMargin = false; // Selling DEL from holdings requires no margin
          } else if (isClosingOrder) {
              requiresMargin = false;
          } else if (!isDerivative || effectiveProductType !== 'DEL') {
              const existingPos = await trx('positions')
                  .where({ user_id: req.user.id, product_type: effectiveProductType })
                  .where(builder => {
                    builder.where({ symbol }).orWhere({ symbol: cleanSym }).orWhere({ symbol: `NSE:${cleanSym}` }).orWhere({ symbol: `BSE:${cleanSym}` }).orWhere({ symbol: `MCX:${cleanSym}` });
                  })
                  .where('quantity', '>', 0)
                  .first();
              if (existingPos && Number(existingPos.quantity) >= Number(quantity)) {
                  requiresMargin = false;
              }
          } else if (isDerivative && effectiveProductType === 'DEL') {
              const existingPos = await trx('positions')
                  .where({ user_id: req.user.id, product_type: effectiveProductType })
                  .where(builder => {
                    builder.where({ symbol }).orWhere({ symbol: cleanSym }).orWhere({ symbol: `NSE:${cleanSym}` }).orWhere({ symbol: `BSE:${cleanSym}` }).orWhere({ symbol: `MCX:${cleanSym}` });
                  })
                  .where('quantity', '>', 0)
                  .first();
              if (existingPos && Number(existingPos.quantity) >= Number(quantity)) {
                  requiresMargin = false;
              }
          }
      } else if (side === 'BUY') {
          if (isClosingOrder) {
              requiresMargin = false;
          } else {
              const existingPos = await trx('positions')
                  .where({ user_id: req.user.id, product_type: effectiveProductType })
                  .where(builder => {
                    builder.where({ symbol }).orWhere({ symbol: cleanSym }).orWhere({ symbol: `NSE:${cleanSym}` }).orWhere({ symbol: `BSE:${cleanSym}` }).orWhere({ symbol: `MCX:${cleanSym}` });
                  })
                  .where('quantity', '<', 0)
                  .first();
              if (existingPos && Math.abs(Number(existingPos.quantity)) >= Number(quantity)) {
                  requiresMargin = false;
              }
          }
      }

      let finalMargin = Number(margin) || 0;
      if (requiresMargin && finalMargin <= 0) {
          const { calculateRequiredMargin } = require('./services/marginEngine');
          finalMargin = calculateRequiredMargin(symbol, effectiveProductType, side, Number(quantity), execPrice);
      }

      if (requiresMargin && finalMargin > 0) {
        const user = await trx('users').where({ id: req.user.id }).first();
        if (Number(user.balance) < finalMargin) {
           throw new Error('Insufficient Funds.');
        }
        const newBalance = Number(user.balance) - finalMargin;
        await trx('users').where({ id: req.user.id }).update({ balance: newBalance });
        
        await trx('ledger').insert({
            user_id: req.user.id,
            amount: -finalMargin,
            type: 'MARGIN_BLOCK',
            description: `Margin blocked for ${side} ${quantity} ${symbol} (${effectiveProductType})`
        });
      }

      // Ensure margin passed down to insert is the final margin
      const marginToSave = requiresMargin ? finalMargin : 0;

      // 3. Insert Order
      const [id] = await trx('orders').insert({
        user_id: req.user.id, symbol, type, side, quantity, price: execPrice || null,
        status, sl_price: sl_price || null, tgt_price: tgt_price || null, trigger_price: resolvedTriggerPrice, trail_amount: trail_amount || null, product_type: effectiveProductType, margin: marginToSave
      }).returning('id');
      const orderId = typeof id === 'object' ? id.id : id;
      
      req.orderToProcess = {
        id: orderId, user_id: req.user.id, symbol, type, side, quantity, price: execPrice || null,
        status, sl_price: sl_price || null, tgt_price: tgt_price || null, trigger_price: resolvedTriggerPrice, trail_amount: trail_amount || null, product_type: effectiveProductType, margin: marginToSave,
        isMarket
      };
    });

    const triggerEngine = require('./services/triggerEngine');
    const ord = req.orderToProcess;
    
    // BUG FIX: Use effectiveProductType (not raw product_type from req.body which may be undefined)
    await triggerEngine.addOrderToMemory(ord);
    
    setTimeout(() => {
        try {
            const { pubClient } = require('./services/redisClient');
            if (pubClient) pubClient.publish('reload_triggers', '1').catch(e=>{});
        } catch(e) {}
    }, 500);
    
    // Manually trigger an evaluation to instantly process Market orders in the background
    // IMPORTANT: Only use real cached LTP for evaluation, NOT the order's limit price.
    // Using the order's own price would cause LIMIT orders to self-trigger immediately.
    if (ord.isMarket) {
      
      const isMutualFund = ord.symbol.endsWith('-MF') || /^\d+$/.test(ord.symbol);
      if (isMutualFund) {
         try {
             const triggerEngineLocal = require('./services/triggerEngine');
             triggerEngineLocal.removeOrderFromMemory(ord.id, ord.symbol);
             triggerEngineLocal.executeOrder(ord, ord.price).catch(e => console.error(e));
         } catch(e) {}
      } else {
         const realLtp = priceCache[ord.symbol]?.ltp || 0;
         if (realLtp > 0) {
            try {
              await triggerEngine.evaluateTick(ord.symbol, realLtp);
              await new Promise(r => setTimeout(r, 250));
            } catch (err) {
              console.error('Immediate evaluation error:', err);
            }
         }
      }

    }

    // Fetch the final status after evaluation to send back to frontend
    const finalOrder = await db('orders').where({ id: ord.id }).first();
    const finalStatus = finalOrder ? finalOrder.status : ord.status;

    // Send instant push notification
    sendPushNotification(req.user.id, {
      title: `Order Placed: ${side} ${quantity} ${symbol}`,
      body: `Status: ${finalStatus} (${product_type || 'INT'})`,
      url: '/orders'
    }).catch(() => {});

    res.json({ success: true, orderId: ord.id, status: finalStatus });

  } catch (error) {
    lastOrderError = { message: error.message, stack: error.stack, payload: req.body };
    console.error('[ORDER ERROR]:', error);
    res.status(500).json({ error: error.message, success: false });
  }
});

// ⚡ SIP Endpoints ⚡
app.post('/api/sip', authenticateToken, async (req, res) => {
  const { symbol, amount, frequency, price } = req.body;
  if (!symbol || !amount) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  try {
    await db.transaction(async (trx) => {
      const user = await trx('users').where({ id: req.user.id }).first();
      const finalMargin = Number(amount);
      if (Number(user.balance) < finalMargin) {
         throw new Error('Insufficient Funds for SIP installment.');
      }
      
      const newBalance = Number(user.balance) - finalMargin;
      await trx('users').where({ id: req.user.id }).update({ balance: newBalance });
      
      await trx('ledger').insert({
          user_id: req.user.id,
          amount: -finalMargin,
          type: 'MARGIN_BLOCK',
          description: `SIP installment blocked for ${symbol}`
      });

      
      let nextExecutionDate = new Date();
      if (frequency === 'DAILY') {
        nextExecutionDate.setDate(nextExecutionDate.getDate() + 1);
      } else if (frequency === 'WEEKLY') {
        nextExecutionDate.setDate(nextExecutionDate.getDate() + 7);
      } else {
        nextExecutionDate.setMonth(nextExecutionDate.getMonth() + 1);
      }
      
      // Ensure it's not Saturday/Sunday (skips to Monday)
      while (nextExecutionDate.getDay() === 0 || nextExecutionDate.getDay() === 6) {
          nextExecutionDate.setDate(nextExecutionDate.getDate() + 1);
      }


      await trx('sips').insert({
        user_id: req.user.id,
        symbol,
        amount: finalMargin,
        frequency: frequency || 'MONTHLY',
        next_execution_date: nextExecutionDate,
        status: 'ACTIVE'
      });

      const execPrice = price || priceCache[symbol]?.ltp || 1;
      const qty = parseFloat((finalMargin / execPrice).toFixed(4));

      const [id] = await trx('orders').insert({
        user_id: req.user.id, symbol, type: 'MARKET', side: 'BUY', quantity: qty, price: execPrice,
        status: 'PENDING', product_type: 'DEL', margin: finalMargin
      }).returning('id');
      const orderId = typeof id === 'object' ? id.id : id;

      const triggerEngine = require('./services/triggerEngine');
      triggerEngine.executeOrder({
        id: orderId, user_id: req.user.id, symbol, type: 'MARKET', side: 'BUY', quantity: qty, price: execPrice,
        status: 'PENDING', product_type: 'DEL', margin: finalMargin
      }, execPrice).catch(e => console.error('Immediate execution error:', e));

    });

    res.json({ success: true, message: 'SIP created successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message, success: false });
  }
});

app.get('/api/sips', authenticateToken, async (req, res) => {
  try {
    const sips = await db('sips').where({ user_id: req.user.id });
    res.json({ success: true, sips });
  } catch (error) {
    res.status(500).json({ error: error.message, success: false });
  }
});


// ⚡ Execute a single SIP installment on demand
app.post('/api/sip/:id/execute-now', authenticateToken, async (req, res) => {
  try {
    const sip = await db('sips').where({ id: req.params.id, user_id: req.user.id }).first();
    if (!sip) return res.status(404).json({ error: 'SIP not found' });
    
    const result = await SIPEngine.executeSingleSip(sip.id, priceCache);
    if (!result.success) {
      if (result.reason === 'INSUFFICIENT_FUNDS') {
        return res.status(400).json({ error: `Insufficient funds. Needed ₹${result.required}, Available ₹${result.available.toFixed(2)}` });
      }
      return res.status(500).json({ error: 'Failed to execute SIP installment' });
    }
    res.json({ success: true, message: `Successfully executed SIP installment! ${result.units} units credited @ NAV ₹${result.nav}`, data: result });
  } catch (error) {
    res.status(500).json({ error: error.message, success: false });
  }
});

// ⚡ Admin: Process all due SIPs
app.post('/api/admin/sips/process-all', authenticateToken, async (req, res) => {
  try {
    if (!req.user.is_admin) return res.status(403).json({ error: 'Admin access required' });
    const result = await SIPEngine.processDueSips(priceCache);
    res.json({ success: true, message: `Processed ${result.total} due SIPs: ${result.success} succeeded, ${result.failed} failed/skipped.`, result });
  } catch (error) {
    res.status(500).json({ error: error.message, success: false });
  }
});

app.delete('/api/sip/:id', authenticateToken, async (req, res) => {
  try {
    await db('sips').where({ id: req.params.id, user_id: req.user.id }).del();
    res.json({ success: true, message: 'SIP deleted' });
  } catch (error) {
    res.status(500).json({ error: error.message, success: false });
  }
});

// ⚡ Fetch Batch LTPs (REST) ⚡
// In-flight deduplication: if 10 users request prices for the same symbols at once,
// only ONE Fyers REST call is made — all other requests share the same Promise result.
const _inFlightLtpRequests = new Map(); // key: sorted symbol list → Promise

app.post('/api/ltp-batch', async (req, res) => {
  try {
    const { symbols, force } = req.body;
    if (!symbols || !Array.isArray(symbols)) {
      return res.status(400).json({ error: 'Missing or invalid symbols array' });
    }
    
    const { fetchBatchLTPs, registerTokens } = require('./services/fyers');
    if (registerTokens) registerTokens(symbols);
    
    const result = {};
    const missingSymbols = [];
    const now = Date.now();
    
    // 1. Serve everything we already have in the live priceCache instantly (unless force=true)
    for (const item of symbols) {
      const sym = typeof item === 'string' ? item : item.symbol;
      if (!sym) continue;
      
      const cached = priceCache[sym];
      const isStale = cached && cached.timestamp ? (now - cached.timestamp > 15000) : false;
      
      if (!force && cached && cached.ltp > 0 && !isStale) {
        result[sym] = cached;
      } else {
        missingSymbols.push(sym);
      }
    }
    
    // 2. For missing symbols, deduplicate concurrent Fyers REST calls
    if (missingSymbols.length > 0) {
      // Create a stable cache key from the sorted list of missing symbols
      const cacheKey = missingSymbols.slice().sort().join(',');
      
      let fetchPromise = _inFlightLtpRequests.get(cacheKey);
      if (!fetchPromise) {
        // No in-flight request — start a new one
        fetchPromise = fetchBatchLTPs(missingSymbols).then(data => {
          // Write results into priceCache for future requests
          for (const [sym, ltpData] of Object.entries(data)) {
            if (ltpData && ltpData.ltp > 0) priceCache[sym] = ltpData;
          }
          return data;
        }).finally(() => {
          // Remove from in-flight map after a short hold (3s) so next request
          // uses the priceCache above rather than hitting Fyers REST again
          setTimeout(() => _inFlightLtpRequests.delete(cacheKey), 3000);
        });
        _inFlightLtpRequests.set(cacheKey, fetchPromise);
      }
      
      // All concurrent requests for this same symbol set await the SAME promise
      const data = await fetchPromise;
      for (const [sym, ltpData] of Object.entries(data)) {
        result[sym] = ltpData;
      }
    }
    
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 🧮 Estimate Charges 🧮
// TEMPORARY FIX ROUTE FOR TCS POSITION
app.get('/api/admin/fix-tcs-position', async (req, res) => {
  try {
     const count = await db('positions').where({ symbol: 'TCS-BSE', quantity: 1 }).update({ quantity: 11, average_price: 2429.00 });
     res.json({ message: `Fixed ${count} position(s) for TCS.` });
  } catch(e) {
     res.status(500).json({ error: e.message });
  }
});

app.get('/api/estimate-charges', authenticateToken, (req, res) => {
  try {
    const { symbol, product_type, side, quantity, price, entry_price, holding_days } = req.query;
    if (!symbol || !side || !quantity || !price) {
      return res.status(400).json({ error: 'Missing required parameters' });
    }
    
    const { calculateTaxes } = require('./services/taxCalculator');
    const taxes = calculateTaxes(symbol, product_type || 'DEL', side, Number(quantity), Number(price), Number(entry_price || 0), Number(holding_days || 0));
    
    res.json(taxes);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});


// 🔔 Web Push Notification Endpoints 🔔
const { sendPushNotification, vapidPublicKey } = require('./services/pushService');

app.get('/api/push/vapid-public-key', (req, res) => {
  res.json({ publicKey: vapidPublicKey });
});

app.post('/api/push/subscribe', authenticateToken, async (req, res) => {
  try {
    const { endpoint, keys } = req.body;
    if (!endpoint || !keys || !keys.p256dh || !keys.auth) {
      return res.status(400).json({ error: 'Invalid subscription payload' });
    }

    // Ensure push_subscriptions table exists defensively
    await db.raw(`
      CREATE TABLE IF NOT EXISTS push_subscriptions (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        endpoint TEXT NOT NULL UNIQUE,
        p256dh TEXT NOT NULL,
        auth TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    const existing = await db('push_subscriptions').where({ endpoint }).first();
    if (existing) {
      await db('push_subscriptions').where({ endpoint }).update({
        user_id: req.user.id,
        p256dh: keys.p256dh,
        auth: keys.auth,
        updated_at: new Date()
      });
    } else {
      await db('push_subscriptions').insert({
        user_id: req.user.id,
        endpoint,
        p256dh: keys.p256dh,
        auth: keys.auth
      });
    }

    res.json({ success: true, message: 'Push subscription registered successfully' });
  } catch (err) {
    console.error('Failed to save push subscription:', err);
    res.status(500).json({ error: err.message });
  }
});


// 🛡️ Risk Guardian Settings 🛡️
app.post('/api/user/risk-guardian', authenticateToken, async (req, res) => {
  try {
    const { max_daily_loss, max_daily_trades, risk_guardian_active } = req.body;
    await db('users').where({ id: req.user.id }).update({
      max_daily_loss: max_daily_loss !== undefined && max_daily_loss !== null ? parseFloat(max_daily_loss) : null,
      max_daily_trades: max_daily_trades !== undefined && max_daily_trades !== null ? parseInt(max_daily_trades) : null,
      risk_guardian_active: !!risk_guardian_active,
      updated_at: new Date()
    });
    const updatedUser = await db('users').where({ id: req.user.id }).first();
    res.json({ success: true, message: 'Risk Guardian settings saved successfully', user: updatedUser });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ⚡ Exit All Holdings ⚡
app.post('/api/holdings/exit-all', authenticateToken, async (req, res) => {
  try {
    const activeHoldings = await db('holdings')
      .where({ user_id: req.user.id })
      .where('quantity', '>', 0);

    if (!activeHoldings || activeHoldings.length === 0) {
      return res.status(400).json({ error: 'No active holdings to exit' });
    }

    let totalSoldAmount = 0;
    const exitOrders = [];

    await db.transaction(async (trx) => {
      for (const holding of activeHoldings) {
        const qty = parseFloat(holding.quantity);
        const ltp = priceCache[holding.symbol]?.ltp || parseFloat(holding.average_price) || 0;
        const totalValue = qty * ltp;
        totalSoldAmount += totalValue;

        const realizedPnl = (ltp - parseFloat(holding.average_price)) * qty;

        // 1. Create executed sell order
        await trx('orders').insert({
          user_id: req.user.id,
          symbol: holding.symbol,
          type: 'MARKET',
          side: 'SELL',
          quantity: qty,
          price: ltp,
          average_price: ltp,
          status: 'EXECUTED',
          product_type: 'DEL',
          margin: 0,
          realized_pnl: realizedPnl,
          created_at: new Date(),
          updated_at: new Date()
        });

        // 1.5 Create closed position record for today
        await trx('positions').insert({
          user_id: req.user.id,
          symbol: holding.symbol,
          quantity: 0,
          closed_quantity: qty,
          average_price: parseFloat(holding.average_price),
          exit_price: ltp,
          realized_pnl: realizedPnl,
          product_type: 'DEL',
          margin: 0,
          created_at: new Date(),
          updated_at: new Date()
        });

        // 2. Reduce holding to 0
        await trx('holdings').where({ id: holding.id }).update({
          quantity: 0,
          updated_at: new Date()
        });

        // 3. Credit funds to ledger and user balance
        await trx('users').where({ id: req.user.id }).increment('balance', totalValue);
        await trx('ledger').insert({
          user_id: req.user.id,
          amount: totalValue,
          type: 'HOLDINGS_SELL',
          description: `Exited Holdings: SELL ${qty} ${holding.symbol} @ ₹${ltp.toFixed(2)}`,
          created_at: new Date()
        });

        exitOrders.push({ symbol: holding.symbol, quantity: qty, price: ltp });
      }
    });

    res.json({ success: true, message: `Successfully exited ${exitOrders.length} holding(s)`, totalSoldAmount });
  } catch (err) {
    console.error('Exit all holdings error:', err);
    res.status(500).json({ error: err.message });
  }
});

// 📝 Tag / Journal Trade 📝
app.post('/api/order/:id/tag', authenticateToken, async (req, res) => {
  try {
    const { tag, notes } = req.body;
    await db('orders')
      .where({ id: req.params.id, user_id: req.user.id })
      .update({
        tag: tag || null,
        notes: notes || null,
        updated_at: new Date()
      });
    res.json({ success: true, message: 'Trade tagged successfully' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/push/unsubscribe', authenticateToken, async (req, res) => {
  try {
    const { endpoint } = req.body;
    if (endpoint) {
      await db('push_subscriptions').where({ endpoint }).delete();
    } else {
      await db('push_subscriptions').where({ user_id: req.user.id }).delete();
    }
    res.json({ success: true, message: 'Unsubscribed from push notifications' });
  } catch (err) {
    console.error('Failed to unsubscribe push:', err);
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/push/test', authenticateToken, async (req, res) => {
  try {
    await sendPushNotification(req.user.id, {
      title: '🔔 Short Edge Alert',
      body: 'Live trade alerts and order push notifications are active on this device!',
      url: '/clientdata'
    });
    res.json({ success: true, message: 'Test notification dispatched' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 📖 Get Ledger History 📖
app.get('/api/ledger', authenticateToken, async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 5000;
    const ledger = await db('ledger')
      .where({ user_id: req.user.id })
      .orderBy('created_at', 'desc')
      .limit(limit);
    res.json(ledger);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 🧺 Place Basket Order 🧺───────────────────────────────────────────────────────
app.post('/api/basket-order', authenticateToken, async (req, res) => {
  const { items, total_margin } = req.body;
  if (!items || !Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ error: 'Basket is empty' });
  }

  // Block Intraday cutoff
  for (const item of items) {
    if (item.product_type === 'INT' || item.product_type === 'BO' || item.product_type === 'CO') {
      const isCommodity = isCommodityContract(item.symbol);
      const now = new Date();
      const istTime = new Date(now.getTime() + (5.5 * 60 * 60 * 1000));
      const hours = istTime.getUTCHours();
      const minutes = istTime.getUTCMinutes();
      
      if (!isCommodity) {
        const isBeforeOpen = hours < 9 || (hours === 9 && minutes < 15);
        const isAfterClose = hours > 15 || (hours === 15 && minutes >= 15);
        if (isBeforeOpen || isAfterClose) {
          return res.status(400).json({ error: 'Intraday/BO/CO trading for Equities is only allowed between 9:15 AM and 3:15 PM IST.' });
        }
      } else {
        const isBeforeOpen = hours < 9;
        const isAfterClose = hours > 22 || (hours === 22 && minutes >= 50);
        if (isBeforeOpen || isAfterClose) {
          return res.status(400).json({ error: 'Intraday/BO/CO trading for Commodities is only allowed between 9:00 AM and 10:50 PM IST.' });
        }
      }
    }

    // BUG FIX 4: Block ALL new orders for F&O/FUT contracts on their expiry day after auto-square-off triggers.
    const isDerivativeSymbol = isDerivativeContract(item.symbol);
    if (isDerivativeSymbol) {
      const now = new Date();
      const istNow = new Date(now.getTime() + (5.5 * 60 * 60 * 1000));
      const dayStr = String(istNow.getUTCDate()).padStart(2, '0');
      const monthNames = ['JAN','FEB','MAR','APR','MAY','JUN','JUL','AUG','SEP','OCT','NOV','DEC'];
      const monthStr = monthNames[istNow.getUTCMonth()];
      const yearStr = String(istNow.getUTCFullYear()).slice(-2);
      const todayExpiryToken = `${dayStr}${monthStr}${yearStr}`;
      
      const isExpiringToday = item.symbol.includes(todayExpiryToken);
      if (isExpiringToday) {
        const h = istNow.getUTCHours();
        const min = istNow.getUTCMinutes();
        const isMCXSymbol = item.symbol.endsWith('-MCX');
        // Equity/NFO/BFO: block after 03:25 PM; MCX: block after 07:00 PM
        const equityExpiryClosed = !isMCXSymbol && (h > 15 || (h === 15 && min >= 25));
        const mcxExpiryClosed   =  isMCXSymbol && (h >= 19);
        if (equityExpiryClosed || mcxExpiryClosed) {
          return res.status(400).json({
            error: `Cannot place orders on ${item.symbol.split('-')[0]}. This contract expires today and the Auto-Square-Off cutoff time has passed.`
          });
        }
      }
    }
  }

  try {
    await db.transaction(async (trx) => {
      // 1. Verify total margin
      const requiredMargin = parseFloat(total_margin) || 0;
      const user = await trx('users').where({ id: req.user.id }).first();
      
      if (requiredMargin > 0 && parseFloat(user.balance) < requiredMargin) {
        throw new Error(`Insufficient Funds.`);
      }

      // 1.5 Validate SELL DEL orders against holdings (No Naked Shorting for Equities)
      const sellDelQuantities = {};
      for (const item of items) {
          const isDerivative = isDerivativeContract(item.symbol);
          if (item.side === 'SELL' && (item.product_type || 'DEL') === 'DEL' && !isDerivative) {
              sellDelQuantities[item.symbol] = (sellDelQuantities[item.symbol] || 0) + Number(item.quantity);
          }
      }
      for (const symbol in sellDelQuantities) {
          const qtyRequested = sellDelQuantities[symbol];
          
          const holding = await trx('holdings').where({ user_id: req.user.id, symbol }).first();
          const holdingQty = holding ? Number(holding.quantity) : 0;
          
          const existingPos = await trx('positions').where({ user_id: req.user.id, symbol, product_type: 'DEL' }).whereNot({ quantity: 0 }).first();
          const posQty = existingPos && Number(existingPos.quantity) > 0 ? Number(existingPos.quantity) : 0;
          
          const pendingOrders = await trx('orders')
              .where({ user_id: req.user.id, symbol, side: 'SELL', product_type: 'DEL', status: 'PENDING' });
          const pendingSellQty = pendingOrders.reduce((sum, o) => sum + Number(o.quantity), 0);
          
          const totalAvailable = parseFloat((holdingQty + posQty - pendingSellQty).toFixed(4));
          
          if (qtyRequested > totalAvailable) {
              throw new Error(`Insufficient holdings for ${symbol}. You only have ${totalAvailable} shares available to sell.`);
          }
      }

      // 2. Deduct total margin
      if (requiredMargin > 0) {
        await trx('users')
          .where({ id: req.user.id })
          .update({ balance: parseFloat(user.balance) - requiredMargin });
      }

      // 3. Process each item
      const executedOrders = [];

      for (const item of items) {
        const { symbol, type, side, quantity, price, sl_price, tgt_price, product_type, margin } = item;
        const status = 'PENDING';
        const isMarket = type === 'MARKET';
        const effectiveProductType = product_type || 'INT';
        const execPrice = parseFloat(price) || priceCache[symbol]?.ltp || 0;
        
        const [orderId] = await trx('orders').insert({
          user_id: req.user.id,
          symbol, type, side, quantity, price: execPrice || null, sl_price, tgt_price,
          status,
          margin: margin || 0, // Individual margin recorded for cancellations
          product_type: effectiveProductType
        }).returning('id');

        const orderIdVal = typeof orderId === 'object' ? orderId.id : orderId;
        executedOrders.push({
          id: orderIdVal, symbol, status, isMarket, execPrice, type, side, quantity, sl_price, tgt_price, margin: margin || 0, product_type: effectiveProductType
        });
      }
      
      req.basketOrdersToProcess = executedOrders;
    });

    const triggerEngine = require('./services/triggerEngine');
    const finalResponseOrders = [];
    
    for (const ord of req.basketOrdersToProcess) {
       await triggerEngine.addOrderToMemory({
          id: ord.id, user_id: req.user.id, symbol: ord.symbol, type: ord.type, side: ord.side, quantity: ord.quantity, price: ord.execPrice || null,
          status: ord.status, sl_price: ord.sl_price || null, tgt_price: ord.tgt_price || null, trigger_price: null, trail_amount: null, product_type: ord.product_type, margin: ord.margin
       });
       
       if (ord.isMarket) {
          
          const isMutualFund = ord.symbol.endsWith('-MF') || /^\d+$/.test(ord.symbol);
          if (isMutualFund) {
             try {
                 const triggerEngineLocal = require('./services/triggerEngine');
                 triggerEngineLocal.removeOrderFromMemory(ord.id, ord.symbol);
                 triggerEngineLocal.executeOrder(ord, ord.execPrice).catch(e => console.error(e));
             } catch(e) {}
          } else {
             const realLtp = priceCache[ord.symbol]?.ltp || 0;
             if (realLtp > 0) {
                try {
                  await triggerEngine.evaluateTick(ord.symbol, realLtp);
                } catch (err) {
                  console.error('Immediate evaluation error for basket item:', err);
                }
             }
          }

       }
       
       finalResponseOrders.push({ id: ord.id, symbol: ord.symbol, status: ord.status });
    }
    
    setTimeout(() => {
        try {
            const { pubClient } = require('./services/redisClient');
            if (pubClient) pubClient.publish('reload_triggers', '1').catch(e=>{});
        } catch(e) {}
    }, 500);

    res.json({ success: true, orders: finalResponseOrders });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// ─── Cancel Order ─────────────────────────────────────────────────────────
app.post('/api/order/:id/cancel', authenticateToken, async (req, res) => {
  try {
    let cancelledOrder = null;
    let siblingsToClean = [];
    let autoExitOrderToExecute = null;
    let autoExitLtp = 0;

    await db.transaction(async (trx) => {
      const order = await trx('orders').where({ id: req.params.id, user_id: req.user.id }).first();
      // BUG FIX: Use throw instead of return res.status() inside a transaction.
      // 'return' only exits the callback arrow function, NOT the transaction — throw aborts it properly.
      if (!order) throw Object.assign(new Error('Order not found'), { statusCode: 404 });
      if (order.status !== 'PENDING' && order.status !== 'PENDING_TRIGGER')
        throw Object.assign(new Error('Only pending orders can be cancelled'), { statusCode: 400 });
      
      // Update status
      await trx('orders').where({ id: req.params.id }).update({ status: 'CANCELLED', updated_at: new Date() });
      
      // OCO: Cancel sibling legs if this is a BO leg
      if (order.parent_order_id) {
          const cancelledSiblings = await trx('orders')
            .where({ parent_order_id: order.parent_order_id, status: 'PENDING_TRIGGER' })
            .whereNot({ id: order.id });

          for (const sib of cancelledSiblings) {
            await trx('orders').where({ id: sib.id }).update({ status: 'CANCELLED', updated_at: new Date() });
            siblingsToClean.push(sib);
          }

          // Bracket order cancelled: Auto-exit the underlying position at market
          const parentOrder = await trx('orders').where({ id: order.parent_order_id }).first();
          if (parentOrder && parentOrder.status === 'EXECUTED') {
              const pos = await trx('positions').where({ user_id: req.user.id, symbol: order.symbol, product_type: parentOrder.product_type }).whereNot({ quantity: 0 }).first();
              if (pos) {
                 const exitQty = Math.min(Math.abs(pos.quantity), Number(parentOrder.quantity));
                 const exitSide = pos.quantity > 0 ? 'SELL' : 'BUY';
                 
                 if (exitQty > 0) {
                   autoExitLtp = priceCache[pos.symbol]?.ltp || Number(pos.average_price) || 0;
                   const [exitOrderId] = await trx('orders').insert({
                     user_id: req.user.id,
                     symbol: pos.symbol,
                     type: 'MARKET',
                     side: exitSide,
                     quantity: exitQty,
                     price: autoExitLtp || null,
                     status: 'PENDING',
                     product_type: pos.product_type || 'INT',
                     margin: 0,
                     created_at: new Date(),
                     updated_at: new Date()
                   }).returning('id');
                   const exitOrderIdVal = typeof exitOrderId === 'object' ? exitOrderId.id : exitOrderId;
                   autoExitOrderToExecute = {
                     id: exitOrderIdVal, user_id: req.user.id, symbol: pos.symbol, type: 'MARKET',
                     side: exitSide, quantity: exitQty, price: autoExitLtp || null, status: 'PENDING',
                     product_type: pos.product_type || 'INT', margin: 0
                   };
                 }
              }
          }
      }
      
      // BUG FIX: Always use order.margin for refund.
      // Previous fallback (order.quantity * order.price) gave ₹0 refund for MARKET orders
      // because market order price is null at placement time.
      const refundAmount = parseFloat(order.margin) || 0;
      if (refundAmount > 0) {
          const user = await trx('users').where({ id: req.user.id }).first();
          await trx('users').where({ id: req.user.id }).update({ balance: parseFloat(user.balance) + refundAmount });
          // BUG FIX: Write a MARGIN_RELEASE ledger entry to match the MARGIN_BLOCK written on placement
          await trx('ledger').insert({
            user_id: req.user.id,
            amount: refundAmount,
            type: 'MARGIN_RELEASE',
            description: `Margin refunded for cancelled order: ${order.quantity} ${order.symbol} ${order.side}`
          });
      }
      
      cancelledOrder = order;
    });

    const triggerEngine = require('./services/triggerEngine');
    triggerEngine.removeOrderFromMemory(req.params.id, cancelledOrder.symbol);
    for (const sib of siblingsToClean) {
      triggerEngine.removeOrderFromMemory(sib.id, sib.symbol);
    }

    if (autoExitOrderToExecute) {
      triggerEngine.removeOrderFromMemory(autoExitOrderToExecute.id, autoExitOrderToExecute.symbol);
      triggerEngine.executeOrder(autoExitOrderToExecute, autoExitLtp).catch(err => console.error('Auto-exit execution error on BO cancel:', err));
    }

    try {
        const { pubClient } = require('./services/redisClient');
        if (pubClient) pubClient.publish('reload_triggers', '1').catch(e=>{});
    } catch(e) {}
    
    res.json({ success: true });
  } catch (err) {
    const statusCode = err.statusCode || 500;
    res.status(statusCode).json({ error: err.message });
  }
});


// ─── ADMIN CLEANUP ENDPOINT ───
app.get('/api/admin/cleanup', async (req, res) => {
  try {
     console.log("Running manual API cleanup for expired contracts...");
     const patterns = ['%24JUL%', '%SENSEX2672377700%', '%NATURALGAS24JUL%'];
     let results = {};
     
     for (const pattern of patterns) {
         let pResults = { ordersDeleted: 0, positionsDeleted: 0, holdingsDeleted: 0, marginRefunded: 0 };
         
         const pendingOrders = await db('orders').where('symbol', 'like', pattern).whereIn('status', ['PENDING', 'PENDING_TRIGGER']);
         for (const order of pendingOrders) {
             const user = await db('users').where({ id: order.user_id }).first();
             if (user && order.margin && order.margin > 0) {
                 await db('users').where({ id: order.user_id }).update({ balance: parseFloat(user.balance) + parseFloat(order.margin) });
                 pResults.marginRefunded += parseFloat(order.margin);
             }
         }
         pResults.ordersDeleted = await db('orders').where('symbol', 'like', pattern).del();
         
         const stuckPositions = await db('positions').where('symbol', 'like', pattern);
         for (const pos of stuckPositions) {
             const user = await db('users').where({ id: pos.user_id }).first();
             if (user) {
                 const refundAmt = Math.abs(pos.quantity) * parseFloat(pos.average_price);
                 await db('users').where({ id: pos.user_id }).update({ balance: parseFloat(user.balance) + refundAmt });
                 pResults.marginRefunded += refundAmt;
             }
         }
         pResults.positionsDeleted = await db('positions').where('symbol', 'like', pattern).del();
         pResults.holdingsDeleted = await db('holdings').where('symbol', 'like', pattern).del();
         
         results[pattern] = pResults;
     }
     res.json({ success: true, message: "Cleanup complete", results });
  } catch (e) {
     console.error("Cleanup failed:", e.message, e.stack);
     res.status(500).json({ success: false, error: e.message, stack: e.stack });
  }
});

// ─── Edit Order ─────────────────────────────────────────────────────────
app.put('/api/order/:id', authenticateToken, async (req, res) => {
      const { isMarket, quantity, price, sl_price, tgt_price } = req.body;
      if (!isMarket && (!quantity || price === undefined)) {
        return res.status(400).json({ error: 'Missing quantity or price' });
      }

      try {
        let marketOrderToExecute = null;
        let ltpForMarket = 0;
        let updatedOrder = null;
        let updatedChildOrders = [];
        
        await db.transaction(async (trx) => {
          const order = await trx('orders').where({ id: req.params.id, user_id: req.user.id }).first();
          if (!order) throw Object.assign(new Error('Order not found'), { statusCode: 404 });
          if (order.status !== 'PENDING' && order.status !== 'PENDING_TRIGGER') {
            throw Object.assign(new Error('Only PENDING or PENDING_TRIGGER orders can be modified'), { statusCode: 400 });
          }

          // Handle Market Execution override for Pending Triggers
          if (isMarket && order.status === 'PENDING_TRIGGER') {
             ltpForMarket = priceCache[order.symbol]?.ltp || Number(order.trigger_price) || Number(order.price) || 0;
             if (ltpForMarket <= 0) throw Object.assign(new Error('Live price unavailable for market execution'), { statusCode: 400 });
             
             // Update the order type to MARKET and status to PENDING so triggerEngine accepts it
             await trx('orders').where({ id: order.id }).update({ type: 'MARKET', status: 'PENDING', trigger_price: null, price: null, updated_at: new Date() });
             
             // We will execute it outside this transaction
             marketOrderToExecute = { ...order, type: 'MARKET', status: 'PENDING', trigger_price: null, price: null };
             return;
          }

          const { calculateRequiredMargin } = require('./services/marginEngine');
          const oldMargin = parseFloat(order.margin || 0);
          let newMargin = oldMargin;
          if (!order.parent_order_id) {
              newMargin = calculateRequiredMargin(order.symbol, order.product_type, order.side, Number(quantity), parseFloat(price));
          }

          const marginDifference = newMargin - oldMargin;
      
          // Check if user has enough balance if margin increases
          const user = await trx('users').where({ id: req.user.id }).first();
          if (marginDifference > 0 && parseFloat(user.balance) < marginDifference) {
             throw Object.assign(new Error('Insufficient Funds.'), { statusCode: 400 });
          }

          // Mathematical Price Validation for PENDING_TRIGGER
          if (order.status === 'PENDING_TRIGGER') {
             const parent = await trx('orders').where({ id: order.parent_order_id }).first();
             if (parent) {
                 const entryPrice = parseFloat(parent.price);
                 if (order.type === 'SL-M') {
                     if (order.side === 'SELL' && parseFloat(price) >= entryPrice) {
                         throw Object.assign(new Error('BO Buy: Stop-Loss must be lower than execution price.'), { statusCode: 400 });
                     } else if (order.side === 'BUY' && parseFloat(price) <= entryPrice) {
                         throw Object.assign(new Error('BO Sell: Stop-Loss must be higher than execution price.'), { statusCode: 400 });
                     }
                 } else if (order.type === 'LIMIT') {
                     if (order.side === 'SELL' && parseFloat(price) <= entryPrice) {
                         throw Object.assign(new Error('BO Buy: Target must be higher than execution price.'), { statusCode: 400 });
                     } else if (order.side === 'BUY' && parseFloat(price) >= entryPrice) {
                         throw Object.assign(new Error('BO Sell: Target must be lower than execution price.'), { statusCode: 400 });
                     }
                 }
             }
          }

          // Build update object
          const updateObj = { 
              quantity: Number(quantity), 
              price: parseFloat(price),
              margin: newMargin,
              updated_at: new Date()
          };

          if (order.status === 'PENDING_TRIGGER' && order.type === 'SL-M') {
              updateObj.trigger_price = parseFloat(price);
              updateObj.price = null; // SL-M is a market order when triggered
          }

          // Update sl_price and tgt_price if provided
          if (sl_price !== undefined) updateObj.sl_price = sl_price;
          if (tgt_price !== undefined) updateObj.tgt_price = tgt_price;

          // Update Order in database
          await trx('orders').where({ id: req.params.id }).update(updateObj);
          updatedOrder = { ...order, ...updateObj };
          
          // Update child OCO orders (SL and Target legs) if sl_price or tgt_price changed
          if (sl_price !== undefined || tgt_price !== undefined) {
            const childOrders = await trx('orders')
              .where({ parent_order_id: req.params.id, status: 'PENDING_TRIGGER' });
            
            for (const child of childOrders) {
              if (child.type === 'SL-M' && sl_price !== undefined) {
                await trx('orders').where({ id: child.id }).update({ 
                  trigger_price: sl_price,
                  price: sl_price,
                  updated_at: new Date()
                });
                updatedChildOrders.push({ ...child, trigger_price: sl_price, price: sl_price });
              } else if (child.type === 'LIMIT' && tgt_price !== undefined) {
                await trx('orders').where({ id: child.id }).update({ 
                  price: tgt_price,
                  updated_at: new Date()
                });
                updatedChildOrders.push({ ...child, price: tgt_price });
              }
            }
          }

          // Update Balance & Ledger (deduct difference if positive, refund if negative)
          if (marginDifference > 0) {
              await trx('users').where({ id: req.user.id }).update({ balance: parseFloat(user.balance) - marginDifference });
              await trx('ledger').insert({
                user_id: req.user.id,
                amount: -marginDifference,
                type: 'MARGIN_BLOCK',
                description: `Additional margin blocked for modified order: ${quantity} ${order.symbol} (${order.product_type})`
              });
          } else if (marginDifference < 0) {
              const refundAmount = Math.abs(marginDifference);
              await trx('users').where({ id: req.user.id }).update({ balance: parseFloat(user.balance) + refundAmount });
              await trx('ledger').insert({
                user_id: req.user.id,
                amount: refundAmount,
                type: 'MARGIN_RELEASE',
                description: `Margin refunded for modified order: ${quantity} ${order.symbol} (${order.product_type})`
              });
          }
        });

        // Outside Transaction: update Redis triggers
        if (marketOrderToExecute) {
            const triggerEngine = require('./services/triggerEngine');
            triggerEngine.removeOrderFromMemory(marketOrderToExecute.id, marketOrderToExecute.symbol);
            triggerEngine.executeOrder(marketOrderToExecute, ltpForMarket).catch(err => console.error(err));
            return res.json({ success: true, executed: true });
        }

        const triggerEngine = require('./services/triggerEngine');
        if (updatedOrder) {
            await triggerEngine.removeOrderFromMemory(updatedOrder.id, updatedOrder.symbol);
            await triggerEngine.addOrderToMemory(updatedOrder);
        }
        for (const child of updatedChildOrders) {
            await triggerEngine.removeOrderFromMemory(child.id, child.symbol);
            await triggerEngine.addOrderToMemory(child);
        }

        try {
            const { pubClient } = require('./services/redisClient');
            if (pubClient) pubClient.publish('reload_triggers', '1').catch(e=>{});
        } catch(e) {}
        
        res.json({ success: true });

      } catch (err) {
        const statusCode = err.statusCode || 500;
        res.status(statusCode).json({ error: err.message });
      }
});


// ─── Historical Chart Data (Candles) ──────────────────────────────────────────────────
const candleCache = {}; // Cache to protect Fyers from rate limits (e.g. 1000 users opening charts)
// Smart Timeframe Cache: Determine cache limit based on requested resolution and Market Hours
function getCacheDuration(interval, symbol) {
  // 1. After-Hours Mega Cache Logic (Exclude MCX Commodities)
  const isCommodity = symbol && symbol.toUpperCase().includes('MCX');
  
  if (!isCommodity) {
      const now = new Date();
      const istTime = new Date(now.toLocaleString("en-US", {timeZone: "Asia/Kolkata"}));
      const hours = istTime.getHours();
      
      // If market is closed (4:00 PM to 8:59 AM IST)
      if (hours >= 16 || hours < 9) {
          // Calculate exact milliseconds until 9:00 AM IST tomorrow morning
          const next9AM = new Date(istTime);
          if (hours >= 16) {
              next9AM.setDate(next9AM.getDate() + 1);
          }
          next9AM.setHours(9, 0, 0, 0);
          return next9AM.getTime() - istTime.getTime(); // Cache expires exactly at 9:00 AM!
      }
  }

  // 2. Standard Market-Hours Smart Timeframe Logic
  if (interval === '1') return 60 * 1000; // 1 min
  if (interval === '2') return 2 * 60 * 1000;
  if (interval === '3') return 3 * 60 * 1000;
  if (interval === '5') return 5 * 60 * 1000;
  if (interval === '10') return 10 * 60 * 1000;
  if (interval === '15') return 15 * 60 * 1000;
  if (interval === '30') return 30 * 60 * 1000;
  if (interval === '60' || interval === '1H') return 60 * 60 * 1000; // 1 hr
  if (interval === 'D' || interval === '1D' || interval === 'ONE_DAY') return 12 * 60 * 60 * 1000; // 12 hours
  return 60 * 1000; // fallback 1 min
}

app.get('/api/candles/:symbol', async (req, res) => {
  try {
    const { fetchCandleData } = require('./services/fyers');
    const interval = req.query.interval || 'ONE_DAY';
    let cleanSymbol = req.params.symbol;
    if (cleanSymbol.includes('CE') || cleanSymbol.includes('PE')) {
        cleanSymbol = cleanSymbol.replace(/\s+/g, '');
    }
    const cacheKey = `${cleanSymbol}_${interval}`;
    const now = Date.now();
    
    // Serve from cache if valid
    const maxAgeMs = getCacheDuration(interval, cleanSymbol);
      if (candleCache[cacheKey] && (now - candleCache[cacheKey].timestamp < maxAgeMs)) {
      return res.json(candleCache[cacheKey].data);
    }

    const candles = await fetchCandleData(cleanSymbol, interval);

    // Retry once if empty — the Fyers token may still be initializing at boot
    // (login is async; the first candle request can arrive before setAccessToken finishes)
    if ((!candles || candles.length === 0)) {
      await new Promise(r => setTimeout(r, 500));
      const retryCandles = await fetchCandleData(cleanSymbol, interval);
      if (retryCandles && retryCandles.length > 0) {
        candleCache[cacheKey] = { timestamp: now, data: retryCandles };
        return res.json(retryCandles);
      }
    }

    // Save to cache only if valid data is returned
    if (candles && candles.length > 0) {
      candleCache[cacheKey] = {
        timestamp: now,
        data: candles
      };
    }
    
    res.json(candles);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── Stock Details (Groww API) ──────────────────────────────────────────────

const stockDetailsCache = {};

async function fetchGoogleNews(symbol) {
  try {
    const q = encodeURIComponent(symbol + ' stock NSE');
    const res = await fetch(`https://news.google.com/rss/search?q=${q}`);
    const xml = await res.text();
    const items = [];
    const itemRegex = /<item>([\s\S]*?)<\/item>/g;
    let match;
    while ((match = itemRegex.exec(xml)) !== null && items.length < 5) {
      const itemXml = match[1];
      const titleMatch = itemXml.match(/<title>([\s\S]*?)<\/title>/);
      const linkMatch = itemXml.match(/<link>([\s\S]*?)<\/link>/);
      const pubDateMatch = itemXml.match(/<pubDate>([\s\S]*?)<\/pubDate>/);
      const sourceMatch = itemXml.match(/<source[^>]*>([\s\S]*?)<\/source>/);
      
      if (titleMatch && linkMatch) {
        let title = titleMatch[1].replace(/<!\[CDATA\[(.*?)\]\]>/, '$1').replace(/&amp;/g, '&');
        let publisher = sourceMatch ? sourceMatch[1] : 'News';
        if (title.includes(' - ')) {
          const parts = title.split(' - ');
          if (!sourceMatch) publisher = parts.pop();
          else parts.pop();
          title = parts.join(' - ');
        }
        
        let providerPublishTime = Math.floor(Date.now()/1000);
        if (pubDateMatch) {
           const d = new Date(pubDateMatch[1]);
           if (!isNaN(d.getTime())) providerPublishTime = Math.floor(d.getTime()/1000);
        }
        
        items.push({
          title,
          link: linkMatch[1],
          publisher,
          providerPublishTime
        });
      }
    }
    return items;
  } catch (err) {
    console.error('Google News error:', err);
    return [];
  }
}

app.get('/api/stocks/:symbol/details', async (req, res) => {
  const symbol = req.params.symbol;
  // Clean symbol by stripping exchange prefix (NSE:, BSE:, MCX:) and suffix (-EQ, -A, -B, -INDEX, etc.)
  let cleanName = symbol.replace(/^(NSE|BSE|MCX):/i, '').split('-')[0].trim();

  // Derivatives (Options/Futures) won't be found on Groww stock search.
  const isDerivative = isDerivativeContract(symbol);
  if (isDerivative) {
    return res.json({
      header: { companyName: symbol, nseScriptCode: cleanName, bseScriptCode: cleanName, industryName: 'Derivatives' },
      priceData: {},
      stats: {},
      details: { businessSummary: `Derivative contract (${symbol}) traded on Indian financial exchanges.`, managingDirector: '-', foundedYear: '-' },
      isDerivative: true
    });
  }

  if (stockDetailsCache[cleanName] && (Date.now() - stockDetailsCache[cleanName].timestamp < 3600000)) {
    return res.json(stockDetailsCache[cleanName].data);
  }

  try {
    // 1. Find Groww search_id
    const searchRes = await fetch(`https://groww.in/v1/api/search/v1/entity?app=false&entity_type=stocks&size=5&q=${encodeURIComponent(cleanName)}`, {
      headers: { 'User-Agent': 'Mozilla/5.0' }
    });
    const searchData = await searchRes.json().catch(() => ({}));
    
    let searchId = null;
    let matchedItem = null;
    if (searchData && Array.isArray(searchData.content) && searchData.content.length > 0) {
      matchedItem = searchData.content.find(c => 
        (c.nse_script_code && c.nse_script_code.toUpperCase() === cleanName.toUpperCase()) ||
        (c.bse_scrip_code && String(c.bse_scrip_code).toUpperCase() === cleanName.toUpperCase()) ||
        (c.search_id && c.search_id.toUpperCase().includes(cleanName.toUpperCase()))
      ) || searchData.content[0];
      searchId = matchedItem?.search_id;
    }

    if (!searchId) {
      // Return a clean fallback object instead of 404 error
      const fallback = {
        header: { companyName: cleanName, nseScriptCode: cleanName, bseScriptCode: cleanName, industryName: 'Equity' },
        priceData: {},
        stats: {},
        details: { businessSummary: `${cleanName} is a publicly traded security on Indian stock exchanges.`, managingDirector: '-', foundedYear: '-' },
        fundamentals: []
      };
      return res.json(fallback);
    }

    // 2. Fetch full details from Groww and live price data for circuits
    const [detailsRes, liveRes] = await Promise.all([
      fetch(`https://groww.in/v1/api/stocks_data/v1/company/search_id/${searchId}`, { headers: { 'User-Agent': 'Mozilla/5.0' } }),
      fetch(`https://groww.in/v1/api/stocks_data/v1/tr_live_prices/exchange/NSE/segment/CASH/${cleanName}/latest`, { headers: { 'User-Agent': 'Mozilla/5.0' } }).catch(() => null)
    ]);
    const data = await detailsRes.json();
    const liveData = liveRes && liveRes.ok ? await liveRes.json().catch(() => null) : null;
    
    if (liveData) {
      data.livePriceData = liveData;
    }

    // Ensure header has clean readable symbol codes
    if (data.header) {
      if (!data.header.nseScriptCode && !data.header.bseScriptCode) {
        data.header.nseScriptCode = cleanName;
      }
    }
    
    if (data.similarAssets && data.similarAssets.peerList) {
      const peerPromises = data.similarAssets.peerList.map(p => {
        const pCode = p.companyHeader?.nseScriptCode || p.companyHeader?.bseScriptCode;
        if (!pCode) return Promise.resolve(null);
        return fetch(`https://groww.in/v1/api/stocks_data/v1/tr_live_prices/exchange/NSE/segment/CASH/${pCode}/latest`, { headers: { 'User-Agent': 'Mozilla/5.0' } })
          .then(r => r.json())
          .catch(() => null);
      });
      const peerLivePrices = await Promise.all(peerPromises);
      data.similarAssets.peerList.forEach((p, i) => {
        if (peerLivePrices[i]) {
          p.livePriceData = peerLivePrices[i];
        }
      });
    }
    
    try {
      data.news = await fetchGoogleNews(cleanName);
    } catch(e) {
      data.news = [];
    }

    stockDetailsCache[cleanName] = { timestamp: Date.now(), data };
    res.json(data);
  } catch (err) {
    console.error('Stock Details Fetch Error for', cleanName, err.message);
    const fallback = {
      header: { companyName: cleanName, nseScriptCode: cleanName, bseScriptCode: cleanName, industryName: 'Equity' },
      priceData: {},
      stats: {},
      details: { businessSummary: `${cleanName} is a publicly traded security on Indian stock exchanges.`, managingDirector: '-', foundedYear: '-' },
      fundamentals: []
    };
    res.json(fallback);
  }
});

// ─── Socket.IO ────────────────────────────────────────────────────────────
io.on('connection', (socket) => {
  // NOTE: Do NOT log every connect/disconnect — at 50k users this would spam logs

  // FIX: Send initial cache as 'price_init' (not 'price_snapshot') so the frontend
  // treats it as stale cache data and doesn't block REST fallback for 20s.
  // Live 100ms-interval batches continue to use 'price_snapshot'.
  if (Object.keys(priceCache).length > 0) {
    socket.emit('price_init', priceCache);
  }

  socket.on('register_user', (userId) => {
    if (userId) {
      socket.join(userId.toString());
    }
  });

  socket.on('subscribe', (data) => {
    if (Array.isArray(data)) {
        data.forEach(sym => {
            let symbol = typeof sym === 'string' ? sym : sym.symbol;
            if (symbol) socket.join(symbol);
        });
        if (isMaster) {
            const { addSubscriptionBatch } = require('./services/fyers');
            if (addSubscriptionBatch) addSubscriptionBatch(data);
        } else {
            try {
                const { pubClient } = require('./services/redisClient');
                pubClient.publish('fyers_subscribe', JSON.stringify(data)).catch(e=>{});
            } catch (err) {}
        }
    } else {
        let symbol = typeof data === 'string' ? data : data.symbol;
        if (symbol) socket.join(symbol);
        if (isMaster) {
            const { addSubscription } = require('./services/fyers');
            if (addSubscription) addSubscription(data, io, priceCache);
        } else {
            try {
                const { pubClient } = require('./services/redisClient');
                pubClient.publish('fyers_subscribe', JSON.stringify([symbol])).catch(e=>{});
            } catch (err) {}
        }
    }
  });

  socket.on('ping_subscriptions', (symbolsArray) => {
    if (!Array.isArray(symbolsArray)) return;
    
    // Join socket.io rooms for each symbol so targeted price_snapshot broadcasts reach this client.
    symbolsArray.forEach(sym => {
      if (sym && typeof sym === 'string') socket.join(sym);
    });

    if (isMaster) {
      const { handlePingSubscriptions } = require('./services/fyers');
      if (handlePingSubscriptions) handlePingSubscriptions(symbolsArray);
    } else {
      try {
        const { pubClient } = require('./services/redisClient');
        pubClient.publish('fyers_ping', JSON.stringify(symbolsArray)).catch(e=>{});
      } catch (err) {}
    }
  });


  socket.on('unsubscribe', (data) => {
    let symbol = typeof data === 'string' ? data : data.symbol;
    socket.leave(symbol);
  });

    socket.on('subscribe_depth', (symbol) => {
    // [DISABLED for bandwidth/traffic optimization]
    // Keeping this route as a dummy so it can easily be re-enabled for VIP/Yearly customers later.
    return;
  });

  socket.on('unsubscribe_depth', (symbol) => {
    // [DISABLED for bandwidth/traffic optimization]
    return;
  });

  socket.on('disconnect', () => {
    // NOTE: No log here intentionally — at scale this would spam the logger
  });
});

app.get('/api/debug-state', (req, res) => {
  const { getFyersAuthURL, getFyersStatus } = require('./services/fyers');
  let state = {};
  if (getFyersAuthURL) {
    state = getFyersAuthURL();
  }
  let fyersStatus = {};
  if (getFyersStatus) {
    fyersStatus = getFyersStatus();
  }
  res.json({
    state,
    fyers: fyersStatus,
    lastOrderError,
    time: new Date().toISOString(),
    isMaster: process.env.NODE_APP_INSTANCE === '0' || !process.env.NODE_APP_INSTANCE,
    pmId: process.env.pm_id
  });
});

app.get('/api/fyers/auth-url', (req, res) => {
  const { getFyersAuthURL } = require('./services/fyers');
  try {
    const url = getFyersAuthURL();
    res.json({ url });
  } catch (err) {
    console.error("Error generating Fyers Auth URL:", err);
    res.status(500).json({ error: "Failed to generate auth URL" });
  }
});

app.get('/api/diagnostics/logs', (req, res) => {
  const fs = require('fs');
  const path = require('path');
  try {
    const today = new Date().toISOString().split('T')[0];
    const logFile = path.join(__dirname, 'error.log');
    if (fs.existsSync(logFile)) {
      const content = fs.readFileSync(logFile, 'utf8');
      const lines = content.split('\n');
      res.type('text/plain').send(lines.slice(Math.max(lines.length - 200, 0)).join('\n'));
    } else {
      res.type('text/plain').send('No log file found for today.');
    }
  } catch (err) {
    res.type('text/plain').send(err.message);
  }
});

app.get('/api/fyers/status', (req, res) => {
  try {
    const { getFyersStatus } = require('./services/fyers');
    if (getFyersStatus) {
      res.json(getFyersStatus());
    } else {
      res.status(500).json({ error: 'getFyersStatus not exported' });
    }
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Fyers OAuth Callback directly handled by backend
app.get('/api/fyers/callback', async (req, res) => {
  const { auth_code } = req.query;
  if (!auth_code) {
    return res.redirect('/?fyers_error=no_auth_code');
  }
  try {
    const { verifyFyersAuth } = require('./services/fyers');
    const result = await verifyFyersAuth(auth_code);
    if (result.success) {
      res.redirect('/?fyers_success=true');
    } else {
      res.redirect('/?fyers_error=' + encodeURIComponent(result.error));
    }
  } catch (err) {
    console.error(err);
    res.redirect('/?fyers_error=server_error');
  }
});

app.post('/api/fyers/verify', async (req, res) => {
  const { auth_code } = req.body;
  if (!auth_code) return res.status(400).json({ error: "Missing auth_code" });
  
  const { verifyFyersAuth } = require('./services/fyers');
  try {
    const result = await verifyFyersAuth(auth_code);
    if (result && result.success) {
      res.json({ success: true, message: "Fyers authenticated successfully!" });
    } else {
      res.status(401).json({ success: false, error: result?.error || "Fyers authentication failed." });
    }
  } catch (err) {
    console.error("Fyers Verify Error:", err);
    res.status(500).json({ success: false, error: "Internal Server Error" });
  }
});

app.get('/api/fyers-debug', (req, res) => {
  const { getFyersStatus } = require('./services/fyers');
  if (getFyersStatus) {
    res.json(getFyersStatus());
  } else {
    res.json({ error: 'getFyersStatus not found' });
  }
});

// ─── Serve Frontend in Production ─────────────────────────────────────────
app.use(express.static(path.join(__dirname, '../frontend/dist'), {
  setHeaders: (res, filePath) => {
    if (filePath.endsWith('.html')) {
      res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    }
  }
}));

// --- REWARD WITHDRAWALS & BANK DETAILS ---

app.post('/api/user/bank_details', authenticateToken, async (req, res) => {
  try {
    const { upi_id, bank_account_no, bank_ifsc } = req.body;
    await db('users').where({ id: req.user.id }).update({
      upi_id,
      bank_account_no,
      bank_ifsc
    });
    res.json({ success: true, message: 'Bank details updated successfully' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/withdrawals/request', authenticateToken, async (req, res) => {
  try {
    const { amount } = req.body;
    if (!amount || isNaN(amount) || amount <= 0) return res.status(400).json({ error: 'Invalid amount' });

    // Check if user has bank details
    const user = await db('users').where({ id: req.user.id }).first();
    if (!user.upi_id && (!user.bank_account_no || !user.bank_ifsc)) {
      return res.status(400).json({ error: 'Please update your Bank or UPI details in Settings before withdrawing' });
    }

    // Calculate available balance
    const referrals = await db('referrals').where({ referrer_id: req.user.id, status: 'completed' });
    const totalEarned = referrals.reduce((sum, r) => sum + parseFloat(r.reward_amount || 0), 0);
    
    const withdrawals = await db('reward_withdrawals').where({ user_id: req.user.id });
    const blockedAmount = withdrawals.filter(w => ['PENDING', 'PROCESSING', 'CREDITED'].includes(w.status)).reduce((sum, w) => sum + parseFloat(w.amount), 0);
    
    const availableRewardBalance = totalEarned - blockedAmount;

    if (amount > availableRewardBalance) {
      return res.status(400).json({ error: 'Insufficient reward balance' });
    }

    await db('reward_withdrawals').insert({
      user_id: req.user.id,
      amount: amount,
      status: 'PENDING'
    });

    res.json({ success: true, message: 'Withdrawal request submitted successfully' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/admin/withdrawals', authenticateToken, async (req, res) => {
  try {
    const caller = await db('users').where({ id: req.user.id }).first();
    if (!caller.is_admin) return res.status(403).json({ error: 'Admin access required' });

    const withdrawals = await db('reward_withdrawals')
      .join('users', 'reward_withdrawals.user_id', 'users.id')
      .select(
        'reward_withdrawals.*', 
        'users.username', 
        'users.email',
        'users.phone',
        'users.upi_id',
        'users.bank_account_no',
        'users.bank_ifsc',
        'users.last_ip',
        'users.registration_ip'
      )
      .orderBy('reward_withdrawals.created_at', 'desc');

    // Group users by IP to detect multi-account fraud
    const ipCounts = await db('users')
      .whereNotNull('last_ip')
      .whereNot('last_ip', '')
      .groupBy('last_ip')
      .select('last_ip')
      .count('id as count');

    const ipMap = {};
    ipCounts.forEach(r => {
      ipMap[r.last_ip] = parseInt(r.count, 10);
    });

    const enhanced = [];
    for (const w of withdrawals) {
      const ip = w.last_ip || w.registration_ip;
      const sharedCount = ip ? (ipMap[ip] || 1) : 1;
      let sharedUsers = [];
      if (sharedCount > 1 && ip) {
        const matching = await db('users')
          .where(function() {
            this.where('last_ip', ip).orWhere('registration_ip', ip);
          })
          .whereNot('id', w.user_id)
          .select('id', 'username')
          .limit(5);
        sharedUsers = matching.map(m => m.username);
      }
      enhanced.push({
        ...w,
        shared_ip_count: sharedCount,
        shared_users: sharedUsers
      });
    }

    res.json({ success: true, withdrawals: enhanced });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── Live Leaderboard (Cached in Redis for 60s) ───────────────────────────
app.get('/api/leaderboard', async (req, res) => {
  try {
    const { generalClient } = require('./services/redisClient');
    const cacheKey = 'leaderboard:daily:top50';

    if (generalClient && generalClient.isReady) {
      const cached = await generalClient.get(cacheKey);
      if (cached) {
        return res.json(JSON.parse(cached));
      }
    }

    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    const topTraders = await db('positions')
      .join('users', 'positions.user_id', 'users.id')
      .where('users.is_admin', false)
      .where('positions.created_at', '>=', todayStart)
      .groupBy('users.id', 'users.username', 'users.profile_picture_url')
      .select(
        'users.id as user_id',
        'users.username',
        'users.profile_picture_url',
        db.raw('COALESCE(SUM(positions.realized_pnl), 0) as total_pnl'),
        db.raw('COUNT(positions.id) as total_trades'),
        db.raw('SUM(CASE WHEN positions.realized_pnl > 0 THEN 1 ELSE 0 END) as winning_trades')
      )
      .having(db.raw('COALESCE(SUM(positions.realized_pnl), 0) > 0'))
      .orderBy('total_pnl', 'desc')
      .limit(50);

    const formatted = topTraders.map((t, idx) => {
      const total = parseInt(t.total_trades || 0, 10);
      const wins = parseInt(t.winning_trades || 0, 10);
      const winRate = total > 0 ? Math.round((wins / total) * 100) : 0;
      return {
        rank: idx + 1,
        username: t.username,
        profile_picture_url: t.profile_picture_url,
        pnl: parseFloat(t.total_pnl || 0),
        totalTrades: total,
        winRate: winRate
      };
    });

    const result = { success: true, leaderboard: formatted, lastUpdated: Date.now() };

    if (generalClient && generalClient.isReady) {
      await generalClient.setEx(cacheKey, 60, JSON.stringify(result)).catch(() => null);
    }

    res.json(result);
  } catch (err) {
    console.error('Leaderboard error:', err);
    res.status(500).json({ error: 'Failed to fetch leaderboard' });
  }
});

// ─── Platform Announcements ────────────────────────────────────────────────
app.get('/api/announcement', async (req, res) => {
  try {
    const { generalClient } = require('./services/redisClient');
    let announcement = null;

    if (generalClient && generalClient.isReady) {
      const data = await generalClient.hGetAll('platform:announcement');
      if (data && data.text) {
        announcement = {
          text: data.text,
          type: data.type || 'info',
          updated_at: data.updated_at
        };
      }
    }
    res.json({ success: true, announcement });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch announcement' });
  }
});

app.post('/api/admin/announcement', authenticateToken, async (req, res) => {
  try {
    const caller = await db('users').where({ id: req.user.id }).first();
    if (!caller || !caller.is_admin) return res.status(403).json({ error: 'Unauthorized' });

    const { text, type } = req.body;
    const { generalClient } = require('./services/redisClient');

    if (!text || text.trim() === '') {
      if (generalClient && generalClient.isReady) {
        await generalClient.del('platform:announcement');
      }
      io.emit('announcement_update', null);
      return res.json({ success: true, message: 'Announcement cleared' });
    }

    const announcementData = {
      text: text.trim(),
      type: type || 'info',
      updated_at: new Date().toISOString()
    };

    if (generalClient && generalClient.isReady) {
      await generalClient.hSet('platform:announcement', announcementData);
    }

    io.emit('announcement_update', announcementData);

    res.json({ success: true, announcement: announcementData });
  } catch (err) {
    res.status(500).json({ error: 'Failed to save announcement' });
  }
});

app.post('/api/admin/withdrawals/:id/process', authenticateToken, async (req, res) => {
  try {
    const caller = await db('users').where({ id: req.user.id }).first();
    if (!caller.is_admin) return res.status(403).json({ error: 'Admin access required' });

    const { status } = req.body; // 'PROCESSING', 'CREDITED', 'REJECTED'
    if (!['PROCESSING', 'CREDITED', 'REJECTED'].includes(status)) return res.status(400).json({ error: 'Invalid status' });

    await db('reward_withdrawals').where({ id: req.params.id }).update({ status, updated_at: db.fn.now() });

    res.json({ success: true, message: 'Withdrawal status updated' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/referrals', authenticateToken, async (req, res) => {
  try {
    const referrals = await db('referrals')
      .join('users', 'referrals.referred_user_id', 'users.id')
      .where('referrals.referrer_id', req.user.id)
      .select('referrals.*', 'users.username', 'users.email')
      .orderBy('referrals.created_at', 'desc');

    const totalEarned = referrals.filter(r => r.status === 'completed').reduce((sum, r) => sum + parseFloat(r.reward_amount || 0), 0);
    const pendingCount = referrals.filter(r => r.status === 'pending').length;
    const completedCount = referrals.filter(r => r.status === 'completed').length;

    res.json({
      success: true,
      referrals,
      stats: {
        totalEarned,
        pendingCount,
        completedCount,
        totalCount: referrals.length
      }
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.use((req, res) => {
  // If the request is for a static asset that wasn't found, return 404 to avoid serving HTML as JS
  if (req.path.match(/\.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot)$/)) {
    return res.status(404).send('Asset not found');
  }
  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
  res.sendFile(path.join(__dirname, '../frontend/dist/index.html'));
});

// ─── Start ────────────────────────────────────────────────────────────────
const { initFyers, setPriceCache } = require('./services/fyers');
setPriceCache(priceCache);

const { updateOptionsMaster } = require('./database/updateOptionsMaster');

const PORT = process.env.PORT || 5000;



server.listen(PORT, async () => {
  console.log(`Server listening on port ${PORT} - Instance ${process.env.NODE_APP_INSTANCE || 0}`);

    // Always initialize Fyers (fyers.js has hardcoded fallback credentials)
    await initFyers(io, priceCache, isMaster);

    if (isMaster) {
      console.log('👑 Master Instance: Starting background tasks and Fyers connection...');

      // Daily Garbage Collector: Wipe dead positions from yesterday (before today 00:00 AM)
      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);
      db('positions').where({ quantity: 0 }).where('updated_at', '<', todayStart).delete()
        .then(count => console.log(`[DB MAINTENANCE] Cleared ${count} dead positions from previous days on startup.`))
        .catch(err => console.error('Failed to run position garbage collector:', err));

      
      // Listen for WebSocket subscriptions from Worker nodes
      const { subClient: cacheSubClient } = require('./services/redisClient');
      const setupMasterSubscriptions = () => {
          cacheSubClient.subscribe('fyers_subscribe', (message) => {
              try {
                  const symbols = JSON.parse(message);
                  const { addSubscriptionBatch } = require('./services/fyers');
                  if (addSubscriptionBatch) addSubscriptionBatch(symbols);
              } catch(e){}
          }).catch(console.error);

          cacheSubClient.subscribe('fyers_ping', (message) => {
              try {
                  const symbols = JSON.parse(message);
                  const { handlePingSubscriptions } = require('./services/fyers');
                  if (handlePingSubscriptions) handlePingSubscriptions(symbols);
              } catch(e){}
          }).catch(console.error);
      };
      
      if (cacheSubClient.isReady) setupMasterSubscriptions();
      else cacheSubClient.on('ready', setupMasterSubscriptions);

      // --- BOOT SELF-SUBSCRIPTION ---
      const bootSubscribeFromDB = async () => {
        try {
          const db = require('./database/db');
          const { addSubscriptionBatch } = require('./services/fyers');
          if (!addSubscriptionBatch) return;
          const allSymbols = new Set(['NSE:NIFTY50-INDEX', 'NSE:NIFTYBANK-INDEX', 'BSE:SENSEX-INDEX']);
          const wlRows = await db('watchlists').select('symbols').catch(() => []);
          wlRows.forEach(row => {
            try {
              const syms = typeof row.symbols === 'string' ? JSON.parse(row.symbols) : (row.symbols || []);
              syms.forEach(s => { const sym = typeof s === 'string' ? s : s && s.symbol; if (sym && !sym.endsWith('-MF')) allSymbols.add(sym); });
            } catch(e) {}
          });
          const posRows = await db('positions').where('qty', '!=', 0).select('symbol').catch(() => []);
          posRows.forEach(r => { if (r.symbol) allSymbols.add(r.symbol); });
          const ordRows = await db('orders').whereIn('status', ['PENDING', 'PENDING_TRIGGER']).select('symbol').catch(() => []);
          ordRows.forEach(r => { if (r.symbol) allSymbols.add(r.symbol); });
          const list = Array.from(allSymbols);
          console.log('Boot self-subscription: ' + list.length + ' symbols from DB');
          addSubscriptionBatch(list);
        } catch(e) { console.error('Boot self-sub error:', e.message); }
      };
      setTimeout(bootSubscribeFromDB, 5000);
      setTimeout(bootSubscribeFromDB, 15000);
      setTimeout(bootSubscribeFromDB, 30000);
      setInterval(bootSubscribeFromDB, 5 * 60 * 1000);
      // ---------------------------------

      // Update options master in background
      updateOptionsMaster().catch(e => console.error(e));
    
    // Start Cron Jobs
    const { startSquareOffJobs } = require('./services/autoSquareOff');
    const { initRiskyStocksSync } = require('./services/riskyStocksSync');
    const { initOrderExecutor } = require('./services/orderExecutor');
    const triggerEngine = require('./services/triggerEngine');
    const MTMRiskManager = require('./services/mtmRiskManager');
    const { initCronJobs } = require('./services/cronJobs');
    const schedule = require('node-schedule');

    // Refresh Fyers Token daily at 2:00 AM IST
    const loginRule = new schedule.RecurrenceRule();
    loginRule.dayOfWeek = [new schedule.Range(1, 5)]; // Mon-Fri
    loginRule.hour = 2;
    loginRule.minute = 0;
    loginRule.tz = 'Asia/Kolkata';
    schedule.scheduleJob(loginRule, async () => {
      console.log('⏰ Daily 2:00 AM Cron: Refreshing Fyers Token...');
      await initFyers(io, priceCache, true);
      });

      const optionsRule = new schedule.RecurrenceRule();
      optionsRule.dayOfWeek = [new schedule.Range(1, 5)];
      optionsRule.hour = 8;
      optionsRule.minute = 15;
      optionsRule.tz = 'Asia/Kolkata';
      schedule.scheduleJob(optionsRule, async () => {
        console.log('Daily 8:15 AM Cron: Updating Options & Futures Master...');
        await updateOptionsMaster().catch(e => console.error(e));
      });


    // Initialize TriggerEngine
    triggerEngine.setSocketIo(io);
    await triggerEngine.loadPendingOrders();
    console.log('⚡ TriggerEngine active (LIMIT + SL/TP/CO/BO order matching)');

    // Initialize EOD Positions Engine (Cron Automations)
    require('./services/positionsEngine');

    // Initialize MTM Risk Manager
    new MTMRiskManager(priceCache).start();
    console.log('🛡️  MTM Risk Manager active (95% auto-liquidation)');

    initCronJobs(priceCache, triggerEngine);
    startSquareOffJobs();
    initRiskyStocksSync();
    initOrderExecutor(priceCache);
    SIPEngine.init(priceCache);
  } else {
    console.log(`👷 Worker Instance: Listening for API requests and WS connections...`);
  }
});

// Clean shutdown handlers to instantly release port when PM2 restarts/stops the process
const cleanupAndExit = () => {
  console.log('Stopping server and releasing port...');
  server.close(() => {
    console.log('Server stopped.');
    process.exit(0);
  });
  setTimeout(() => {
    console.log('Forced exit.');
    process.exit(0);
  }, 2000);
};

process.on('SIGINT', cleanupAndExit);
process.on('SIGTERM', cleanupAndExit);

module.exports = { io, priceCache };










// ─── Security Shield & Ban Management ──────────────────────────────────────────
app.get('/api/admin/banned', authenticateToken, async (req, res) => {
  try {
    const caller = await db('users').where({ id: req.user.id }).first();
    if (!caller || !caller.is_admin) return res.status(403).json({ error: 'Unauthorized' });
    const bans = await db('banned_entities').orderBy('created_at', 'desc');
    res.json({ bans });
  } catch (err) {
    console.error('Fetch Banned Error:', err);
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/admin/ban', authenticateToken, async (req, res) => {
  try {
    const caller = await db('users').where({ id: req.user.id }).first();
    if (!caller || !caller.is_admin) return res.status(403).json({ error: 'Unauthorized' });
    const { type, value, reason } = req.body;
    if (!type || !value) return res.status(400).json({ error: 'Type and value are required' });

    const upperType = type.toUpperCase();
    const cleanValue = value.trim();

    const existing = await db('banned_entities').where({ type: upperType, value: cleanValue }).first();
    if (!existing) {
      await db('banned_entities').insert({
        type: upperType,
        value: cleanValue,
        reason: reason || 'Restricted by Admin',
        banned_by: caller.id
      });
    }

    if (upperType === 'USER') {
      await db('users').where({ id: cleanValue }).orWhere({ username: cleanValue }).update({ is_banned: true });
    } else if (upperType === 'PHONE') {
      await db('users').where({ phone: cleanValue }).update({ is_banned: true });
    }

    await syncBannedEntities(db, generalClient);
    res.json({ success: true, message: `Successfully banned ${upperType}: ${cleanValue}` });
  } catch (err) {
    console.error('Ban Error:', err);
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/admin/unban', authenticateToken, async (req, res) => {
  try {
    const caller = await db('users').where({ id: req.user.id }).first();
    if (!caller || !caller.is_admin) return res.status(403).json({ error: 'Unauthorized' });
    const { id, type, value } = req.body;

    if (id) {
      const ban = await db('banned_entities').where({ id }).first();
      if (ban) {
        await db('banned_entities').where({ id }).del();
        if (ban.type === 'USER') {
          await db('users').where({ id: ban.value }).orWhere({ username: ban.value }).update({ is_banned: false });
        } else if (ban.type === 'PHONE') {
          await db('users').where({ phone: ban.value }).update({ is_banned: false });
        }
      }
    } else if (type && value) {
      await db('banned_entities').where({ type: type.toUpperCase(), value: value.trim() }).del();
      if (type.toUpperCase() === 'USER') {
        await db('users').where({ id: value }).orWhere({ username: value }).update({ is_banned: false });
      } else if (type.toUpperCase() === 'PHONE') {
        await db('users').where({ phone: value }).update({ is_banned: false });
      }
    }

    await syncBannedEntities(db, generalClient);
    res.json({ success: true, message: 'Unbanned successfully' });
  } catch (err) {
    console.error('Unban Error:', err);
    res.status(500).json({ error: err.message });
  }
});
