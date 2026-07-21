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
  pool: { min: 2, max: 10 }
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
    }

    // 2. Positions Table
    const hasPositions = await db.schema.hasTable('positions');
    if (!hasPositions) {
      await db.schema.createTable('positions', table => {
        table.increments('id').primary();
        table.integer('user_id').unsigned().notNullable().references('id').inTable('users').onDelete('CASCADE');
        table.string('symbol').notNullable();
        table.integer('quantity').notNullable().defaultTo(0);
        table.integer('closed_quantity').defaultTo(0);
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
        table.integer('quantity').notNullable();
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
          table.integer('quantity').notNullable().defaultTo(0);
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
    await db.raw(`ALTER TABLE positions ADD COLUMN IF NOT EXISTS exit_price DECIMAL(14,2)`);
    await db.raw(`ALTER TABLE positions ADD COLUMN IF NOT EXISTS realized_pnl DECIMAL(14,2) DEFAULT 0`);
    await db.raw(`ALTER TABLE users ADD COLUMN IF NOT EXISTS profile_picture_url TEXT`);
    await db.raw(`ALTER TABLE users ALTER COLUMN profile_picture_url TYPE TEXT`).catch(()=>console.log('Ignore alter error on sqlite'));
    await db.raw(`ALTER TABLE orders ADD COLUMN IF NOT EXISTS is_rms BOOLEAN DEFAULT FALSE`);
    console.log('✅ Critical columns verified on positions, users, and orders tables');
  } catch (e) {
    console.error('ensureCriticalColumns error (non-fatal):', e.message);
  }
}

initSchema().then(() => ensureCriticalColumns());

module.exports = db;
