const knex = require('knex');
const path = require('path');

// Determine environment
const isProduction = !!process.env.DATABASE_URL;

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
          table.string('profile_picture_url');
        });
        console.log('Added profile_picture_url to users table');
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
        table.decimal('average_price', 14, 2).notNullable();
        table.string('product_type').notNullable().defaultTo('DEL'); // INT, DEL
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
    }

    // 3. Orders Table
    const hasOrders = await db.schema.hasTable('orders');
    if (!hasOrders) {
      await db.schema.createTable('orders', table => {
        table.increments('id').primary();
        table.integer('user_id').unsigned().notNullable().references('id').inTable('users').onDelete('CASCADE');
        table.string('symbol').notNullable();
        table.string('type').notNullable(); // MARKET, LIMIT
        table.string('side').notNullable(); // BUY, SELL
        table.string('product_type').notNullable().defaultTo('DEL'); // INT, DEL
        table.integer('quantity').notNullable();
        table.decimal('price', 14, 2); // Nullable for MARKET orders
        table.string('status').notNullable().defaultTo('PENDING'); // PENDING, EXECUTED, CANCELLED, REJECTED
        table.decimal('sl_price', 14, 2);
        table.decimal('tgt_price', 14, 2);
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

      const hasMargin = await db.schema.hasColumn('orders', 'margin');
      if (!hasMargin) {
        await db.schema.alterTable('orders', table => {
          table.decimal('margin', 14, 2).defaultTo(0);
        });
        console.log('Added margin to orders table');
      }
    }

    // 4. Deposit Requests Table
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

initSchema();

module.exports = db;
