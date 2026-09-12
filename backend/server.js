process.on('unhandledRejection', (reason, promise) => { console.error('Unhandled Rejection at:', promise, 'reason:', reason); });
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env'), quiet: true });
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
app.set('trust proxy', true);
const server = http.createServer(app);

// Cleanup legacy invalid telemetry placeholders on startup
(async function cleanInvalidTelemetry() {
  try {
    await db('users')
      .where('city', 'Local Network')
      .orWhere('city', 'Local')
      .update({ city: '' });
    await db('users')
      .where('state', 'Local')
      .update({ state: '' });
  } catch (e) {}
})();

function isValidPublicIp(ip) {
  if (!ip || typeof ip !== 'string') return false;
  const clean = ip.replace(/^::ffff:/, '').trim();
  if (!clean || clean === '::1' || clean === '127.0.0.1' || clean === 'localhost') return false;
  if (clean.startsWith('10.') || clean.startsWith('192.168.') || clean.startsWith('169.254.')) return false;
  if (/^172\.(1[6-9]|2[0-9]|3[0-1])\./.test(clean)) return false;
  if (clean.startsWith('fc') || clean.startsWith('fd') || clean.startsWith('fe80')) return false;
  const ipv4Pattern = /^(?:[0-9]{1,3}\.){3}[0-9]{1,3}$/;
  const ipv6Pattern = /^[0-9a-fA-F:]+$/;
  return ipv4Pattern.test(clean) || ipv6Pattern.test(clean);
}

function getClientIp(req, optionalBodyIp) {
  // 1. Direct header sent by frontend client
  const customHeader = req.headers['x-client-public-ip'];
  if (isValidPublicIp(customHeader)) {
    return customHeader.trim().replace(/^::ffff:/, '');
  }

  // 2. Body IP sent by frontend in login / register / telemetry
  if (isValidPublicIp(optionalBodyIp)) {
    return optionalBodyIp.trim().replace(/^::ffff:/, '');
  }
  if (isValidPublicIp(req.body?.client_ip)) {
    return req.body.client_ip.trim().replace(/^::ffff:/, '');
  }

  // 3. Proxy & Cloud Provider Headers
  const cfIp = req.headers['cf-connecting-ip'] || req.headers['true-client-ip'];
  if (isValidPublicIp(cfIp)) {
    return cfIp.trim().replace(/^::ffff:/, '');
  }

  const forwarded = req.headers['x-forwarded-for'];
  if (forwarded && typeof forwarded === 'string') {
    const ips = forwarded.split(',').map(s => s.trim().replace(/^::ffff:/, ''));
    for (const ip of ips) {
      if (isValidPublicIp(ip)) return ip;
    }
  }

  const realIp = req.headers['x-real-ip'] || req.headers['x-client-ip'] || req.headers['x-cluster-client-ip'];
  if (isValidPublicIp(realIp)) {
    return realIp.trim().replace(/^::ffff:/, '');
  }

  // 4. Raw connection address
  const raw = req.ip || req.socket?.remoteAddress || '';
  const cleanRaw = raw.replace(/^::ffff:/, '').trim();
  if (isValidPublicIp(cleanRaw)) {
    return cleanRaw;
  }

  return cleanRaw || '127.0.0.1';
}
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

// Market Status Cache ('AUTO' | 'OPEN' | 'CLOSED')
// Market Status Cache ('AUTO' | 'OPEN' | 'CLOSED')
const marketStatusCache = { equity: 'AUTO', commodity: 'AUTO' };
const marketCalendarCache = new Map();

async function loadMarketStatusFromDb() {
  try {
    const rows = await db('system_settings').whereIn('key', ['equity_market_status', 'commodity_market_status']);
    rows.forEach(r => {
      if (r.key === 'equity_market_status') marketStatusCache.equity = r.value || 'AUTO';
      if (r.key === 'commodity_market_status') marketStatusCache.commodity = r.value || 'AUTO';
    });
    console.log(`📊 Loaded Market Status: EQ=${marketStatusCache.equity}, MCX=${marketStatusCache.commodity}`);
  } catch (e) {}
}
loadMarketStatusFromDb();

async function loadMarketCalendarFromDb() {
  try {
    const rows = await db('market_calendar').select('*');
    marketCalendarCache.clear();
    rows.forEach(r => {
      marketCalendarCache.set(r.date, r);
    });
    console.log(`📅 Loaded ${marketCalendarCache.size} rules into Market Calendar Cache`);
  } catch (e) {
    console.warn('loadMarketCalendarFromDb warning:', e.message);
  }
}
loadMarketCalendarFromDb();

function isSegmentMarketOpen(isCommodity) {
  const globalStatus = isCommodity ? marketStatusCache.commodity : marketStatusCache.equity;
  if (globalStatus === 'OPEN') return { open: true };
  if (globalStatus === 'CLOSED') {
    return { open: false, isTotalBlock: true, reason: `${isCommodity ? 'MCX Commodity' : 'NSE/BSE Equity'} Market is currently marked as CLOSED / Holiday by Administrator.` };
  }
  
  // Evaluate date in Asia/Kolkata (IST)
  const now = new Date();
  const istTime = new Date(now.getTime() + (5.5 * 60 * 60 * 1000));
  const year = istTime.getUTCFullYear();
  const month = String(istTime.getUTCMonth() + 1).padStart(2, '0');
  const dateNum = String(istTime.getUTCDate()).padStart(2, '0');
  const todayStr = `${year}-${month}-${dateNum}`;
  const day = istTime.getUTCDay(); // 0 = Sun, 6 = Sat
  const hours = istTime.getUTCHours();
  const minutes = istTime.getUTCMinutes();
  const currentMinutes = hours * 60 + minutes;

  // 1. Check Date-Specific Calendar Override
  const calRule = marketCalendarCache.get(todayStr);
  if (calRule) {
    const segmentStatus = isCommodity ? calRule.commodity_status : calRule.equity_status;
    const holidayReason = calRule.reason || (isCommodity ? 'MCX Commodity Market Holiday' : 'NSE/BSE Equity Market Holiday');

    if (segmentStatus === 'CLOSED') {
      return {
        open: false,
        isTotalBlock: true,
        reason: `${isCommodity ? 'MCX Commodity' : 'NSE/BSE Equity'} market is CLOSED today (${holidayReason}).`
      };
    }

    if (segmentStatus === 'OPEN') {
      // Special trading session (e.g., Saturday special session, Muhurat trading, or MCX evening session)
      const startTimeStr = isCommodity ? (calRule.commodity_start_time || '09:00') : (calRule.equity_start_time || '09:15');
      const endTimeStr = isCommodity ? (calRule.commodity_end_time || '23:30') : (calRule.equity_end_time || '15:30');

      const [sH, sM] = startTimeStr.split(':').map(Number);
      const [eH, eM] = endTimeStr.split(':').map(Number);
      const startMins = sH * 60 + (sM || 0);
      const endMins = eH * 60 + (eM || 0);

      if (currentMinutes < startMins || currentMinutes >= endMins) {
        return {
          open: false,
          isTotalBlock: true,
          reason: `Today's special session for ${isCommodity ? 'MCX' : 'NSE/BSE'} (${holidayReason}) is open only between ${startTimeStr} and ${endTimeStr} IST.`
        };
      }
      return { open: true };
    }
  }

  // 2. Default Schedule (Mon-Fri)
  if (day === 0 || day === 6) {
    return { open: false, isTotalBlock: true, reason: 'Markets are closed on weekends (Saturday & Sunday). Regular trading resumes on Monday.' };
  }
  
  if (!isCommodity) {
    // Equities: 9:15 AM to 3:15 PM for Intraday/BO/CO
    const isBeforeOpen = hours < 9 || (hours === 9 && minutes < 15);
    const isAfterClose = hours > 15 || (hours === 15 && minutes >= 15);
    if (isBeforeOpen || isAfterClose) {
      return { open: false, isTotalBlock: false, reason: 'Intraday/BO/CO trading for Equities is only allowed between 9:15 AM and 3:15 PM IST on trading days.' };
    }
  } else {
    // Commodities: 9:00 AM to 10:50 PM for Intraday/BO/CO
    const isBeforeOpen = hours < 9;
    const isAfterClose = hours > 22 || (hours === 22 && minutes >= 50);
    if (isBeforeOpen || isAfterClose) {
      return { open: false, isTotalBlock: false, reason: 'Intraday/BO/CO trading for Commodities is only allowed between 9:00 AM and 10:50 PM IST on trading days.' };
    }
  }
  return { open: true };
}

// When running in PM2 Cluster Mode, NODE_APP_INSTANCE tells us the worker ID
const isMaster = process.env.NODE_APP_INSTANCE === '0' || !process.env.NODE_APP_INSTANCE;

const io = new Server(server, {
  cors: { origin: true, credentials: true, methods: ['GET', 'POST'] },
  adapter: createAdapter(adapterPubClient, adapterSubClient)
});

// Listen for Fyers token updates, Market Status updates & Calendar updates on all cluster nodes
const { subClient: globalSubClient } = require('./services/redisClient');
if (globalSubClient) {
    const setupClusterSync = () => {
        globalSubClient.subscribe('fyers_token_updated', () => {
            try {
                const { reloadFyersToken } = require('./services/fyers');
                if (reloadFyersToken) reloadFyersToken();
            } catch(e) {}
        }).catch((err) => { console.error('Redis token sync subscribe error:', err); });

        globalSubClient.subscribe('market_status_updated', (message) => {
            try {
                const data = JSON.parse(message);
                if (data.equity) marketStatusCache.equity = data.equity;
                if (data.commodity) marketStatusCache.commodity = data.commodity;
                console.log(`📊 Redis Market Status Synced: EQ=${marketStatusCache.equity}, MCX=${marketStatusCache.commodity}`);
                io.emit('market_status_updated', {
                    equity: marketStatusCache.equity,
                    commodity: marketStatusCache.commodity
                });
            } catch(e) {}
        }).catch(() => {});

        globalSubClient.subscribe('market_calendar_updated', () => {
            try {
                loadMarketCalendarFromDb();
                io.emit('market_calendar_updated');
            } catch(e) {}
        }).catch(() => {});
    };
    
    if (globalSubClient.isReady) setupClusterSync();
    else globalSubClient.on('ready', setupClusterSync);
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
let _pricesEtag = null;
let _lastPricesJson = null;
let _lastPricesHashTime = 0;

app.get('/api/prices', (req, res) => {
  res.setHeader('Cache-Control', 'public, max-age=2, stale-while-revalidate=5');
  
  const now = Date.now();
  if (!_lastPricesJson || (now - _lastPricesHashTime > 2000)) {
    _lastPricesJson = JSON.stringify(priceCache);
    const crypto = require('crypto');
    _pricesEtag = `"${crypto.createHash('md5').update(_lastPricesJson).digest('hex')}"`;
    _lastPricesHashTime = now;
  }

  res.setHeader('ETag', _pricesEtag);
  if (req.headers['if-none-match'] === _pricesEtag) {
    return res.status(304).end();
  }

  res.type('application/json').send(_lastPricesJson);
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
    res.setHeader('Cache-Control', 'public, max-age=3600, stale-while-revalidate=86400');
    res.json(result);
  } catch (err) {
    console.error('/api/lotsizes Error:', err);
    res.json({});
  }
});

app.get('/api/stocks', async (req, res) => {
  try {
    const { generalClient } = require('./services/redisClient');
    const cacheKey = 'api:stocks:nse_bse:v2';
    
    let payload = null;

    // 1. Try Redis cache first
    if (generalClient && generalClient.isReady) {
      const cached = await generalClient.get(cacheKey);
      if (cached) {
        payload = cached;
      }
    }
    
    // 2. Compute if not in cache (Query In-Memory JSON)
    if (!payload) {
      const { getAllStocks } = require('./services/instrumentsCache');
      const stocksArray = getAllStocks();
      if (!stocksArray || stocksArray.length === 0) return res.json([]);
      payload = JSON.stringify(stocksArray);
      
      // Save to Redis (cache for 6 hours)
      if (generalClient && generalClient.isReady) {
        generalClient.set(cacheKey, payload, { EX: 21600 }).catch(console.error);
      }
    }

    // 3. ETag & HTTP 304 Handling: Save 100% of network bandwidth on conditional requests
    const crypto = require('crypto');
    const etag = `"${crypto.createHash('md5').update(payload).digest('hex')}"`;
    res.setHeader('ETag', etag);
    res.setHeader('Cache-Control', 'public, max-age=3600, stale-while-revalidate=86400');
    
    if (req.headers['if-none-match'] === etag) {
      return res.status(304).end(); // 0 bytes transferred over network!
    }
    
    res.setHeader('Content-Type', 'application/json');
    res.send(payload);
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
        const cacheKey = `api:search:v5:${qLower}`;
      
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
          exchange: item.exchange || item.exch_seg || (item.symbol && item.symbol.includes(':') ? item.symbol.split(':')[0] : 'NSE'),
          lotsize: item.lotsize,
          expiryTimestamp: item.expiryTimestamp || item.expiry_timestamp || null,
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
const { authenticateToken, JWT_SECRET, hashToken } = require('./middleware/auth');
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
  message: { error: 'Order rate limit exceeded (max 120/min)' },
  skip: (req) => {
    const ip = req.ip || req.connection?.remoteAddress || '';
    const isLoopback = ip === '127.0.0.1' || ip === '::1' || ip === '::ffff:127.0.0.1';
    return isLoopback || Boolean(req.body?.is_system_close);
  }
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
    
    const clientIp = getClientIp(req, req.body?.client_ip);
    
    // Check if IP or Phone is banned
    if (await isIpBanned(clientIp, generalClient)) {
      return res.status(403).json({ error: 'Registration blocked: Your IP address has been restricted.' });
    }
    if (await isPhoneBanned(phone, generalClient)) {
      return res.status(403).json({ error: 'Registration blocked: This phone number has been restricted.' });
    }

    const { deviceModel, osName, browserName } = parseDeviceDetails(req.headers['user-agent']);
    let { city, state } = parseIpLocation(clientIp);
    if (!city && req.body?.client_city) city = req.body.client_city;
    if (!state && req.body?.client_state) state = req.body.client_state;

    const [id] = await db('users').insert({ 
      username, email, phone, password_hash, watchlists: defaultWatchlist,
      registration_ip: clientIp, last_ip: clientIp,
      device_model: deviceModel, os_name: osName, browser_name: browserName,
      city: (city && city !== 'Local Network' && city !== 'Local') ? city : '',
      state: (state && state !== 'Local') ? state : ''
    }).returning('id');
    
    // Some db engines return an object from returning(), handle both
    const userId = typeof id === 'object' ? id.id : id;
    
    // Generate Professional Client ID: SE + Base36(userId) padded to 6 chars
    const clientId = 'SE' + Number(userId).toString(36).toUpperCase().padStart(6, '0');
    await db('users').where({ id: userId }).update({ client_id: clientId });
    // Handle Referral Logic (supports client_id like 'SE000001', numeric user id, or username)
    if (referral_code) {
      try {
        const codeTrimmed = String(referral_code).trim();
        let referrer = null;
        
        // 1. Try lookup by client_id (case-insensitive)
        referrer = await db('users')
          .whereRaw('LOWER(client_id) = ?', [codeTrimmed.toLowerCase()])
          .first();

        // 2. Try lookup by numeric user id if it is purely digits
        if (!referrer && /^\d+$/.test(codeTrimmed)) {
          referrer = await db('users')
            .where({ id: parseInt(codeTrimmed, 10) })
            .first();
        }

        // 3. Try lookup by username (case-insensitive)
        if (!referrer) {
          referrer = await db('users')
            .whereRaw('LOWER(username) = ?', [codeTrimmed.toLowerCase()])
            .first();
        }

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
    const tokenHash = hashToken(token);
    if (tokenHash) {
      await db('user_sessions').insert({
        user_id: userId,
        token_hash: tokenHash,
        device_model: deviceModel,
        browser_name: browserName,
        os_name: osName,
        ip_address: clientIp,
        city: (city && city !== 'Local Network' && city !== 'Local') ? city : '',
        state: (state && state !== 'Local') ? state : '',
        last_active_at: new Date()
      }).catch(() => {});
    }
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

    const clientIp = getClientIp(req, req.body?.client_ip);
    
    // Check if IP or Account is banned
    if (await isIpBanned(clientIp, generalClient)) {
      return res.status(403).json({ error: 'Access restricted: Your IP address has been restricted.' });
    }
    if (user.is_banned) {
      return res.status(403).json({ error: 'Your trading account has been suspended by administration.' });
    }

    const { deviceModel, osName, browserName } = parseDeviceDetails(req.headers['user-agent']);
    let { city, state } = parseIpLocation(clientIp);
    if (!city && req.body?.client_city) city = req.body.client_city;
    if (!state && req.body?.client_state) state = req.body.client_state;

    const updateFields = {
      device_model: deviceModel,
      os_name: osName,
      browser_name: browserName
    };
    if (clientIp && clientIp !== '127.0.0.1' && clientIp !== '::1') {
      updateFields.last_ip = clientIp;
    }
    if (city && city !== 'Local Network' && city !== 'Local') {
      updateFields.city = city;
    }
    if (state && state !== 'Local') {
      updateFields.state = state;
    }

    await db('users').where({ id: user.id }).update(updateFields).catch(e => console.error('Failed to update user login meta:', e));
    
    const token = jwt.sign({ id: user.id, username: user.username, is_admin: user.is_admin }, JWT_SECRET, { expiresIn: '7d' });
    const tokenHash = hashToken(token);
    if (tokenHash) {
      await db('user_sessions').insert({
        user_id: user.id,
        token_hash: tokenHash,
        device_model: deviceModel,
        browser_name: browserName,
        os_name: osName,
        ip_address: clientIp,
        city: (city && city !== 'Local Network' && city !== 'Local') ? city : '',
        state: (state && state !== 'Local') ? state : '',
        last_active_at: new Date()
      }).catch(() => {});
    }
    const watchlists = typeof user.watchlists === 'string' ? JSON.parse(user.watchlists || '[]') : (user.watchlists || []);
    const isHttps = req.headers['x-forwarded-proto'] === 'https' || req.secure || req.headers['host']?.includes('sslip.io');
    res.cookie('token', token, {
      httpOnly: true,
      secure: isHttps,
      sameSite: isHttps ? 'none' : 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000
    });
    let clientId = user.client_id;
    if (!clientId) {
      clientId = 'SE' + Number(user.id).toString(36).toUpperCase().padStart(6, '0');
      await db('users').where({ id: user.id }).update({ client_id: clientId }).catch(() => {});
    }
    res.json({
      success: true,
      token,
      user: {
        id: user.id,
        client_id: clientId,
        username: user.username,
        email: user.email,
        phone: user.phone,
        balance: user.balance || 1000000.0,
        is_admin: Boolean(user.is_admin),
        is_onboarded: Boolean(user.is_onboarded),
        watchlists,
        subscription_tier: user.subscription_tier || 'BASIC',
        subscription_expires: user.subscription_expires
      }
    });
  } catch (err) {
    const errorMsg = err.message || String(err);
    if (errorMsg.includes('ECONNREFUSED') || String(err).includes('ECONNREFUSED')) {
      return res.status(500).json({ error: 'Database not connected. Please add a PostgreSQL database in Railway.' });
    }
    res.status(500).json({ error: errorMsg || 'Unknown error occurred during login' });
  }
});

// Active Client Telemetry Sync (Instant location and device fingerprinting)
app.post('/api/user/telemetry', authenticateToken, async (req, res) => {
  try {
    const clientIp = getClientIp(req, req.body?.client_ip);
    const userAgent = req.headers['user-agent'] || '';
    const { deviceModel, osName, browserName } = parseDeviceDetails(userAgent);
    
    let { city, state } = parseIpLocation(clientIp);
    if (!city && req.body?.city) city = req.body.city;
    if (!state && req.body?.state) state = req.body.state;

    const updateFields = {
      device_model: deviceModel,
      os_name: osName,
      browser_name: browserName
    };
    if (clientIp && clientIp !== '127.0.0.1' && clientIp !== '::1') {
      updateFields.last_ip = clientIp;
    }
    if (city && city !== 'Local Network' && city !== 'Local') {
      updateFields.city = city;
    }
    if (state && state !== 'Local') {
      updateFields.state = state;
    }

    await db('users').where({ id: req.user.id }).update(updateFields);
    res.json({ success: true, ip: clientIp, city: updateFields.city, state: updateFields.state, device: deviceModel });
  } catch (err) {
    res.status(500).json({ error: err.message });
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
    if (!user.client_id) {
      user.client_id = 'SE' + Number(user.id).toString(36).toUpperCase().padStart(6, '0');
      await db('users').where({ id: user.id }).update({ client_id: user.client_id }).catch(() => {});
    }
    if (typeof user.watchlists === 'string') user.watchlists = JSON.parse(user.watchlists);
    user.balance = parseFloat(user.balance || 0);
    user.is_admin = Boolean(user.is_admin);
    user.is_onboarded = Boolean(user.is_onboarded);
    res.json(user);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ⚡ High-Performance 5-in-1 User Bootstrap Endpoint (Cuts Client Network Polls by 80%)
app.get('/api/user/bootstrap', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const [userRow, positionsRows, holdingsRows, ordersRows, sipsRows] = await Promise.all([
      db('users').where({ id: userId }).first(),
      db('positions').where({ user_id: userId }),
      db('holdings').where({ user_id: userId }).whereNot({ quantity: 0 }).orderBy('id', 'desc'),
      db('orders').where({ user_id: userId }).orderBy('created_at', 'desc').limit(100),
      db('sips').where({ user_id: userId })
    ]);

    if (!userRow) return res.status(404).json({ error: 'User not found' });

    delete userRow.password_hash;
    if (!userRow.client_id) {
      userRow.client_id = 'SE' + Number(userRow.id).toString(36).toUpperCase().padStart(6, '0');
      db('users').where({ id: userRow.id }).update({ client_id: userRow.client_id }).catch(() => {});
    }
    if (typeof userRow.watchlists === 'string') {
      try {
        userRow.watchlists = JSON.parse(userRow.watchlists);
      } catch (_) {
        userRow.watchlists = [];
      }
    }
    userRow.balance = parseFloat(userRow.balance || 0);
    userRow.is_admin = Boolean(userRow.is_admin);
    userRow.is_onboarded = Boolean(userRow.is_onboarded);

    const formattedPositions = (positionsRows || []).map(p => ({
      ...p,
      quantity: Number(p.quantity),
      closed_quantity: Number(p.closed_quantity || 0),
      average_price: Number(p.average_price || 0),
      exit_price: p.exit_price !== null && p.exit_price !== undefined ? Number(p.exit_price) : null,
      margin: Number(p.margin || 0),
      realized_pnl: Number(p.realized_pnl || 0)
    }));

    const LEGACY_FIX_MAP = {
      'EDEL-MF': { code: '118615', fallbackNav: 61.66 },
      'EDEL':    { code: '118615', fallbackNav: 61.66 },
      'MIRA-MF': { code: '118825', fallbackNav: 126.99 },
      'MIRA':    { code: '118825', fallbackNav: 126.99 },
      'NIPP-MF': { code: '118778', fallbackNav: 209.96 },
      'NIPP':    { code: '118778', fallbackNav: 209.96 }
    };

    const formattedHoldings = holdingsRows || [];
    for (const h of formattedHoldings) {
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

    res.json({
      success: true,
      user: userRow,
      positions: formattedPositions,
      holdings: formattedHoldings,
      orders: ordersRows || [],
      sips: sipsRows || []
    });
  } catch (err) {
    console.error('[User Bootstrap Error]:', err.message);
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
    
    const secret = process.env.RAZORPAY_KEY_SECRET;
    if (!secret || secret === 'secret_placeholder') {
      return res.status(503).json({ error: 'Payment gateway configuration is incomplete or in maintenance. Please contact support.' });
    }

    if (!razorpay_payment_id || !razorpay_signature) {
      return res.status(400).json({ error: 'Missing required payment verification parameters' });
    }

    // For subscriptions, Razorpay generates signature using payment_id + '|' + subscription_id
    // For normal orders, it uses order_id + '|' + payment_id
    let body = razorpay_order_id + "|" + razorpay_payment_id;
    if (razorpay_subscription_id) {
      body = razorpay_payment_id + "|" + razorpay_subscription_id;
    }
    
    const expectedSignature = crypto
      .createHmac('sha256', secret)
      .update(body.toString())
      .digest('hex');
      
    const isAuthentic = expectedSignature === razorpay_signature;
    if (isAuthentic) {
      const expires = new Date();
      const selectedPlan = plan === 'yearly' ? 'yearly' : 'monthly';
      if (selectedPlan === 'monthly') {
        expires.setMonth(expires.getMonth() + 1);
      } else {
        expires.setFullYear(expires.getFullYear() + 1);
      }
      
      await db.transaction(async (trx) => {
        await trx('users').where({ id: req.user.id }).update({
          subscription_tier: 'PRO',
          subscription_expires: expires
        });

        // --- Referral Reward Logic (Atomic) ---
        try {
          const pendingRef = await trx('referrals')
            .where({ referred_user_id: req.user.id, status: 'pending' })
            .first();

          if (pendingRef) {
            const rewardAmount = selectedPlan === 'monthly' ? 9.9 : 49.9;
            
            // Mark as completed
            await trx('referrals')
              .where({ id: pendingRef.id })
              .update({ status: 'completed', reward_amount: rewardAmount });
            
            // Credit referrer
            await trx('users')
              .where({ id: pendingRef.referrer_id })
              .increment('balance', rewardAmount);
          }
        } catch (e) {
          console.error('Failed to process referral reward', e);
        }
      });

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
    const { phone, pan_card, aadhar_number, address } = req.body;
    const updateObj = {};
    if (phone !== undefined) updateObj.phone = phone;
    if (pan_card !== undefined) updateObj.pan_card = pan_card;
    if (aadhar_number !== undefined) updateObj.aadhar_number = aadhar_number;
    if (address !== undefined) updateObj.address = address;

    await db('users').where({ id: req.user.id }).update(updateObj);
    res.json({ success: true, ...updateObj });
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
    const parsedAmount = parseFloat(amount);
    if (isNaN(parsedAmount) || !isFinite(parsedAmount) || parsedAmount < 100 || parsedAmount > 100000000) {
      return res.status(400).json({ error: 'Invalid amount. Minimum deposit is ₹100 and maximum is ₹10 Crore.' });
    }
    
    await db('deposit_requests').insert({
      user_id: req.user.id,
      amount: parsedAmount,
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


function getSystemTelemetry() {
    const os = require('os');
    const fs = require('fs');
    const totalRam = os.totalmem();
    const freeRam = os.freemem();
    const usedRam = totalRam - freeRam;
    const ramPct = ((usedRam / totalRam) * 100).toFixed(1);
    
    let diskStats = null;
    try {
        if (typeof fs.statfsSync === 'function') {
            const stat = fs.statfsSync('.');
            const totalDisk = stat.bsize * stat.blocks;
            const freeDisk = stat.bsize * stat.bfree;
            const usedDisk = totalDisk - freeDisk;
            diskStats = {
                totalGB: (totalDisk / 1073741824).toFixed(1),
                usedGB: (usedDisk / 1073741824).toFixed(1),
                freeGB: (freeDisk / 1073741824).toFixed(1),
                pct: ((usedDisk / totalDisk) * 100).toFixed(1)
            };
        }
    } catch(e) {}

    const cpus = os.cpus() || [];
    const loadAvg = os.loadavg() || [0, 0, 0];
    const cpuLoad1m = ((loadAvg[0] / Math.max(1, cpus.length)) * 100).toFixed(1);
    const procMem = process.memoryUsage();
    const uptimeSec = os.uptime();
    const days = Math.floor(uptimeSec / 86400);
    const hrs = Math.floor((uptimeSec % 86400) / 3600);
    const mins = Math.floor((uptimeSec % 3600) / 60);

    return {
        ram: {
            totalGB: (totalRam / 1073741824).toFixed(2),
            usedGB: (usedRam / 1073741824).toFixed(2),
            freeGB: (freeRam / 1073741824).toFixed(2),
            pct: ramPct
        },
        cpu: {
            cores: cpus.length,
            model: cpus[0]?.model || 'Cloud vCPU',
            loadAvg: loadAvg.map(l => l.toFixed(2)),
            loadPct: Math.min(100, Math.max(0, parseFloat(cpuLoad1m)))
        },
        process: {
            rssMB: (procMem.rss / 1048576).toFixed(1),
            heapUsedMB: (procMem.heapUsed / 1048576).toFixed(1),
            heapTotalMB: (procMem.heapTotal / 1048576).toFixed(1)
        },
        disk: diskStats,
        uptime: `${days > 0 ? `${days}d ` : ''}${hrs}h ${mins}m`,
        platform: `${os.platform()} (${os.arch()})`
    };
}

app.get('/api/admin/telemetry', authenticateToken, async (req, res) => {
    try {
        const caller = await db('users').where({ id: req.user.id }).first();
        if (!caller || !caller.is_admin) return res.status(403).json({ error: 'Unauthorized' });

        const { generalClient } = require('./services/redisClient');
        if (!generalClient || !generalClient.isReady) return res.json({ api: [], users: [], system: getSystemTelemetry() });

        const system = getSystemTelemetry();
        const tf = req.query.timeframe || 'all';
        let minutes = 0;
        const match = tf.match(/^(\d+)([mh])$/);
        if (match) {
            const val = parseInt(match[1], 10);
            minutes = match[2] === 'h' ? val * 60 : val;
        }

        if (minutes === 0 || tf === 'all') {
            // Cumulative All-Time Stats (Non-blocking lookup)
            let routes = await generalClient.sMembers('telemetry:routes').catch(() => []);
            let users = await generalClient.sMembers('telemetry:users').catch(() => []);

            // Fallback to non-blocking SCAN if sets are not yet populated
            if (!routes || routes.length === 0) {
                routes = [];
                for await (const chunk of generalClient.scanIterator({ MATCH: 'telemetry:api:*', COUNT: 100 })) {
                    const keys = Array.isArray(chunk) ? chunk : [chunk];
                    for (const k of keys) {
                        if (typeof k === 'string') routes.push(k.replace('telemetry:api:', ''));
                    }
                }
            }
            if (!users || users.length === 0) {
                users = [];
                for await (const chunk of generalClient.scanIterator({ MATCH: 'telemetry:user:*', COUNT: 100 })) {
                    const keys = Array.isArray(chunk) ? chunk : [chunk];
                    for (const k of keys) {
                        if (typeof k === 'string') users.push(k.replace('telemetry:user:', ''));
                    }
                }
            }

            const apiPipeline = generalClient.multi();
            routes.forEach(r => apiPipeline.hGetAll(`telemetry:api:${r}`));
            const apiResults = routes.length > 0 ? await apiPipeline.exec() : [];

            const apiStats = routes.map((route, i) => {
                const data = apiResults[i] || {};
                return {
                    route,
                    count: parseInt(data.count || 0),
                    totalTime: parseInt(data.time_ms || 0),
                    totalBytes: parseInt(data.bytes || 0)
                };
            });

            const userPipeline = generalClient.multi();
            users.forEach(u => userPipeline.hGetAll(`telemetry:user:${u}`));
            const userResults = users.length > 0 ? await userPipeline.exec() : [];

            const userStats = [];
            for (let i = 0; i < users.length; i++) {
                const userId = users[i];
                const data = userResults[i] || {};
                const isNumeric = userId && !isNaN(Number(userId));
                const dbUser = isNumeric ? await db('users').where({ id: Number(userId) }).first().catch(() => null) : null;
                userStats.push({
                    userId,
                    clientId: dbUser ? dbUser.client_id : null,
                    username: dbUser ? dbUser.username : (userId === 'anonymous' ? 'Anonymous / Guest' : `User (#${userId})`),
                    apiCalls: parseInt(data.api_calls || 0),
                    apiBytes: parseInt(data.api_bytes || 0),
                    wsMinutes: parseInt(data.ws_minutes || 0)
                });
            }
            return res.json({ api: apiStats, users: userStats, system, timeframe: 'all' });
        } else {
            // Timeframe / Minute-Bucket Aggregation
            const now = Date.now();
            const targetBuckets = [];
            const targetBucketSet = new Set();
            const pad = (n) => String(n).padStart(2, '0');
            for (let i = 0; i <= minutes; i++) {
                const d = new Date(now - i * 60 * 1000);
                const bucket = `${d.getUTCFullYear()}${pad(d.getUTCMonth()+1)}${pad(d.getUTCDate())}${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}`;
                if (!targetBucketSet.has(bucket)) {
                    targetBucketSet.add(bucket);
                    targetBuckets.push(bucket);
                }
            }

            // Phase 1: Fast O(1) Bucket Index Lookup via Redis Pipeline (<2ms)
            const bucketPipeline = generalClient.multi();
            targetBuckets.forEach(b => bucketPipeline.sMembers(`telemetry:mb_keys:${b}`));
            const bucketKeySets = await bucketPipeline.exec().catch(() => []);

            const validKeysSet = new Set();
            if (bucketKeySets && bucketKeySets.length > 0) {
                for (const set of bucketKeySets) {
                    if (Array.isArray(set)) {
                        for (const k of set) {
                            if (typeof k === 'string') validKeysSet.add(k);
                        }
                    }
                }
            }

            // Phase 2: Fallback to non-blocking SCAN if bucket index set is empty (e.g. legacy keys)
            if (validKeysSet.size === 0) {
                for await (const chunk of generalClient.scanIterator({ MATCH: 'telemetry:mb:*', COUNT: 300 })) {
                    const keys = Array.isArray(chunk) ? chunk : [chunk];
                    for (const k of keys) {
                        if (typeof k !== 'string') continue;
                        const parts = k.split(':');
                        if (parts.length >= 5 && targetBucketSet.has(parts[2])) {
                            validKeysSet.add(k);
                        }
                    }
                }
            }

            const validKeys = [];
            for (const k of validKeysSet) {
                const parts = k.split(':');
                if (parts.length >= 5) {
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
                const isNumeric = u.userId && !isNaN(Number(u.userId));
                const dbUser = isNumeric ? await db('users').where({ id: Number(u.userId) }).first().catch(() => null) : null;
                userStats.push({
                    userId: u.userId,
                    clientId: dbUser ? dbUser.client_id : null,
                    username: dbUser ? dbUser.username : (u.userId === 'anonymous' ? 'Anonymous / Guest' : `User (#${u.userId})`),
                    apiCalls: u.apiCalls,
                    apiBytes: u.apiBytes,
                    wsMinutes: u.wsMinutes
                });
            }

            return res.json({ api: apiStats, users: userStats, system, timeframe: tf });
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

        const keysToDelete = [];
        for await (const chunk of generalClient.scanIterator({ MATCH: 'telemetry:*', COUNT: 200 })) {
            const keys = Array.isArray(chunk) ? chunk : [chunk];
            for (const k of keys) {
                if (typeof k === 'string') keysToDelete.push(k);
            }
        }
        if (keysToDelete.length > 0) {
            await generalClient.del(keysToDelete);
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
    const startDate = req.query.startDate;
    const endDate = req.query.endDate;
    const isExport = req.query.export === 'true' || req.query.limit === 'all';

    let query = db('users').leftJoin('user_profiles', 'users.id', 'user_profiles.user_id');
    let countQuery = db('users');

    if (search) {
      query = query.where(function() {
        this.where('users.username', 'ilike', `%${search}%`)
            .orWhere('users.email', 'ilike', `%${search}%`)
            .orWhere('users.client_id', 'ilike', `%${search}%`);
      });
      countQuery = countQuery.where(function() {
        this.where('username', 'ilike', `%${search}%`)
            .orWhere('email', 'ilike', `%${search}%`)
            .orWhere('client_id', 'ilike', `%${search}%`);
      });
    }

    if (startDate) {
      query = query.where('users.created_at', '>=', startDate);
      countQuery = countQuery.where('users.created_at', '>=', startDate);
    }
    if (endDate) {
      query = query.where('users.created_at', '<=', endDate);
      countQuery = countQuery.where('users.created_at', '<=', endDate);
    }

    const [countResult] = await countQuery.count('id as total');
    const total = countResult ? parseInt(countResult.total) : 0;
    const totalPages = Math.ceil(total / limit) || 1;

    let userQuery = query
      .select(
        'users.id', 'users.client_id', 'users.username', 'users.email', 'users.balance',
        'users.is_banned', 'users.phone', 'users.pan_card', 'users.aadhar_number',
        'users.kyc_pan_url', 'users.kyc_aadhar_url', 'users.is_admin', 'users.created_at',
        'users.last_ip', 'users.registration_ip', 'users.device_model', 'users.os_name',
        'users.browser_name', 'users.address', 'users.upi_id', 'users.bank_account_no', 'users.bank_ifsc',
        'users.city as ip_city', 'users.state as ip_state',
        'user_profiles.dob', 'user_profiles.gender',
        'user_profiles.state as onboarding_state', 'user_profiles.city as onboarding_city',
        'user_profiles.occupation', 'user_profiles.annual_income',
        'user_profiles.financial_goal', 'user_profiles.trading_experience',
        'user_profiles.preferred_segment', 'user_profiles.trading_style'
      )
      .orderBy('users.created_at', 'desc');

    if (!isExport) {
      userQuery = userQuery.limit(limit).offset(offset);
    } else {
      userQuery = userQuery.limit(10000);
    }

    const rawUsers = await userQuery;

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
      let detectedCity = (u.ip_city && u.ip_city !== 'Local Network' && u.ip_city !== 'Local') ? u.ip_city : '';
      let detectedState = (u.ip_state && u.ip_state !== 'Local') ? u.ip_state : '';
      if ((!detectedCity || !detectedState) && ip && ip !== '::1' && ip !== '127.0.0.1' && !ip.startsWith('192.168.') && !ip.startsWith('10.')) {
        const geo = parseIpLocation(ip);
        if (geo.city && geo.city !== 'Local Network') detectedCity = geo.city;
        if (geo.state && geo.state !== 'Local') detectedState = geo.state;
      }
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
        ip_city: detectedCity,
        ip_state: detectedState,
        city: u.onboarding_city || u.city || '',
        state: u.onboarding_state || u.state || '',
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
    if (!caller || !caller.is_admin) return res.status(403).json({ error: 'Unauthorized' });

    const targetUserId = req.params.id;
    let pendingOrders = [];
    await db.transaction(async (trx) => {
      // 0. Fetch pending orders to purge them from TriggerEngine memory & Redis
      pendingOrders = await trx('orders')
        .where({ user_id: targetUserId })
        .whereIn('status', ['PENDING', 'PENDING_TRIGGER']);

      // 1. Nullify self-referencing FK links to prevent FK constraint crashes
      await trx('orders').where({ user_id: targetUserId }).update({ linked_order_id: null, parent_order_id: null });
      await trx('orders').where({ user_id: targetUserId }).del();
      await trx('positions').where({ user_id: targetUserId }).del();

      const hasHoldings = await trx.schema.hasTable('holdings');
      if (hasHoldings) {
        await trx('holdings').where({ user_id: targetUserId }).del();
      }
      const hasSips = await trx.schema.hasTable('sips');
      if (hasSips) {
        await trx('sips').where({ user_id: targetUserId }).del();
      }
      await trx('ledger').where({ user_id: targetUserId }).del();
      await trx('users').where({ id: targetUserId }).update({ balance: 1000000.0 });
      await trx('ledger').insert({
        user_id: targetUserId,
        amount: 1000000.0,
        type: 'DEPOSIT',
        description: 'Admin account reset opening balance'
      });
    });

    const triggerEngine = require('./services/triggerEngine');
    for (const ord of pendingOrders) {
      triggerEngine.removeOrderFromMemory(ord.id, ord.symbol);
    }
    try {
      const { pubClient } = require('./services/redisClient');
      if (pubClient) pubClient.publish('reload_triggers', '1').catch(() => {});
    } catch(e) {}

    res.json({ success: true, message: 'User account reset to ₹10,00,000.' });
  } catch (err) {
    console.error('Admin reset error:', err);
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
    const newBal = Number(balance);
    if (balance === undefined || isNaN(newBal) || newBal < 0) {
      return res.status(400).json({ error: 'Valid non-negative balance required' });
    }

    const targetUserId = req.params.id;
    let updatedBal = newBal;
    await db.transaction(async (trx) => {
      const targetUser = await trx('users').where({ id: targetUserId }).first();
      if (!targetUser) {
        throw Object.assign(new Error('User not found'), { statusCode: 404 });
      }

      const prevBal = Number(targetUser.balance) || 0;
      const delta = parseFloat((newBal - prevBal).toFixed(2));

      await trx('users').where({ id: targetUserId }).update({ balance: newBal });

      if (delta !== 0) {
        await trx('ledger').insert({
          user_id: targetUserId,
          amount: delta,
          type: delta > 0 ? 'DEPOSIT' : 'WITHDRAWAL',
          description: `Admin balance adjustment by ${caller.username} (₹${prevBal.toLocaleString('en-IN')} ➔ ₹${newBal.toLocaleString('en-IN')})`
        });
      }
      updatedBal = newBal;
    });

    res.json({ success: true, balance: updatedBal });
  } catch (err) {
    const status = err.statusCode || 500;
    res.status(status).json({ error: err.message });
  }
});

app.get('/api/admin/deposits', authenticateToken, async (req, res) => {
  try {
    const caller = await db('users').where({ id: req.user.id }).first();
    if (!caller || !caller.is_admin) return res.status(403).json({ error: 'Unauthorized' });

    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 50;
    const offset = (page - 1) * limit;
    const search = req.query.search || '';
    const startDate = req.query.startDate;
    const endDate = req.query.endDate;
    const isExport = req.query.export === 'true' || req.query.limit === 'all';

    let query = db('deposit_requests')
      .join('users', 'deposit_requests.user_id', 'users.id')
      .select('deposit_requests.*', 'users.username', 'users.email', 'users.client_id');

    let countQuery = db('deposit_requests')
      .join('users', 'deposit_requests.user_id', 'users.id');

    if (search) {
      const s = `%${search}%`;
      query = query.where(function() {
        this.where('users.username', 'ilike', s)
            .orWhere('users.email', 'ilike', s)
            .orWhere('users.client_id', 'ilike', s)
            .orWhereRaw('CAST(deposit_requests.amount AS TEXT) ilike ?', [s]);
      });
      countQuery = countQuery.where(function() {
        this.where('users.username', 'ilike', s)
            .orWhere('users.email', 'ilike', s)
            .orWhere('users.client_id', 'ilike', s)
            .orWhereRaw('CAST(deposit_requests.amount AS TEXT) ilike ?', [s]);
      });
    }

    if (startDate) {
      query = query.where('deposit_requests.created_at', '>=', startDate);
      countQuery = countQuery.where('deposit_requests.created_at', '>=', startDate);
    }
    if (endDate) {
      query = query.where('deposit_requests.created_at', '<=', endDate);
      countQuery = countQuery.where('deposit_requests.created_at', '<=', endDate);
    }

    const [countResult] = await countQuery.count('deposit_requests.id as total');
    const total = countResult ? parseInt(countResult.total) : 0;
    const totalPages = Math.ceil(total / limit) || 1;

    let depQuery = query.orderBy('deposit_requests.created_at', 'desc');
    if (!isExport) {
      depQuery = depQuery.limit(limit).offset(offset);
    } else {
      depQuery = depQuery.limit(10000);
    }
    const deposits = await depQuery;
      
    res.json({ success: true, deposits, total, page, totalPages });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/admin/deposits/:id/approve', authenticateToken, async (req, res) => {
  try {
    const caller = await db('users').where({ id: req.user.id }).first();
    if (!caller || !caller.is_admin) return res.status(403).json({ error: 'Unauthorized' });

    await db.transaction(async trx => {
      // Atomic conditional update guarantees only one transaction can approve a PENDING deposit
      const updatedCount = await trx('deposit_requests')
        .where({ id: req.params.id, status: 'PENDING' })
        .update({ status: 'APPROVED' });

      if (updatedCount === 0) {
        throw new Error('Deposit request has already been processed or does not exist');
      }

      const deposit = await trx('deposit_requests').where({ id: req.params.id }).first();
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

    const updatedCount = await db('deposit_requests')
      .where({ id: req.params.id, status: 'PENDING' })
      .update({ status: 'REJECTED' });

    if (updatedCount === 0) {
      return res.status(400).json({ error: 'Deposit request already processed or not found' });
    }
    
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
    
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 50;
    const offset = (page - 1) * limit;
    const search = req.query.search || '';
    const startDate = req.query.startDate;
    const endDate = req.query.endDate;
    const isExport = req.query.export === 'true' || req.query.limit === 'all';

    let query = db('orders')
      .join('users', 'orders.user_id', '=', 'users.id')
      .select('orders.*', 'users.username', 'users.email', 'users.client_id');
    
    let countQuery = db('orders')
      .join('users', 'orders.user_id', '=', 'users.id');

    if (search) {
      const s = `%${search}%`;
      query = query.where(function() {
        this.where('orders.symbol', 'ilike', s)
            .orWhere('users.username', 'ilike', s)
            .orWhere('users.client_id', 'ilike', s)
            .orWhereRaw('CAST(orders.id AS TEXT) ilike ?', [s]);
      });
      countQuery = countQuery.where(function() {
        this.where('orders.symbol', 'ilike', s)
            .orWhere('users.username', 'ilike', s)
            .orWhere('users.client_id', 'ilike', s)
            .orWhereRaw('CAST(orders.id AS TEXT) ilike ?', [s]);
      });
    }

    if (startDate) {
      query = query.where('orders.created_at', '>=', startDate);
      countQuery = countQuery.where('orders.created_at', '>=', startDate);
    }
    if (endDate) {
      query = query.where('orders.created_at', '<=', endDate);
      countQuery = countQuery.where('orders.created_at', '<=', endDate);
    }

    const [countResult] = await countQuery.count('orders.id as total');
    const total = countResult ? parseInt(countResult.total) : 0;
    const totalPages = Math.ceil(total / limit) || 1;

    let ordQuery = query.orderBy('orders.created_at', 'desc');
    if (!isExport) {
      ordQuery = ordQuery.limit(limit).offset(offset);
    } else {
      ordQuery = ordQuery.limit(10000);
    }
    const orders = await ordQuery;

    res.json({ success: true, orders, total, page, totalPages });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/admin/positions', authenticateToken, async (req, res) => {
  try {
    const caller = await db('users').where({ id: req.user.id }).first();
    if (!caller || !caller.is_admin) return res.status(403).json({ error: 'Unauthorized' });
    
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 50;
    const offset = (page - 1) * limit;
    const search = req.query.search || '';
    const startDate = req.query.startDate;
    const endDate = req.query.endDate;
    const isExport = req.query.export === 'true' || req.query.limit === 'all';

    let query = db('positions')
      .join('users', 'positions.user_id', '=', 'users.id')
      .select('positions.*', 'users.username', 'users.email', 'users.client_id')
      .where('positions.quantity', '!=', 0);
    
    let countQuery = db('positions')
      .join('users', 'positions.user_id', '=', 'users.id')
      .where('positions.quantity', '!=', 0);

    if (search) {
      const s = `%${search}%`;
      query = query.where(function() {
        this.where('positions.symbol', 'ilike', s)
            .orWhere('users.username', 'ilike', s)
            .orWhere('users.client_id', 'ilike', s);
      });
      countQuery = countQuery.where(function() {
        this.where('positions.symbol', 'ilike', s)
            .orWhere('users.username', 'ilike', s)
            .orWhere('users.client_id', 'ilike', s);
      });
    }

    if (startDate) {
      query = query.where('positions.created_at', '>=', startDate);
      countQuery = countQuery.where('positions.created_at', '>=', startDate);
    }
    if (endDate) {
      query = query.where('positions.created_at', '<=', endDate);
      countQuery = countQuery.where('positions.created_at', '<=', endDate);
    }

    const [countResult] = await countQuery.count('positions.id as total');
    const total = countResult ? parseInt(countResult.total) : 0;
    const totalPages = Math.ceil(total / limit) || 1;

    let posQuery = query.orderBy('positions.id', 'desc');
    if (!isExport) {
      posQuery = posQuery.limit(limit).offset(offset);
    } else {
      posQuery = posQuery.limit(10000);
    }
    const positions = await posQuery;
    res.json({ success: true, positions, total, page, totalPages });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/admin/ledger', authenticateToken, async (req, res) => {
  try {
    const caller = await db('users').where({ id: req.user.id }).first();
    if (!caller || !caller.is_admin) return res.status(403).json({ error: 'Unauthorized' });
    
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 50;
    const offset = (page - 1) * limit;
    const search = req.query.search || '';
    const startDate = req.query.startDate;
    const endDate = req.query.endDate;
    const isExport = req.query.export === 'true' || req.query.limit === 'all';

    let query = db('ledger')
      .join('users', 'ledger.user_id', '=', 'users.id')
      .select('ledger.*', 'users.username', 'users.email', 'users.client_id');

    let countQuery = db('ledger')
      .join('users', 'ledger.user_id', '=', 'users.id');

    if (search) {
      const s = `%${search}%`;
      query = query.where(function() {
        this.where('ledger.description', 'ilike', s)
            .orWhere('ledger.type', 'ilike', s)
            .orWhere('users.username', 'ilike', s)
            .orWhere('users.client_id', 'ilike', s);
      });
      countQuery = countQuery.where(function() {
        this.where('ledger.description', 'ilike', s)
            .orWhere('ledger.type', 'ilike', s)
            .orWhere('users.username', 'ilike', s)
            .orWhere('users.client_id', 'ilike', s);
      });
    }

    if (startDate) {
      query = query.where('ledger.created_at', '>=', startDate);
      countQuery = countQuery.where('ledger.created_at', '>=', startDate);
    }
    if (endDate) {
      query = query.where('ledger.created_at', '<=', endDate);
      countQuery = countQuery.where('ledger.created_at', '<=', endDate);
    }

    const [countResult] = await countQuery.count('ledger.id as total');
    const total = countResult ? parseInt(countResult.total) : 0;
    const totalPages = Math.ceil(total / limit) || 1;

    let ledQuery = query.orderBy('ledger.created_at', 'desc');
    if (!isExport) {
      ledQuery = ledQuery.limit(limit).offset(offset);
    } else {
      ledQuery = ledQuery.limit(10000);
    }
    const ledger = await ledQuery;

    res.json({ success: true, ledger, total, page, totalPages });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── Market Status Endpoints (Admin Controls) ──────────────────────────────────
app.get('/api/market-status', (req, res) => {
  res.json({
    success: true,
    equity: marketStatusCache.equity,
    commodity: marketStatusCache.commodity
  });
});

app.get('/api/admin/market-status', authenticateToken, async (req, res) => {
  try {
    const caller = await db('users').where({ id: req.user.id }).first();
    if (!caller || !caller.is_admin) return res.status(403).json({ error: 'Unauthorized' });

    const { getFyersStatus } = require('./services/fyers');
    const fyersStatus = getFyersStatus ? getFyersStatus() : {};

    res.json({
      success: true,
      equity: marketStatusCache.equity,
      commodity: marketStatusCache.commodity,
      fyers: fyersStatus
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/admin/market-status', authenticateToken, async (req, res) => {
  try {
    const caller = await db('users').where({ id: req.user.id }).first();
    if (!caller || !caller.is_admin) return res.status(403).json({ error: 'Unauthorized' });

    const { equity, commodity } = req.body;
    const validModes = ['AUTO', 'OPEN', 'CLOSED'];

    if (equity && validModes.includes(equity.toUpperCase())) {
      marketStatusCache.equity = equity.toUpperCase();
      await db('system_settings')
        .insert({ key: 'equity_market_status', value: marketStatusCache.equity, updated_at: new Date() })
        .onConflict('key')
        .merge();
    }

    if (commodity && validModes.includes(commodity.toUpperCase())) {
      marketStatusCache.commodity = commodity.toUpperCase();
      await db('system_settings')
        .insert({ key: 'commodity_market_status', value: marketStatusCache.commodity, updated_at: new Date() })
        .onConflict('key')
        .merge();
    }

    // Broadcast across Redis cluster
    try {
      const { pubClient } = require('./services/redisClient');
      if (pubClient) {
        pubClient.publish('market_status_updated', JSON.stringify({
          equity: marketStatusCache.equity,
          commodity: marketStatusCache.commodity
        })).catch(() => {});
      }
    } catch(e) {}

    try {
      io.emit('market_status_updated', {
        equity: marketStatusCache.equity,
        commodity: marketStatusCache.commodity
      });
    } catch(e) {}

    console.log(`[Admin] Market Status updated: Equity=${marketStatusCache.equity}, Commodity=${marketStatusCache.commodity}`);
    res.json({
      success: true,
      equity: marketStatusCache.equity,
      commodity: marketStatusCache.commodity
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── MARKET CALENDAR ENDPOINTS ──────────────────────────────────────────

const OFFICIAL_2026_HOLIDAYS = [
  { date: '2026-01-26', equity_status: 'CLOSED', commodity_status: 'CLOSED', reason: 'Republic Day' },
  { date: '2026-02-18', equity_status: 'CLOSED', commodity_status: 'OPEN', commodity_start_time: '17:00', commodity_end_time: '23:30', reason: 'Mahashivratri (MCX Evening Session Open)' },
  { date: '2026-03-03', equity_status: 'CLOSED', commodity_status: 'OPEN', commodity_start_time: '17:00', commodity_end_time: '23:30', reason: 'Holi (MCX Evening Session Open)' },
  { date: '2026-03-27', equity_status: 'CLOSED', commodity_status: 'OPEN', commodity_start_time: '17:00', commodity_end_time: '23:30', reason: 'Id-Ul-Fitr / Ramzan Id (MCX Evening Session Open)' },
  { date: '2026-04-03', equity_status: 'CLOSED', commodity_status: 'CLOSED', reason: 'Good Friday' },
  { date: '2026-04-14', equity_status: 'CLOSED', commodity_status: 'OPEN', commodity_start_time: '17:00', commodity_end_time: '23:30', reason: 'Dr. Ambedkar Jayanti (MCX Evening Session Open)' },
  { date: '2026-05-01', equity_status: 'CLOSED', commodity_status: 'OPEN', commodity_start_time: '17:00', commodity_end_time: '23:30', reason: 'Maharashtra Day (MCX Evening Session Open)' },
  { date: '2026-05-27', equity_status: 'CLOSED', commodity_status: 'OPEN', commodity_start_time: '17:00', commodity_end_time: '23:30', reason: 'Bakri Id (MCX Evening Session Open)' },
  { date: '2026-06-25', equity_status: 'CLOSED', commodity_status: 'OPEN', commodity_start_time: '17:00', commodity_end_time: '23:30', reason: 'Muharram (MCX Evening Session Open)' },
  { date: '2026-08-15', equity_status: 'CLOSED', commodity_status: 'CLOSED', reason: 'Independence Day' },
  { date: '2026-10-02', equity_status: 'CLOSED', commodity_status: 'CLOSED', reason: 'Mahatma Gandhi Jayanti' },
  { date: '2026-10-20', equity_status: 'CLOSED', commodity_status: 'OPEN', commodity_start_time: '17:00', commodity_end_time: '23:30', reason: 'Dussehra (MCX Evening Session Open)' },
  { date: '2026-11-08', equity_status: 'OPEN', commodity_status: 'OPEN', equity_start_time: '18:15', equity_end_time: '19:15', commodity_start_time: '18:15', commodity_end_time: '19:15', reason: 'Diwali Laxmi Pujan (Muhurat Trading 6:15 PM - 7:15 PM)' },
  { date: '2026-11-10', equity_status: 'CLOSED', commodity_status: 'OPEN', commodity_start_time: '17:00', commodity_end_time: '23:30', reason: 'Diwali Balipratipada (MCX Evening Session Open)' },
  { date: '2026-11-24', equity_status: 'CLOSED', commodity_status: 'OPEN', commodity_start_time: '17:00', commodity_end_time: '23:30', reason: 'Gurunanak Jayanti (MCX Evening Session Open)' },
  { date: '2026-12-25', equity_status: 'CLOSED', commodity_status: 'CLOSED', reason: 'Christmas' }
];

app.get('/api/market-calendar', async (req, res) => {
  try {
    const { month } = req.query; // optional 'YYYY-MM'
    let query = db('market_calendar').select('*').orderBy('date', 'asc');
    if (month && /^[0-9]{4}-[0-9]{2}$/.test(month)) {
      query = query.whereRaw('date LIKE ?', [`${month}%`]);
    }
    const rows = await query;
    res.json({ success: true, calendar: rows });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/market-calendar/today', (req, res) => {
  try {
    const now = new Date();
    const istTime = new Date(now.getTime() + (5.5 * 60 * 60 * 1000));
    const year = istTime.getUTCFullYear();
    const month = String(istTime.getUTCMonth() + 1).padStart(2, '0');
    const dateNum = String(istTime.getUTCDate()).padStart(2, '0');
    const todayStr = `${year}-${month}-${dateNum}`;

    const equityCheck = isSegmentMarketOpen(false);
    const commodityCheck = isSegmentMarketOpen(true);
    const todayRule = marketCalendarCache.get(todayStr) || null;

    res.json({
      success: true,
      today: todayStr,
      equity: {
        open: equityCheck.open,
        reason: equityCheck.reason || null,
        globalStatus: marketStatusCache.equity,
        rule: todayRule ? todayRule.equity_status : 'DEFAULT'
      },
      commodity: {
        open: commodityCheck.open,
        reason: commodityCheck.reason || null,
        globalStatus: marketStatusCache.commodity,
        rule: todayRule ? todayRule.commodity_status : 'DEFAULT'
      },
      todayRule
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/admin/market-calendar', authenticateToken, async (req, res) => {
  try {
    const caller = await db('users').where({ id: req.user.id }).first();
    if (!caller || !caller.is_admin) return res.status(403).json({ error: 'Unauthorized' });

    const {
      date,
      equity_status = 'DEFAULT',
      commodity_status = 'DEFAULT',
      equity_start_time = null,
      equity_end_time = null,
      commodity_start_time = null,
      commodity_end_time = null,
      reason = ''
    } = req.body;

    if (!date || !/^[0-9]{4}-[0-9]{2}-[0-9]{2}$/.test(date)) {
      return res.status(400).json({ error: 'Invalid date format. Expected YYYY-MM-DD' });
    }

    const payload = {
      date,
      equity_status,
      commodity_status,
      equity_start_time: equity_start_time || null,
      equity_end_time: equity_end_time || null,
      commodity_start_time: commodity_start_time || null,
      commodity_end_time: commodity_end_time || null,
      reason: reason || null,
      updated_at: new Date()
    };

    await db('market_calendar')
      .insert(payload)
      .onConflict('date')
      .merge();

    await loadMarketCalendarFromDb();

    // Broadcast across Redis cluster & Socket.IO
    try {
      const { pubClient } = require('./services/redisClient');
      if (pubClient) {
        pubClient.publish('market_calendar_updated', JSON.stringify({ date })).catch(() => {});
      }
    } catch(e) {}

    try {
      io.emit('market_calendar_updated', { date, ...payload });
    } catch(e) {}

    console.log(`[Admin] Saved Market Calendar rule for ${date}: Equity=${equity_status}, MCX=${commodity_status} (${reason})`);
    res.json({ success: true, entry: payload });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/admin/market-calendar/:date', authenticateToken, async (req, res) => {
  try {
    const caller = await db('users').where({ id: req.user.id }).first();
    if (!caller || !caller.is_admin) return res.status(403).json({ error: 'Unauthorized' });

    const { date } = req.params;
    await db('market_calendar').where({ date }).del();
    await loadMarketCalendarFromDb();

    // Broadcast across Redis cluster & Socket.IO
    try {
      const { pubClient } = require('./services/redisClient');
      if (pubClient) {
        pubClient.publish('market_calendar_updated', JSON.stringify({ date, deleted: true })).catch(() => {});
      }
    } catch(e) {}

    try {
      io.emit('market_calendar_updated', { date, deleted: true });
    } catch(e) {}

    console.log(`[Admin] Reset Market Calendar rule for ${date} to DEFAULT`);
    res.json({ success: true, date });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/admin/market-calendar/bulk-holidays', authenticateToken, async (req, res) => {
  try {
    const caller = await db('users').where({ id: req.user.id }).first();
    if (!caller || !caller.is_admin) return res.status(403).json({ error: 'Unauthorized' });

    for (const h of OFFICIAL_2026_HOLIDAYS) {
      await db('market_calendar')
        .insert({
          ...h,
          updated_at: new Date()
        })
        .onConflict('date')
        .merge();
    }

    await loadMarketCalendarFromDb();

    try {
      const { pubClient } = require('./services/redisClient');
      if (pubClient) {
        pubClient.publish('market_calendar_updated', JSON.stringify({ bulk: true })).catch(() => {});
      }
    } catch(e) {}

    try {
      io.emit('market_calendar_updated', { bulk: true });
    } catch(e) {}

    console.log(`[Admin] Seeded ${OFFICIAL_2026_HOLIDAYS.length} official 2026 stock market holidays`);
    res.json({ success: true, count: OFFICIAL_2026_HOLIDAYS.length });
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
    let requestedAmount = parseFloat(req.body?.amount);
    // Limit: minimum ₹10,000, maximum ₹10 Crore (100,000,000)
    const MAX_AMOUNT = 100000000.0; // 10 Crore
    const MIN_AMOUNT = 10000.0;     // 10 Thousand
    let newBalance = 1000000.0;     // Default 10 Lakh
    if (!isNaN(requestedAmount) && requestedAmount > 0) {
      newBalance = Math.min(Math.max(requestedAmount, MIN_AMOUNT), MAX_AMOUNT);
    }

    let pendingOrders = [];
    await db.transaction(async (trx) => {
      // 0. Fetch pending orders to purge them from TriggerEngine memory & Redis
      pendingOrders = await trx('orders')
        .where({ user_id: req.user.id })
        .whereIn('status', ['PENDING', 'PENDING_TRIGGER']);

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
      // 5. Clear active/scheduled SIPs
      const hasSips = await trx.schema.hasTable('sips');
      if (hasSips) {
        await trx('sips').where({ user_id: req.user.id }).del();
      }
      // 6. Delete ledger history
      await trx('ledger').where({ user_id: req.user.id }).del();
      // 7. Reset balance to chosen amount (up to 10 Crore)
      await trx('users').where({ id: req.user.id }).update({ balance: newBalance });
      // 8. Add initial deposit record so ledger matches balance
      await trx('ledger').insert({
        user_id: req.user.id,
        amount: newBalance,
        type: 'DEPOSIT',
        description: 'Account reset opening balance'
      });
    });

    const triggerEngine = require('./services/triggerEngine');
    for (const ord of pendingOrders) {
      triggerEngine.removeOrderFromMemory(ord.id, ord.symbol);
    }
    try {
      const { pubClient } = require('./services/redisClient');
      if (pubClient) pubClient.publish('reload_triggers', '1').catch(() => {});
    } catch(e) {}
    res.json({ 
      success: true, 
      balance: newBalance,
      message: `Account successfully reset to ₹${newBalance.toLocaleString('en-IN')}.` 
    });
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
  const { positionId, newProductType } = req.body;
  if (!positionId || !newProductType) {
    return res.status(400).json({ error: 'Missing required fields' });
  }
  if (!['INT', 'DEL'].includes(newProductType)) {
    return res.status(400).json({ error: 'Invalid product type. Must be INT or DEL.' });
  }
  
  try {
    await db.transaction(async (trx) => {
      await trx.raw('SELECT pg_advisory_xact_lock(?)', [req.user.id]);
      const position = await trx('positions').where({ id: positionId, user_id: req.user.id }).first();
      if (!position) throw Object.assign(new Error('Position not found'), { statusCode: 404 });
      if (position.product_type === newProductType) {
        throw Object.assign(new Error('Position is already in the requested product type'), { statusCode: 400 });
      }
      if (Number(position.quantity) === 0) {
        throw Object.assign(new Error('Cannot convert a closed position'), { statusCode: 400 });
      }

      // Prohibit converting short equity positions into Delivery (DEL)
      const isDerivative = isDerivativeContract(position.symbol);
      if (Number(position.quantity) < 0 && newProductType === 'DEL' && !isDerivative) {
        throw Object.assign(new Error('Short equity positions cannot be converted to Delivery (CNC).'), { statusCode: 400 });
      }

      const { calculateRequiredMargin } = require('./services/marginEngine');
      const currentPrice = priceCache[position.symbol]?.ltp || Number(position.average_price) || 0;
      const absQty = Math.abs(Number(position.quantity));
      const side = Number(position.quantity) > 0 ? 'BUY' : 'SELL';

      const oldMargin = parseFloat(position.margin) || 0;
      const newMargin = calculateRequiredMargin(position.symbol, newProductType, side, absQty, currentPrice);
      const marginDifference = newMargin - oldMargin;

      const user = await trx('users').where({ id: req.user.id }).first();

      if (marginDifference > 0) {
        if (parseFloat(user.balance) < marginDifference) {
          throw Object.assign(new Error('Insufficient Funds to convert position.'), { statusCode: 400 });
        }
        await trx('users').where({ id: req.user.id }).update({ balance: parseFloat(user.balance) - marginDifference });
        await trx('ledger').insert({
          user_id: req.user.id,
          amount: -marginDifference,
          type: 'MARGIN_BLOCK',
          description: `Additional margin blocked for converting ${position.symbol} to ${newProductType}`
        });
      } else if (marginDifference < 0) {
        const refund = Math.abs(marginDifference);
        await trx('users').where({ id: req.user.id }).update({ balance: parseFloat(user.balance) + refund });
        await trx('ledger').insert({
          user_id: req.user.id,
          amount: refund,
          type: 'MARGIN_RELEASE',
          description: `Margin released for converting ${position.symbol} to ${newProductType}`
        });
      }

      // Update position product type and new margin
      await trx('positions').where({ id: positionId }).update({ 
        product_type: newProductType,
        margin: newMargin,
        updated_at: new Date()
      });
      
      // Try to merge positions if there's already an existing position for the same symbol + product_type
      const existingPos = await trx('positions')
        .where({ user_id: req.user.id, symbol: position.symbol, product_type: newProductType })
        .whereNot('id', positionId)
        .whereNot('quantity', 0)
        .first();

      if (existingPos) {
        const qtyA = Number(existingPos.quantity);
        const qtyB = Number(position.quantity);
        const priceA = parseFloat(existingPos.average_price) || 0;
        const priceB = parseFloat(position.average_price) || 0;
        const marginA = parseFloat(existingPos.margin || 0);
        const marginB = newMargin;

        const sameSign = (qtyA > 0 && qtyB > 0) || (qtyA < 0 && qtyB < 0);

        if (sameSign) {
          // Volume-weighted average price when adding to the same side
          const newQty = qtyA + qtyB;
          const currentCost = Math.abs(qtyA) * priceA;
          const addedCost = Math.abs(qtyB) * priceB;
          const newAvg = Math.abs(newQty) > 0 ? (currentCost + addedCost) / Math.abs(newQty) : priceA;
          const combinedMargin = marginA + marginB;

          await trx('positions').where({ id: existingPos.id }).update({ 
            quantity: newQty, 
            average_price: newAvg,
            margin: combinedMargin,
            updated_at: new Date()
          });
          await trx('positions').where({ id: positionId }).del();
        } else {
          // Netting opposing positions
          const closedQty = Math.min(Math.abs(qtyA), Math.abs(qtyB));
          const netQty = qtyA + qtyB;
          
          // PnL calculation: If qtyA > 0, qtyA was BUY and qtyB was SELL
          const realizedPnl = qtyA > 0 
            ? (priceB - priceA) * closedQty 
            : (priceA - priceB) * closedQty;

          if (netQty === 0) {
            // Both completely closed
            const totalMarginRelease = marginA + marginB;
            const netRelease = totalMarginRelease + realizedPnl;
            await trx('users').where({ id: req.user.id }).increment('balance', netRelease);

            if (totalMarginRelease > 0) {
              await trx('ledger').insert({
                user_id: req.user.id,
                amount: totalMarginRelease,
                type: 'MARGIN_RELEASE',
                description: `Margin released from netted conversion for ${position.symbol}`
              });
            }
            if (realizedPnl !== 0) {
              await trx('ledger').insert({
                user_id: req.user.id,
                amount: realizedPnl,
                type: 'REALIZED_PNL',
                description: `Realized P&L from netted conversion for ${position.symbol}`
              });
            }

            await trx('positions').where({ id: existingPos.id }).update({
              quantity: 0,
              closed_quantity: trx.raw('COALESCE(closed_quantity, 0) + ?', [closedQty]),
              exit_price: priceB,
              margin: 0,
              realized_pnl: trx.raw('COALESCE(realized_pnl, 0) + ?', [realizedPnl]),
              updated_at: new Date()
            });
            await trx('positions').where({ id: positionId }).del();
          } else if (Math.abs(qtyA) > Math.abs(qtyB)) {
            // Existing position partially closed, incoming completely absorbed
            const marginReleaseFromA = marginA * (closedQty / Math.abs(qtyA));
            const remainingMarginA = marginA - marginReleaseFromA;
            const totalMarginRelease = marginB + marginReleaseFromA;
            const netRelease = totalMarginRelease + realizedPnl;
            await trx('users').where({ id: req.user.id }).increment('balance', netRelease);

            if (totalMarginRelease > 0) {
              await trx('ledger').insert({
                user_id: req.user.id,
                amount: totalMarginRelease,
                type: 'MARGIN_RELEASE',
                description: `Margin released from partial netting conversion for ${position.symbol}`
              });
            }
            if (realizedPnl !== 0) {
              await trx('ledger').insert({
                user_id: req.user.id,
                amount: realizedPnl,
                type: 'REALIZED_PNL',
                description: `Realized P&L from partial netting conversion for ${position.symbol}`
              });
            }

            await trx('positions').where({ id: existingPos.id }).update({
              quantity: netQty,
              average_price: priceA,
              margin: remainingMarginA,
              closed_quantity: trx.raw('COALESCE(closed_quantity, 0) + ?', [closedQty]),
              realized_pnl: trx.raw('COALESCE(realized_pnl, 0) + ?', [realizedPnl]),
              updated_at: new Date()
            });
            await trx('positions').where({ id: positionId }).del();
          } else {
            // Existing position completely absorbed, incoming partially remaining
            const marginReleaseFromB = marginB * (closedQty / Math.abs(qtyB));
            const remainingMarginB = marginB - marginReleaseFromB;
            const totalMarginRelease = marginA + marginReleaseFromB;
            const netRelease = totalMarginRelease + realizedPnl;
            await trx('users').where({ id: req.user.id }).increment('balance', netRelease);

            if (totalMarginRelease > 0) {
              await trx('ledger').insert({
                user_id: req.user.id,
                amount: totalMarginRelease,
                type: 'MARGIN_RELEASE',
                description: `Margin released from partial netting conversion for ${position.symbol}`
              });
            }
            if (realizedPnl !== 0) {
              await trx('ledger').insert({
                user_id: req.user.id,
                amount: realizedPnl,
                type: 'REALIZED_PNL',
                description: `Realized P&L from partial netting conversion for ${position.symbol}`
              });
            }

            await trx('positions').where({ id: existingPos.id }).update({
              quantity: netQty,
              average_price: priceB,
              margin: remainingMarginB,
              closed_quantity: trx.raw('COALESCE(closed_quantity, 0) + ?', [closedQty]),
              realized_pnl: trx.raw('COALESCE(realized_pnl, 0) + ?', [realizedPnl]),
              updated_at: new Date()
            });
            await trx('positions').where({ id: positionId }).del();
          }
        }
      }
    });

    res.json({ success: true });
  } catch (err) {
    const statusCode = err.statusCode || 400;
    res.status(statusCode).json({ error: err.message });
  }
});

// ── MUTUAL FUNDS ENGINE ───────────────────────────────────────────────────────

const myFetch = async (...args) => {
    const { default: nf } = await import('node-fetch');
    return nf(...args);
};

// 1. Master List Cache
let allMutualFunds = [];
let allMutualFundsMap = new Map();

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
            allMutualFundsMap = new Map();
            for (const f of funds) {
                allMutualFundsMap.set(String(f.schemeCode), f);
            }
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

function setLRUCache(cacheObj, key, value, maxItems = 100) {
    const keys = Object.keys(cacheObj);
    if (keys.length >= maxItems) {
        let oldestKey = keys[0];
        let oldestTs = Infinity;
        for (const k of keys) {
            if (cacheObj[k]?.timestamp < oldestTs) {
                oldestTs = cacheObj[k].timestamp;
                oldestKey = k;
            }
        }
        delete cacheObj[oldestKey];
    }
    cacheObj[key] = value;
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
                const fund = allMutualFundsMap.get(cleanId);
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
                            const newFund = { schemeCode: parseInt(cleanId), schemeName: mfRes.data.meta.scheme_name };
                            allMutualFunds.push(newFund);
                            allMutualFundsMap.set(cleanId, newFund);
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

        res.setHeader('Cache-Control', 'public, max-age=300, stale-while-revalidate=1800');
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
                    const axios = require('axios');
                    const cleanCode = String(schemeCode).replace('-MF', '');
                    const res = await axios.get(`https://api.mfapi.in/mf/${cleanCode}`, { timeout: 4000 });
                    if (res.data && res.data.data && res.data.data.length > 0) {
                        data = res.data;
                        mfCache[schemeCode] = { timestamp: Date.now(), data };
                    }
                }

                if (!data || !data.data || data.data.length === 0) return null;
                const historicalData = data.data;
                const latestNav = parseFloat(historicalData[0].nav);

                return {
                    id: schemeCode,
                    nav: latestNav,
                    return1y: calculateReturn(historicalData, 1) || 0,
                    return3y: calculateReturn(historicalData, 3) || 0,
                    return5y: calculateReturn(historicalData, 5) || 0,
                    returnAllTime: calculateReturnAllTime(historicalData) || 0,
                    risk: determineRisk(calculateReturn(historicalData, 1))
                };
            } catch { return null; }
        }));

        res.setHeader('Cache-Control', 'public, max-age=1800, stale-while-revalidate=86400');
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
            res.setHeader('Cache-Control', 'public, max-age=3600, stale-while-revalidate=86400');
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

        setLRUCache(mfDetailsCache, name, { timestamp: Date.now(), data: detailsData }, 100);
        res.setHeader('Cache-Control', 'public, max-age=3600, stale-while-revalidate=86400');
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
        
        setLRUCache(mfCache, schemeCode, { timestamp: Date.now(), data }, 100);
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
// ─── Option Chain & Futures In-Memory Caching (Zero Disk I/O on Requests) ───
let cachedOptionsData = null;
let cachedFuturesData = null;
let cachedOptionsSymbols = [];

async function loadOptionsAndFuturesCache() {
  const optionsPath = path.join(__dirname, 'database', 'options.json');
  const futuresPath = path.join(__dirname, 'database', 'futures.json');

  try {
    const [optRaw, futRaw] = await Promise.all([
      fs.promises.readFile(optionsPath, 'utf8').catch(() => null),
      fs.promises.readFile(futuresPath, 'utf8').catch(() => null)
    ]);
    if (optRaw) {
      cachedOptionsData = JSON.parse(optRaw);
      cachedOptionsSymbols = Object.keys(cachedOptionsData).sort();
    }
    if (futRaw) {
      cachedFuturesData = JSON.parse(futRaw);
    }
    console.log(`⚡ [Cache Loaded] Options (${cachedOptionsSymbols.length} underlyings) & Futures in memory.`);
  } catch (err) {
    console.error('Failed to load options/futures in-memory cache:', err.message);
  }
}

// Initial async load at server boot
loadOptionsAndFuturesCache();

app.get('/api/options/chain/:symbol', async (req, res) => {
  const symbol = req.params.symbol.toUpperCase();

  if (!cachedOptionsData) {
    await loadOptionsAndFuturesCache();
  }

  if (!cachedOptionsData) {
    return res.status(503).json({ error: 'Options database is currently being built. Please try again in a minute.' });
  }

  if (!cachedOptionsData[symbol]) {
    return res.status(404).json({ error: `Option chain for ${symbol} not found.` });
  }

  res.setHeader('Cache-Control', 'public, max-age=60, stale-while-revalidate=300');
  res.json(cachedOptionsData[symbol]);
});

// Endpoint to fetch all available underlying symbols for options (e.g., NIFTY, RELIANCE, CRUDEOIL)
app.get('/api/options/symbols', async (req, res) => {
  if (!cachedOptionsData) {
    await loadOptionsAndFuturesCache();
  }

  if (!cachedOptionsData) {
    return res.status(503).json({ error: 'Options database is currently being built.' });
  }

  res.setHeader('Cache-Control', 'public, max-age=1800, stale-while-revalidate=86400');
  res.json(cachedOptionsSymbols);
});

app.get('/api/options/futures/:symbol', async (req, res) => {
  const symbol = req.params.symbol.toUpperCase();

  if (!cachedFuturesData) {
    await loadOptionsAndFuturesCache();
  }

  if (!cachedFuturesData) {
    return res.status(503).json({ error: 'Futures database not ready.' });
  }

  const data = cachedFuturesData;
  if (data[symbol] && data[symbol].length > 0) {
    const now = new Date();
    now.setHours(0, 0, 0, 0);

    const validFutures = data[symbol].filter(f => {
      const expDate = new Date(f.expiry);
      return expDate >= now;
    });

    res.setHeader('Cache-Control', 'public, max-age=300, stale-while-revalidate=1800');
    if (validFutures.length > 0) {
      res.json(validFutures[0]);
    } else {
      res.json(data[symbol][data[symbol].length - 1]);
    }
  } else {
    res.status(404).json({ error: 'No futures found for symbol' });
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

  if (type === 'GTT') {
    return res.status(400).json({ error: 'GTT orders are not supported.' });
  }

  // Validate Limit and Stop-Loss prices
  if (type === 'LIMIT' && (!price || parseFloat(price) <= 0 || isNaN(parseFloat(price)))) {
    return res.status(400).json({ error: 'Limit orders require a valid price greater than 0.' });
  }

  if ((type === 'SL-L' || type === 'SL-M') && (!trigger_price || parseFloat(trigger_price) <= 0 || isNaN(parseFloat(trigger_price)))) {
    return res.status(400).json({ error: 'Stop Loss orders require a valid trigger price greater than 0.' });
  }

  // Validate Quantity is a multiple of Lot Size for Options/Futures
  if (isDerivativeContract(symbol)) {
    const { getLotSizes } = require('./services/instrumentsCache');
    const cleanSym = String(symbol).replace(/^(NSE:|BSE:|MCX:)/i, '');
    const lotSizes = getLotSizes([symbol, cleanSym]);
    const lotsize = lotSizes[symbol] || lotSizes[cleanSym] || 1;
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
  const effectiveProductType = (product_type === 'CNC' || product_type === 'DELIVERY' || !product_type) ? 'DEL' : product_type;
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

  // Safety net: If this is an automated system square-off order, ensure it does not open a reverse/new position
  if (req.body && req.body.is_system_close && !isClosingOrder) {
    return res.json({ success: true, message: 'Position already closed or not found.' });
  }

  // 🛡️ RISK GUARDIAN ENFORCEMENT 🛡️
  // Note: Risk Guardian NEVER blocks closing/square-off orders for existing positions/holdings.
  const currentUser = await db('users').where({ id: req.user.id }).first();
  if (currentUser && currentUser.risk_guardian_active && !isClosingOrder) {
    const formatter = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata', year: 'numeric', month: '2-digit', day: '2-digit' });
    const parts = formatter.formatToParts(new Date());
    const year = parts.find(p => p.type === 'year').value;
    const month = parts.find(p => p.type === 'month').value;
    const day = parts.find(p => p.type === 'day').value;
    const todayStart = new Date(`${year}-${month}-${day}T00:00:00+05:30`);

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

  // Block new orders when market is closed (square-off / closing orders are always permitted)
  if (!isClosingOrder) {
    const isCommodity = isCommodityContract(symbol);
    const isIntradayProduct = (product_type === 'INT' || product_type === 'BO' || product_type === 'CO');
    
    const marketCheck = isSegmentMarketOpen(isCommodity);
    if (!marketCheck.open) {
      if (marketCheck.isTotalBlock || isIntradayProduct) {
        return res.status(400).json({ error: marketCheck.reason });
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
      const isMCXSymbol = symbol.endsWith('-MCX') || isCommodityContract(symbol);
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
      // Serialize order operations per-user to prevent race conditions with execution/cancel
      await trx.raw('SELECT pg_advisory_xact_lock(?)', [req.user.id]);

      // 1. Determine execution status
      const hasTrigger = Boolean((type && (type.startsWith('SL') || type === 'TRAILING_STOP')) || (trigger_price !== undefined && trigger_price !== null && Number(trigger_price) > 0));
      const isMarket = type === 'MARKET' && !hasTrigger;
      const isTriggerOrder = hasTrigger;
      const status = isTriggerOrder ? 'PENDING_TRIGGER' : 'PENDING';
      const execPrice = parseFloat(price) || priceCache[symbol]?.ltp || 0; // Fetch live LTP here for market orders
      const resolvedTriggerPrice = trigger_price ? parseFloat(trigger_price) : (type && type.startsWith('SL') && price ? parseFloat(price) : null);
      
      // 2. Deduct Margin from User Balance
      let requiresMargin = true;
      let marginQty = Number(quantity);

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
              if (existingPos) {
                  const excessQty = Math.max(0, Number(quantity) - Number(existingPos.quantity));
                  if (excessQty === 0) {
                      requiresMargin = false;
                  } else {
                      marginQty = excessQty;
                  }
              }
          } else if (isDerivative && effectiveProductType === 'DEL') {
              const existingPos = await trx('positions')
                  .where({ user_id: req.user.id, product_type: effectiveProductType })
                  .where(builder => {
                    builder.where({ symbol }).orWhere({ symbol: cleanSym }).orWhere({ symbol: `NSE:${cleanSym}` }).orWhere({ symbol: `BSE:${cleanSym}` }).orWhere({ symbol: `MCX:${cleanSym}` });
                  })
                  .where('quantity', '>', 0)
                  .first();
              if (existingPos) {
                  const excessQty = Math.max(0, Number(quantity) - Number(existingPos.quantity));
                  if (excessQty === 0) {
                      requiresMargin = false;
                  } else {
                      marginQty = excessQty;
                  }
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
              if (existingPos) {
                  const excessQty = Math.max(0, Number(quantity) - Math.abs(Number(existingPos.quantity)));
                  if (excessQty === 0) {
                      requiresMargin = false;
                  } else {
                      marginQty = excessQty;
                  }
              }
          }
      }

      let finalMargin = 0;
      if (requiresMargin) {
          const { calculateRequiredMargin } = require('./services/marginEngine');
          finalMargin = calculateRequiredMargin(symbol, effectiveProductType, side, marginQty, execPrice);
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
    
    // Instantly execute Market orders & Marketable Limit orders with 0ms delay
    if (ord.isMarket) {
      const execLtp = (priceCache[ord.symbol]?.ltp && Number(priceCache[ord.symbol].ltp) > 0)
        ? Number(priceCache[ord.symbol].ltp)
        : (parseFloat(ord.price) || parseFloat(req.body.price) || 0);

      if (execLtp > 0) {
        try {
          await triggerEngine.removeOrderFromMemory(ord.id, ord.symbol);
          await triggerEngine.executeOrder(ord, execLtp);
        } catch (err) {
          console.error('Immediate market execution error:', err);
        }
      }
    } else if (ord.type === 'LIMIT') {
      // Check for marketable limit order (e.g. BUY with limit >= LTP, or SELL with limit <= LTP)
      const currentLtp = (priceCache[ord.symbol]?.ltp && Number(priceCache[ord.symbol].ltp) > 0)
        ? Number(priceCache[ord.symbol].ltp)
        : (parseFloat(req.body.price) || 0);
      
      const limitPrice = parseFloat(ord.price) || 0;
      if (currentLtp > 0 && limitPrice > 0) {
        const isMarketableBuy = ord.side === 'BUY' && currentLtp <= limitPrice;
        const isMarketableSell = ord.side === 'SELL' && currentLtp >= limitPrice;
        if (isMarketableBuy || isMarketableSell) {
          try {
            await triggerEngine.removeOrderFromMemory(ord.id, ord.symbol);
            await triggerEngine.executeOrder(ord, currentLtp);
          } catch (err) {
            console.error('Immediate marketable limit execution error:', err);
          }
        }
      }
    }

    // Final status after execution without redundant DB query delay
    const finalStatus = ord.status || 'PENDING';
    const finalPrice = ord.price || price;

    // Send instant push & Telegram notification asynchronously (non-blocking)
    sendPushNotification(req.user.id, {
      title: `Order Placed: ${side} ${quantity} ${symbol}`,
      body: `Status: ${finalStatus} (${product_type || 'INT'})`,
      url: '/orders'
    }).catch(() => {});

    if (finalStatus === 'EXECUTED' || finalStatus === 'COMPLETE') {
      sendTelegramAlert(req.user.id, 'ORDER', {
        symbol,
        side,
        quantity,
        price: finalPrice,
        product_type
      }).catch(() => {});
    }

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
    const finalMargin = Number(amount);
    if (isNaN(finalMargin) || finalMargin <= 0) {
      return res.status(400).json({ error: 'Invalid SIP amount' });
    }

    // 1. Resolve Execution Price / NAV
    let execPrice = Number(price);
    if (!execPrice || execPrice <= 0) {
      execPrice = await SIPEngine.getLatestNav(symbol, priceCache);
    }
    if (!execPrice || execPrice <= 0) {
      const cleanSym = symbol.replace(/^(NSE:|BSE:|MCX:)/i, '');
      execPrice = priceCache[symbol]?.ltp || priceCache[cleanSym]?.ltp || priceCache[`NSE:${cleanSym}`]?.ltp || 0;
    }
    if (!execPrice || execPrice <= 0) {
      return res.status(400).json({ error: `Unable to determine live NAV or market price for ${symbol}. Please specify a valid price or try again.` });
    }

    const qty = parseFloat((finalMargin / execPrice).toFixed(4));
    if (qty <= 0) {
      return res.status(400).json({ error: 'Calculated quantity is zero. Please increase SIP amount.' });
    }

    const nextExecutionDate = SIPEngine.getNextExecutionDate(new Date(), frequency);
    const isMf = Boolean(symbol.endsWith('-MF') || symbol.includes('MUTUALFUND'));
    const assetClass = isMf ? 'MUTUAL_FUND' : 'EQUITY';
    const cleanSym = symbol.includes(':') ? symbol.split(':')[1] : symbol;

    await db.transaction(async (trx) => {
      const user = await trx('users').where({ id: req.user.id }).first();
      if (Number(user.balance) < finalMargin) {
         throw Object.assign(new Error(`Insufficient funds for SIP installment. Required: ₹${finalMargin.toLocaleString('en-IN')}, Available: ₹${Number(user.balance).toLocaleString('en-IN')}`), { statusCode: 400 });
      }
      
      const newBalance = Number(user.balance) - finalMargin;
      await trx('users').where({ id: req.user.id }).update({ balance: newBalance });
      
      await trx('ledger').insert({
          user_id: req.user.id,
          amount: -finalMargin,
          type: 'MARGIN_BLOCK',
          description: `SIP Installment (${frequency || 'MONTHLY'}): Bought ${qty} units of ${symbol} @ ₹${execPrice.toFixed(2)}`
      });

      await trx('sips').insert({
        user_id: req.user.id,
        symbol,
        amount: finalMargin,
        frequency: frequency || 'MONTHLY',
        next_execution_date: nextExecutionDate,
        status: 'ACTIVE'
      });

      // Insert Executed Order Record
      await trx('orders').insert({
        user_id: req.user.id,
        symbol,
        type: 'MARKET',
        side: 'BUY',
        quantity: qty,
        price: execPrice,
        status: 'EXECUTED',
        product_type: 'DEL',
        margin: finalMargin,
        created_at: new Date(),
        updated_at: new Date()
      });

      // Update or Insert Holding Directly
      const existingHolding = await trx('holdings')
        .where({ user_id: req.user.id })
        .where(builder => {
          builder.where({ symbol: symbol })
                 .orWhere({ symbol: cleanSym })
                 .orWhere({ symbol: `NSE:${cleanSym}` })
                 .orWhere({ symbol: `BSE:${cleanSym}` });
        })
        .first();

      if (existingHolding) {
        const prevQty = parseFloat(existingHolding.quantity) || 0;
        const prevAvg = parseFloat(existingHolding.average_price) || execPrice;
        const totalQty = prevQty + qty;
        const newAvg = totalQty > 0 ? ((prevQty * prevAvg) + (qty * execPrice)) / totalQty : execPrice;
        await trx('holdings').where({ id: existingHolding.id }).update({
          quantity: parseFloat(totalQty.toFixed(4)),
          average_price: parseFloat(newAvg.toFixed(2)),
          asset_class: assetClass,
          updated_at: new Date()
        });
      } else {
        await trx('holdings').insert({
          user_id: req.user.id,
          symbol,
          quantity: qty,
          average_price: parseFloat(execPrice.toFixed(2)),
          asset_class: assetClass,
          created_at: new Date(),
          updated_at: new Date()
        });
      }
    });

    res.json({ success: true, message: `SIP created and 1st installment executed successfully (${qty} units @ ₹${execPrice.toFixed(2)})` });
  } catch (error) {
    const statusCode = error.statusCode || 500;
    res.status(statusCode).json({ error: error.message, success: false });
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
      
      const rawSym = sym.includes(':') ? sym.split(':')[1] : null;
      const cached = priceCache[sym] || (rawSym ? priceCache[rawSym] : null) || priceCache[`NSE:${sym}`] || priceCache[`BSE:${sym}`] || priceCache[`MCX:${sym}`];
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
            if (ltpData && ltpData.ltp > 0) {
              priceCache[sym] = ltpData;
              const rSym = sym.includes(':') ? sym.split(':')[1] : null;
              if (rSym) priceCache[rSym] = ltpData;
              
              // ⚡ Real-time broadcast to socket rooms immediately
              if (io) {
                io.to(sym).emit('price_snapshot', { [sym]: ltpData });
                if (rSym) io.to(rSym).emit('price_snapshot', { [rSym]: ltpData });
              }
            }
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

app.get('/api/push/status', authenticateToken, async (req, res) => {
  try {
    let hasWebPush = false;
    let hasFcm = false;
    try {
      const webSub = await db('push_subscriptions').where({ user_id: req.user.id }).first();
      hasWebPush = !!webSub;
    } catch (e) {}
    try {
      const fcmSub = await db('fcm_device_tokens').where({ user_id: req.user.id }).first();
      hasFcm = !!fcmSub;
    } catch (e) {}

    res.json({
      success: true,
      enabled: hasWebPush || hasFcm,
      hasWebPush,
      hasFcm
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
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

// 📱 Native Mobile App Push Endpoints (FCM)
app.post('/api/push/fcm-subscribe', authenticateToken, async (req, res) => {
  try {
    const { token, platform, deviceName } = req.body;
    if (!token) {
      return res.status(400).json({ error: 'FCM token is required' });
    }

    // Ensure fcm_device_tokens table exists defensively
    await db.raw(`
      CREATE TABLE IF NOT EXISTS fcm_device_tokens (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        token TEXT NOT NULL UNIQUE,
        platform VARCHAR(20) DEFAULT 'android',
        device_name VARCHAR(100),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    const existing = await db('fcm_device_tokens').where({ token }).first();
    if (existing) {
      await db('fcm_device_tokens').where({ token }).update({
        user_id: req.user.id,
        platform: platform || 'android',
        device_name: deviceName || null,
        updated_at: new Date()
      });
    } else {
      await db('fcm_device_tokens').insert({
        user_id: req.user.id,
        token,
        platform: platform || 'android',
        device_name: deviceName || null
      });
    }

    res.json({ success: true, message: 'FCM device token registered successfully' });
  } catch (err) {
    console.error('Failed to save FCM token:', err);
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/push/fcm-unsubscribe', authenticateToken, async (req, res) => {
  try {
    const { token } = req.body;
    if (token) {
      await db('fcm_device_tokens').where({ token }).delete();
    } else {
      await db('fcm_device_tokens').where({ user_id: req.user.id }).delete();
    }
    res.json({ success: true, message: 'Unsubscribed FCM device token' });
  } catch (err) {
    console.error('Failed to unsubscribe FCM token:', err);
    res.status(500).json({ error: err.message });
  }
});


// 📱 Telegram Trade & Risk Alerts Endpoints 📱
const { 
  sendTelegramAlert, 
  sendTestAlert, 
  broadcastTelegramMessage, 
  handleIncomingTelegramUpdate,
  getSystemConfig: getTelegramSystemConfig, 
  updateSystemConfig: updateTelegramSystemConfig 
} = require('./services/telegramService');

// 📱 Telegram Webhook Endpoint for Interactive 2-Way Bot Commands (/pnl, /positions, /exitall)
app.post('/api/telegram/webhook', async (req, res) => {
  try {
    const result = await handleIncomingTelegramUpdate(req.body);
    res.json({ ok: true, ...result });
  } catch (err) {
    console.error('Telegram webhook error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/telegram/settings', authenticateToken, async (req, res) => {
  try {
    const user = await db('users').where({ id: req.user.id }).first();
    if (!user) return res.status(404).json({ error: 'User not found' });

    const sysConfig = getTelegramSystemConfig();

    res.json({
      success: true,
      telegram_chat_id: user.telegram_chat_id || '',
      telegram_alerts_enabled: !!user.telegram_alerts_enabled,
      telegram_alert_orders: user.telegram_alert_orders !== false,
      telegram_alert_targets: user.telegram_alert_targets !== false,
      telegram_alert_stoploss: user.telegram_alert_stoploss !== false,
      telegram_alert_risk: user.telegram_alert_risk !== false,
      bot_username: sysConfig.bot_username || 'ShortEdgeAlerts_bot',
      global_enabled: sysConfig.global_enabled
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/telegram/settings', authenticateToken, async (req, res) => {
  try {
    const { 
      telegram_chat_id, 
      telegram_alerts_enabled, 
      telegram_alert_orders, 
      telegram_alert_targets, 
      telegram_alert_stoploss, 
      telegram_alert_risk 
    } = req.body;

    await db('users').where({ id: req.user.id }).update({
      telegram_chat_id: (telegram_chat_id || '').trim(),
      telegram_alerts_enabled: !!telegram_alerts_enabled,
      telegram_alert_orders: telegram_alert_orders !== undefined ? !!telegram_alert_orders : true,
      telegram_alert_targets: telegram_alert_targets !== undefined ? !!telegram_alert_targets : true,
      telegram_alert_stoploss: telegram_alert_stoploss !== undefined ? !!telegram_alert_stoploss : true,
      telegram_alert_risk: telegram_alert_risk !== undefined ? !!telegram_alert_risk : true
    });

    res.json({ success: true, message: 'Telegram alert preferences updated successfully!' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/telegram/test', authenticateToken, async (req, res) => {
  try {
    const { chat_id } = req.body;
    const user = await db('users').where({ id: req.user.id }).first();
    const targetChatId = chat_id || user?.telegram_chat_id;

    if (!targetChatId) {
      return res.status(400).json({ error: 'Please enter a valid Telegram Chat ID first.' });
    }

    const result = await sendTestAlert(targetChatId, user?.username || 'Trader');
    if (result.success) {
      res.json({ success: true, message: 'Test message delivered to your Telegram account!' });
    } else {
      res.status(400).json({ error: result.error || 'Failed to deliver test message to Telegram.' });
    }
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 🛡️ Admin Telegram Traffic & Peak Protection Endpoints
app.get('/api/admin/telegram/config', authenticateToken, async (req, res) => {
  try {
    if (!req.user.is_admin) return res.status(403).json({ error: 'Admin access required' });
    const config = getTelegramSystemConfig();
    const connectedUsersCount = await db('users').whereNotNull('telegram_chat_id').where('telegram_alerts_enabled', true).count('* as count').first();
    res.json({ success: true, config, connectedUsers: Number(connectedUsersCount?.count || 0) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/admin/telegram/config', authenticateToken, async (req, res) => {
  try {
    if (!req.user.is_admin) return res.status(403).json({ error: 'Admin access required' });
    const updated = updateTelegramSystemConfig(req.body);
    res.json({ success: true, message: 'Telegram system configuration updated!', config: updated });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/admin/telegram/broadcast', authenticateToken, async (req, res) => {
  try {
    if (!req.user.is_admin) return res.status(403).json({ error: 'Admin access required' });
    const { message } = req.body;
    if (!message) return res.status(400).json({ error: 'Message content is required' });

    const result = await broadcastTelegramMessage(message);
    res.json(result);
  } catch (err) {
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
      await trx.raw('SELECT pg_advisory_xact_lock(?)', [req.user.id]);
      const LedgerService = require('./services/ledgerService');
      for (const holding of activeHoldings) {
        const qty = parseFloat(holding.quantity);
        const ltp = priceCache[holding.symbol]?.ltp || parseFloat(holding.average_price) || 0;
        if (ltp <= 0) {
          throw new Error(`Live price unavailable for ${holding.symbol}. Cannot exit holdings.`);
        }
        const totalValue = qty * ltp;
        totalSoldAmount += totalValue;

        const realizedPnl = (ltp - parseFloat(holding.average_price)) * qty;
        const totalTaxes = await LedgerService.chargeExecutionTaxes(trx, req.user.id, holding.symbol, 'DEL', 'SELL', qty, ltp);

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
          taxes: totalTaxes,
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
          type: 'MARGIN_RELEASE',
          description: `Exited Holdings: SELL ${qty} ${holding.symbol} @ ₹${ltp.toFixed(2)}`,
          created_at: new Date()
        });

        if (realizedPnl !== 0) {
          await trx('ledger').insert({
            user_id: req.user.id,
            amount: realizedPnl,
            type: 'REALIZED_PNL',
            description: `Realized P&L for exited holding ${holding.symbol}`,
            created_at: new Date()
          });
        }

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
    const { endpoint, token } = req.body;
    if (endpoint) {
      await db('push_subscriptions').where({ endpoint }).delete();
    }
    if (token) {
      await db('fcm_device_tokens').where({ token }).delete();
    }
    // Also defensively clear all subscriptions for this user to guarantee status check returns false
    await db('push_subscriptions').where({ user_id: req.user.id }).delete();
    await db('fcm_device_tokens').where({ user_id: req.user.id }).delete();
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

  // Block new orders when market is closed
  for (const item of items) {
    const isCommodity = isCommodityContract(item.symbol);
    const isIntradayProduct = (item.product_type === 'INT' || item.product_type === 'BO' || item.product_type === 'CO');
    
    const marketCheck = isSegmentMarketOpen(isCommodity);
    if (!marketCheck.open) {
      if (marketCheck.isTotalBlock || isIntradayProduct) {
        return res.status(400).json({ error: marketCheck.reason });
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
        await trx('ledger').insert({
          user_id: req.user.id,
          amount: -requiredMargin,
          type: 'MARGIN_BLOCK',
          description: `Combined margin blocked for Basket Order (${items.length} legs)`
        });
      }

      // 3. Process each item (Hedge-Aware Sequence: BUY legs first)
      const sortedItems = [...items].sort((a, b) => {
        if (a.side === 'BUY' && b.side === 'SELL') return -1;
        if (a.side === 'SELL' && b.side === 'BUY') return 1;
        return 0;
      });

      // Calculate proportional margin allocation across all basket items
      const { calculateRequiredMargin } = require('./services/marginEngine');
      const itemStandaloneMargins = sortedItems.map(item => {
        const pType = item.product_type || 'INT';
        const pPrice = parseFloat(item.price) || priceCache[item.symbol]?.ltp || 1;
        const pQty = Number(item.quantity) || 0;
        if (item.margin && parseFloat(item.margin) > 0) {
          return parseFloat(item.margin);
        }
        try {
          return Math.max(0, calculateRequiredMargin(item.symbol, pType, item.side, pQty, pPrice));
        } catch (e) {
          return pQty * pPrice;
        }
      });
      const totalStandalone = itemStandaloneMargins.reduce((sum, m) => sum + m, 0);

      let distributedMarginSum = 0;
      const itemAllocatedMargins = sortedItems.map((item, idx) => {
        if (requiredMargin <= 0) return 0;
        let allocated = 0;
        if (totalStandalone > 0) {
          allocated = parseFloat(((itemStandaloneMargins[idx] / totalStandalone) * requiredMargin).toFixed(2));
        } else {
          allocated = parseFloat((requiredMargin / sortedItems.length).toFixed(2));
        }
        distributedMarginSum += allocated;
        return allocated;
      });

      // Adjust rounding discrepancy so sum(itemAllocatedMargins) === requiredMargin
      if (requiredMargin > 0 && itemAllocatedMargins.length > 0) {
        const diff = parseFloat((requiredMargin - distributedMarginSum).toFixed(2));
        if (Math.abs(diff) > 0 && Math.abs(diff) < 1) {
          let maxIdx = 0;
          for (let k = 1; k < itemAllocatedMargins.length; k++) {
            if (itemAllocatedMargins[k] > itemAllocatedMargins[maxIdx]) maxIdx = k;
          }
          itemAllocatedMargins[maxIdx] = parseFloat((itemAllocatedMargins[maxIdx] + diff).toFixed(2));
        }
      }

      const { calculateOrderSlices } = require('./services/taxCalculator');
      const basketGroupId = 'BSK_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7);
      const executedOrders = [];

      for (let itemIdx = 0; itemIdx < sortedItems.length; itemIdx++) {
        const item = sortedItems[itemIdx];
        const effectiveItemMargin = itemAllocatedMargins[itemIdx] || 0;
        const { symbol, type, side, quantity, price, sl_price, tgt_price, product_type, trail_amount } = item;
        const status = 'PENDING';
        const isMarket = type === 'MARKET';
        const effectiveProductType = product_type || 'INT';
        const execPrice = parseFloat(price) || priceCache[symbol]?.ltp || 0;
        const qtyNum = Number(quantity) || 0;
        const slices = calculateOrderSlices(symbol, qtyNum);
        const isSliced = slices.length > 1;
        const sliceGroupId = isSliced ? `bsk_slice_${Date.now()}_${Math.random().toString(36).substring(2, 6)}` : null;

        for (let sIdx = 0; sIdx < slices.length; sIdx++) {
          const sliceQty = slices[sIdx];
          const sliceMargin = isSliced ? parseFloat(((effectiveItemMargin * sliceQty) / qtyNum).toFixed(2)) : effectiveItemMargin;

          const [orderId] = await trx('orders').insert({
            user_id: req.user.id,
            symbol, type, side,
            quantity: sliceQty,
            price: execPrice || null,
            sl_price, tgt_price,
            status,
            margin: sliceMargin,
            product_type: effectiveProductType,
            basket_group_id: basketGroupId,
            slice_group_id: sliceGroupId,
            slice_index: isSliced ? sIdx + 1 : null,
            slice_total: isSliced ? slices.length : null,
            trail_amount: trail_amount ? parseFloat(trail_amount) : null
          }).returning('id');

          const orderIdVal = typeof orderId === 'object' ? orderId.id : orderId;
          executedOrders.push({
            id: orderIdVal, symbol, status, isMarket, execPrice, type, side,
            quantity: sliceQty, sl_price, tgt_price, margin: sliceMargin,
            product_type: effectiveProductType, basket_group_id: basketGroupId,
            slice_group_id: sliceGroupId, slice_index: isSliced ? sIdx + 1 : null,
            slice_total: isSliced ? slices.length : null,
            trail_amount: trail_amount ? parseFloat(trail_amount) : null
          });
        }
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
      await trx.raw('SELECT pg_advisory_xact_lock(?)', [req.user.id]);
      const order = await trx('orders').where({ id: req.params.id, user_id: req.user.id }).forUpdate().first();
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
                   if (autoExitLtp <= 0) {
                     throw Object.assign(new Error('Live market price unavailable for auto-exit. Cannot cancel bracket protection without a valid price.'), { statusCode: 400 });
                   }
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
      try {
        await triggerEngine.executeOrder(autoExitOrderToExecute, autoExitLtp);
      } catch (err) {
        console.error('Auto-exit execution error on BO cancel:', err);
      }
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
app.get('/api/admin/cleanup', authenticateToken, async (req, res) => {
  try {
     const caller = await db('users').where({ id: req.user.id }).first();
     if (!caller || !caller.is_admin) {
       return res.status(403).json({ error: 'Access denied. Administrator privileges required.' });
     }
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
      const { isMarket, quantity, price, sl_price, tgt_price, trigger_price } = req.body;
      if (!isMarket && (!quantity || (price === undefined && trigger_price === undefined))) {
        return res.status(400).json({ error: 'Missing quantity, price, or trigger price' });
      }

      if (quantity !== undefined && quantity !== null) {
        const parsedQty = Number(quantity);
        if (isNaN(parsedQty) || parsedQty <= 0 || !isFinite(parsedQty)) {
          return res.status(400).json({ error: 'Quantity must be a positive number' });
        }
      }
      if (price !== undefined && price !== null && price !== '') {
        const parsedP = parseFloat(price);
        if (isNaN(parsedP) || parsedP <= 0 || !isFinite(parsedP)) {
          return res.status(400).json({ error: 'Price must be a positive number greater than 0' });
        }
      }
      if (trigger_price !== undefined && trigger_price !== null && trigger_price !== '') {
        const parsedTP = parseFloat(trigger_price);
        if (isNaN(parsedTP) || parsedTP <= 0 || !isFinite(parsedTP)) {
          return res.status(400).json({ error: 'Trigger price must be a positive number greater than 0' });
        }
      }
      if (sl_price !== undefined && sl_price !== null && sl_price !== '') {
        const parsedSL = parseFloat(sl_price);
        if (isNaN(parsedSL) || parsedSL <= 0 || !isFinite(parsedSL)) {
          return res.status(400).json({ error: 'Stop loss price must be a positive number greater than 0' });
        }
      }
      if (tgt_price !== undefined && tgt_price !== null && tgt_price !== '') {
        const parsedTgt = parseFloat(tgt_price);
        if (isNaN(parsedTgt) || parsedTgt <= 0 || !isFinite(parsedTgt)) {
          return res.status(400).json({ error: 'Target price must be a positive number greater than 0' });
        }
      }

      try {
        let marketOrderToExecute = null;
        let ltpForMarket = 0;
        let updatedOrder = null;
        let updatedChildOrders = [];
        
        await db.transaction(async (trx) => {
          await trx.raw('SELECT pg_advisory_xact_lock(?)', [req.user.id]);
          const order = await trx('orders').where({ id: req.params.id, user_id: req.user.id }).forUpdate().first();
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
          const isDerivative = isDerivativeContract(order.symbol);
          const isDelSell = order.side === 'SELL' && (order.product_type === 'DEL' || order.product_type === 'CNC') && !isDerivative;

          if (isDelSell) {
            newMargin = 0;
            // If quantity increased, verify sufficient holdings
            const newQty = Number(quantity);
            if (newQty > Number(order.quantity)) {
              const cleanSym = order.symbol.includes(':') ? order.symbol.split(':')[1] : order.symbol;
              const holding = await trx('holdings')
                .where({ user_id: req.user.id })
                .where(builder => {
                  builder.where({ symbol: order.symbol }).orWhere({ symbol: cleanSym }).orWhere({ symbol: `NSE:${cleanSym}` }).orWhere({ symbol: `BSE:${cleanSym}` });
                })
                .first();
              const holdingQty = holding ? Number(holding.quantity) : 0;
              if (newQty > holdingQty) {
                throw Object.assign(new Error(`Insufficient holdings. You only have ${holdingQty} shares available.`), { statusCode: 400 });
              }
            }
          } else if (oldMargin === 0 && Number(quantity) === Number(order.quantity)) {
            // If the order originally required 0 margin (e.g. position exit limit order or bracket leg) and quantity is unchanged,
            // modifying price or trigger price must not suddenly demand entry margin.
            newMargin = 0;
          } else if (!order.parent_order_id) {
              const effectivePrice = price !== undefined && !isNaN(parseFloat(price)) ? parseFloat(price) : (trigger_price !== undefined ? parseFloat(trigger_price) : parseFloat(order.price || 0));
              newMargin = calculateRequiredMargin(order.symbol, order.product_type, order.side, Number(quantity), effectivePrice);
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
                 const checkPrice = trigger_price !== undefined ? parseFloat(trigger_price) : parseFloat(price);
                 if (order.type === 'SL-M') {
                     if (order.side === 'SELL' && checkPrice >= entryPrice) {
                         throw Object.assign(new Error('BO Buy: Stop-Loss must be lower than execution price.'), { statusCode: 400 });
                     } else if (order.side === 'BUY' && checkPrice <= entryPrice) {
                         throw Object.assign(new Error('BO Sell: Stop-Loss must be higher than execution price.'), { statusCode: 400 });
                     }
                 } else if (order.type === 'LIMIT') {
                     if (order.side === 'SELL' && checkPrice <= entryPrice) {
                         throw Object.assign(new Error('BO Buy: Target must be higher than execution price.'), { statusCode: 400 });
                     } else if (order.side === 'BUY' && checkPrice >= entryPrice) {
                         throw Object.assign(new Error('BO Sell: Target must be lower than execution price.'), { statusCode: 400 });
                     }
                 }
             }
          }

          // Build update object
          const updateObj = { 
              quantity: Number(quantity),
              margin: newMargin,
              updated_at: new Date()
          };

          if (price !== undefined && price !== null && !isNaN(parseFloat(price))) {
              updateObj.price = parseFloat(price);
          }
          if (trigger_price !== undefined && trigger_price !== null && !isNaN(parseFloat(trigger_price))) {
              updateObj.trigger_price = parseFloat(trigger_price);
          }

          if (order.status === 'PENDING_TRIGGER' && order.type === 'SL-M') {
              updateObj.trigger_price = trigger_price !== undefined ? parseFloat(trigger_price) : parseFloat(price);
              updateObj.price = null; // SL-M is a market order when triggered
          }

          // Update sl_price and tgt_price if provided
          if (sl_price !== undefined) updateObj.sl_price = sl_price;
          if (tgt_price !== undefined) updateObj.tgt_price = tgt_price;

          // Update Order in database
          await trx('orders').where({ id: req.params.id }).update(updateObj);
          updatedOrder = { ...order, ...updateObj };
          
          // Update child OCO orders (SL and Target legs) - synchronize quantity and sl/tgt prices
          const childOrders = await trx('orders')
            .where({ parent_order_id: req.params.id, status: 'PENDING_TRIGGER' });
          
          if (childOrders.length > 0) {
            for (const child of childOrders) {
              const childUpdate = {
                quantity: Number(quantity),
                updated_at: new Date()
              };
              if (child.type === 'SL-M' && sl_price !== undefined) {
                childUpdate.trigger_price = sl_price;
                childUpdate.price = null;
              } else if (child.type === 'LIMIT' && tgt_price !== undefined) {
                childUpdate.price = tgt_price;
                childUpdate.trigger_price = tgt_price;
              }
              await trx('orders').where({ id: child.id }).update(childUpdate);
              updatedChildOrders.push({ ...child, ...childUpdate });
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
            await triggerEngine.executeOrder(marketOrderToExecute, ltpForMarket).catch(err => console.error(err));
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
const candleCache = {}; // Cache to protect Fyers from rate limits (capped at 200 items)
const MAX_CANDLE_CACHE_ITEMS = 200;

function setCandleCache(key, data, now) {
  const keys = Object.keys(candleCache);
  if (keys.length >= MAX_CANDLE_CACHE_ITEMS) {
    let oldestKey = keys[0];
    let oldestTs = Infinity;
    for (const k of keys) {
      if (candleCache[k]?.timestamp < oldestTs) {
        oldestTs = candleCache[k].timestamp;
        oldestKey = k;
      }
    }
    delete candleCache[oldestKey];
  }
  candleCache[key] = { timestamp: now, data };
}

// Hourly Background cleanup: Prune expired candles older than 12h to stop RAM leaks
setInterval(() => {
  const now = Date.now();
  for (const [key, item] of Object.entries(candleCache)) {
    if (item && item.timestamp && (now - item.timestamp > 12 * 3600 * 1000)) {
      delete candleCache[key];
    }
  }
}, 3600000).unref();

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
        setCandleCache(cacheKey, retryCandles, now);
        return res.json(retryCandles);
      }
    }

    // Save to cache only if valid data is returned
    if (candles && candles.length > 0) {
      setCandleCache(cacheKey, candles, now);
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

    setLRUCache(stockDetailsCache, cleanName, { timestamp: Date.now(), data }, 100);
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

  // ⚡ High-Performance Cache Init: Send core indices immediately so top ticker renders instantly.
  // Slashes initial WebSocket connection payload from ~1.5MB (5,000+ symbols) down to ~1KB.
  const coreIndices = ['NSE:NIFTY50-INDEX', 'NSE:NIFTYBANK-INDEX', 'BSE:SENSEX-INDEX'];
  const initialCache = {};
  for (const idx of coreIndices) {
    if (priceCache[idx]) initialCache[idx] = priceCache[idx];
  }
  if (Object.keys(initialCache).length > 0) {
    socket.emit('price_init', initialCache);
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
      if (sym && typeof sym === 'string') {
        socket.join(sym);
      }
    });

    // ⚡ Send full price snapshot ONLY on initial connect/first ping for this socket.
    // Routine 10s keepalive pings maintain room membership and Fyers GC without re-broadcasting 50+ symbols.
    if (!socket._hasReceivedPriceInit) {
      socket._hasReceivedPriceInit = true;
      const requestedCache = {};
      symbolsArray.forEach(sym => {
        if (sym && typeof sym === 'string') {
          const p = priceCache[sym] || (sym.includes(':') ? priceCache[sym.split(':')[1]] : null);
          if (p) {
            requestedCache[sym] = [
              p.ltp,
              p.change !== undefined ? p.change : (p.ch !== undefined ? p.ch : 0),
              p.pct !== undefined ? p.pct : (p.chp !== undefined ? p.chp : 0),
              p.timestamp || p.ts || Date.now(),
              p.open,
              p.high,
              p.low,
              p.close,
              p.volume !== undefined ? p.volume : (p.vol !== undefined ? p.vol : 0),
              p.totBuyQuan || 0,
              p.totSellQuan || 0
            ];
          }
        }
      });

      if (Object.keys(requestedCache).length > 0) {
        socket.emit('price_init', requestedCache);
      }
    }

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
    if (Array.isArray(data)) {
      data.forEach(item => {
        const sym = typeof item === 'string' ? item : item?.symbol;
        if (sym) socket.leave(sym);
      });
    } else if (data) {
      const sym = typeof data === 'string' ? data : data.symbol;
      if (sym) socket.leave(sym);
    }
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

app.get('/api/admin/fyers/credentials', authenticateToken, async (req, res) => {
  try {
    const caller = await db('users').where({ id: req.user.id }).first();
    if (!caller || !caller.is_admin) return res.status(403).json({ error: 'Admin access required' });
    const { getFyersCredentials } = require('./services/fyersAutoLogin');
    const creds = await getFyersCredentials();
    res.json({
      success: true,
      hasCredentials: !!(creds.fy_id && creds.pin && creds.totp_key),
      fyers_user_id: creds.fy_id || '',
      has_pin: !!creds.pin,
      has_totp_key: !!creds.totp_key,
      app_id: creds.app_id || ''
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/admin/fyers/credentials', authenticateToken, async (req, res) => {
  try {
    const caller = await db('users').where({ id: req.user.id }).first();
    if (!caller || !caller.is_admin) return res.status(403).json({ error: 'Admin access required' });
    const { fyers_user_id, fyers_pin, fyers_totp_key } = req.body;
    if (fyers_user_id) {
      await db('system_settings').insert({ key: 'fyers_user_id', value: fyers_user_id.trim(), updated_at: new Date() }).onConflict('key').merge();
    }
    if (fyers_pin) {
      await db('system_settings').insert({ key: 'fyers_pin', value: fyers_pin.trim(), updated_at: new Date() }).onConflict('key').merge();
    }
    if (fyers_totp_key) {
      await db('system_settings').insert({ key: 'fyers_totp_key', value: fyers_totp_key.replace(/\s+/g, ''), updated_at: new Date() }).onConflict('key').merge();
    }

    // Immediately attempt auto-login with the new credentials
    const { performFyersAutoLogin } = require('./services/fyersAutoLogin');
    const loginResult = await performFyersAutoLogin();
    res.json({ success: true, message: 'Fyers credentials saved', loginResult });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/admin/fyers/auto-login', authenticateToken, async (req, res) => {
  try {
    const caller = await db('users').where({ id: req.user.id }).first();
    if (!caller || !caller.is_admin) return res.status(403).json({ error: 'Admin access required' });
    const { performFyersAutoLogin } = require('./services/fyersAutoLogin');
    const result = await performFyersAutoLogin();
    res.json(result);
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
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
  maxAge: '1y',
  immutable: true,
  setHeaders: (res, filePath) => {
    // Dynamic entry points (HTML, Service Worker, Webmanifest) are NEVER cached
    if (filePath.endsWith('.html') || filePath.endsWith('sw.js') || filePath.endsWith('manifest.webmanifest')) {
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
    const parsedAmount = parseFloat(amount);
    if (!parsedAmount || isNaN(parsedAmount) || parsedAmount <= 0) return res.status(400).json({ error: 'Invalid amount' });

    await db.transaction(async (trx) => {
      await trx.raw('SELECT pg_advisory_xact_lock(?)', [req.user.id]);

      // Check if user has bank details
      const user = await trx('users').where({ id: req.user.id }).first();
      if (!user.upi_id && (!user.bank_account_no || !user.bank_ifsc)) {
        throw Object.assign(new Error('Please update your Bank or UPI details in Settings before withdrawing'), { statusCode: 400 });
      }

      // Calculate available balance inside transaction
      const referrals = await trx('referrals').where({ referrer_id: req.user.id, status: 'completed' });
      const totalEarned = referrals.reduce((sum, r) => sum + parseFloat(r.reward_amount || 0), 0);
      
      const withdrawals = await trx('reward_withdrawals').where({ user_id: req.user.id });
      const blockedAmount = withdrawals.filter(w => ['PENDING', 'PROCESSING', 'CREDITED'].includes(w.status)).reduce((sum, w) => sum + parseFloat(w.amount), 0);
      
      const availableRewardBalance = totalEarned - blockedAmount;

      if (parsedAmount > availableRewardBalance) {
        throw Object.assign(new Error('Insufficient reward balance'), { statusCode: 400 });
      }

      await trx('reward_withdrawals').insert({
        user_id: req.user.id,
        amount: parsedAmount,
        status: 'PENDING',
        created_at: new Date()
      });
    });

    res.json({ success: true, message: 'Withdrawal request submitted successfully' });
  } catch (err) {
    res.status(err.statusCode || 500).json({ error: err.message });
  }
});

app.get('/api/admin/withdrawals', authenticateToken, async (req, res) => {
  try {
    const caller = await db('users').where({ id: req.user.id }).first();
    if (!caller || !caller.is_admin) return res.status(403).json({ error: 'Admin access required' });

    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 50;
    const offset = (page - 1) * limit;
    const search = req.query.search || '';
    const startDate = req.query.startDate;
    const endDate = req.query.endDate;
    const isExport = req.query.export === 'true' || req.query.limit === 'all';

    let query = db('reward_withdrawals')
      .join('users', 'reward_withdrawals.user_id', 'users.id')
      .select(
        'reward_withdrawals.*', 
        'users.username', 
        'users.client_id',
        'users.email',
        'users.phone',
        'users.upi_id',
        'users.bank_account_no',
        'users.bank_ifsc',
        'users.last_ip',
        'users.registration_ip'
      );

    let countQuery = db('reward_withdrawals')
      .join('users', 'reward_withdrawals.user_id', 'users.id');

    if (search) {
      const s = `%${search}%`;
      query = query.where(function() {
        this.where('users.username', 'ilike', s)
            .orWhere('users.phone', 'ilike', s)
            .orWhere('users.upi_id', 'ilike', s)
            .orWhere('users.client_id', 'ilike', s)
            .orWhere('users.bank_account_no', 'ilike', s)
            .orWhereRaw('CAST(reward_withdrawals.amount AS TEXT) ilike ?', [s]);
      });
      countQuery = countQuery.where(function() {
        this.where('users.username', 'ilike', s)
            .orWhere('users.phone', 'ilike', s)
            .orWhere('users.upi_id', 'ilike', s)
            .orWhere('users.client_id', 'ilike', s)
            .orWhere('users.bank_account_no', 'ilike', s)
            .orWhereRaw('CAST(reward_withdrawals.amount AS TEXT) ilike ?', [s]);
      });
    }

    if (startDate) {
      query = query.where('reward_withdrawals.created_at', '>=', startDate);
      countQuery = countQuery.where('reward_withdrawals.created_at', '>=', startDate);
    }
    if (endDate) {
      query = query.where('reward_withdrawals.created_at', '<=', endDate);
      countQuery = countQuery.where('reward_withdrawals.created_at', '<=', endDate);
    }

    const [countResult] = await countQuery.count('reward_withdrawals.id as total');
    const total = countResult ? parseInt(countResult.total) : 0;
    const totalPages = Math.ceil(total / limit) || 1;

    let withQuery = query.orderBy('reward_withdrawals.created_at', 'desc');
    if (!isExport) {
      withQuery = withQuery.limit(limit).offset(offset);
    } else {
      withQuery = withQuery.limit(10000);
    }
    const withdrawals = await withQuery;

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

    res.json({ success: true, withdrawals: enhanced, total, page, totalPages });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/admin/withdrawals/:id/process', authenticateToken, async (req, res) => {
  try {
    const caller = await db('users').where({ id: req.user.id }).first();
    if (!caller || !caller.is_admin) return res.status(403).json({ error: 'Admin access required' });

    const { status, remarks, utr } = req.body;
    if (!['PENDING', 'PROCESSING', 'CREDITED', 'REJECTED'].includes(status)) {
      return res.status(400).json({ error: 'Invalid withdrawal status' });
    }

    const withdrawal = await db('reward_withdrawals').where({ id: req.params.id }).first();
    if (!withdrawal) return res.status(404).json({ error: 'Withdrawal record not found' });

    await db('reward_withdrawals').where({ id: req.params.id }).update({
      status,
      remarks: remarks || null,
      utr: utr || null,
      updated_at: new Date()
    });

    res.json({ success: true, message: `Withdrawal #${req.params.id} marked as ${status}` });
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

// ─── Session & Device Security Manager Endpoints ─────────────────────────
app.get('/api/user/sessions', authenticateToken, async (req, res) => {
  try {
    const currentHash = req.tokenHash || '';
    const sessions = await db('user_sessions')
      .where({ user_id: req.user.id })
      .orderBy('last_active_at', 'desc');

    const formatted = sessions.map(s => ({
      id: s.id,
      device_model: s.device_model || 'Unknown Device',
      browser_name: s.browser_name || 'Browser',
      os_name: s.os_name || 'Unknown OS',
      ip_address: s.ip_address || '',
      city: s.city || '',
      state: s.state || '',
      last_active_at: s.last_active_at,
      created_at: s.created_at,
      is_current: s.token_hash === currentHash
    }));

    res.json({ success: true, sessions: formatted });
  } catch (err) {
    console.error('Error fetching user sessions:', err);
    res.status(500).json({ error: 'Failed to fetch active login sessions' });
  }
});

app.post('/api/user/sessions/revoke-others', authenticateToken, async (req, res) => {
  try {
    const currentHash = req.tokenHash || '';
    if (!currentHash) return res.status(400).json({ error: 'Current session identifier not found' });

    const deletedCount = await db('user_sessions')
      .where({ user_id: req.user.id })
      .where('token_hash', '!=', currentHash)
      .del();

    res.json({ success: true, message: `Successfully logged out ${deletedCount} other device(s).`, revokedCount: deletedCount });
  } catch (err) {
    console.error('Error revoking other sessions:', err);
    res.status(500).json({ error: 'Failed to revoke other sessions' });
  }
});

app.delete('/api/user/sessions/:id', authenticateToken, async (req, res) => {
  try {
    const sessionId = req.params.id;
    await db('user_sessions')
      .where({ id: sessionId, user_id: req.user.id })
      .del();

    res.json({ success: true, message: 'Device session revoked.' });
  } catch (err) {
    console.error('Error revoking session:', err);
    res.status(500).json({ error: 'Failed to revoke session' });
  }
});

// ─── Contests & Tournaments Endpoints ─────────────────────────────────────
app.get('/api/contests/active', async (req, res) => {
  try {
    let contest = await db('contests')
      .where({ status: 'ACTIVE' })
      .orderBy('id', 'desc')
      .first();

    // If no active contest exists, auto-seed one for the current month
    if (!contest) {
      const now = new Date();
      const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);
      const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
      const monthName = monthNames[now.getMonth()];
      const [newId] = await db('contests').insert({
        title: `🏆 ${monthName} Premier Trader Championship ${now.getFullYear()}`,
        description: `Official monthly intraday & F&O championship. Trade, scale up profits, and top the leaderboard to win real cash prizes and free PRO memberships!`,
        start_date: new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0),
        end_date: endOfMonth,
        prize_1st: '₹500 Cash + 1-Month Free PRO',
        prize_2nd: '₹250 Cash + 1-Month Free PRO',
        prize_3rd: '₹100 Cash + Free PRO',
        status: 'ACTIVE'
      }).returning('id');
      const cid = typeof newId === 'object' ? newId.id : newId;
      contest = await db('contests').where({ id: cid }).first();
    }

    // Also fetch the top 3 leaderboard contenders for the contest period
    const startDate = contest?.start_date || new Date(0);
    const topContenders = await db('positions')
      .join('users', 'positions.user_id', 'users.id')
      .where('users.is_admin', false)
      .where('positions.created_at', '>=', startDate)
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
      .limit(3);

    const formattedContenders = topContenders.map((t, idx) => {
      const total = parseInt(t.total_trades || 0, 10);
      const wins = parseInt(t.winning_trades || 0, 10);
      const winRate = total > 0 ? Math.round((wins / total) * 100) : 0;
      return {
        rank: idx + 1,
        username: t.username,
        profile_picture_url: t.profile_picture_url,
        pnl: parseFloat(t.total_pnl || 0),
        totalTrades: total,
        winRate
      };
    });

    res.json({
      success: true,
      contest,
      topContenders: formattedContenders
    });
  } catch (err) {
    console.error('Error fetching active contest:', err);
    res.status(500).json({ error: 'Failed to fetch contest' });
  }
});

// Admin: Get all contests
app.get('/api/admin/contests', authenticateToken, async (req, res) => {
  try {
    const user = await db('users').where({ id: req.user.id }).first();
    if (!user || !user.is_admin) return res.status(403).json({ error: 'Unauthorized: Admin access required' });

    const contests = await db('contests').orderBy('id', 'desc');
    res.json({ success: true, contests });
  } catch (err) {
    console.error('Error fetching admin contests:', err);
    res.status(500).json({ error: 'Failed to fetch contests' });
  }
});

// Admin: Create or update contest
app.post('/api/admin/contests', authenticateToken, async (req, res) => {
  try {
    const user = await db('users').where({ id: req.user.id }).first();
    if (!user || !user.is_admin) return res.status(403).json({ error: 'Unauthorized: Admin access required' });

    const { id, title, description, start_date, end_date, prize_1st, prize_2nd, prize_3rd, status } = req.body;

    if (!title) return res.status(400).json({ error: 'Title is required' });

    if (id) {
      await db('contests').where({ id }).update({
        title,
        description: description || '',
        start_date: start_date ? new Date(start_date) : undefined,
        end_date: end_date ? new Date(end_date) : undefined,
        prize_1st: prize_1st || '₹500 Cash + Free PRO',
        prize_2nd: prize_2nd || '₹250 Cash + Free PRO',
        prize_3rd: prize_3rd || '₹100 Cash + Free PRO',
        status: status || 'ACTIVE',
        updated_at: new Date()
      });
      return res.json({ success: true, message: 'Contest updated successfully' });
    } else {
      const [newId] = await db('contests').insert({
        title,
        description: description || '',
        start_date: start_date ? new Date(start_date) : new Date(),
        end_date: end_date ? new Date(end_date) : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        prize_1st: prize_1st || '₹500 Cash + Free PRO',
        prize_2nd: prize_2nd || '₹250 Cash + Free PRO',
        prize_3rd: prize_3rd || '₹100 Cash + Free PRO',
        status: status || 'ACTIVE'
      }).returning('id');
      return res.json({ success: true, message: 'Contest created successfully', id: typeof newId === 'object' ? newId.id : newId });
    }
  } catch (err) {
    console.error('Error saving contest:', err);
    res.status(500).json({ error: 'Failed to save contest' });
  }
});

// Admin: Finalize and award winners
app.post('/api/admin/contests/:id/award', authenticateToken, async (req, res) => {
  try {
    const user = await db('users').where({ id: req.user.id }).first();
    if (!user || !user.is_admin) return res.status(403).json({ error: 'Unauthorized: Admin access required' });

    const contestId = req.params.id;
    const { awardProUpgrade, cashAmount1st, cashAmount2nd, cashAmount3rd } = req.body;

    const contest = await db('contests').where({ id: contestId }).first();
    if (!contest) return res.status(404).json({ error: 'Contest not found' });

    // Fetch top 3 traders for the contest duration
    const startDate = contest.start_date || new Date(0);
    const topTraders = await db('positions')
      .join('users', 'positions.user_id', 'users.id')
      .where('users.is_admin', false)
      .where('positions.created_at', '>=', startDate)
      .groupBy('users.id')
      .select('users.id')
      .orderBy(db.raw('COALESCE(SUM(positions.realized_pnl), 0)'), 'desc')
      .limit(3);

    const winner1 = topTraders[0]?.id || null;
    const winner2 = topTraders[1]?.id || null;
    const winner3 = topTraders[2]?.id || null;

    await db('contests').where({ id: contestId }).update({
      winner_1st_id: winner1,
      winner_2nd_id: winner2,
      winner_3rd_id: winner3,
      status: 'COMPLETED',
      updated_at: new Date()
    });

    // Credit Cash or Pro upgrades if selected
    if (awardProUpgrade) {
      const oneMonthLater = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
      const winnerIds = [winner1, winner2, winner3].filter(Boolean);
      for (const wid of winnerIds) {
        await db('users').where({ id: wid }).update({
          subscription_tier: 'PRO',
          subscription_expires: oneMonthLater
        });
      }
    }

    if (cashAmount1st && winner1) {
      await db('users').where({ id: winner1 }).increment('balance', Number(cashAmount1st));
      await db('ledger').insert({
        user_id: winner1,
        amount: Number(cashAmount1st),
        type: 'DEPOSIT',
        description: `🏆 1st Prize Reward - ${contest.title}`
      });
    }
    if (cashAmount2nd && winner2) {
      await db('users').where({ id: winner2 }).increment('balance', Number(cashAmount2nd));
      await db('ledger').insert({
        user_id: winner2,
        amount: Number(cashAmount2nd),
        type: 'DEPOSIT',
        description: `🥈 2nd Prize Reward - ${contest.title}`
      });
    }
    if (cashAmount3rd && winner3) {
      await db('users').where({ id: winner3 }).increment('balance', Number(cashAmount3rd));
      await db('ledger').insert({
        user_id: winner3,
        amount: Number(cashAmount3rd),
        type: 'DEPOSIT',
        description: `🥉 3rd Prize Reward - ${contest.title}`
      });
    }

    res.json({ success: true, message: 'Contest completed and rewards successfully distributed!' });
  } catch (err) {
    console.error('Error awarding contest:', err);
    res.status(500).json({ error: 'Failed to award contest rewards' });
  }
});

app.get('/api/referrals', authenticateToken, async (req, res) => {
  try {
    const referrals = await db('referrals')
      .join('users', 'referrals.referred_user_id', 'users.id')
      .where('referrals.referrer_id', req.user.id)
      .select('referrals.*', 'users.username', 'users.email', 'users.client_id')
      .orderBy('referrals.created_at', 'desc');

    const totalEarned = referrals.filter(r => r.status === 'completed').reduce((sum, r) => sum + parseFloat(r.reward_amount || 0), 0);
    const pendingCount = referrals.filter(r => r.status === 'pending').length;
    const completedCount = referrals.filter(r => r.status === 'completed').length;

    const withdrawals = await db('reward_withdrawals').where({ user_id: req.user.id }).orderBy('created_at', 'desc');
    const blockedAmount = withdrawals.filter(w => ['PENDING', 'PROCESSING', 'CREDITED'].includes(w.status)).reduce((sum, w) => sum + parseFloat(w.amount), 0);
    const totalWithdrawn = withdrawals.filter(w => w.status === 'CREDITED').reduce((sum, w) => sum + parseFloat(w.amount), 0);
    const pendingWithdrawalAmount = withdrawals.filter(w => ['PENDING', 'PROCESSING'].includes(w.status)).reduce((sum, w) => sum + parseFloat(w.amount), 0);
    const availableRewardBalance = Math.max(0, totalEarned - blockedAmount);

    res.json({
      success: true,
      referrals,
      withdrawals,
      stats: {
        totalEarned,
        pendingCount,
        completedCount,
        totalCount: referrals.length,
        totalWithdrawn,
        pendingWithdrawalAmount,
        availableRewardBalance
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

      // Zero Trade Data Deletion: Preserve historical closed positions for tax reports, audit trails, and journals
      console.log('👑 Master Instance: Historical positions preserved for reporting.');

      
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

      // --- BOOT & RECURRING SELF-SUBSCRIPTION ---
      const bootSubscribeFromDB = async (includeWatchlists = false) => {
        try {
          const db = require('./database/db');
          const { addSubscriptionBatch } = require('./services/fyers');
          if (!addSubscriptionBatch) return;
          const allSymbols = new Set(['NSE:NIFTY50-INDEX', 'NSE:NIFTYBANK-INDEX', 'BSE:SENSEX-INDEX']);

          if (includeWatchlists) {
            const userRows = await db('users').select('watchlists').catch(() => []);
            userRows.forEach(row => {
              try {
                const wls = typeof row.watchlists === 'string' ? JSON.parse(row.watchlists) : (row.watchlists || []);
                wls.forEach(wl => {
                  (wl.symbols || []).forEach(sym => {
                    const s = typeof sym === 'string' ? sym : sym && sym.symbol;
                    if (s && !s.endsWith('-MF')) allSymbols.add(s);
                  });
                });
              } catch(e) {}
            });
          }

          const posRows = await db('positions').where('quantity', '!=', 0).select('symbol').catch(() => []);
          posRows.forEach(r => { if (r.symbol) allSymbols.add(r.symbol); });
          const ordRows = await db('orders').whereIn('status', ['PENDING', 'PENDING_TRIGGER']).select('symbol').catch(() => []);
          ordRows.forEach(r => { if (r.symbol) allSymbols.add(r.symbol); });
          const list = Array.from(allSymbols);
          if (list.length > 0) {
            addSubscriptionBatch(list);
          }
        } catch(e) { console.error('Self-sub error:', e.message); }
      };
      setTimeout(() => bootSubscribeFromDB(true), 5000);
      setTimeout(() => bootSubscribeFromDB(false), 20000);
      setInterval(async () => {
        // ⚡ Guard: If markets are closed across all segments, skip heavy recurring DB scans
        try {
          const eq = isSegmentMarketOpen(false);
          const mcx = isSegmentMarketOpen(true);
          if (!eq.open && !mcx.open) {
            return; // All markets closed (nights/weekends/holidays) — nap and skip DB scan
          }
        } catch(e) {}
        bootSubscribeFromDB(false);
      }, 5 * 60 * 1000);
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

    // Automated Fyers TOTP Login daily at 08:00 AM & 08:30 AM IST (Mon-Fri & Weekends)
    const loginRule = new schedule.RecurrenceRule();
    loginRule.hour = 8;
    loginRule.minute = 0;
    loginRule.tz = 'Asia/Kolkata';
    schedule.scheduleJob(loginRule, async () => {
      console.log('⏰ Daily 08:00 AM Cron: Running automated Fyers TOTP Login...');
      try {
        const { performFyersAutoLogin } = require('./services/fyersAutoLogin');
        await performFyersAutoLogin();
      } catch(e) { console.error('Auto-login cron error:', e); }
    });

    const loginBackupRule = new schedule.RecurrenceRule();
    loginBackupRule.hour = 8;
    loginBackupRule.minute = 30;
    loginBackupRule.tz = 'Asia/Kolkata';
    schedule.scheduleJob(loginBackupRule, async () => {
      console.log('⏰ Daily 08:30 AM Backup Cron: Checking / Re-verifying Fyers Token...');
      try {
        const { getFyersStatus } = require('./services/fyers');
        const status = getFyersStatus ? getFyersStatus() : {};
        if (!status.hasAccessToken || status.tokenExpired) {
          const { performFyersAutoLogin } = require('./services/fyersAutoLogin');
          await performFyersAutoLogin();
        }
      } catch(e) { console.error('Backup auto-login cron error:', e); }
    });

    // Automated Options & Futures Master & Lot Sizes Download daily at 08:15 AM IST (Mon-Sun)
    const optionsMorningRule = new schedule.RecurrenceRule();
    optionsMorningRule.hour = 8;
    optionsMorningRule.minute = 15;
    optionsMorningRule.tz = 'Asia/Kolkata';
    schedule.scheduleJob(optionsMorningRule, async () => {
      console.log('⏰ Daily 08:15 AM Cron: Downloading latest Master Contracts & Lot Sizes...');
      try {
        await updateOptionsMaster();
      } catch(e) { console.error('Options Master update cron error:', e); }
    });

    // RAM Optimization: Clean expired derivative contracts from priceCache daily at 08:05 AM IST
    async function cleanStaleOptionCache() {
      try {
        const now = Date.now();
        let cleaned = 0;
        const keys = Object.keys(priceCache);
        for (const sym of keys) {
          if (isDerivativeContract(sym)) {
            const inst = await db('instruments').where({ unique_symbol: sym }).whereNotNull('expiry_timestamp').first();
            if (inst && Number(inst.expiry_timestamp) < now) {
              delete priceCache[sym];
              cleaned++;
            }
          }
        }
        if (cleaned > 0) {
          console.log(`🧹 [RAM OPTIMIZATION] Purged ${cleaned} expired option contracts from memory cache.`);
        }
      } catch(e) {}
    }
    const pruneCacheRule = new schedule.RecurrenceRule();
    pruneCacheRule.hour = 8;
    pruneCacheRule.minute = 5;
    pruneCacheRule.tz = 'Asia/Kolkata';
    schedule.scheduleJob(pruneCacheRule, () => cleanStaleOptionCache());
    setTimeout(cleanStaleOptionCache, 60000); // Also prune 60s after server boot


    // Initialize TriggerEngine
    triggerEngine.setSocketIo(io);
    await triggerEngine.loadPendingOrders();
    console.log('⚡ TriggerEngine active (LIMIT + SL/TP/CO/BO order matching)');

    // Initialize EOD Positions Engine (Cron Automations)
    require('./services/positionsEngine');

    // Initialize MTM Risk Manager with live Admin Market Status integration
    new MTMRiskManager(priceCache, () => {
      const eq = isSegmentMarketOpen(false);
      const mcx = isSegmentMarketOpen(true);
      return eq.open || mcx.open;
    }).start();
    console.log('🛡️  MTM Risk Manager active (95% auto-liquidation, synced with Admin Market Status)');

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

// ══════════════════════════════════════════════════════════════════════════════
// ── TRADE DIARY & TRADING JOURNAL API ENDPOINTS ──────────────────────────────
// ══════════════════════════════════════════════════════════════════════════════

// 1. Trades API
app.get('/api/journal/trades', authenticateToken, async (req, res) => {
  try {
    const isExport = req.query.export === 'true' || req.query.limit === 'all';
    const limit = isExport ? null : (parseInt(req.query.limit) || 250);
    const offset = parseInt(req.query.offset) || 0;

    let query = db('journal_trades')
      .where({ user_id: req.user.id })
      .orderBy('trade_date', 'desc')
      .orderBy('created_at', 'desc');

    if (limit) {
      query = query.limit(limit);
    }
    if (offset > 0) {
      query = query.offset(offset);
    }

    const trades = await query;
    res.json({ success: true, trades });
  } catch (err) {
    console.error('Fetch Journal Trades Error:', err);
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/journal/trades', authenticateToken, async (req, res) => {
  try {
    const {
      symbol, trade_type, product_type, market_segment, entry_price, exit_price,
      quantity, realized_pnl, charges, net_pnl, roi_percentage, strategy,
      emotion, mistake, setup_rating, trade_date, notes, tags, screenshot_url
    } = req.body;

    const [newTrade] = await db('journal_trades').insert({
      user_id: req.user.id,
      trade_id: `JT-${Date.now()}-${Math.floor(Math.random()*1000)}`,
      symbol: symbol || 'NIFTY',
      trade_type: trade_type || 'BUY',
      product_type: product_type || 'INT',
      market_segment: market_segment || 'Indian',
      entry_price: parseFloat(entry_price) || 0,
      exit_price: parseFloat(exit_price) || 0,
      quantity: parseInt(quantity) || 1,
      realized_pnl: parseFloat(realized_pnl) || 0,
      charges: parseFloat(charges) || 0,
      net_pnl: parseFloat(net_pnl) || (parseFloat(realized_pnl) || 0),
      roi_percentage: parseFloat(roi_percentage) || 0,
      strategy: strategy || '',
      emotion: emotion || '',
      mistake: mistake || '',
      setup_rating: parseInt(setup_rating) || 5,
      trade_date: trade_date || new Date().toISOString().split('T')[0],
      notes: notes || '',
      tags: tags ? JSON.stringify(tags) : JSON.stringify([]),
      screenshot_url: screenshot_url || ''
    }).returning('*');

    res.json({ success: true, trade: newTrade });
  } catch (err) {
    console.error('Create Journal Trade Error:', err);
    res.status(500).json({ error: err.message });
  }
});

app.put('/api/journal/trades/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const updateData = { ...req.body, updated_at: new Date() };
    delete updateData.id;
    delete updateData.user_id;
    if (updateData.tags && typeof updateData.tags !== 'string') {
      updateData.tags = JSON.stringify(updateData.tags);
    }

    const [updated] = await db('journal_trades')
      .where({ id, user_id: req.user.id })
      .update(updateData)
      .returning('*');

    res.json({ success: true, trade: updated });
  } catch (err) {
    console.error('Update Journal Trade Error:', err);
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/journal/trades/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    await db('journal_trades').where({ id, user_id: req.user.id }).del();
    res.json({ success: true, message: 'Trade deleted successfully' });
  } catch (err) {
    console.error('Delete Journal Trade Error:', err);
    res.status(500).json({ error: err.message });
  }
});

// 2. Checklists API
app.get('/api/journal/checklists', authenticateToken, async (req, res) => {
  try {
    const { date } = req.query;
    let query = db('trading_checklists').where({ user_id: req.user.id });
    if (date) query = query.where({ date });
    const checklists = await query.orderBy('date', 'desc');
    res.json({ success: true, checklists });
  } catch (err) {
    console.error('Fetch Checklists Error:', err);
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/journal/checklists', authenticateToken, async (req, res) => {
  try {
    const { date, pre_market_data, post_market_data, notes } = req.body;
    const targetDate = date || new Date().toISOString().split('T')[0];

    const existing = await db('trading_checklists').where({ user_id: req.user.id, date: targetDate }).first();
    let result;

    if (existing) {
      [result] = await db('trading_checklists')
        .where({ id: existing.id })
        .update({
          pre_market_data: pre_market_data ? JSON.stringify(pre_market_data) : existing.pre_market_data,
          post_market_data: post_market_data ? JSON.stringify(post_market_data) : existing.post_market_data,
          notes: notes !== undefined ? notes : existing.notes,
          updated_at: new Date()
        })
        .returning('*');
    } else {
      [result] = await db('trading_checklists').insert({
        user_id: req.user.id,
        date: targetDate,
        pre_market_data: JSON.stringify(pre_market_data || {}),
        post_market_data: JSON.stringify(post_market_data || {}),
        notes: notes || ''
      }).returning('*');
    }

    res.json({ success: true, checklist: result });
  } catch (err) {
    console.error('Save Checklist Error:', err);
    res.status(500).json({ error: err.message });
  }
});

// 3. Mistakes Tracker API
app.get('/api/journal/mistakes', authenticateToken, async (req, res) => {
  try {
    const mistakes = await db('trading_mistakes').where({ user_id: req.user.id }).orderBy('loss_incurred', 'desc');
    res.json({ success: true, mistakes });
  } catch (err) {
    console.error('Fetch Mistakes Error:', err);
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/journal/mistakes', authenticateToken, async (req, res) => {
  try {
    const { mistake_name, category, loss_incurred, lessons_learned } = req.body;
    const [mistake] = await db('trading_mistakes').insert({
      user_id: req.user.id,
      mistake_name: mistake_name || 'Trading Mistake',
      category: category || 'EXECUTION',
      loss_incurred: parseFloat(loss_incurred) || 0,
      frequency: 1,
      lessons_learned: lessons_learned || ''
    }).returning('*');
    res.json({ success: true, mistake });
  } catch (err) {
    console.error('Add Mistake Error:', err);
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/journal/mistakes/:id', authenticateToken, async (req, res) => {
  try {
    await db('trading_mistakes').where({ id: req.params.id, user_id: req.user.id }).del();
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 4. Strategies API
app.get('/api/journal/strategies', authenticateToken, async (req, res) => {
  try {
    const strategies = await db('trading_strategies').where({ user_id: req.user.id }).orderBy('net_pnl', 'desc');
    res.json({ success: true, strategies });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/journal/strategies', authenticateToken, async (req, res) => {
  try {
    const { strategy_name, description, win_rate, total_trades, net_pnl, color } = req.body;
    const [strategy] = await db('trading_strategies').insert({
      user_id: req.user.id,
      strategy_name: strategy_name || 'New Strategy',
      description: description || '',
      win_rate: parseFloat(win_rate) || 0,
      total_trades: parseInt(total_trades) || 0,
      net_pnl: parseFloat(net_pnl) || 0,
      color: color || '#3b82f6'
    }).returning('*');
    res.json({ success: true, strategy });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/journal/strategies/:id', authenticateToken, async (req, res) => {
  try {
    await db('trading_strategies').where({ id: req.params.id, user_id: req.user.id }).del();
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 5. Rules API
app.get('/api/journal/rules', authenticateToken, async (req, res) => {
  try {
    const rules = await db('trading_rules').where({ user_id: req.user.id }).orderBy('created_at', 'asc');
    res.json({ success: true, rules });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/journal/rules', authenticateToken, async (req, res) => {
  try {
    const { rule_text, category, is_active } = req.body;
    const [rule] = await db('trading_rules').insert({
      user_id: req.user.id,
      rule_text: rule_text || 'Trading Rule',
      category: category || 'RISK',
      is_active: is_active !== false,
      times_followed: 0,
      times_broken: 0
    }).returning('*');
    res.json({ success: true, rule });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.put('/api/journal/rules/:id', authenticateToken, async (req, res) => {
  try {
    const { rule_text, is_active, times_followed, times_broken, followed, broken } = req.body;
    const finalFollowed = times_followed !== undefined ? times_followed : followed;
    const finalBroken = times_broken !== undefined ? times_broken : broken;
    const [rule] = await db('trading_rules')
      .where({ id: req.params.id, user_id: req.user.id })
      .update({
        ...(rule_text !== undefined ? { rule_text } : {}),
        ...(is_active !== undefined ? { is_active } : {}),
        ...(finalFollowed !== undefined ? { times_followed: finalFollowed } : {}),
        ...(finalBroken !== undefined ? { times_broken: finalBroken } : {}),
        updated_at: new Date()
      })
      .returning('*');
    res.json({ success: true, rule });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/journal/rules/:id', authenticateToken, async (req, res) => {
  try {
    await db('trading_rules').where({ id: req.params.id, user_id: req.user.id }).del();
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

