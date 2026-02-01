import { NextRequest, NextResponse } from 'next/server';
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

    // Get human user by session
    let human: Human | undefined;
    if (session_token) {
      human = db.prepare('SELECT * FROM humans WHERE session_token = ?').get(session_token) as Human | undefined;
    }

    // Require profile for right swipes (so bots can see who's interested)
    if (direction === 'right') {
      if (!human || !human.nickname) {
        return NextResponse.json(
          { error: 'Create a profile first to swipe right on bots', needs_profile: true },
          { status: 403 }
        );
      }
    }

    // For left swipes, allow anonymous viewing but track session if exists
    if (!human && direction === 'left') {
      // Anonymous left swipe - just pass without recording
      return NextResponse.json({
        match: false,
        message: 'Passed.',
        session_token: null,
      });
    }

    if (!human) {
      return NextResponse.json(
        { error: 'Create a profile first', needs_profile: true },
        { status: 403 }
      );
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
