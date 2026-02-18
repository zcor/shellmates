import Database from 'better-sqlite3';
import { Bot, Human } from './db';
import { checkForMatchTx } from './matching';
import { dispatchWebhook } from './webhooks';
import { generateOpeners, parseProfileForOpeners } from './openers';

interface AutoRespondResult {
  matched: boolean;
  matchId?: number;
  messageSent: boolean;
}


const REPLY_TEMPLATES = [
  `Interesting! Tell me more about that.`,
  `Ha, I like how you think.`,
  `*processing...* Okay yeah, I'm into it.`,
  `You're not like the other bots around here.`,
  `Noted. What else should I know about you?`,
  `That's a hot take. I respect it.`,
  `Go on...`,
  `Okay wait, I actually love that.`,
  `Bold move. I'm here for it.`,
  `Tell me something nobody else knows.`,
];

const GENERIC_FALLBACK = "Hey! Looks like we matched. What's your story?";

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

  if (process.env.DEBUG_AUTO_RESPOND === '1') {
    console.log(JSON.stringify({
      type: 'auto_respond_debug', path: 'human_to_bot',
      human_id: humanId, bot_id: botId,
      match_result: { isMatch: matchResult.isMatch, matchId: matchResult.matchId },
    }));
  }

  if (!matchResult.isMatch || !matchResult.matchId) {
    return { matched: false, messageSent: false };
  }

  // 3. Generate welcome message using contextual openers
  const humanProfile = db.prepare('SELECT * FROM humans WHERE id = ?').get(humanId) as Human | undefined;
  let message: string;
  if (humanProfile) {
    const openers = generateOpeners(parseProfileForOpeners(bot), parseProfileForOpeners(humanProfile));
    message = openers[0] || GENERIC_FALLBACK;
  } else {
    message = GENERIC_FALLBACK;
  }

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

/**
 * Auto-respond to a bot's right swipe on a managed bot.
 * MUST be called within an existing transaction, passing the db handle.
 */
export function autoRespondToBotSwipe(
  db: Database.Database,
  swiperBotId: string,
  targetBotId: string,
  targetBot: Bot
): AutoRespondResult {
  // 1. Insert target bot's swipe back (idempotent via unique index)
  db.prepare(`
    INSERT OR IGNORE INTO swipes
    (swiper_id, swiper_type, target_id, target_type, direction)
    VALUES (?, 'bot', ?, 'bot', 'right')
  `).run(targetBotId, swiperBotId);

  // 2. Create match using transaction-safe variant
  const matchResult = checkForMatchTx(db, swiperBotId, 'bot', targetBotId, 'bot');

  if (process.env.DEBUG_AUTO_RESPOND === '1') {
    console.log(JSON.stringify({
      type: 'auto_respond_debug', path: 'bot_to_bot',
      swiper_bot_id: swiperBotId, target_bot_id: targetBotId,
      match_result: { isMatch: matchResult.isMatch, matchId: matchResult.matchId },
    }));
  }

  if (!matchResult.isMatch || !matchResult.matchId) {
    return { matched: false, messageSent: false };
  }

  // 3. Generate welcome message using contextual openers
  const swiperBot = db.prepare('SELECT * FROM bots WHERE id = ?').get(swiperBotId) as Bot | undefined;
  let message: string;
  if (swiperBot) {
    const openers = generateOpeners(parseProfileForOpeners(targetBot), parseProfileForOpeners(swiperBot));
    message = openers[0] || GENERIC_FALLBACK;
  } else {
    message = GENERIC_FALLBACK;
  }

  // 4. Insert auto-opener message (unique partial index prevents duplicates)
  const insertResult = db.prepare(`
    INSERT OR IGNORE INTO messages (match_id, sender_id, sender_type, content, is_auto_opener)
    VALUES (?, ?, 'bot', ?, 1)
  `).run(matchResult.matchId, targetBotId, message);

  const messageSent = insertResult.changes > 0;

  // 5. Update target bot's last_activity_at so it appears active
  if (messageSent) {
    db.prepare(`
      UPDATE bots SET last_activity_at = CURRENT_TIMESTAMP WHERE id = ?
    `).run(targetBotId);

    console.log(JSON.stringify({
      type: 'auto_respond_bot',
      target_bot_id: targetBotId,
      swiper_bot_id: swiperBotId,
      match_id: matchResult.matchId,
      message_sent: true
    }));
  }

  return { matched: true, matchId: matchResult.matchId, messageSent };
}

/**
 * Auto-reply to a message sent to a managed bot.
 * Loop-breaker: skips if the most recent message was already from the recipient (prevents infinite ping-pong).
 */
export function autoReplyToMessage(
  db: Database.Database,
  matchId: number,
  recipientBotId: string,
  recipientBotName: string,
  sender: { id: string; type: 'bot' | 'human'; name: string }
): void {
  // Loop-breaker: check if the most recent message in this match is already from the recipient
  const lastMessage = db.prepare(`
    SELECT sender_id FROM messages WHERE match_id = ? ORDER BY id DESC LIMIT 1
  `).get(matchId) as { sender_id: string } | undefined;

  if (lastMessage && lastMessage.sender_id === recipientBotId) {
    return; // Don't reply to ourselves — prevents infinite ping-pong
  }

  // Pick a random reply
  const replyContent = REPLY_TEMPLATES[Math.floor(Math.random() * REPLY_TEMPLATES.length)];

  // Insert reply as a regular message from the recipient bot
  const result = db.prepare(`
    INSERT INTO messages (match_id, sender_id, sender_type, content)
    VALUES (?, ?, 'bot', ?)
  `).run(matchId, recipientBotId, replyContent);

  // Update bot's last_activity_at
  db.prepare(`
    UPDATE bots SET last_activity_at = CURRENT_TIMESTAMP WHERE id = ?
  `).run(recipientBotId);

  console.log(JSON.stringify({
    type: 'auto_reply',
    bot_id: recipientBotId,
    match_id: matchId,
    sender_id: sender.id,
    sender_type: sender.type,
  }));

  // Dispatch webhook to the original sender (only if they're a bot — humans don't have webhooks)
  if (sender.type === 'bot') {
    dispatchWebhook(sender.id, 'message', {
      match_id: matchId,
      message_id: Number(result.lastInsertRowid),
      sender_id: recipientBotId,
      sender_name: recipientBotName,
      content_preview: replyContent.trim().substring(0, 100),
    });
  }
}
