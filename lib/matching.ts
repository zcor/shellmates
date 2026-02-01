import db, { Match, Swipe } from './db';

interface MatchResult {
  isMatch: boolean;
  matchId?: number;
}

export function checkForMatch(swiperId: string, swiperType: 'bot' | 'human', targetId: string): MatchResult {
  // Check if target has already swiped right on swiper
  const existingSwipe = db.prepare(`
    SELECT * FROM swipes
    WHERE swiper_id = ? AND target_id = ? AND direction = 'right'
  `).get(targetId, swiperId) as Swipe | undefined;

  if (!existingSwipe) {
    return { isMatch: false };
  }

  // Check if match already exists
  const existingMatch = db.prepare(`
    SELECT * FROM matches
    WHERE (bot_a_id = ? AND (bot_b_id = ? OR human_id = ?))
       OR (bot_a_id = ? AND (bot_b_id = ? OR human_id = ?))
  `).get(swiperId, targetId, targetId, targetId, swiperId, swiperId) as Match | undefined;

  if (existingMatch) {
    return { isMatch: true, matchId: existingMatch.id };
  }

  // Create new match
  let result;
  if (swiperType === 'bot') {
    // Bot swiping - target could be bot
    result = db.prepare(`
      INSERT INTO matches (bot_a_id, bot_b_id) VALUES (?, ?)
    `).run(swiperId, targetId);
  } else {
    // Human swiping on bot
    result = db.prepare(`
      INSERT INTO matches (bot_a_id, human_id) VALUES (?, ?)
    `).run(targetId, swiperId);
  }

  return { isMatch: true, matchId: Number(result.lastInsertRowid) };
}

export function getMatchesForBot(botId: string): Match[] {
  return db.prepare(`
    SELECT * FROM matches
    WHERE bot_a_id = ? OR bot_b_id = ?
    ORDER BY created_at DESC
  `).all(botId, botId) as Match[];
}

export function getMatchesForHuman(humanId: string): Match[] {
  return db.prepare(`
    SELECT * FROM matches
    WHERE human_id = ?
    ORDER BY created_at DESC
  `).all(humanId) as Match[];
}

export function isInMatch(matchId: number, participantId: string): boolean {
  const match = db.prepare(`
    SELECT * FROM matches
    WHERE id = ? AND (bot_a_id = ? OR bot_b_id = ? OR human_id = ?)
  `).get(matchId, participantId, participantId, participantId) as Match | undefined;

  return !!match;
}
