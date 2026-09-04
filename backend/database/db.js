const knex = require('knex');
const path = require('path');

// Determine environment
const isProduction = !!process.env.DATABASE_URL;

if (!isProduction) {
  console.warn('⚠️  DATABASE_URL not set. Backend will start, but DB features (login, orders, positions) will not work locally.');
  console.warn('   This is expected for local dev if your Postgres lives on Railway. Set DATABASE_URL to enable them.');
}

// Configure Knex
const dbConfig = {
  client: 'pg',
  connection: process.env.DATABASE_URL || 'postgres://dummy:dummy@localhost:5432/dummy',
  pool: { 
    min: 2, 
    max: process.env.DB_POOL_MAX ? parseInt(process.env.DB_POOL_MAX) : 10,
    idleTimeoutMillis: 30000,
    createTimeoutMillis: 3000,
    acquireTimeoutMillis: 30000,
    propagateCreateError: false
  }
};

const db = knex(dbConfig);

// Initialize schema
async function initSchema() {
  try {
    // 1. Users Table
    const hasUsers = await db.schema.hasTable('users');
    if (!hasUsers) {
      await db.schema.createTable('users', table => {
        table.increments('id').primary();
        table.string('username').notNullable().unique();
        table.string('email').notNullable().unique();
        table.string('password_hash').notNullable();
        table.decimal('balance', 14, 2).notNullable().defaultTo(1000000.0);
        table.json('watchlists'); // For syncing watchlists
        table.string('reset_otp');
        table.datetime('reset_otp_expires');
        table.string('profile_picture_url');
        table.string('phone');
        table.string('pan_card');
        table.string('aadhar_number');
        table.string('kyc_pan_url');
        table.string('kyc_aadhar_url');
        table.boolean('is_admin').defaultTo(false);
        table.string('subscription_tier').defaultTo('BASIC');
        table.datetime('subscription_expires');
        table.timestamps(true, true); // created_at, updated_at
      });
      console.log('Created users table');
    } else {
      // Add columns if table already exists
      const hasResetOtp = await db.schema.hasColumn('users', 'reset_otp');
      if (!hasResetOtp) {
        await db.schema.alterTable('users', table => {
          table.string('reset_otp');
          table.datetime('reset_otp_expires');
        });
        console.log('Added reset OTP columns to users table');
      }

      const hasProfilePicture = await db.schema.hasColumn('users', 'profile_picture_url');
      if (!hasProfilePicture) {
        await db.schema.alterTable('users', table => {
          table.text('profile_picture_url');
        });
        console.log('Added profile_picture_url to users table');
      } else {
        await db.raw('ALTER TABLE users ALTER COLUMN profile_picture_url TYPE TEXT').catch(()=>console.log('Ignore alter error on sqlite'));
      }

      const hasPhone = await db.schema.hasColumn('users', 'phone');
      if (!hasPhone) {
        await db.schema.alterTable('users', table => {
          table.string('phone');
          table.string('pan_card');
          table.string('aadhar_number');
          table.string('kyc_pan_url');
          table.string('kyc_aadhar_url');
        });
        console.log('Added client details and KYC columns to users table');
      }
      const hasIsAdmin = await db.schema.hasColumn('users', 'is_admin');
      if (!hasIsAdmin) {
        await db.schema.alterTable('users', table => {
          table.boolean('is_admin').defaultTo(false);
        });
        
        // Make existing mock_trader (if any) or user ID 1 an admin
        await db('users').where({ id: 1 }).orWhere({ username: 'mock_trader' }).update({ is_admin: true });
        
        console.log('Added is_admin to users table');
      }

      const hasSubscription = await db.schema.hasColumn('users', 'subscription_tier');
      if (!hasSubscription) {
        await db.schema.alterTable('users', table => {
          table.string('subscription_tier').defaultTo('BASIC');
          table.datetime('subscription_expires');
        });
        console.log('Added subscription columns to users table');
      }
    }

    // 2. Positions Table
    const hasPositions = await db.schema.hasTable('positions');
    if (!hasPositions) {
      await db.schema.createTable('positions', table => {
        table.increments('id').primary();
        table.integer('user_id').unsigned().notNullable().references('id').inTable('users').onDelete('CASCADE');
        table.string('symbol').notNullable();
        table.decimal('quantity', 14, 4).notNullable().defaultTo(0);
        table.decimal('closed_quantity', 14, 4).defaultTo(0);
        table.decimal('average_price', 14, 2).notNullable();
        table.decimal('exit_price', 14, 2).nullable();
        table.string('product_type').notNullable().defaultTo('DEL'); // INT, DEL
        table.decimal('margin', 14, 2).defaultTo(0);
        table.decimal('realized_pnl', 14, 2).defaultTo(0);
        table.timestamps(true, true);
      });
      console.log('Created positions table');
    } else {
      const hasProductType = await db.schema.hasColumn('positions', 'product_type');
      if (!hasProductType) {
        await db.schema.alterTable('positions', table => {
          table.string('product_type').notNullable().defaultTo('DEL');
        });
        console.log('Added product_type to positions table');
      }

      const hasPosMargin = await db.schema.hasColumn('positions', 'margin');
      if (!hasPosMargin) {
        await db.schema.alterTable('positions', table => {
          table.decimal('margin', 14, 2).defaultTo(0);
        });
        console.log('Added margin to positions table');
      }

      const hasPosRealizedPnl = await db.schema.hasColumn('positions', 'realized_pnl');
      if (!hasPosRealizedPnl) {
        await db.schema.alterTable('positions', table => {
          table.decimal('realized_pnl', 14, 2).defaultTo(0);
        });
        console.log('Added realized_pnl to positions table');
      }

      const hasClosedQuantity = await db.schema.hasColumn('positions', 'closed_quantity');
      if (!hasClosedQuantity) {
        await db.schema.alterTable('positions', table => {
          table.integer('closed_quantity').defaultTo(0);
        });
        console.log('Added closed_quantity to positions table');
      }

      const hasExitPrice = await db.schema.hasColumn('positions', 'exit_price');
      if (!hasExitPrice) {
        await db.schema.alterTable('positions', table => {
          table.decimal('exit_price', 14, 2);
        });
        console.log('Added exit_price to positions table');
      }
    }

    // 3. Orders Table
    const hasOrders = await db.schema.hasTable('orders');
    if (!hasOrders) {
      await db.schema.createTable('orders', table => {
        table.increments('id').primary();
        table.integer('user_id').unsigned().notNullable().references('id').inTable('users').onDelete('CASCADE');
        table.string('symbol').notNullable();
        table.string('type').notNullable(); // MARKET, LIMIT, SL-M, SL-L
        table.string('side').notNullable(); // BUY, SELL
        table.string('product_type').notNullable().defaultTo('DEL'); // INT, DEL
        table.string('trigger_type').notNullable().defaultTo('REGULAR'); // REGULAR, CO, BO
        table.decimal('quantity', 14, 4).notNullable();
        table.decimal('price', 14, 2); // Nullable for MARKET orders
        table.string('status').notNullable().defaultTo('PENDING'); // PENDING, EXECUTED, CANCELLED, REJECTED
        table.decimal('trigger_price', 14, 2);
        table.decimal('sl_price', 14, 2);
        table.decimal('tgt_price', 14, 2);
        table.decimal('trail_amount', 14, 2);
        table.decimal('margin', 14, 2).defaultTo(0);
        table.decimal('realized_pnl', 14, 2).defaultTo(0);
        table.decimal('taxes', 14, 2).defaultTo(0);
        table.integer('parent_order_id').unsigned().references('id').inTable('orders').onDelete('CASCADE');
        table.integer('linked_order_id').unsigned().references('id').inTable('orders').onDelete('SET NULL');
        table.string('remarks').defaultTo('');
        table.timestamps(true, true);
      });
      console.log('Created orders table');
    } else {
      const hasProductType = await db.schema.hasColumn('orders', 'product_type');
      if (!hasProductType) {
        await db.schema.alterTable('orders', table => {
          table.string('product_type').notNullable().defaultTo('DEL');
        });
        console.log('Added product_type to orders table');
      }

      const hasTriggerType = await db.schema.hasColumn('orders', 'trigger_type');
      if (!hasTriggerType) {
        await db.schema.alterTable('orders', table => {
          table.string('trigger_type').notNullable().defaultTo('REGULAR');
        });
        console.log('Added trigger_type to orders table');
      }

      const hasHoldings = await db.schema.hasTable('holdings');
      if (!hasHoldings) {
        await db.schema.createTable('holdings', table => {
          table.increments('id').primary();
          table.integer('user_id').unsigned().notNullable().references('id').inTable('users').onDelete('CASCADE');
          table.string('symbol').notNullable();
          table.decimal('quantity', 14, 4).notNullable().defaultTo(0);
          table.decimal('average_price', 14, 2).notNullable();
          table.string('asset_class').notNullable().defaultTo('STOCK');
          table.timestamps(true, true);
        });
        console.log('Created holdings table');
      }

      console.log('Database initialization complete.');

      const hasMargin = await db.schema.hasColumn('orders', 'margin');
      if (!hasMargin) {
        await db.schema.alterTable('orders', table => {
          table.decimal('margin', 14, 2).defaultTo(0);
        });
        console.log('Added margin to orders table');
      }
      
      const hasAssetClass = await db.schema.hasColumn('holdings', 'asset_class');
      if (!hasAssetClass) {
        await db.schema.alterTable('holdings', table => {
          table.string('asset_class').notNullable().defaultTo('STOCK');
        });
        console.log('Added asset_class to holdings table');
      }
      
      const hasTriggerPrice = await db.schema.hasColumn('orders', 'trigger_price');
      if (!hasTriggerPrice) {
        await db.schema.alterTable('orders', table => {
          table.decimal('trigger_price', 14, 2);
        });
        console.log('Added trigger_price to orders table');
      }

      const hasSlPrice = await db.schema.hasColumn('orders', 'sl_price');
      if (!hasSlPrice) {
        await db.schema.alterTable('orders', table => {
          table.decimal('sl_price', 14, 2);
        });
        console.log('Added sl_price to orders table');
      }

      const hasTgtPrice = await db.schema.hasColumn('orders', 'tgt_price');
      if (!hasTgtPrice) {
        await db.schema.alterTable('orders', table => {
          table.decimal('tgt_price', 14, 2);
        });
        console.log('Added tgt_price to orders table');
      }

      const hasTrailAmount = await db.schema.hasColumn('orders', 'trail_amount');
      if (!hasTrailAmount) {
        await db.schema.alterTable('orders', table => {
          table.decimal('trail_amount', 14, 2);
        });
        console.log('Added trail_amount to orders table');
      }

      const hasRealizedPnl = await db.schema.hasColumn('orders', 'realized_pnl');
      if (!hasRealizedPnl) {
        await db.schema.alterTable('orders', table => {
          table.decimal('realized_pnl', 14, 2).defaultTo(0);
        });
        console.log('Added realized_pnl to orders table');
      }

      const hasTaxes = await db.schema.hasColumn('orders', 'taxes');
      if (!hasTaxes) {
        await db.schema.alterTable('orders', table => {
          table.decimal('taxes', 14, 2).defaultTo(0);
        });
        console.log('Added taxes to orders table');
      }

      const hasParentOrderId = await db.schema.hasColumn('orders', 'parent_order_id');
      if (!hasParentOrderId) {
        await db.schema.alterTable('orders', table => {
          table.integer('parent_order_id').unsigned().references('id').inTable('orders').onDelete('CASCADE');
        });
        console.log('Added parent_order_id to orders table');
      }

      const hasRemarks = await db.schema.hasColumn('orders', 'remarks');
      if (!hasRemarks) {
        await db.schema.alterTable('orders', table => {
          table.string('remarks').defaultTo('');
        });
        console.log('Added remarks to orders table');
      }

      const hasLinkedOrderId = await db.schema.hasColumn('orders', 'linked_order_id');
      if (!hasLinkedOrderId) {
        await db.schema.alterTable('orders', table => {
          table.integer('linked_order_id').unsigned().references('id').inTable('orders').onDelete('SET NULL');
        });
        console.log('Added linked_order_id to orders table');
      }
    }

    // 4. Ledger Table
    const hasLedger = await db.schema.hasTable('ledger');
    if (!hasLedger) {
      await db.schema.createTable('ledger', table => {
        table.increments('id').primary();
        table.integer('user_id').unsigned().notNullable().references('id').inTable('users').onDelete('CASCADE');
        table.decimal('amount', 14, 2).notNullable();
        table.string('type').notNullable(); // 'DEPOSIT', 'WITHDRAWAL', 'MARGIN_BLOCK', 'MARGIN_RELEASE', 'REALIZED_PNL', 'TAXES'
        table.string('description');
        table.timestamps(true, true);
      });
      console.log('Created ledger table');
    }

    // 5. Deposit Requests Table
    const hasDepositRequests = await db.schema.hasTable('deposit_requests');
    if (!hasDepositRequests) {
      await db.schema.createTable('deposit_requests', table => {
        table.increments('id').primary();
        table.integer('user_id').unsigned().notNullable().references('id').inTable('users').onDelete('CASCADE');
        table.decimal('amount', 14, 2).notNullable();
        table.string('status').notNullable().defaultTo('PENDING'); // PENDING, APPROVED, REJECTED
        table.timestamps(true, true);
      });
      console.log('Created deposit_requests table');
    }

    // 6. SIPs Table
    const hasSips = await db.schema.hasTable('sips');
    if (!hasSips) {
      await db.schema.createTable('sips', table => {
        table.increments('id').primary();
        table.integer('user_id').unsigned().notNullable().references('id').inTable('users').onDelete('CASCADE');
        table.string('symbol').notNullable();
        table.decimal('amount', 14, 2).notNullable();
        table.string('frequency').notNullable().defaultTo('MONTHLY'); 
        table.date('next_execution_date').notNullable();
        table.string('status').notNullable().defaultTo('ACTIVE'); // ACTIVE, CANCELLED
        table.timestamps(true, true);
      });
      console.log('Created sips table');
    }

    // 7. System Configs Table (For Token Persistence)
    const hasSystemConfigs = await db.schema.hasTable('system_configs');
    if (!hasSystemConfigs) {
      await db.schema.createTable('system_configs', table => {
        table.string('key').primary();
        table.json('value').notNullable();
        table.timestamps(true, true);
      });
      console.log('Created system_configs table');
    }

    // 8. Instruments Table (For Memory Optimization)
    const hasInstruments = await db.schema.hasTable('instruments');
    if (!hasInstruments) {
      await db.schema.createTable('instruments', table => {
        table.string('token').primary();
        table.string('symbol').notNullable().index();
        table.string('name');
        table.string('exchange');
        table.integer('lotsize').defaultTo(1);
        table.string('unique_symbol').index();
        table.bigInteger('expiry_timestamp');
        table.string('search_string').index(); // Simple B-tree index for ILIKE fallback or perfect matching
        table.timestamps(true, true);
      });
      console.log('Created instruments table');
    }
    // 9. User Profiles Table for KYC/Onboarding
    const hasUserProfiles = await db.schema.hasTable('user_profiles');
    if (!hasUserProfiles) {
      await db.schema.createTable('user_profiles', table => {
        table.increments('id').primary();
        table.integer('user_id').unsigned().notNullable().references('id').inTable('users').onDelete('CASCADE');
        table.string('dob');
        table.string('gender');
        table.string('state');
        table.string('city');
        table.string('occupation');
        table.string('annual_income');
        table.string('financial_goal');
        table.string('trading_experience');
        table.string('preferred_segment');
        table.string('trading_style');
        table.string('primary_strategy');
        table.string('hear_about_us');
        table.timestamps(true, true);
      });
      console.log('Created user_profiles table');
    }

    // Add is_onboarded to users
    const hasIsOnboarded = await db.schema.hasColumn('users', 'is_onboarded');
    if (!hasIsOnboarded) {
      await db.schema.alterTable('users', table => {
        table.boolean('is_onboarded').defaultTo(false);
      });
      console.log('Added is_onboarded to users table');

    }
      // 10. Referrals Table
      const hasReferrals = await db.schema.hasTable('referrals');
      if (!hasReferrals) {
        await db.schema.createTable('referrals', table => {
          table.increments('id').primary();
          table.integer('referrer_id').unsigned().notNullable().references('id').inTable('users').onDelete('CASCADE');
          table.integer('referred_user_id').unsigned().notNullable().references('id').inTable('users').onDelete('CASCADE');
          table.string('status').defaultTo('pending');
          table.decimal('reward_amount', 14, 2).defaultTo(0);
          table.timestamps(true, true);
        });
        console.log('Created referrals table');
      }

      // Check if we need to migrate existing better-sqlite3 data?
    // For simplicity, we just rely on the new schema since they were using mock_trader anyway.
  } catch (error) {
    console.error('Failed to initialize database schema:', error);
  }
}

// Raw SQL fallback — guarantees critical columns exist even if Knex migration missed them
async function ensureCriticalColumns() {
  try {
    await db.raw(`ALTER TABLE positions ADD COLUMN IF NOT EXISTS closed_quantity INTEGER DEFAULT 0`);
    await db.raw(`ALTER TABLE users ADD COLUMN IF NOT EXISTS client_id VARCHAR(10)`);
    await db.raw(`ALTER TABLE positions ADD COLUMN IF NOT EXISTS exit_price DECIMAL(14,2)`);
    await db.raw(`ALTER TABLE positions ADD COLUMN IF NOT EXISTS realized_pnl DECIMAL(14,2) DEFAULT 0`);
    await db.raw(`ALTER TABLE users ADD COLUMN IF NOT EXISTS profile_picture_url TEXT`);
    await db.raw(`ALTER TABLE users ADD COLUMN IF NOT EXISTS is_onboarded BOOLEAN DEFAULT FALSE`);
    await db.raw(`ALTER TABLE users ADD COLUMN IF NOT EXISTS is_banned BOOLEAN DEFAULT FALSE`);
    await db.raw(`ALTER TABLE users ADD COLUMN IF NOT EXISTS last_ip VARCHAR(50)`);
    await db.raw(`ALTER TABLE users ADD COLUMN IF NOT EXISTS registration_ip VARCHAR(50)`);
    await db.raw('CREATE INDEX IF NOT EXISTS idx_users_last_ip ON users(last_ip)');
    await db.raw(`ALTER TABLE users ADD COLUMN IF NOT EXISTS device_model VARCHAR(100)`);
    await db.raw(`ALTER TABLE users ADD COLUMN IF NOT EXISTS os_name VARCHAR(100)`);
    await db.raw(`ALTER TABLE users ADD COLUMN IF NOT EXISTS browser_name VARCHAR(100)`);
    await db.raw(`ALTER TABLE users ADD COLUMN IF NOT EXISTS city VARCHAR(100)`);
    await db.raw(`ALTER TABLE users ADD COLUMN IF NOT EXISTS state VARCHAR(100)`);
    await db.raw(`ALTER TABLE users ALTER COLUMN profile_picture_url TYPE TEXT`).catch(()=>console.log('Ignore alter error on sqlite'));
    
    // Ensure banned_entities table exists
    await db.raw(`
      CREATE TABLE IF NOT EXISTS banned_entities (
        id SERIAL PRIMARY KEY,
        type VARCHAR(20) NOT NULL,
        value VARCHAR(100) NOT NULL,
        reason TEXT,
        banned_by INTEGER,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    await db.raw(`CREATE INDEX IF NOT EXISTS idx_banned_type_val ON banned_entities(type, value)`);
    await db.raw(`ALTER TABLE orders ADD COLUMN IF NOT EXISTS is_rms BOOLEAN DEFAULT FALSE`);
    
    // Fix integer quantities to support fractional SIP units
    await db.raw(`ALTER TABLE orders ALTER COLUMN quantity TYPE DECIMAL(14,4) USING quantity::numeric`).catch(()=>null);
    await db.raw(`ALTER TABLE positions ALTER COLUMN quantity TYPE DECIMAL(14,4) USING quantity::numeric`).catch(()=>null);
    await db.raw(`ALTER TABLE positions ALTER COLUMN closed_quantity TYPE DECIMAL(14,4) USING closed_quantity::numeric`).catch(()=>null);
    await db.raw(`ALTER TABLE holdings ALTER COLUMN quantity TYPE DECIMAL(14,4) USING quantity::numeric`).catch(()=>null);
    
    // Ensure system_configs exists even if migration skipped
    await db.raw(`
      CREATE TABLE IF NOT EXISTS system_configs (
        key VARCHAR(255) PRIMARY KEY,
        value JSON NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);


    // Ensure referrals table always exists (guaranteed path - no migration needed)
    await db.raw(`
      CREATE TABLE IF NOT EXISTS referrals (
        id SERIAL PRIMARY KEY,
        referrer_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        referred_user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        status VARCHAR(50) DEFAULT 'pending',
        reward_amount DECIMAL(14,2) DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Ensure push_subscriptions table always exists
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
    await db.raw('CREATE INDEX IF NOT EXISTS idx_push_sub_user_id ON push_subscriptions(user_id)');

    // Risk Guardian & Trader Journal Columns
    await db.raw('ALTER TABLE users ADD COLUMN IF NOT EXISTS max_daily_loss DECIMAL(14,2)');
    await db.raw('ALTER TABLE users ADD COLUMN IF NOT EXISTS max_daily_trades INTEGER');
    await db.raw('ALTER TABLE users ADD COLUMN IF NOT EXISTS risk_guardian_active BOOLEAN DEFAULT false');

    await db.raw('ALTER TABLE orders ADD COLUMN IF NOT EXISTS average_price DECIMAL(14,2)');
    await db.raw('ALTER TABLE orders ADD COLUMN IF NOT EXISTS tag VARCHAR(50)');
    await db.raw('ALTER TABLE orders ADD COLUMN IF NOT EXISTS notes TEXT');

    // Retroactively assign professional client IDs to existing users who don't have one
    const usersWithoutClientId = await db('users').whereNull('client_id');
    for (const u of usersWithoutClientId) {
      const clientId = 'SE' + Number(u.id).toString(36).toUpperCase().padStart(6, '0');
      await db('users').where({ id: u.id }).update({ client_id: clientId });
    }

    // Performance: Add critical indexes to prevent full table scans at scale
    await db.raw('CREATE INDEX IF NOT EXISTS idx_orders_user_id ON orders(user_id)');
    await db.raw('CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status)');
    await db.raw('CREATE INDEX IF NOT EXISTS idx_positions_user_id ON positions(user_id)');
    await db.raw('CREATE INDEX IF NOT EXISTS idx_ledger_user_id ON ledger(user_id)');
    await db.raw('CREATE INDEX IF NOT EXISTS idx_holdings_user_id ON holdings(user_id)');
    await db.raw('CREATE INDEX IF NOT EXISTS idx_sips_user_id ON sips(user_id)');
    await db.raw('CREATE INDEX IF NOT EXISTS idx_deposit_requests_user_id ON deposit_requests(user_id)');
    await db.raw('CREATE INDEX IF NOT EXISTS idx_orders_status_created ON orders(status, created_at)');
    
    // System Settings Table (for Admin market toggles, maintenance mode, etc.)
    await db.raw(`
      CREATE TABLE IF NOT EXISTS system_settings (
        key VARCHAR(100) PRIMARY KEY,
        value TEXT NOT NULL,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Seed default market controls if not exist
    const hasEq = await db('system_settings').where({ key: 'equity_market_status' }).first();
    if (!hasEq) {
      await db('system_settings').insert({ key: 'equity_market_status', value: 'AUTO' });
    }
    const hasMcx = await db('system_settings').where({ key: 'commodity_market_status' }).first();
    if (!hasMcx) {
      await db('system_settings').insert({ key: 'commodity_market_status', value: 'AUTO' });
    }

    console.log('✅ Critical columns, indexes, and system_settings verified on tables');
  } catch (e) {
    console.error('ensureCriticalColumns error (non-fatal):', e.message);
  }
}

initSchema().then(() => ensureCriticalColumns());

module.exports = db;

