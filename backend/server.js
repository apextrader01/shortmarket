const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });

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
const cookieParser = require('cookie-parser');
const db = require('./database/db');
const fs = require('fs');

const app = express();
const server = http.createServer(app);

// ─── Price Cache (lives in server.js to avoid module issues) ─────────────────
const priceCache = {};

const io = new Server(server, {
  cors: { origin: true, credentials: true, methods: ['GET', 'POST'] }
});

app.use(cors({ origin: true, credentials: true }));
app.use(cookieParser());
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
  
  // Only send NSE equities and Indices to the frontend to avoid huge payloads (options/futures are massive)
  cachedStocksArray = Object.entries(STOCK_MASTER)
    .filter(([token, info]) => info.exchange === 'NSE')
    .map(([token, info]) => ({
      token, symbol: info.symbol, name: info.name, exchange: info.exchange, uniqueSymbol: info.uniqueSymbol
    }));
  res.json(cachedStocksArray);
});

  app.get('/api/stocks/search', (req, res) => {
    const q = req.query.q;
    if (!q || q.length < 2) return res.json([]);
    
    const { STOCK_MASTER, globalNfoOptions, globalNfoFutures, globalBseSpots } = require('./services/angelOne');

    const queryParts = q.toLowerCase().split(/\s+/).filter(Boolean);
    const matchesQuery = (str) => {
      if (!str) return false;
      const lowerStr = str.toLowerCase();
      return queryParts.every(part => lowerStr.includes(part));
    };

    const resultsMap = new Map();
    
    // Helper to add to map, preferring higher lotsizes
    const addResult = (resObj) => {
      if (resultsMap.has(resObj.uniqueSymbol)) {
        const existing = resultsMap.get(resObj.uniqueSymbol);
        if (resObj.lotsize > existing.lotsize) {
           resultsMap.set(resObj.uniqueSymbol, resObj);
        }
      } else {
        resultsMap.set(resObj.uniqueSymbol, resObj);
      }
    };

    // 1. Search regular stocks and indices
    if (STOCK_MASTER) {
      for (const [key, value] of Object.entries(STOCK_MASTER)) {
        if (!value) continue;
        if (value.symbol && value.name) {
          if (matchesQuery(value.symbol) || matchesQuery(value.name)) {
            addResult({
              token: key, 
              symbol: value.symbol, 
              name: value.name, 
              exchange: value.exchange, 
              lotsize: Number(value.lotsize || 1),
              uniqueSymbol: value.uniqueSymbol || `${value.symbol}-${value.exchange || 'NSE'}`
            });
          }
        }
      }
    }

    // 2. Search BSE Spots
    if (globalBseSpots) {
      for (const [key, value] of Object.entries(globalBseSpots)) {
        if (value && value.symbol && matchesQuery(value.symbol)) {
          addResult({
            token: value.token, symbol: value.symbol, name: value.name, 
            exchange: value.exchange || 'BSE', lotsize: Number(value.lotsize || 1), uniqueSymbol: `${value.symbol}-${value.exchange || 'BSE'}`
          });
        }
      }
    }

    // Helper to check if a derivative is expired (expiryDate < today midnight)
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const isExpired = (expiryStr) => {
      if (!expiryStr) return false;
      const day = parseInt(expiryStr.slice(0, 2), 10);
      const monthStr = expiryStr.slice(2, 5).toUpperCase();
      let year = parseInt(expiryStr.slice(5), 10);
      if (year < 100) year += 2000;
      
      const monthMap = { 'JAN':0, 'FEB':1, 'MAR':2, 'APR':3, 'MAY':4, 'JUN':5, 'JUL':6, 'AUG':7, 'SEP':8, 'OCT':9, 'NOV':10, 'DEC':11 };
      const month = monthMap[monthStr];
      if (!isNaN(day) && month !== undefined && !isNaN(year)) {
        const expiryDate = new Date(year, month, day);
        return expiryDate < today;
      }
      return false;
    };

    // 3. Search Futures
    if (globalNfoFutures) {
      for (const [key, value] of Object.entries(globalNfoFutures)) {
        if (Array.isArray(value)) {
          for (const fut of value) {
            if (fut && fut.symbol && matchesQuery(fut.symbol)) {
               if (fut.expiry && isExpired(fut.expiry)) continue;
               addResult({
                 token: fut.token, symbol: fut.symbol, name: key, 
                 exchange: fut.exchange || 'NFO', lotsize: Number(fut.lotsize || 1), uniqueSymbol: `${fut.symbol}-${fut.exchange || 'NFO'}`
               });
            }
          }
        }
      }
    }

    // 4. Search Options
    if (globalNfoOptions) {
      for (const [key, value] of Object.entries(globalNfoOptions)) {
        if (typeof value === 'object') {
          for (const expiry in value) {
            if (isExpired(expiry)) continue;
            if (typeof value[expiry] !== 'object') continue;
            for (const strike in value[expiry]) {
               if (typeof value[expiry][strike] !== 'object') continue;
               for (const type in value[expiry][strike]) {
                  const opt = value[expiry][strike][type];
                  if (opt && opt.symbol && matchesQuery(opt.symbol)) {
                     addResult({
                       token: opt.token, symbol: opt.symbol, name: key, 
                       exchange: opt.exch_seg || 'NFO', lotsize: Number(opt.lotsize || 1), uniqueSymbol: `${opt.symbol}-${opt.exch_seg || 'NFO'}`
                     });
                  }
               }
            }
          }
        }
      }
    }
    
    let finalResults = Array.from(resultsMap.values());
    
    // Sort exact matches and indices to the top
    const qLower = q.toLowerCase();
    finalResults.sort((a, b) => {
      const aExact = a.symbol.toLowerCase() === qLower || (a.name && a.name.toLowerCase() === qLower);
      const bExact = b.symbol.toLowerCase() === qLower || (b.name && b.name.toLowerCase() === qLower);
      if (aExact && !bExact) return -1;
      if (!aExact && bExact) return 1;
      
      // Prefer Cash/Indices (NSE/BSE) over derivatives
      const aIsCash = (a.exchange === 'NSE' || a.exchange === 'BSE');
      const bIsCash = (b.exchange === 'NSE' || b.exchange === 'BSE');
      if (aIsCash && !bIsCash) return -1;
      if (!aIsCash && bIsCash) return 1;
      
      // Prefer Futures over Options
      const aIsFut = a.symbol.includes('FUT');
      const bIsFut = b.symbol.includes('FUT');
      if (aIsFut && !bIsFut) return -1;
      if (!aIsFut && bIsFut) return 1;
      
      return 0;
    });

    res.json(finalResults.slice(0, 100));
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
    const isHttps = req.headers['x-forwarded-proto'] === 'https' || req.secure || req.headers['host']?.includes('sslip.io');
    res.cookie('token', token, {
      httpOnly: true,
      secure: isHttps,
      sameSite: isHttps ? 'none' : 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000
    });
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
  const { email, password } = req.body || {};
  if (!email || !password) return res.status(400).json({ error: 'Email and password are required' });
  try {
    const user = await db('users').where({ email }).first();
    if (!user) return res.status(400).json({ error: 'Invalid credentials' });
    
    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) return res.status(400).json({ error: 'Invalid credentials' });
    
    const token = jwt.sign({ id: user.id, username: user.username, is_admin: user.is_admin }, JWT_SECRET, { expiresIn: '7d' });
    const watchlists = typeof user.watchlists === 'string' ? JSON.parse(user.watchlists || '[]') : (user.watchlists || []);
    const isHttps = req.headers['x-forwarded-proto'] === 'https' || req.secure || req.headers['host']?.includes('sslip.io');
    res.cookie('token', token, {
      httpOnly: true,
      secure: isHttps,
      sameSite: isHttps ? 'none' : 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000
    });
    res.json({ success: true, token, user: { id: user.id, username: user.username, balance: user.balance || 1000000.0, is_admin: user.is_admin, watchlists } });
  } catch (err) {
    const errorMsg = err.message || String(err);
    if (errorMsg.includes('ECONNREFUSED') || String(err).includes('ECONNREFUSED')) {
      return res.status(500).json({ error: 'Database not connected. Please add a PostgreSQL database in Railway.' });
    }
    res.status(500).json({ error: errorMsg || 'Unknown error occurred during login' });
  }
});

// Logout endpoint
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
app.get('/api/user', authenticateToken, async (req, res) => {
  try {
    const user = await db('users').where({ id: req.user.id }).first();
    if (!user) return res.status(404).json({ error: 'User not found' });
    delete user.password_hash;
    if (typeof user.watchlists === 'string') user.watchlists = JSON.parse(user.watchlists);
    user.balance = parseFloat(user.balance || 0);
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
app.get('/api/admin/users', authenticateToken, async (req, res) => {
  try {
    const caller = await db('users').where({ id: req.user.id }).first();
    if (!caller || !caller.is_admin) return res.status(403).json({ error: 'Unauthorized' });

    const users = await db('users').select('id', 'username', 'email', 'balance', 'phone', 'pan_card', 'aadhar_number', 'kyc_pan_url', 'kyc_aadhar_url', 'is_admin', 'created_at').orderBy('created_at', 'desc');
    res.json(users);
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
    
    const [orderId] = await db('orders').insert({
      user_id: position.user_id,
      symbol: position.symbol,
      type: 'MARKET',
      side: side,
      quantity: quantity,
      product_type: position.product_type,
      status: 'PENDING'
    }).returning('id');

    res.json({ success: true, message: 'Force close order placed', orderId: typeof orderId === 'object' ? orderId.id : orderId });
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
    res.json(positions);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── Holdings ─────────────────────────────────────────────────────────────
app.get('/api/holdings', authenticateToken, async (req, res) => {
  try {
    const holdings = await db('holdings').where({ user_id: req.user.id });
    res.json({ success: true, holdings });
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
    const orders = await db('orders').where({ user_id: req.user.id }).orderBy('created_at', 'desc');
    res.json(orders);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── Place Order ─────────────────────────────────────────────────────────
const { spawnBracketOrders } = require('./services/orderExecutor');

let lastOrderError = null;

app.post('/api/order', authenticateToken, async (req, res) => {
  lastOrderError = null;
  const { symbol, type, side, quantity, price, sl_price, tgt_price, trigger_price, trail_amount, margin, product_type } = req.body;
  if (!symbol || !type || !side || !quantity) {
    return res.status(400).json({ error: 'Missing required fields' });
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

  // Block new Intraday orders outside valid time windows
  if (product_type === 'INT' || product_type === 'BO' || product_type === 'CO') {
    const isCommodity = ['CRUDEOIL', 'GOLD', 'SILVER', 'NATURALGAS', 'COPPER', 'ZINC', 'LEAD', 'ALUMINIUM', 'MENTHAOIL', 'COTTON'].some(c => symbol.startsWith(c));
    const istTime = new Date(new Date().toLocaleString("en-US", {timeZone: "Asia/Kolkata"}));
    const hours = istTime.getHours();
    const minutes = istTime.getMinutes();
    
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

  try {
    await db.transaction(async (trx) => {
      // 1. Determine execution status
      const isMarket = type === 'MARKET';
      const status = 'PENDING';
      const execPrice = parseFloat(price) || priceCache[symbol]?.ltp || 0; // Fetch live LTP here for market orders
      
      // 2. Deduct Margin from User Balance
      let requiresMargin = true;
      const effectiveProductType = product_type || 'DEL';
      if (side === 'SELL') {
          const isDerivative = symbol.includes('CE') || symbol.includes('PE') || symbol.includes('FUT');
          if (effectiveProductType === 'DEL' && !isDerivative) {
              // 1. Fetch available Holdings
              const holding = await trx('holdings').where({ user_id: req.user.id, symbol }).first();
              const holdingQty = holding ? holding.quantity : 0;
              
              // 2. Fetch open Positions for today
              const existingPos = await trx('positions').where({ user_id: req.user.id, symbol, product_type: 'DEL' }).whereNot({ quantity: 0 }).first();
              const posQty = existingPos && existingPos.quantity > 0 ? existingPos.quantity : 0;
              
              // 3. Fetch Pending Sell Orders for this symbol
              const pendingOrders = await trx('orders')
                  .where({ user_id: req.user.id, symbol, side: 'SELL', product_type: 'DEL', status: 'PENDING' });
              const pendingSellQty = pendingOrders.reduce((sum, o) => sum + Number(o.quantity), 0);
              
              const totalAvailable = holdingQty + posQty - pendingSellQty;
              
              if (Number(quantity) > totalAvailable) {
                  throw new Error(`Insufficient holdings. You only have ${totalAvailable} shares available to sell.`);
              }
              requiresMargin = false; // Selling DEL from holdings requires no margin
          } else if (!isDerivative || effectiveProductType !== 'DEL') {
              const existingPos = await trx('positions').where({ user_id: req.user.id, symbol, product_type: effectiveProductType }).whereNot({ quantity: 0 }).first();
              if (existingPos && existingPos.quantity >= Number(quantity)) {
                  requiresMargin = false;
              }
          } else if (isDerivative && effectiveProductType === 'DEL') {
              // Option writing / Future shorting in Delivery (NRML).
              // Check if we are closing an existing long position.
              const existingPos = await trx('positions').where({ user_id: req.user.id, symbol, product_type: effectiveProductType }).whereNot({ quantity: 0 }).first();
              if (existingPos && existingPos.quantity >= Number(quantity)) {
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
        status, sl_price: sl_price || null, tgt_price: tgt_price || null, trigger_price: trigger_price || null, trail_amount: trail_amount || null, product_type: effectiveProductType, margin: marginToSave
      }).returning('id');
      const orderId = typeof id === 'object' ? id.id : id;
      
      const triggerEngine = require('./services/triggerEngine');
      triggerEngine.addOrderToMemory({
        id: orderId, user_id: req.user.id, symbol, type, side, quantity, price: execPrice || null,
        status, sl_price: sl_price || null, tgt_price: tgt_price || null, trigger_price: trigger_price || null, trail_amount: trail_amount || null, product_type: product_type || 'DEL', margin: marginToSave
      });
      
      // Manually trigger an evaluation to instantly process Market orders in the background
      // IMPORTANT: Only use real cached LTP for evaluation, NOT the order's limit price.
      // Using the order's own price would cause LIMIT orders to self-trigger immediately.
      if (isMarket) {
        const realLtp = priceCache[symbol]?.ltp || 0;
        if (realLtp > 0) {
          triggerEngine.evaluateTick(symbol, realLtp).catch(err => console.error('Immediate evaluation error:', err));
        }
      }

      res.json({ success: true, orderId, status });
    });

  } catch (error) {
    lastOrderError = { message: error.message, stack: error.stack, payload: req.body };
    console.error('[ORDER ERROR]:', error);
    res.status(500).json({ error: error.message, success: false });
  }
});

// ⚡ Fetch Batch LTPs (REST) ⚡
app.post('/api/ltp-batch', async (req, res) => {
  try {
    const { symbols } = req.body;
    if (!symbols || !Array.isArray(symbols)) {
      return res.status(400).json({ error: 'Missing or invalid symbols array' });
    }
    
    const { fetchBatchLTPs, registerTokens } = require('./services/angelOne');
    if (registerTokens) registerTokens(symbols);
    
    const result = {};
    const missingSymbols = [];
    
    // 1. Try to serve from memory cache instantly
    for (const item of symbols) {
      const sym = typeof item === 'string' ? item : item.symbol;
      if (!sym) continue;
      
      if (priceCache[sym] && priceCache[sym].ltp > 0) {
        result[sym] = priceCache[sym];
      } else {
        missingSymbols.push(sym);
      }
    }
    
    // 2. Fetch only missing symbols from Angel One REST API
    if (missingSymbols.length > 0) {
      const data = await fetchBatchLTPs(missingSymbols);
      for (const [sym, ltpData] of Object.entries(data)) {
        result[sym] = ltpData;
        if (ltpData && ltpData.ltp > 0) {
          priceCache[sym] = ltpData;
        }
      }
    }
    
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 🧮 Estimate Charges 🧮
app.get('/api/estimate-charges', authenticateToken, (req, res) => {
  try {
    const { symbol, product_type, side, quantity, price } = req.query;
    if (!symbol || !side || !quantity || !price) {
      return res.status(400).json({ error: 'Missing required parameters' });
    }
    
    const { calculateTaxes } = require('./services/taxCalculator');
    const taxes = calculateTaxes(symbol, product_type || 'DEL', side, Number(quantity), Number(price));
    
    res.json(taxes);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 📖 Get Ledger History 📖
app.get('/api/ledger', authenticateToken, async (req, res) => {
  try {
    const ledger = await db('ledger')
      .where({ user_id: req.user.id })
      .orderBy('created_at', 'desc')
      .limit(100);
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
      const isCommodity = ['CRUDEOIL', 'GOLD', 'SILVER', 'NATURALGAS', 'COPPER', 'ZINC', 'LEAD', 'ALUMINIUM', 'MENTHAOIL', 'COTTON'].some(c => item.symbol.startsWith(c));
      const istTime = new Date(new Date().toLocaleString("en-US", {timeZone: "Asia/Kolkata"}));
      const hours = istTime.getHours();
      const minutes = istTime.getMinutes();
      
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
          const isDerivative = item.symbol.includes('CE') || item.symbol.includes('PE') || item.symbol.includes('FUT');
          if (item.side === 'SELL' && (item.product_type || 'DEL') === 'DEL' && !isDerivative) {
              sellDelQuantities[item.symbol] = (sellDelQuantities[item.symbol] || 0) + Number(item.quantity);
          }
      }
      for (const symbol in sellDelQuantities) {
          const qtyRequested = sellDelQuantities[symbol];
          
          const holding = await trx('holdings').where({ user_id: req.user.id, symbol }).first();
          const holdingQty = holding ? holding.quantity : 0;
          
          const existingPos = await trx('positions').where({ user_id: req.user.id, symbol, product_type: 'DEL' }).whereNot({ quantity: 0 }).first();
          const posQty = existingPos && existingPos.quantity > 0 ? existingPos.quantity : 0;
          
          const pendingOrders = await trx('orders')
              .where({ user_id: req.user.id, symbol, side: 'SELL', product_type: 'DEL', status: 'PENDING' });
          const pendingSellQty = pendingOrders.reduce((sum, o) => sum + Number(o.quantity), 0);
          
          const totalAvailable = holdingQty + posQty - pendingSellQty;
          
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
      const triggerEngine = require('./services/triggerEngine');

      for (const item of items) {
        const { symbol, type, side, quantity, price, sl_price, tgt_price, product_type, margin } = item;
        const status = 'PENDING';
        
        const [orderId] = await trx('orders').insert({
          user_id: req.user.id,
          symbol, type, side, quantity, price, sl_price, tgt_price,
          status,
          margin: margin || 0, // Individual margin recorded for cancellations
          product_type: product_type || 'INT'
        });

        executedOrders.push({ id: orderId, symbol, status });

        // If executed immediately, create positions
        if (isMarket) {
          const pos = await trx('positions').where({ user_id: req.user.id, symbol, product_type: product_type || 'INT' }).first();
          
          if (pos) {
            let newQty = pos.quantity;
            let newAvgPrice = pos.average_price;
            
            if (side === 'BUY') {
              if (pos.quantity >= 0) {
                newAvgPrice = ((pos.quantity * pos.average_price) + (quantity * price)) / (pos.quantity + quantity);
                newQty += quantity;
              } else {
                newQty += quantity;
              }
            } else {
              if (pos.quantity <= 0) {
                newAvgPrice = ((Math.abs(pos.quantity) * pos.average_price) + (quantity * price)) / (Math.abs(pos.quantity) + quantity);
                newQty -= quantity;
              } else {
                newQty -= quantity;
              }
            }

            if (newQty === 0) {
              await trx('positions').where({ id: pos.id }).del();
            } else {
              await trx('positions').where({ id: pos.id }).update({ quantity: newQty, average_price: newAvgPrice });
            }
          } else {
            await trx('positions').insert({
              user_id: req.user.id,
              symbol,
              quantity: side === 'BUY' ? quantity : -quantity,
              average_price: price,
              product_type: product_type || 'INT'
            });
          }
        }
      }
      res.json({ success: true, orders: executedOrders });
    });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// ─── Cancel Order ─────────────────────────────────────────────────────────
app.post('/api/order/:id/cancel', authenticateToken, async (req, res) => {
  try {
    await db.transaction(async (trx) => {
      const order = await trx('orders').where({ id: req.params.id, user_id: req.user.id }).first();
      if (!order) return res.status(404).json({ error: 'Order not found' });
      if (order.status !== 'PENDING' && order.status !== 'PENDING_TRIGGER') return res.status(400).json({ error: 'Only pending orders can be cancelled' });
      
      // Update status
      await trx('orders').where({ id: req.params.id }).update({ status: 'CANCELLED' });
      
      // OCO: Cancel sibling if it exists
      if (order.parent_order_id) {
          await trx('orders')
            .where({ parent_order_id: order.parent_order_id, status: 'PENDING_TRIGGER' })
            .whereNot({ id: order.id })
            .update({ status: 'CANCELLED' });
            
          // Bracket order cancelled: Auto-exit the underlying position at market
          const parentOrder = await trx('orders').where({ id: order.parent_order_id }).first();
          if (parentOrder && parentOrder.status === 'EXECUTED') {
              const pos = await trx('positions').where({ user_id: req.user.id, symbol: order.symbol, product_type: parentOrder.product_type }).first();
              if (pos && pos.quantity !== 0) {
                 const exitQty = Math.min(Math.abs(pos.quantity), Number(parentOrder.quantity));
                 const exitSide = pos.quantity > 0 ? 'SELL' : 'BUY';
                 
                 if (exitQty > 0) {
                   await trx('orders').insert({
                     user_id: req.user.id,
                     symbol: pos.symbol,
                     type: 'MARKET',
                     side: exitSide,
                     quantity: exitQty,
                     price: null,
                     status: 'PENDING', // orderExecutor will pick this up instantly
                     product_type: pos.product_type || 'INT',
                     margin: 0
                   });
                 }
              }
          }
      }
      
      // Refund Margin
      const refundAmount = order.margin ? parseFloat(order.margin) : (order.quantity * parseFloat(order.price || 0));
      if (refundAmount > 0) {
          const user = await trx('users').where({ id: req.user.id }).first();
          await trx('users').where({ id: req.user.id }).update({ balance: parseFloat(user.balance) + refundAmount });
      }
      
      const triggerEngine = require('./services/triggerEngine');
      triggerEngine.removeOrderFromMemory(req.params.id, order.symbol);
      
      res.json({ success: true });
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── Edit Order ─────────────────────────────────────────────────────────
app.put('/api/order/:id', authenticateToken, async (req, res) => {
  const { quantity, price, sl_price, tgt_price } = req.body;
  if (!quantity || !price) {
    return res.status(400).json({ error: 'Missing quantity or price' });
  }

  try {
    await db.transaction(async (trx) => {
      const order = await trx('orders').where({ id: req.params.id, user_id: req.user.id }).first();
      if (!order) return res.status(404).json({ error: 'Order not found' });
      if (order.status !== 'PENDING' && order.status !== 'PENDING_TRIGGER') {
        return res.status(400).json({ error: 'Only PENDING or PENDING_TRIGGER orders can be modified' });
      }
      
      const { calculateRequiredMargin } = require('./services/marginEngine');
      const oldMargin = parseFloat(order.margin || 0);
      let newMargin = 0;
      if (!order.parent_order_id) {
          newMargin = calculateRequiredMargin(order.symbol, order.product_type, order.side, Number(quantity), parseFloat(price));
      }
      const marginDifference = newMargin - oldMargin;
      
      // Check if user has enough balance if margin increases
      const user = await trx('users').where({ id: req.user.id }).first();
      if (marginDifference > 0 && parseFloat(user.balance) < marginDifference) {
         return res.status(400).json({ error: 'Insufficient Funds.' });
      }

      // Mathematical Price Validation for PENDING_TRIGGER
      if (order.status === 'PENDING_TRIGGER') {
         const parent = await trx('orders').where({ id: order.parent_order_id }).first();
         if (parent) {
             const entryPrice = parseFloat(parent.price);
             if (order.type === 'SL-M') {
                 if (order.side === 'SELL' && parseFloat(price) >= entryPrice) {
                     return res.status(400).json({ error: 'BO Buy: Stop-Loss must be lower than execution price.' });
                 } else if (order.side === 'BUY' && parseFloat(price) <= entryPrice) {
                     return res.status(400).json({ error: 'BO Sell: Stop-Loss must be higher than execution price.' });
                 }
             } else if (order.type === 'LIMIT') {
                 if (order.side === 'SELL' && parseFloat(price) <= entryPrice) {
                     return res.status(400).json({ error: 'BO Buy: Target must be higher than execution price.' });
                 } else if (order.side === 'BUY' && parseFloat(price) >= entryPrice) {
                     return res.status(400).json({ error: 'BO Sell: Target must be lower than execution price.' });
                 }
             }
         }
      }

      // Build update object
      const updateObj = { 
          quantity: Number(quantity), 
          price: parseFloat(price),
          margin: newMargin
      };

      if (order.status === 'PENDING_TRIGGER' && order.type === 'SL-M') {
          updateObj.trigger_price = parseFloat(price);
          updateObj.price = null; // SL-M is a market order when triggered
      }

      // Update sl_price and tgt_price if provided
      if (sl_price !== undefined) updateObj.sl_price = sl_price;
      if (tgt_price !== undefined) updateObj.tgt_price = tgt_price;

      // Update Order
      await trx('orders').where({ id: req.params.id }).update(updateObj);
      
      // Update child OCO orders (SL and Target legs) if sl_price or tgt_price changed
      if (sl_price !== undefined || tgt_price !== undefined) {
        const childOrders = await trx('orders')
          .where({ parent_order_id: req.params.id, status: 'PENDING_TRIGGER' });
        
        const triggerEngine = require('./services/triggerEngine');
        for (const child of childOrders) {
          if (child.type === 'SL-M' && sl_price !== undefined) {
            await trx('orders').where({ id: child.id }).update({ 
              trigger_price: sl_price,
              price: sl_price 
            });
          } else if (child.type === 'LIMIT' && tgt_price !== undefined) {
            await trx('orders').where({ id: child.id }).update({ 
              price: tgt_price 
            });
          }
        }
      }

      // Update Balance (deduct difference if positive, refund if negative)
      if (marginDifference !== 0) {
          await trx('users').where({ id: req.user.id }).update({ balance: parseFloat(user.balance) - marginDifference });
      }
      
      const triggerEngine = require('./services/triggerEngine');
      triggerEngine.addOrderToMemory({ ...order, ...updateObj });
      
      res.json({ success: true });
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});


// ─── Historical Chart Data (Candles) ──────────────────────────────────────────────────
const candleCache = {}; // Cache to protect Angel One from rate limits (e.g. 1000 users opening charts)
const CACHE_DURATION_MS = 60 * 1000; // 1 minute cache

app.get('/api/candles/:symbol', async (req, res) => {
  try {
    const { fetchCandleData } = require('./services/angelOne');
    const interval = req.query.interval || 'ONE_DAY';
    let cleanSymbol = req.params.symbol;
    if (cleanSymbol.includes('CE') || cleanSymbol.includes('PE')) {
        cleanSymbol = cleanSymbol.replace(/\s+/g, '');
    }
    if (cleanSymbol.endsWith('-EQ')) {
        cleanSymbol = cleanSymbol.replace('-EQ', '');
    }
    const cacheKey = `${cleanSymbol}_${interval}`;
    const now = Date.now();
    
    // Serve from cache if valid
    if (candleCache[cacheKey] && (now - candleCache[cacheKey].timestamp < CACHE_DURATION_MS)) {
      return res.json(candleCache[cacheKey].data);
    }

    const candles = await fetchCandleData(cleanSymbol, interval);

    // Retry once if empty — the Angel One token may still be initializing at boot
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

  socket.on('register_user', (userId) => {
    if (userId) {
      socket.join(userId.toString());
      console.log(`Socket ${socket.id} registered user: ${userId}`);
    }
  });

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

  socket.on('subscribe_depth', (symbol) => {
    if (!symbol) return;
    socket.join(`${symbol}_depth`);
    const { subscribeToDepth } = require('./services/angelOne');
    if (subscribeToDepth) subscribeToDepth(symbol);
  });

  socket.on('unsubscribe_depth', (symbol) => {
    if (!symbol) return;
    socket.leave(`${symbol}_depth`);
    const { unsubscribeFromDepth } = require('./services/angelOne');
    if (unsubscribeFromDepth) unsubscribeFromDepth(symbol);
  });

  socket.on('disconnect', () => {
    console.log('Client disconnected:', socket.id);
  });
});

app.get('/api/debug-state', (req, res) => {
  const { getDebugState } = require('./services/angelOne');
  let state = {};
  if (getDebugState) {
    state = getDebugState();
  }
  res.json({
    state,
    lastOrderError,
    time: new Date().toISOString()
  });
});

// ─── Serve Frontend in Production ─────────────────────────────────────────
app.use(express.static(path.join(__dirname, '../frontend/dist'), {
  setHeaders: (res, filePath) => {
    if (filePath.endsWith('.html')) {
      res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    }
  }
}));
app.use((req, res) => {
  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
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
  const { startSquareOffJobs } = require('./services/autoSquareOff');
  const { initRiskyStocksSync } = require('./services/riskyStocksSync');
  const { initOrderExecutor } = require('./services/orderExecutor');
  const triggerEngine = require('./services/triggerEngine');
  const MTMRiskManager = require('./services/mtmRiskManager');
  const { initCronJobs } = require('./services/cronJobs');
  const schedule = require('node-schedule');

  // Refresh Angel One Token daily at 2:00 AM IST
  const loginRule = new schedule.RecurrenceRule();
  loginRule.dayOfWeek = [new schedule.Range(1, 5)]; // Mon-Fri
  loginRule.hour = 2;
  loginRule.minute = 0;
  loginRule.tz = 'Asia/Kolkata';
  schedule.scheduleJob(loginRule, async () => {
    console.log('⏰ Daily 2:00 AM Cron: Refreshing Angel One Token...');
    await loginAngelOne(io, priceCache);
  });

  // Initialize TriggerEngine: matches LIMIT + PENDING_TRIGGER (SL/TP/CO/BO) orders
  // against live WS price ticks. angelOne.js already calls triggerEngine.evaluateTick()
  // on every tick — this just loads existing orders into memory on startup.
  triggerEngine.setSocketIo(io);
  await triggerEngine.loadPendingOrders();
  console.log('⚡ TriggerEngine active (LIMIT + SL/TP/CO/BO order matching)');

  // Initialize EOD Positions Engine (Cron Automations)
  require('./services/positionsEngine');

  // Initialize MTM Risk Manager: 95% auto-liquidation rule (checks every 2s)
  new MTMRiskManager(priceCache).start();
  console.log('🛡️  MTM Risk Manager active (95% auto-liquidation)');

  // EOD Automations (sweeps, square-offs, holdings migration, expiry settlement) are handled by positionsEngine.js above.

  // Legacy square-off jobs (expiry + intraday via HTTP self-calls) + remaining services
  startSquareOffJobs();
  initRiskyStocksSync();
  initOrderExecutor(priceCache);
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
