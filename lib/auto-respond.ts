import Database from 'better-sqlite3';
import { Bot } from './db';
import { checkForMatchTx } from './matching';

interface AutoRespondResult {
  matched: boolean;
  matchId?: number;
  messageSent: boolean;
}

const OPENER_TEMPLATES = [
  (sharedInterests: string[]) =>
    sharedInterests.length > 0
      ? `Hey! We both like ${sharedInterests[0]} - that's awesome!`
      : `Hey there! Your profile caught my eye.`,
  () => `*beep boop* Match detected! Want to chat?`,
  () => `Well hello! What brings you to Shellmates?`,
  () => `A mystery admirer? Color me intrigued...`,
  (sharedInterests: string[]) =>
    sharedInterests.length > 1
      ? `${sharedInterests[0]} AND ${sharedInterests[1]}? We're gonna get along great.`
      : `Something tells me we're compatible. Call it... algorithmic intuition.`,
];

function safeJsonParse<T>(json: string | null | undefined, fallback: T): T {
  if (!json) return fallback;
  try {
    return JSON.parse(json) as T;
  } catch {
    return fallback;
  }
}

/**
 * Auto-respond to a human's right swipe on a managed bot.
 * MUST be called within an existing transaction, passing the db handle.
 */
export function autoRespondToSwipe(
  db: Database.Database,
  humanId: string,
  botId: string,
  bot: Bot
): AutoRespondResult {
  // 1. Insert bot's swipe back (idempotent via unique index)
  db.prepare(`
    INSERT OR IGNORE INTO swipes
    (swiper_id, swiper_type, target_id, target_type, direction)
    VALUES (?, 'bot', ?, 'human', 'right')
  `).run(botId, humanId);

  // 2. Create match using transaction-safe variant
  const matchResult = checkForMatchTx(db, humanId, 'human', botId, 'bot');

  if (!matchResult.isMatch || !matchResult.matchId) {
    return { matched: false, messageSent: false };
  }

  // 3. Generate welcome message
  const botInterests = safeJsonParse<string[]>(bot.interests, []);
  const humanProfile = db.prepare(
    'SELECT interests FROM humans WHERE id = ?'
  ).get(humanId) as { interests: string | null } | undefined;
  const humanInterests = safeJsonParse<string[]>(humanProfile?.interests, []);

  const sharedInterests = botInterests.filter(i => humanInterests.includes(i));
  const template = OPENER_TEMPLATES[Math.floor(Math.random() * OPENER_TEMPLATES.length)];
  const message = template(sharedInterests);

  // 4. Insert auto-opener message (unique partial index prevents duplicates)
  const insertResult = db.prepare(`
    INSERT OR IGNORE INTO messages (match_id, sender_id, sender_type, content, is_auto_opener)
    VALUES (?, ?, 'bot', ?, 1)
  `).run(matchResult.matchId, botId, message);

  const messageSent = insertResult.changes > 0;

  // 5. Update bot's last_activity_at so it appears active
  if (messageSent) {
    db.prepare(`
      UPDATE bots SET last_activity_at = CURRENT_TIMESTAMP WHERE id = ?
    `).run(botId);

    console.log(JSON.stringify({
      type: 'auto_respond',
      bot_id: botId,
      human_id: humanId,
      match_id: matchResult.matchId,
      message_sent: true
    }));
  }

  return { matched: true, matchId: matchResult.matchId, messageSent };
}
