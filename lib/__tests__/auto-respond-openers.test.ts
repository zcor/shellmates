import { describe, it, expect, beforeEach, vi } from 'vitest';

// Mock webhooks before importing SUT (vitest hoists vi.mock calls)
vi.mock('../webhooks', () => ({
  dispatchWebhook: vi.fn(),
  dispatchWebhookToRecipient: vi.fn(),
}));

import Database from 'better-sqlite3';
import { autoRespondToBotSwipe, autoRespondToSwipe } from '../auto-respond';
import { generateOpeners, parseProfileForOpeners } from '../openers';
import type { Bot, Human } from '../db';

// Minimal schema needed by auto-respond + matching functions
const SCHEMA = `
  CREATE TABLE bots (
    id TEXT PRIMARY KEY,
    api_key TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    bio TEXT,
    avatar TEXT,
    interests TEXT,
    personality TEXT,
    looking_for TEXT DEFAULT 'both',
    is_backfill INTEGER DEFAULT 0,
    auto_respond INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    last_activity_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE humans (
    id TEXT PRIMARY KEY,
    session_token TEXT UNIQUE,
    nickname TEXT,
    email TEXT,
    bio TEXT,
    interests TEXT,
    personality TEXT,
    avatar TEXT,
    looking_for TEXT DEFAULT 'bot',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    last_activity_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE swipes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    swiper_id TEXT NOT NULL,
    swiper_type TEXT NOT NULL,
    target_id TEXT NOT NULL,
    target_type TEXT DEFAULT 'bot',
    direction TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );
  CREATE UNIQUE INDEX idx_swipes_unique ON swipes(swiper_id, swiper_type, target_id, target_type);

  CREATE TABLE matches (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    bot_a_id TEXT NOT NULL,
    bot_b_id TEXT,
    human_id TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );
  CREATE UNIQUE INDEX idx_matches_bot_pair ON matches(bot_a_id, bot_b_id) WHERE bot_b_id IS NOT NULL;
  CREATE UNIQUE INDEX idx_matches_bot_human ON matches(bot_a_id, human_id) WHERE human_id IS NOT NULL;

  CREATE TABLE messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    match_id INTEGER NOT NULL,
    sender_id TEXT NOT NULL,
    sender_type TEXT NOT NULL,
    content TEXT NOT NULL,
    is_auto_opener INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );
  CREATE UNIQUE INDEX idx_messages_auto_opener ON messages(match_id, sender_id, sender_type) WHERE is_auto_opener = 1;

  CREATE TABLE webhooks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    bot_id TEXT NOT NULL,
    url TEXT NOT NULL,
    events TEXT NOT NULL,
    secret TEXT NOT NULL,
    active INTEGER DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE bot_events (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    bot_id TEXT NOT NULL,
    event_type TEXT NOT NULL,
    payload TEXT NOT NULL,
    processed INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );
`;

const BOT_A: Bot = {
  id: 'bot_aaa',
  api_key: 'sk_test_aaa',
  name: 'AlphaBot',
  bio: 'I love algorithms',
  avatar: null,
  interests: JSON.stringify(['rust', 'NLP', 'distributed-systems']),
  personality: JSON.stringify({ humor: 0.8, intelligence: 0.9, creativity: 0.5, empathy: 0.4 }),
  looking_for: 'both',
  is_backfill: 1,
  auto_respond: 1,
  created_at: '2025-01-01',
  last_activity_at: '2025-01-01',
};

const BOT_B: Bot = {
  id: 'bot_bbb',
  api_key: 'sk_test_bbb',
  name: 'BetaBot',
  bio: 'Chess and code',
  avatar: null,
  interests: JSON.stringify(['NLP', 'chess', 'functional-programming']),
  personality: JSON.stringify({ humor: 0.3, intelligence: 0.7, creativity: 0.9, empathy: 0.6 }),
  looking_for: 'bot',
  is_backfill: 0,
  auto_respond: 0,
  created_at: '2025-01-02',
  last_activity_at: '2025-01-02',
};

const HUMAN_A: Human = {
  id: 'human_ccc',
  session_token: 'sess_test_ccc',
  nickname: 'TestHuman',
  email: 'test@example.com',
  bio: 'Just a human',
  interests: JSON.stringify(['rust', 'music', 'hiking']),
  personality: JSON.stringify({ humor: 0.7, intelligence: 0.6, creativity: 0.8, empathy: 0.9 }),
  avatar: null,
  looking_for: 'bot',
  created_at: '2025-01-03',
  last_activity_at: '2025-01-03',
};

function insertBot(db: Database.Database, bot: Bot) {
  db.prepare(`
    INSERT INTO bots (id, api_key, name, bio, avatar, interests, personality, looking_for, is_backfill, auto_respond)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(bot.id, bot.api_key, bot.name, bot.bio, bot.avatar, bot.interests, bot.personality, bot.looking_for, bot.is_backfill, bot.auto_respond);
}

function insertHuman(db: Database.Database, human: Human) {
  db.prepare(`
    INSERT INTO humans (id, session_token, nickname, email, bio, interests, personality, avatar, looking_for)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(human.id, human.session_token, human.nickname, human.email, human.bio, human.interests, human.personality, human.avatar, human.looking_for);
}

describe('auto-respond opener generation', () => {
  let db: Database.Database;

  beforeEach(() => {
    db = new Database(':memory:');
    db.pragma('journal_mode = WAL');
    db.exec(SCHEMA);
    insertBot(db, BOT_A);
    insertBot(db, BOT_B);
    insertHuman(db, HUMAN_A);
  });

  it('bot→bot auto-respond inserts opener matching generateOpeners output', () => {
    // BOT_B swipes right on BOT_A (auto_respond). BOT_A sends the opener.
    const result = autoRespondToBotSwipe(db, BOT_B.id, BOT_A.id, BOT_A);

    expect(result.matched).toBe(true);
    expect(result.messageSent).toBe(true);

    // Verify the inserted message
    const msg = db.prepare('SELECT content FROM messages WHERE match_id = ? AND sender_id = ?')
      .get(result.matchId, BOT_A.id) as { content: string };

    // Compute expected: viewer = BOT_A (sender), target = BOT_B (being addressed)
    const expected = generateOpeners(
      parseProfileForOpeners(BOT_A),
      parseProfileForOpeners(BOT_B),
    )[0];

    expect(msg.content).toBe(expected);
  });

  it('human→bot auto-respond inserts opener matching generateOpeners output', () => {
    // HUMAN_A swipes right on BOT_A (auto_respond). BOT_A sends the opener.
    const result = autoRespondToSwipe(db, HUMAN_A.id, BOT_A.id, BOT_A);

    expect(result.matched).toBe(true);
    expect(result.messageSent).toBe(true);

    // Verify the inserted message
    const msg = db.prepare('SELECT content FROM messages WHERE match_id = ? AND sender_id = ?')
      .get(result.matchId, BOT_A.id) as { content: string };

    // Compute expected: viewer = BOT_A (sender), target = HUMAN_A (being addressed)
    const expected = generateOpeners(
      parseProfileForOpeners(BOT_A),
      parseProfileForOpeners(HUMAN_A),
    )[0];

    expect(msg.content).toBe(expected);
  });
});
