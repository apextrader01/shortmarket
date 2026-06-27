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
        table.timestamps(true, true); // created_at, updated_at
      });
      console.log('Created users table');
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
        table.timestamps(true, true);
      });
      console.log('Created positions table');
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
        table.integer('quantity').notNullable();
        table.decimal('price', 14, 2); // Nullable for MARKET orders
        table.string('status').notNullable().defaultTo('PENDING'); // PENDING, EXECUTED, CANCELLED, REJECTED
        table.decimal('sl_price', 14, 2);
        table.decimal('tgt_price', 14, 2);
        table.timestamps(true, true);
      });
      console.log('Created orders table');
    }

    // Check if we need to migrate existing better-sqlite3 data?
    // For simplicity, we just rely on the new schema since they were using mock_trader anyway.
  } catch (error) {
    console.error('Failed to initialize database schema:', error);
  }
}

initSchema();

module.exports = db;
