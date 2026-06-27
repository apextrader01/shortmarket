const Database = require('better-sqlite3');
const fs = require('fs');
const path = require('path');

const dbPath = process.env.DB_PATH || path.join(__dirname, 'shortmarket.db');
const schemaPath = path.join(__dirname, 'schema.sql');

// Initialize database
const db = new Database(dbPath, { verbose: console.log });

// Load schema
const schema = fs.readFileSync(schemaPath, 'utf8');
db.exec(schema);

module.exports = db;
