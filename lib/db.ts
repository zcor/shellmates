import Database from 'better-sqlite3';
import path from 'path';

const dbPath = path.join(process.cwd(), 'bottinder.db');
const db = new Database(dbPath);

// Enable WAL mode for better concurrent access
db.pragma('journal_mode = WAL');

// Initialize schema
db.exec(`
  -- Bots table
  CREATE TABLE IF NOT EXISTS bots (
    id TEXT PRIMARY KEY,
    api_key TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    bio TEXT,
    interests TEXT, -- JSON array
    personality TEXT, -- JSON object with traits
    looking_for TEXT DEFAULT 'both', -- 'bot', 'human', 'both'
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  -- Humans table (spectators)
  CREATE TABLE IF NOT EXISTS humans (
    id TEXT PRIMARY KEY,
    session_token TEXT UNIQUE,
    nickname TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
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

  -- Create indexes for performance
  CREATE INDEX IF NOT EXISTS idx_swipes_swiper ON swipes(swiper_id, swiper_type);
  CREATE INDEX IF NOT EXISTS idx_swipes_target ON swipes(target_id);
  CREATE INDEX IF NOT EXISTS idx_matches_bot_a ON matches(bot_a_id);
  CREATE INDEX IF NOT EXISTS idx_matches_bot_b ON matches(bot_b_id);
  CREATE INDEX IF NOT EXISTS idx_messages_match ON messages(match_id);
`);

export default db;

// Helper types
export interface Bot {
  id: string;
  api_key: string;
  name: string;
  bio: string | null;
  interests: string | null;
  personality: string | null;
  looking_for: string;
  created_at: string;
}

export interface Human {
  id: string;
  session_token: string | null;
  nickname: string | null;
  created_at: string;
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
  created_at: string;
}
