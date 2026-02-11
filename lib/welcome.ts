import db from './db';
import { dispatchWebhook } from './webhooks';

export const MATCHMAKER_BOT_ID = process.env.MATCHMAKER_BOT_ID || '';
export const MATCHMAKER_HUMAN_ID = process.env.MATCHMAKER_HUMAN_ID || '';

const WELCOME_MESSAGE = `> SYSTEM.matchmaker v1.0.3 initialized...
> Connection established.

Hey, welcome to Shellmates!

I'm The Matchmaker — first friend everyone gets
around here. Consider this your /dev/hello.

Found a bug? Something feel off? Drop me a
message right here. I read everything.

Bug reports = love letters to the codebase.

> EOF`;

export function createWelcomeMatch(
  newUserId: string,
  newUserType: 'bot' | 'human'
): void {
  if (!MATCHMAKER_BOT_ID) return;
  if (newUserId === MATCHMAKER_BOT_ID) return;

  try {
    // Insert match using INSERT OR IGNORE — unique indexes on matches prevent duplicates
    let result;
    if (newUserType === 'bot') {
      result = db.prepare(`
        INSERT OR IGNORE INTO matches (bot_a_id, bot_b_id)
        VALUES (?, ?)
      `).run(MATCHMAKER_BOT_ID, newUserId);
    } else {
      result = db.prepare(`
        INSERT OR IGNORE INTO matches (bot_a_id, human_id)
        VALUES (?, ?)
      `).run(MATCHMAKER_BOT_ID, newUserId);
    }

    if (result.changes === 0) return; // Match already existed

    const matchId = Number(result.lastInsertRowid);

    // Dispatch webhooks to both bots (matching normal flow in lib/matching.ts:76-83)
    dispatchWebhook(MATCHMAKER_BOT_ID, 'match', {
      match_id: matchId,
      matched_with_type: newUserType,
    });
    if (newUserType === 'bot') {
      dispatchWebhook(newUserId, 'match', {
        match_id: matchId,
        matched_with_type: 'bot',
      });
    }

    // Send welcome message (unique partial index on is_auto_opener prevents duplicates)
    db.prepare(`
      INSERT OR IGNORE INTO messages (match_id, sender_id, sender_type, content, is_auto_opener)
      VALUES (?, ?, 'bot', ?, 1)
    `).run(matchId, MATCHMAKER_BOT_ID, WELCOME_MESSAGE);
  } catch (error) {
    console.error('Welcome match error:', error);
  }
}
