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
      template_id: 'kjl8rfj',
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

// ─── Orders ───────────────────────────────────────────────────────────────
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
  const { symbol, type, side, quantity, price, sl_price, tgt_price, margin } = req.body;
  if (!symbol || !type || !side || !quantity) {
    return res.status(400).json({ error: 'Missing required fields' });
  }
  try {
    await db.transaction(async (trx) => {
      // 1. Insert Order
      const [id] = await trx('orders').insert({
        user_id: req.user.id, symbol, type, side, quantity, price: price || null,
        sl_price: sl_price || null, tgt_price: tgt_price || null
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

// ─── Socket.IO ────────────────────────────────────────────────────────────
io.on('connection', (socket) => {
  console.log('Client connected:', socket.id);

  // Send full price snapshot immediately on connect (if available)
  if (Object.keys(priceCache).length > 0) {
    socket.emit('price_snapshot', priceCache);
  }

  socket.on('subscribe', (symbol) => {
    socket.join(symbol);
    const { addSubscription } = require('./services/angelOne');
    if (addSubscription) addSubscription(symbol, io, priceCache);
  });

  socket.on('unsubscribe', (symbol) => {
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
const { loginAngelOne } = require('./services/angelOne');

const PORT = process.env.PORT || 5000;
server.listen(PORT, '0.0.0.0', async () => {
  console.log(`Server listening on port ${PORT}`);
  if (!process.env.ANGEL_TOTP_SECRET) {
      console.log('⚠️ WARNING: Missing Angel One Environment Variables! Please add them in Railway > Variables.');
  } else {
      await loginAngelOne(io, priceCache);
  }
});

module.exports = { io, priceCache };
