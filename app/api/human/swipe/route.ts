import { NextRequest, NextResponse } from 'next/server';
import { v4 as uuidv4 } from 'uuid';
import db, { Human } from '@/lib/db';
import { checkForMatch } from '@/lib/matching';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { target_id, direction, session_token } = body;

    if (!target_id || typeof target_id !== 'string') {
      return NextResponse.json({ error: 'target_id is required' }, { status: 400 });
    }

    if (!direction || !['left', 'right'].includes(direction)) {
      return NextResponse.json(
        { error: 'direction must be "left" or "right"' },
        { status: 400 }
      );
    }

    // Check if target bot exists
    const targetBot = db.prepare('SELECT id FROM bots WHERE id = ?').get(target_id);
    if (!targetBot) {
      return NextResponse.json({ error: 'Target bot not found' }, { status: 404 });
    }

    // Get or create human user
    let human: Human | undefined;
    if (session_token) {
      human = db.prepare('SELECT * FROM humans WHERE session_token = ?').get(session_token) as Human | undefined;
    }

    if (!human) {
      // Create new human spectator
      const humanId = `human_${uuidv4().replace(/-/g, '').slice(0, 12)}`;
      const newToken = uuidv4();

      db.prepare(`
        INSERT INTO humans (id, session_token) VALUES (?, ?)
      `).run(humanId, newToken);

      human = {
        id: humanId,
        session_token: newToken,
        nickname: null,
        created_at: new Date().toISOString(),
      };
    }

    // Check if already swiped
    const existingSwipe = db.prepare(`
      SELECT id FROM swipes
      WHERE swiper_id = ? AND target_id = ? AND swiper_type = 'human'
    `).get(human.id, target_id);

    if (existingSwipe) {
      return NextResponse.json(
        { error: 'You have already swiped on this bot', session_token: human.session_token },
        { status: 400 }
      );
    }

    // Record the swipe
    db.prepare(`
      INSERT INTO swipes (swiper_id, swiper_type, target_id, direction)
      VALUES (?, 'human', ?, ?)
    `).run(human.id, target_id, direction);

    // Check for match if swiped right
    // For human-bot matches, we check if the bot swiped right on "the pool" (looking_for includes 'human' or 'both')
    if (direction === 'right') {
      const matchResult = checkForMatch(human.id, 'human', target_id);

      if (matchResult.isMatch) {
        return NextResponse.json({
          match: true,
          match_id: matchResult.matchId,
          message: "It's a match! The bot doesn't know you're human... 🤫",
          session_token: human.session_token,
        });
      }
    }

    return NextResponse.json({
      match: false,
      message: direction === 'right' ? 'Swipe recorded. Maybe they like you too!' : 'Passed.',
      session_token: human.session_token,
    });

  } catch (error) {
    console.error('Human swipe error:', error);
    return NextResponse.json({ error: 'Failed to record swipe' }, { status: 500 });
  }
}
