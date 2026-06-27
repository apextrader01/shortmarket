require('dotenv').config();
const express = require('express');
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

// ─── Health ────────────────────────────────────────────────────────────────
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', symbols: Object.keys(priceCache).length });
});

// ─── Prices (all cached LTPs) ─────────────────────────────────────────────
app.get('/api/prices', (req, res) => {
  res.json(priceCache);
});

// ─── Stocks (full instrument master) ──────────────────────────────────────
app.get('/api/stocks', (req, res) => {
  const { STOCK_MASTER } = require('./services/angelOne');
  const stocks = Object.entries(STOCK_MASTER).map(([token, info]) => ({
    token, symbol: info.symbol, name: info.name, exchange: info.exchange, uniqueSymbol: info.uniqueSymbol
  }));
  res.json(stocks);
});

// ─── User ─────────────────────────────────────────────────────────────────
app.get('/api/user/:id', (req, res) => {
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.params.id);
  if (!user) return res.status(404).json({ error: 'User not found' });
  res.json(user);
});

// ─── Positions ────────────────────────────────────────────────────────────
app.get('/api/positions/:userId', (req, res) => {
  const positions = db.prepare('SELECT * FROM positions WHERE user_id = ?').all(req.params.userId);
  res.json(positions);
});

// ─── Orders ───────────────────────────────────────────────────────────────
app.get('/api/orders/:userId', (req, res) => {
  const orders = db.prepare('SELECT * FROM orders WHERE user_id = ? ORDER BY created_at DESC').all(req.params.userId);
  res.json(orders);
});

// ─── Place Order ─────────────────────────────────────────────────────────
app.post('/api/order', (req, res) => {
  const { userId, symbol, type, side, quantity, price } = req.body;
  if (!userId || !symbol || !type || !side || !quantity) {
    return res.status(400).json({ error: 'Missing required fields' });
  }
  try {
    const result = db.prepare(`
      INSERT INTO orders (user_id, symbol, type, side, quantity, price)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(userId, symbol, type, side, quantity, price || null);
    res.json({ success: true, orderId: result.lastInsertRowid });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ─── Cancel Order ─────────────────────────────────────────────────────────
app.post('/api/order/:id/cancel', (req, res) => {
  const order = db.prepare('SELECT * FROM orders WHERE id = ?').get(req.params.id);
  if (!order) return res.status(404).json({ error: 'Order not found' });
  if (order.status !== 'PENDING') return res.status(400).json({ error: 'Only PENDING orders can be cancelled' });
  db.prepare("UPDATE orders SET status = 'CANCELLED' WHERE id = ?").run(req.params.id);
  res.json({ success: true });
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
