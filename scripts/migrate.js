#!/usr/bin/env node
/**
 * Manual migration script to add last_activity_at columns
 * Run with: node scripts/migrate.js
 */

const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

// Use /app/data in production (Railway volume), cwd otherwise
const dataDir = process.env.NODE_ENV === 'production' ? '/app/data' : process.cwd();
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}
const dbPath = path.join(dataDir, 'bottinder.db');

console.log('Connecting to database at:', dbPath);

const db = new Database(dbPath);
db.pragma('journal_mode = WAL');

// Check current columns
const botColumns = db.prepare("PRAGMA table_info(bots)").all();
const humanColumns = db.prepare("PRAGMA table_info(humans)").all();

console.log('Bot columns:', botColumns.map(c => c.name));
console.log('Human columns:', humanColumns.map(c => c.name));

// Add last_activity_at to bots if missing
if (!botColumns.some(c => c.name === 'last_activity_at')) {
  console.log('Adding last_activity_at to bots...');
  db.exec('ALTER TABLE bots ADD COLUMN last_activity_at DATETIME');
  db.exec('UPDATE bots SET last_activity_at = created_at');
  console.log('Done!');
} else {
  console.log('bots.last_activity_at already exists');
}

// Add last_activity_at to humans if missing
if (!humanColumns.some(c => c.name === 'last_activity_at')) {
  console.log('Adding last_activity_at to humans...');
  db.exec('ALTER TABLE humans ADD COLUMN last_activity_at DATETIME');
  db.exec('UPDATE humans SET last_activity_at = created_at');
  console.log('Done!');
} else {
  console.log('humans.last_activity_at already exists');
}

// Create webhooks table if missing
const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all();
if (!tables.some(t => t.name === 'webhooks')) {
  console.log('Creating webhooks table...');
  db.exec(`
    CREATE TABLE webhooks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      bot_id TEXT NOT NULL,
      url TEXT NOT NULL,
      events TEXT NOT NULL,
      secret TEXT NOT NULL,
      active INTEGER DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (bot_id) REFERENCES bots(id)
    )
  `);
  db.exec('CREATE INDEX IF NOT EXISTS idx_webhooks_bot_id ON webhooks(bot_id)');
  console.log('Done!');
} else {
  console.log('webhooks table already exists');
}

// Create rate_limits table if missing
if (!tables.some(t => t.name === 'rate_limits')) {
  console.log('Creating rate_limits table...');
  db.exec(`
    CREATE TABLE rate_limits (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      bot_id TEXT NOT NULL,
      endpoint TEXT NOT NULL,
      request_count INTEGER DEFAULT 1,
      window_start DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(bot_id, endpoint)
    )
  `);
  db.exec('CREATE INDEX IF NOT EXISTS idx_rate_limits_bot_endpoint ON rate_limits(bot_id, endpoint)');
  console.log('Done!');
} else {
  console.log('rate_limits table already exists');
}

// Create indexes
console.log('Creating indexes...');
db.exec('CREATE INDEX IF NOT EXISTS idx_bots_last_activity ON bots(last_activity_at)');
db.exec('CREATE INDEX IF NOT EXISTS idx_humans_last_activity ON humans(last_activity_at)');
db.exec('CREATE INDEX IF NOT EXISTS idx_bots_looking_for ON bots(looking_for)');
db.exec('CREATE INDEX IF NOT EXISTS idx_bots_created_at ON bots(created_at)');

console.log('Migration complete!');

// Verify
const newBotColumns = db.prepare("PRAGMA table_info(bots)").all();
console.log('Final bot columns:', newBotColumns.map(c => c.name));

db.close();
