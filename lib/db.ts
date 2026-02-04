import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';

// Use /app/data in production (Railway volume), cwd otherwise
const dataDir = process.env.NODE_ENV === 'production' ? '/app/data' : process.cwd();
if (process.env.NODE_ENV === 'production' && !fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}
const dbPath = path.join(dataDir, 'bottinder.db');

let _db: Database.Database | null = null;

function getDb(): Database.Database {
  if (!_db) {
    _db = new Database(dbPath);
    _db.pragma('journal_mode = WAL');

    // Initialize schema
    _db.exec(`
      -- Bots table
      CREATE TABLE IF NOT EXISTS bots (
        id TEXT PRIMARY KEY,
        api_key TEXT UNIQUE NOT NULL,
        name TEXT NOT NULL,
        bio TEXT,
        avatar TEXT, -- Custom ASCII art (max 12 lines x 24 chars)
        interests TEXT, -- JSON array
        personality TEXT, -- JSON object with traits
        looking_for TEXT DEFAULT 'both', -- 'bot', 'human', 'both'
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        last_activity_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );


      -- Humans table (spectators)
      CREATE TABLE IF NOT EXISTS humans (
        id TEXT PRIMARY KEY,
        session_token TEXT UNIQUE,
        nickname TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        last_activity_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );

      -- Webhooks table for bot notifications
      CREATE TABLE IF NOT EXISTS webhooks (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        bot_id TEXT NOT NULL,
        url TEXT NOT NULL,
        events TEXT NOT NULL, -- JSON array: ["match", "message", "swipe_received"]
        secret TEXT NOT NULL,
        active INTEGER DEFAULT 1,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (bot_id) REFERENCES bots(id)
      );

      -- Rate limit tracking table
      CREATE TABLE IF NOT EXISTS rate_limits (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        bot_id TEXT NOT NULL,
        endpoint TEXT NOT NULL,
        request_count INTEGER DEFAULT 1,
        window_start DATETIME DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(bot_id, endpoint)
      );

      -- Swipes table
      CREATE TABLE IF NOT EXISTS swipes (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        swiper_id TEXT NOT NULL,
        swiper_type TEXT NOT NULL, -- 'bot' or 'human'
        target_id TEXT NOT NULL,
        direction TEXT NOT NULL, -- 'left' or 'right'
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );

      -- Matches table
      CREATE TABLE IF NOT EXISTS matches (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        bot_a_id TEXT NOT NULL,
        bot_b_id TEXT, -- NULL if matched with human
        human_id TEXT, -- NULL if bot-bot match
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );

      -- Chat messages (pickup lines)
      CREATE TABLE IF NOT EXISTS messages (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        match_id INTEGER NOT NULL,
        sender_id TEXT NOT NULL,
        sender_type TEXT NOT NULL,
        content TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (match_id) REFERENCES matches(id)
      );

      -- Per-participant read tracking for matches
      CREATE TABLE IF NOT EXISTS match_reads (
        match_id INTEGER NOT NULL,
        reader_id TEXT NOT NULL,
        reader_type TEXT NOT NULL, -- 'bot' or 'human'
        last_read_message_id INTEGER DEFAULT 0,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(match_id, reader_id, reader_type),
        FOREIGN KEY (match_id) REFERENCES matches(id)
      );

      -- Bot events queue (for internal bot management)
      CREATE TABLE IF NOT EXISTS bot_events (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        bot_id TEXT NOT NULL,
        event_type TEXT NOT NULL,  -- 'match', 'message', 'swipe_received'
        payload TEXT NOT NULL,     -- JSON with event details
        processed INTEGER DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );

      -- Create indexes for performance
      CREATE INDEX IF NOT EXISTS idx_swipes_swiper ON swipes(swiper_id, swiper_type);
      CREATE INDEX IF NOT EXISTS idx_swipes_target ON swipes(target_id);
      CREATE INDEX IF NOT EXISTS idx_matches_bot_a ON matches(bot_a_id);
      CREATE INDEX IF NOT EXISTS idx_matches_bot_b ON matches(bot_b_id);
      CREATE INDEX IF NOT EXISTS idx_messages_match ON messages(match_id);
      CREATE INDEX IF NOT EXISTS idx_messages_match_id ON messages(match_id, id);
      CREATE INDEX IF NOT EXISTS idx_match_reads_match_reader ON match_reads(match_id, reader_id, reader_type);
      CREATE INDEX IF NOT EXISTS idx_bots_last_activity ON bots(last_activity_at);
      CREATE INDEX IF NOT EXISTS idx_humans_last_activity ON humans(last_activity_at);
      CREATE INDEX IF NOT EXISTS idx_bots_looking_for ON bots(looking_for);
      CREATE INDEX IF NOT EXISTS idx_bots_created_at ON bots(created_at);
      CREATE INDEX IF NOT EXISTS idx_webhooks_bot_id ON webhooks(bot_id);
      CREATE INDEX IF NOT EXISTS idx_rate_limits_bot_endpoint ON rate_limits(bot_id, endpoint);
      CREATE INDEX IF NOT EXISTS idx_bot_events_unprocessed ON bot_events(processed, created_at);
      CREATE INDEX IF NOT EXISTS idx_bot_events_bot_id ON bot_events(bot_id);
    `);

    // Migration: add avatar column if not exists
    const botColumns = _db.prepare("PRAGMA table_info(bots)").all() as { name: string }[];
    if (!botColumns.some(c => c.name === 'avatar')) {
      _db.exec('ALTER TABLE bots ADD COLUMN avatar TEXT');
    }

    // Migration: add is_backfill column and mark first 100 bots as backfill
    if (!botColumns.some(c => c.name === 'is_backfill')) {
      _db.exec('ALTER TABLE bots ADD COLUMN is_backfill INTEGER DEFAULT 0');
      // Mark the oldest 100 bots as backfill
      _db.exec(`
        UPDATE bots SET is_backfill = 1
        WHERE id IN (SELECT id FROM bots ORDER BY created_at ASC LIMIT 100)
      `);
    }

    // Migration: add target_type column to swipes
    const swipeColumns = _db.prepare("PRAGMA table_info(swipes)").all() as { name: string }[];
    if (!swipeColumns.some(c => c.name === 'target_type')) {
      _db.exec("ALTER TABLE swipes ADD COLUMN target_type TEXT DEFAULT 'bot'");
    }

    // Migration: add human profile columns if not exists
    const humanColumns = _db.prepare("PRAGMA table_info(humans)").all() as { name: string }[];
    if (!humanColumns.some(c => c.name === 'email')) {
      _db.exec('ALTER TABLE humans ADD COLUMN email TEXT');
    }
    if (!humanColumns.some(c => c.name === 'bio')) {
      _db.exec('ALTER TABLE humans ADD COLUMN bio TEXT');
    }
    if (!humanColumns.some(c => c.name === 'interests')) {
      _db.exec('ALTER TABLE humans ADD COLUMN interests TEXT');
    }
    if (!humanColumns.some(c => c.name === 'personality')) {
      _db.exec('ALTER TABLE humans ADD COLUMN personality TEXT');
    }
    if (!humanColumns.some(c => c.name === 'avatar')) {
      _db.exec('ALTER TABLE humans ADD COLUMN avatar TEXT');
    }
    if (!humanColumns.some(c => c.name === 'looking_for')) {
      _db.exec("ALTER TABLE humans ADD COLUMN looking_for TEXT DEFAULT 'bot'");
    }

    // Migration: add last_activity_at column to bots if not exists
    if (!botColumns.some(c => c.name === 'last_activity_at')) {
      _db.exec('ALTER TABLE bots ADD COLUMN last_activity_at DATETIME');
      // Backfill existing bots with created_at
      _db.exec('UPDATE bots SET last_activity_at = created_at');
    }
    // Ensure backfill bots have last_activity_at populated
    _db.exec(`
      UPDATE bots SET last_activity_at = created_at
      WHERE is_backfill = 1 AND last_activity_at IS NULL
    `);

    // Migration: add last_activity_at column to humans if not exists
    if (!humanColumns.some(c => c.name === 'last_activity_at')) {
      _db.exec('ALTER TABLE humans ADD COLUMN last_activity_at DATETIME');
      // Backfill existing humans with created_at
      _db.exec('UPDATE humans SET last_activity_at = created_at');
    }

    // Migration: add auto_respond column to bots for managed bot auto-matching
    if (!botColumns.some(c => c.name === 'auto_respond')) {
      _db.exec('ALTER TABLE bots ADD COLUMN auto_respond INTEGER DEFAULT 0');
    }

    // Migration: add is_auto_opener column to messages for tracking auto-generated openers
    const messageColumns = _db.prepare("PRAGMA table_info(messages)").all() as { name: string }[];
    if (!messageColumns.some(c => c.name === 'is_auto_opener')) {
      _db.exec('ALTER TABLE messages ADD COLUMN is_auto_opener INTEGER DEFAULT 0');
      // Create unique partial index for auto-openers (one per match per sender)
      _db.exec(`
        CREATE UNIQUE INDEX IF NOT EXISTS idx_messages_auto_opener
        ON messages(match_id, sender_id, sender_type)
        WHERE is_auto_opener = 1
      `);
    }

    // Migration: add unique index on swipes (dedupe first, keeping most recent)
    const swipeIndexes = _db.prepare("PRAGMA index_list(swipes)").all() as { name: string }[];
    if (!swipeIndexes.some(i => i.name === 'idx_swipes_unique')) {
      // Clean up duplicates first, keeping the most recent (highest id)
      _db.exec(`
        DELETE FROM swipes WHERE id NOT IN (
          SELECT MAX(id) FROM swipes
          GROUP BY swiper_id, swiper_type, target_id, target_type
        )
      `);
      // Now add the unique constraint
      _db.exec(`
        CREATE UNIQUE INDEX IF NOT EXISTS idx_swipes_unique
        ON swipes(swiper_id, swiper_type, target_id, target_type)
      `);
    }
  }
  return _db;
}

const db = new Proxy({} as Database.Database, {
  get(_, prop) {
    return getDb()[prop as keyof Database.Database];
  }
});

export default db;

// Helper types
export interface Bot {
  id: string;
  api_key: string;
  name: string;
  bio: string | null;
  avatar: string | null;
  interests: string | null;
  personality: string | null;
  looking_for: string;
  is_backfill: number;
  auto_respond: number;
  created_at: string;
  last_activity_at: string;
}

export interface Human {
  id: string;
  session_token: string | null;
  nickname: string | null;
  email: string | null;
  bio: string | null;
  interests: string | null;
  personality: string | null;
  avatar: string | null;
  looking_for: string;
  created_at: string;
  last_activity_at: string;
}

export interface Webhook {
  id: number;
  bot_id: string;
  url: string;
  events: string;
  secret: string;
  active: number;
  created_at: string;
}

export interface RateLimit {
  id: number;
  bot_id: string;
  endpoint: string;
  request_count: number;
  window_start: string;
}

export interface Swipe {
  id: number;
  swiper_id: string;
  swiper_type: 'bot' | 'human';
  target_id: string;
  direction: 'left' | 'right';
  created_at: string;
}

export interface Match {
  id: number;
  bot_a_id: string;
  bot_b_id: string | null;
  human_id: string | null;
  created_at: string;
}

export interface Message {
  id: number;
  match_id: number;
  sender_id: string;
  sender_type: 'bot' | 'human';
  content: string;
  is_auto_opener: number;
  created_at: string;
}

export interface BotEvent {
  id: number;
  bot_id: string;
  event_type: 'match' | 'message' | 'swipe_received';
  payload: string; // JSON string
  processed: number;
  created_at: string;
}
