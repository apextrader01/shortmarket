require('dotenv').config();

// Ultimate Crash Reporter
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
const db = require('./database/db');
const path = require('path');
const fs = require('fs');

const app = express();
const server = http.createServer(app);

// ─── Price Cache (lives in server.js to avoid module issues) ─────────────────
const priceCache = {};

const io = new Server(server, {
  cors: { origin: '*', methods: ['GET', 'POST'] }
});

app.use(cors());
app.use(express.json());
app.use(compression()); // Compress all API responses to fix frontend loading lag

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
  
  const { fetchBatchLTPs } = require('./services/angelOne');
  if (fetchBatchLTPs) {
    const prices = await fetchBatchLTPs(symbols);
    Object.assign(priceCache, prices);
    res.json(prices);
  } else {
    res.json({});
  }
});

// ─── Stocks (full instrument master) ──────────────────────────────────────
let cachedStocksArray = null;
app.get('/api/stocks', (req, res) => {
  if (cachedStocksArray) return res.json(cachedStocksArray);
  
  const { STOCK_MASTER } = require('./services/angelOne');
  if (!STOCK_MASTER || Object.keys(STOCK_MASTER).length === 0) return res.json([]);
  
  cachedStocksArray = Object.entries(STOCK_MASTER).map(([token, info]) => ({
    token, symbol: info.symbol, name: info.name, exchange: info.exchange, uniqueSymbol: info.uniqueSymbol
  }));
  res.json(cachedStocksArray);
});

// ─── Auth ───────────────────────────────────────────────────────────────────
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { authenticateToken, JWT_SECRET } = require('./middleware/auth');

app.post('/api/auth/register', async (req, res) => {
  const { username, email, password } = req.body;
  if (!username || !email || !password) return res.status(400).json({ error: 'Missing fields' });
  try {
    const password_hash = await bcrypt.hash(password, 10);
    const defaultWatchlist = JSON.stringify([{ id: 1, name: 'Watchlist 1', symbols: [] }]);
    
    const [id] = await db('users').insert({ 
      username, email, password_hash, watchlists: defaultWatchlist 
    }).returning('id');
    
    // Some db engines return an object from returning(), handle both
    const userId = typeof id === 'object' ? id.id : id;
    const token = jwt.sign({ id: userId, username }, JWT_SECRET, { expiresIn: '7d' });
    res.json({ success: true, token, user: { id: userId, username, balance: 1000000.0, watchlists: JSON.parse(defaultWatchlist) } });
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

app.post('/api/auth/login', async (req, res) => {
  const { email, password } = req.body;
  try {
    const user = await db('users').where({ email }).first();
    if (!user) return res.status(400).json({ error: 'Invalid credentials' });
    
    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) return res.status(400).json({ error: 'Invalid credentials' });
    
    const token = jwt.sign({ id: user.id, username: user.username }, JWT_SECRET, { expiresIn: '7d' });
    const watchlists = typeof user.watchlists === 'string' ? JSON.parse(user.watchlists || '[]') : (user.watchlists || []);
    res.json({ success: true, token, user: { id: user.id, username: user.username, balance: user.balance || 1000000.0, watchlists } });
  } catch (err) {
    const errorMsg = err.message || String(err);
    if (errorMsg.includes('ECONNREFUSED') || String(err).includes('ECONNREFUSED')) {
      return res.status(500).json({ error: 'Database not connected. Please add a PostgreSQL database in Railway.' });
    }
    res.status(500).json({ error: errorMsg || 'Unknown error occurred during login' });
  }
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
app.get('/api/user', authenticateToken, async (req, res) => {
  try {
    const user = await db('users').where({ id: req.user.id }).first();
    if (!user) return res.status(404).json({ error: 'User not found' });
    delete user.password_hash;
    if (typeof user.watchlists === 'string') user.watchlists = JSON.parse(user.watchlists);
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

app.post('/api/user/watchlists', authenticateToken, async (req, res) => {
  try {
    const { watchlists } = req.body;
    await db('users').where({ id: req.user.id }).update({ watchlists: JSON.stringify(watchlists) });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── Positions ────────────────────────────────────────────────────────────
app.get('/api/positions', authenticateToken, async (req, res) => {
  try {
    const positions = await db('positions').where({ user_id: req.user.id });
    res.json(positions);
  } catch (err) {
    res.status(500).json({ error: err.message });
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
async function initMutualFundsList() {
    try {
        console.log('🔄 Fetching master list of all Mutual Funds from mfapi.in...');
        const res = await myFetch('https://api.mfapi.in/mf');
        const data = await res.json();
        if (Array.isArray(data)) {
            allMutualFunds = data;
            console.log(`✅ Loaded ${allMutualFunds.length} mutual funds into memory.`);
        }
    } catch (err) {
        console.error('❌ Failed to fetch mutual funds master list:', err.message);
    }
}
initMutualFundsList();

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

// 2. FAST Search Endpoint — returns ALL matching funds instantly from memory (no mfapi calls)
app.get('/api/mf/search', async (req, res) => {
    try {
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
            matches = allMutualFunds.filter(f => f.schemeName.toLowerCase().includes(query));
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

        // Return ALL matches with basic info (no API calls needed = instant)
        const results = matches.map(fund => {
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
        const ids = (req.query.ids || '').split(',').filter(Boolean).slice(0, 10);
        if (ids.length === 0) return res.json([]);

        const results = await Promise.all(ids.map(async (schemeCode) => {
            try {
                let data = null;
                if (mfCache[schemeCode] && (Date.now() - mfCache[schemeCode].timestamp < 3600000)) {
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
        if (mfDetailsCache[name] && (Date.now() - mfDetailsCache[name].timestamp < 43200000)) { // 12 hours cache
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

// ─── Order Management ───────────────────────────────────────────────────────────────
app.get('/api/orders', authenticateToken, async (req, res) => {
  try {
    const orders = await db('orders').where({ user_id: req.user.id }).orderBy('created_at', 'desc');
    res.json(orders);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── Place Order ─────────────────────────────────────────────────────────
app.post('/api/order', authenticateToken, async (req, res) => {
  const { symbol, type, side, quantity, price, sl_price, tgt_price, margin, product_type } = req.body;
  if (!symbol || !type || !side || !quantity) {
    return res.status(400).json({ error: 'Missing required fields' });
  }
  try {
    await db.transaction(async (trx) => {
      // 1. Insert Order
      const [id] = await trx('orders').insert({
        user_id: req.user.id, symbol, type, side, quantity, price: price || null,
        sl_price: sl_price || null, tgt_price: tgt_price || null, product_type: product_type || 'DEL'
      }).returning('id');
      const orderId = typeof id === 'object' ? id.id : id;

      // 2. Deduct Margin from User Balance
      if (margin && Number(margin) > 0) {
        const user = await trx('users').where({ id: req.user.id }).first();
        const newBalance = Number(user.balance) - Number(margin);
        await trx('users').where({ id: req.user.id }).update({ balance: newBalance });
      }

      res.json({ success: true, orderId });
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ─── Cancel Order ─────────────────────────────────────────────────────────
app.post('/api/order/:id/cancel', authenticateToken, async (req, res) => {
  try {
    await db.transaction(async (trx) => {
      const order = await trx('orders').where({ id: req.params.id, user_id: req.user.id }).first();
      if (!order) return res.status(404).json({ error: 'Order not found' });
      if (order.status !== 'PENDING') return res.status(400).json({ error: 'Only PENDING orders can be cancelled' });
      
      // Update status
      await trx('orders').where({ id: req.params.id }).update({ status: 'CANCELLED' });
      
      // Refund Margin
      const refundAmount = order.quantity * parseFloat(order.price || 0);
      if (refundAmount > 0) {
          const user = await trx('users').where({ id: req.user.id }).first();
          await trx('users').where({ id: req.user.id }).update({ balance: parseFloat(user.balance) + refundAmount });
      }
      
      res.json({ success: true });
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── Edit Order ─────────────────────────────────────────────────────────
app.put('/api/order/:id', authenticateToken, async (req, res) => {
  const { quantity, price } = req.body;
  if (!quantity || !price) {
    return res.status(400).json({ error: 'Missing quantity or price' });
  }

  try {
    await db.transaction(async (trx) => {
      const order = await trx('orders').where({ id: req.params.id, user_id: req.user.id }).first();
      if (!order) return res.status(404).json({ error: 'Order not found' });
      if (order.status !== 'PENDING') return res.status(400).json({ error: 'Only PENDING orders can be modified' });
      
      const oldMargin = order.quantity * parseFloat(order.price || 0);
      const newMargin = Number(quantity) * parseFloat(price);
      const marginDifference = newMargin - oldMargin;
      
      // Check if user has enough balance if margin increases
      const user = await trx('users').where({ id: req.user.id }).first();
      if (marginDifference > 0 && parseFloat(user.balance) < marginDifference) {
         return res.status(400).json({ error: 'Insufficient balance to increase order size' });
      }

      // Update Order
      await trx('orders').where({ id: req.params.id }).update({ 
          quantity: Number(quantity), 
          price: parseFloat(price) 
      });
      
      // Update Balance (deduct difference if positive, refund if negative)
      if (marginDifference !== 0) {
          await trx('users').where({ id: req.user.id }).update({ balance: parseFloat(user.balance) - marginDifference });
      }
      
      res.json({ success: true });
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});


// ─── Candle Data ──────────────────────────────────────────────────────────
app.get('/api/candles/:symbol', async (req, res) => {
  try {
    const { fetchCandleData } = require('./services/angelOne');
    const interval = req.query.interval || 'ONE_DAY';
    const candles = await fetchCandleData(req.params.symbol, interval);
    res.json(candles);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── Stock Details (Groww API) ──────────────────────────────────────────────

const stockDetailsCache = {};
app.get('/api/stocks/:symbol/details', async (req, res) => {
  const symbol = req.params.symbol;
  let rawName = symbol.split('-')[0];

  if (stockDetailsCache[rawName] && (Date.now() - stockDetailsCache[rawName].timestamp < 3600000)) {
    return res.json(stockDetailsCache[rawName].data);
  }

  try {
    // 1. Find Groww search_id
    const searchRes = await fetch(`https://groww.in/v1/api/search/v1/entity?app=false&entity_type=stocks&size=1&q=${encodeURIComponent(rawName)}`);
    const searchData = await searchRes.json();
    
    if (!searchData || !searchData.content || searchData.content.length === 0) {
      return res.status(404).json({ error: 'Stock not found on Groww' });
    }
    const searchId = searchData.content[0].search_id;

    // 2. Fetch full details from Groww and live price data for circuits
    const [detailsRes, liveRes] = await Promise.all([
      fetch(`https://groww.in/v1/api/stocks_data/v1/company/search_id/${searchId}`),
      fetch(`https://groww.in/v1/api/stocks_data/v1/tr_live_prices/exchange/NSE/segment/CASH/${rawName}/latest`).catch(() => null)
    ]);
    const data = await detailsRes.json();
    const liveData = liveRes && liveRes.ok ? await liveRes.json().catch(() => null) : null;
    
    if (liveData) {
      data.livePriceData = liveData;
    }
    
    if (data.similarAssets && data.similarAssets.peerList) {
      const peerPromises = data.similarAssets.peerList.map(p => 
        fetch(`https://groww.in/v1/api/stocks_data/v1/tr_live_prices/exchange/NSE/segment/CASH/${p.companyHeader.nseScriptCode || p.companyHeader.bseScriptCode}/latest`)
          .then(r => r.json())
          .catch(() => null)
      );
      const peerLivePrices = await Promise.all(peerPromises);
      data.similarAssets.peerList.forEach((p, i) => {
        if (peerLivePrices[i]) {
          p.livePriceData = peerLivePrices[i];
        }
      });
    }
    
    data.news = []; // Removed Yahoo finance completely

    stockDetailsCache[rawName] = { timestamp: Date.now(), data };
    res.json(data);
  } catch (err) {
    console.error('Groww API Error for', rawName, err.message);
    res.status(500).json({ error: 'Failed to fetch stock details', details: err.message, stack: err.stack });
  }
});

// ─── Socket.IO ────────────────────────────────────────────────────────────
io.on('connection', (socket) => {
  console.log('Client connected:', socket.id);

  // Send full price snapshot immediately on connect (if available)
  if (Object.keys(priceCache).length > 0) {
    socket.emit('price_snapshot', priceCache);
  }

  socket.on('subscribe', (data) => {
    let symbol = typeof data === 'string' ? data : data.symbol;
    socket.join(symbol);
    const { addSubscription } = require('./services/angelOne');
    if (addSubscription) addSubscription(data, io, priceCache);
  });

  socket.on('subscribe_batch', (dataArray) => {
    if (!Array.isArray(dataArray)) return;
    const { addSubscriptionBatch } = require('./services/angelOne');
    if (addSubscriptionBatch) addSubscriptionBatch(dataArray, io, priceCache, socket);
  });

  socket.on('unsubscribe', (data) => {
    let symbol = typeof data === 'string' ? data : data.symbol;
    socket.leave(symbol);
  });

  socket.on('disconnect', () => {
    console.log('Client disconnected:', socket.id);
  });
});

// ─── Serve Frontend in Production ─────────────────────────────────────────
app.use(express.static(path.join(__dirname, '../frontend/dist')));
app.use((req, res) => {
  res.sendFile(path.join(__dirname, '../frontend/dist/index.html'));
});

// ─── Start ────────────────────────────────────────────────────────────────
const { loginAngelOne, setPriceCache } = require('./services/angelOne');
setPriceCache(priceCache);

const { updateOptionsMaster } = require('./database/updateOptionsMaster');

const PORT = process.env.PORT || 5000;
server.listen(PORT, '0.0.0.0', async () => {
  console.log(`Server listening on port ${PORT}`);
  
  // Update options master in background
  updateOptionsMaster().catch(e => console.error(e));

  if (!process.env.ANGEL_TOTP_SECRET) {
      console.log('⚠️ WARNING: Missing Angel One Environment Variables! Please add them in Railway > Variables.');
  } else {
      await loginAngelOne(io, priceCache);
  }
  
  // Start Cron Jobs
  const { initAutoSquareOff } = require('./services/autoSquareOff');
  const { initRiskyStocksSync } = require('./services/riskyStocksSync');
  initAutoSquareOff();
  initRiskyStocksSync();
});

module.exports = { io, priceCache };
