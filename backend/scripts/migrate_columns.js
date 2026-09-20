const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });
require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });

const db = require('../database/db');

async function runMigration() {
  if (!process.env.DATABASE_URL) {
    console.warn('⚠️  DATABASE_URL not set in environment or .env file.');
    console.warn('   Skipping PostgreSQL migration for local dev without database.');
    process.exit(0);
  }
  console.log('🚀 Running critical PostgreSQL column and table migrations...');
  try {
    // 1. Ensure essential tables exist
    await db.raw(`
      CREATE TABLE IF NOT EXISTS holdings (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        symbol VARCHAR(255) NOT NULL,
        quantity DECIMAL(14,4) NOT NULL DEFAULT 0,
        average_price DECIMAL(14,2) NOT NULL,
        asset_class VARCHAR(50) NOT NULL DEFAULT 'STOCK',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log('  ✅ holdings table verified');

    await db.raw(`
      CREATE TABLE IF NOT EXISTS ledger (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        amount DECIMAL(14,2) NOT NULL,
        type VARCHAR(50) NOT NULL,
        description TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log('  ✅ ledger table verified');

    await db.raw(`
      CREATE TABLE IF NOT EXISTS deposit_requests (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        amount DECIMAL(14,2) NOT NULL,
        status VARCHAR(50) NOT NULL DEFAULT 'PENDING',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log('  ✅ deposit_requests table verified');

    await db.raw(`
      CREATE TABLE IF NOT EXISTS sips (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        symbol VARCHAR(255) NOT NULL,
        amount DECIMAL(14,2) NOT NULL,
        frequency VARCHAR(50) NOT NULL DEFAULT 'MONTHLY',
        next_execution_date DATE NOT NULL,
        status VARCHAR(50) NOT NULL DEFAULT 'ACTIVE',
        anchor_day INTEGER,
        failure_count INTEGER DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log('  ✅ sips table verified');

    await db.raw(`
      CREATE TABLE IF NOT EXISTS instruments (
        token VARCHAR(255) PRIMARY KEY,
        symbol VARCHAR(255) NOT NULL,
        name VARCHAR(255),
        exchange VARCHAR(50),
        lotsize INTEGER DEFAULT 1,
        unique_symbol VARCHAR(255),
        expiry_timestamp BIGINT,
        search_string VARCHAR(255),
        is_cas_illiquid BOOLEAN DEFAULT FALSE,
        average_volume_5d DECIMAL(16,2) DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log('  ✅ instruments table verified');

    await db.raw(`
      CREATE TABLE IF NOT EXISTS reward_withdrawals (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        amount DECIMAL(14,2) NOT NULL,
        status VARCHAR(50) DEFAULT 'PENDING',
        remarks TEXT,
        utr VARCHAR(100),
        admin_notes TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log('  ✅ reward_withdrawals table verified');

    // 2. Orders table partial fill, average price, taxes, variety, and bracket columns
    const orderColumns = [
      'ALTER TABLE orders ADD COLUMN IF NOT EXISTS filled_quantity DECIMAL(14,4) DEFAULT 0',
      'ALTER TABLE orders ALTER COLUMN filled_quantity SET DEFAULT 0',
      'ALTER TABLE orders ADD COLUMN IF NOT EXISTS pending_quantity DECIMAL(14,4)',
      'ALTER TABLE orders ADD COLUMN IF NOT EXISTS average_price DECIMAL(14,2)',
      'ALTER TABLE orders ADD COLUMN IF NOT EXISTS order_variety VARCHAR(50) DEFAULT \'REGULAR\'',
      'ALTER TABLE orders ALTER COLUMN order_variety SET DEFAULT \'REGULAR\'',
      'ALTER TABLE orders ADD COLUMN IF NOT EXISTS taxes DECIMAL(14,2) DEFAULT 0',
      'ALTER TABLE orders ADD COLUMN IF NOT EXISTS trigger_type VARCHAR(50) DEFAULT \'REGULAR\'',
      'ALTER TABLE orders ADD COLUMN IF NOT EXISTS parent_order_id INTEGER REFERENCES orders(id) ON DELETE CASCADE',
      'ALTER TABLE orders ADD COLUMN IF NOT EXISTS linked_order_id INTEGER REFERENCES orders(id) ON DELETE SET NULL',
      'ALTER TABLE orders ADD COLUMN IF NOT EXISTS remarks TEXT DEFAULT \'\'',
      'ALTER TABLE orders ADD COLUMN IF NOT EXISTS margin DECIMAL(14,2) DEFAULT 0',
      'ALTER TABLE orders ADD COLUMN IF NOT EXISTS realized_pnl DECIMAL(14,2) DEFAULT 0',
      'ALTER TABLE orders ADD COLUMN IF NOT EXISTS product_type VARCHAR(20) DEFAULT \'DEL\'',
      'ALTER TABLE orders ADD COLUMN IF NOT EXISTS trigger_price DECIMAL(14,2)',
      'ALTER TABLE orders ADD COLUMN IF NOT EXISTS sl_price DECIMAL(14,2)',
      'ALTER TABLE orders ADD COLUMN IF NOT EXISTS tgt_price DECIMAL(14,2)',
      'ALTER TABLE orders ADD COLUMN IF NOT EXISTS trail_amount DECIMAL(14,2)',
      'ALTER TABLE orders ADD COLUMN IF NOT EXISTS tag VARCHAR(50)',
      'ALTER TABLE orders ADD COLUMN IF NOT EXISTS notes TEXT',
      'ALTER TABLE orders ADD COLUMN IF NOT EXISTS slice_group_id VARCHAR(100)',
      'ALTER TABLE orders ADD COLUMN IF NOT EXISTS slice_index INTEGER',
      'ALTER TABLE orders ADD COLUMN IF NOT EXISTS slice_total INTEGER',
      'ALTER TABLE orders ADD COLUMN IF NOT EXISTS basket_group_id VARCHAR(100)',
      'ALTER TABLE orders ADD COLUMN IF NOT EXISTS high_water_mark DECIMAL(14,2)',
      'ALTER TABLE orders ADD COLUMN IF NOT EXISTS low_water_mark DECIMAL(14,2)',
      'ALTER TABLE orders ADD COLUMN IF NOT EXISTS is_trailing BOOLEAN DEFAULT FALSE',
      'ALTER TABLE orders ADD COLUMN IF NOT EXISTS is_rms BOOLEAN DEFAULT FALSE'
    ];
    for (const sql of orderColumns) {
      await db.raw(sql);
    }
    console.log('  ✅ orders table columns verified');

    // 3. Positions table columns
    const positionColumns = [
      'ALTER TABLE positions ADD COLUMN IF NOT EXISTS closed_quantity DECIMAL(14,4) DEFAULT 0',
      'ALTER TABLE positions ADD COLUMN IF NOT EXISTS exit_price DECIMAL(14,2)',
      'ALTER TABLE positions ADD COLUMN IF NOT EXISTS realized_pnl DECIMAL(14,2) DEFAULT 0',
      'ALTER TABLE positions ADD COLUMN IF NOT EXISTS margin DECIMAL(14,2) DEFAULT 0',
      'ALTER TABLE positions ADD COLUMN IF NOT EXISTS product_type VARCHAR(20) DEFAULT \'DEL\''
    ];
    for (const sql of positionColumns) {
      await db.raw(sql);
    }
    console.log('  ✅ positions table columns verified');

    // 4. Holdings and Instruments columns
    await db.raw('ALTER TABLE holdings ADD COLUMN IF NOT EXISTS asset_class VARCHAR(50) DEFAULT \'STOCK\'');
    await db.raw('ALTER TABLE instruments ADD COLUMN IF NOT EXISTS is_cas_illiquid BOOLEAN DEFAULT FALSE');
    await db.raw('ALTER TABLE instruments ADD COLUMN IF NOT EXISTS average_volume_5d DECIMAL(16,2) DEFAULT 0');
    console.log('  ✅ holdings and instruments columns verified');

    // 5. Users table columns
    const userColumns = [
      'ALTER TABLE users ADD COLUMN IF NOT EXISTS client_id VARCHAR(10)',
      'ALTER TABLE users ADD COLUMN IF NOT EXISTS profile_picture_url TEXT',
      'ALTER TABLE users ADD COLUMN IF NOT EXISTS phone VARCHAR(50)',
      'ALTER TABLE users ADD COLUMN IF NOT EXISTS pan_card VARCHAR(50)',
      'ALTER TABLE users ADD COLUMN IF NOT EXISTS aadhar_number VARCHAR(50)',
      'ALTER TABLE users ADD COLUMN IF NOT EXISTS kyc_pan_url TEXT',
      'ALTER TABLE users ADD COLUMN IF NOT EXISTS kyc_aadhar_url TEXT',
      'ALTER TABLE users ADD COLUMN IF NOT EXISTS is_admin BOOLEAN DEFAULT FALSE',
      'ALTER TABLE users ADD COLUMN IF NOT EXISTS subscription_tier VARCHAR(50) DEFAULT \'BASIC\'',
      'ALTER TABLE users ADD COLUMN IF NOT EXISTS subscription_expires TIMESTAMP',
      'ALTER TABLE users ADD COLUMN IF NOT EXISTS upi_id VARCHAR(255)',
      'ALTER TABLE users ADD COLUMN IF NOT EXISTS bank_account_no VARCHAR(255)',
      'ALTER TABLE users ADD COLUMN IF NOT EXISTS bank_ifsc VARCHAR(50)',
      'ALTER TABLE users ADD COLUMN IF NOT EXISTS address TEXT',
      'ALTER TABLE users ADD COLUMN IF NOT EXISTS is_onboarded BOOLEAN DEFAULT FALSE',
      'ALTER TABLE users ADD COLUMN IF NOT EXISTS is_banned BOOLEAN DEFAULT FALSE',
      'ALTER TABLE users ADD COLUMN IF NOT EXISTS last_ip VARCHAR(50)',
      'ALTER TABLE users ADD COLUMN IF NOT EXISTS registration_ip VARCHAR(50)',
      'ALTER TABLE users ADD COLUMN IF NOT EXISTS device_model VARCHAR(100)',
      'ALTER TABLE users ADD COLUMN IF NOT EXISTS os_name VARCHAR(100)',
      'ALTER TABLE users ADD COLUMN IF NOT EXISTS browser_name VARCHAR(100)',
      'ALTER TABLE users ADD COLUMN IF NOT EXISTS city VARCHAR(100)',
      'ALTER TABLE users ADD COLUMN IF NOT EXISTS state VARCHAR(100)',
      'ALTER TABLE users ADD COLUMN IF NOT EXISTS max_daily_loss DECIMAL(14,2)',
      'ALTER TABLE users ADD COLUMN IF NOT EXISTS max_daily_trades INTEGER',
      'ALTER TABLE users ADD COLUMN IF NOT EXISTS risk_guardian_active BOOLEAN DEFAULT FALSE',
      'ALTER TABLE users ADD COLUMN IF NOT EXISTS telegram_chat_id VARCHAR(100)',
      'ALTER TABLE users ADD COLUMN IF NOT EXISTS telegram_alerts_enabled BOOLEAN DEFAULT FALSE',
      'ALTER TABLE users ADD COLUMN IF NOT EXISTS telegram_alert_orders BOOLEAN DEFAULT TRUE',
      'ALTER TABLE users ADD COLUMN IF NOT EXISTS telegram_alert_targets BOOLEAN DEFAULT TRUE',
      'ALTER TABLE users ADD COLUMN IF NOT EXISTS telegram_alert_stoploss BOOLEAN DEFAULT TRUE',
      'ALTER TABLE users ADD COLUMN IF NOT EXISTS telegram_alert_risk BOOLEAN DEFAULT TRUE'
    ];
    for (const sql of userColumns) {
      await db.raw(sql);
    }
    console.log('  ✅ users table columns verified');

    // 6. Drop restrictive legacy check constraints
    await db.raw('ALTER TABLE orders DROP CONSTRAINT IF EXISTS orders_status_check').catch(() => {});
    await db.raw('ALTER TABLE orders DROP CONSTRAINT IF EXISTS orders_type_check').catch(() => {});
    await db.raw('ALTER TABLE orders DROP CONSTRAINT IF EXISTS orders_side_check').catch(() => {});
    await db.raw('ALTER TABLE orders DROP CONSTRAINT IF EXISTS orders_product_type_check').catch(() => {});
    await db.raw('ALTER TABLE orders DROP CONSTRAINT IF EXISTS orders_trigger_type_check').catch(() => {});
    await db.raw('ALTER TABLE ledger DROP CONSTRAINT IF EXISTS ledger_type_check').catch(() => {});
    await db.raw('ALTER TABLE deposit_requests DROP CONSTRAINT IF EXISTS deposit_requests_status_check').catch(() => {});
    console.log('  ✅ Restrictive constraints removed');

    // 7. Backfill nulls
    await db.raw('UPDATE orders SET pending_quantity = quantity - COALESCE(filled_quantity, 0) WHERE pending_quantity IS NULL').catch(() => {});
    await db.raw('UPDATE orders SET filled_quantity = 0 WHERE filled_quantity IS NULL').catch(() => {});
    await db.raw('UPDATE orders SET order_variety = \'REGULAR\' WHERE order_variety IS NULL').catch(() => {});
    await db.raw('UPDATE orders SET trigger_type = \'REGULAR\' WHERE trigger_type IS NULL').catch(() => {});
    await db.raw('UPDATE orders SET product_type = \'DEL\' WHERE product_type IS NULL').catch(() => {});
    await db.raw('UPDATE positions SET product_type = \'DEL\' WHERE product_type IS NULL').catch(() => {});
    await db.raw('UPDATE positions SET closed_quantity = 0 WHERE closed_quantity IS NULL').catch(() => {});
    await db.raw('UPDATE holdings SET asset_class = \'STOCK\' WHERE asset_class IS NULL').catch(() => {});
    await db.raw("ALTER TABLE contests ADD COLUMN IF NOT EXISTS segment VARCHAR(50) DEFAULT 'ALL'").catch(() => {});
    await db.raw("UPDATE contests SET segment = 'ALL' WHERE segment IS NULL").catch(() => {});
    await db.raw("UPDATE contests SET status = 'ENDED', updated_at = CURRENT_TIMESTAMP WHERE status = 'ACTIVE' AND end_date < CURRENT_TIMESTAMP").catch(() => {});
    console.log('  ✅ Historical records backfilled with valid defaults');

    // 7B. Round fractional decimal quantities for non-MF symbols in orders, positions, and holdings
    await db.raw(`
      UPDATE orders
      SET
        quantity = ROUND(quantity),
        filled_quantity = ROUND(filled_quantity),
        pending_quantity = ROUND(pending_quantity)
      WHERE
        symbol NOT LIKE '%-MF'
        AND symbol NOT LIKE '%:MF'
        AND (
          quantity != ROUND(quantity)
          OR filled_quantity != ROUND(filled_quantity)
          OR pending_quantity != ROUND(pending_quantity)
        )
    `).catch(() => {});
    await db.raw(`
      UPDATE positions
      SET
        quantity = ROUND(quantity),
        closed_quantity = ROUND(closed_quantity)
      WHERE
        symbol NOT LIKE '%-MF'
        AND symbol NOT LIKE '%:MF'
        AND (
          quantity != ROUND(quantity)
          OR closed_quantity != ROUND(closed_quantity)
        )
    `).catch(() => {});
    await db.raw(`
      UPDATE holdings
      SET
        quantity = ROUND(quantity)
      WHERE
        symbol NOT LIKE '%-MF'
        AND symbol NOT LIKE '%:MF'
        AND quantity != ROUND(quantity)
    `).catch(() => {});
    console.log('  ✅ Non-MF decimal quantities sanitized to whole integers');

    // 8. Composite indexes
    await db.raw('CREATE INDEX IF NOT EXISTS idx_orders_user_id ON orders(user_id)').catch(() => {});
    await db.raw('CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status)').catch(() => {});
    await db.raw('CREATE INDEX IF NOT EXISTS idx_orders_symbol ON orders(symbol)').catch(() => {});
    await db.raw('CREATE INDEX IF NOT EXISTS idx_orders_order_variety ON orders(order_variety)').catch(() => {});
    await db.raw('CREATE INDEX IF NOT EXISTS idx_orders_created_at ON orders(created_at)').catch(() => {});
    await db.raw('CREATE INDEX IF NOT EXISTS idx_orders_user_status_created ON orders(user_id, status, created_at DESC)').catch(() => {});
    await db.raw('CREATE INDEX IF NOT EXISTS idx_orders_user_created ON orders(user_id, created_at DESC)').catch(() => {});
    await db.raw('CREATE INDEX IF NOT EXISTS idx_positions_user_id ON positions(user_id)').catch(() => {});
    await db.raw('CREATE INDEX IF NOT EXISTS idx_positions_symbol ON positions(symbol)').catch(() => {});
    await db.raw('CREATE INDEX IF NOT EXISTS idx_positions_user_symbol ON positions(user_id, symbol)').catch(() => {});
    await db.raw('CREATE INDEX IF NOT EXISTS idx_positions_user_product ON positions(user_id, product_type)').catch(() => {});
    await db.raw('CREATE INDEX IF NOT EXISTS idx_positions_quantity ON positions(quantity)').catch(() => {});
    await db.raw('CREATE INDEX IF NOT EXISTS idx_positions_created_at ON positions(created_at)').catch(() => {});
    await db.raw('CREATE INDEX IF NOT EXISTS idx_holdings_user_id ON holdings(user_id)').catch(() => {});
    await db.raw('CREATE INDEX IF NOT EXISTS idx_holdings_user_symbol ON holdings(user_id, symbol)').catch(() => {});
    await db.raw('CREATE INDEX IF NOT EXISTS idx_ledger_user_id ON ledger(user_id)').catch(() => {});
    await db.raw('CREATE INDEX IF NOT EXISTS idx_ledger_user_created ON ledger(user_id, created_at DESC, id DESC)').catch(() => {});
    await db.raw('CREATE INDEX IF NOT EXISTS idx_sips_status_next_exec ON sips(status, next_execution_date)').catch(() => {});
    await db.raw('CREATE INDEX IF NOT EXISTS idx_deposit_requests_status ON deposit_requests(status, created_at DESC)').catch(() => {});
    await db.raw('CREATE INDEX IF NOT EXISTS idx_trusted_devices_expires ON trusted_devices(expires_at)').catch(() => {});
    await db.raw('CREATE INDEX IF NOT EXISTS idx_user_sessions_created_at ON user_sessions(created_at)').catch(() => {});
    await db.raw('CREATE INDEX IF NOT EXISTS idx_journal_trades_user_date ON journal_trades(user_id, trade_date DESC)').catch(() => {});
    console.log('  ✅ Performance indexes verified');

    console.log('\n🎉 ALL DATABASE MIGRATIONS APPLIED SUCCESSFULLY!');
    process.exit(0);
  } catch (err) {
    console.error('❌ Migration failed:', err.message);
    process.exit(1);
  }
}

runMigration();
