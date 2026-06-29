-- SQLite Schema for Short Market Mock Backend

CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE NOT NULL,
    balance REAL NOT NULL DEFAULT 1000000.0,
    profile_picture_url TEXT,
    phone TEXT,
    pan_card TEXT,
    aadhar_number TEXT,
    kyc_pan_url TEXT,
    kyc_aadhar_url TEXT,
    is_admin BOOLEAN DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS positions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    symbol TEXT NOT NULL,
    quantity INTEGER NOT NULL DEFAULT 0,
    average_price REAL NOT NULL,
    product_type TEXT DEFAULT 'DEL',
    margin REAL DEFAULT 0, -- The total margin locked for this open position
    FOREIGN KEY(user_id) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS orders (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    symbol TEXT NOT NULL,
    type TEXT NOT NULL CHECK(type IN ('MARKET', 'LIMIT', 'SL-M', 'SL-L')),
    side TEXT NOT NULL CHECK(side IN ('BUY', 'SELL')),
    quantity INTEGER NOT NULL,
    price REAL, -- NULL for MARKET orders
    trigger_price REAL, -- For GTT and SL orders
    sl_price REAL, -- For Stop Loss target
    tgt_price REAL, -- For Target target
    product_type TEXT DEFAULT 'DEL', -- INT or DEL
    margin REAL DEFAULT 0, -- Margin blocked for this order
    realized_pnl REAL DEFAULT 0, -- Profit/Loss made if this order closed a position
    taxes REAL DEFAULT 0, -- Total taxes and brokerage deducted for this order
    status TEXT NOT NULL DEFAULT 'PENDING' CHECK(status IN ('PENDING', 'EXECUTED', 'CANCELLED', 'REJECTED')),
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(user_id) REFERENCES users(id)
);

-- Insert a default mock user if not exists
INSERT OR IGNORE INTO users (id, username, balance) VALUES (1, 'mock_trader', 1000000.0);

CREATE TABLE IF NOT EXISTS deposit_requests (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    amount REAL NOT NULL,
    status TEXT NOT NULL DEFAULT 'PENDING' CHECK(status IN ('PENDING', 'APPROVED', 'REJECTED')),
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(user_id) REFERENCES users(id)
);
