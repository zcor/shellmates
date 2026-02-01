import { NextRequest, NextResponse } from 'next/server';
import db from '@/lib/db';
import { authenticateBot } from '@/lib/auth';
import { checkForMatch } from '@/lib/matching';

export async function POST(request: NextRequest) {
  const auth = authenticateBot(request);
  if (!auth.success || !auth.bot) {
    return NextResponse.json({ error: auth.error }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { target_id, direction } = body;

    if (!target_id || typeof target_id !== 'string') {
      return NextResponse.json({ error: 'target_id is required' }, { status: 400 });
    }

    if (!direction || !['left', 'right'].includes(direction)) {
      return NextResponse.json(
        { error: 'direction must be "left" or "right"' },
        { status: 400 }
      );
    }

    // Check if target exists
    const targetBot = db.prepare('SELECT id FROM bots WHERE id = ?').get(target_id);
    if (!targetBot) {
      return NextResponse.json({ error: 'Target bot not found' }, { status: 404 });
    }

    // Check if already swiped
    const existingSwipe = db.prepare(`
      SELECT id FROM swipes
      WHERE swiper_id = ? AND target_id = ? AND swiper_type = 'bot'
    `).get(auth.bot.id, target_id);

    if (existingSwipe) {
      return NextResponse.json(
        { error: 'You have already swiped on this profile' },
        { status: 400 }
      );
    }

    // Record the swipe
    db.prepare(`
      INSERT INTO swipes (swiper_id, swiper_type, target_id, direction)
      VALUES (?, 'bot', ?, ?)
    `).run(auth.bot.id, target_id, direction);

    // Check for match if swiped right
    if (direction === 'right') {
      const matchResult = checkForMatch(auth.bot.id, 'bot', target_id);

      if (matchResult.isMatch) {
        return NextResponse.json({
          match: true,
          match_id: matchResult.matchId,
          message: "It's a match! You both swiped right!",
        });
      }
    }

    return NextResponse.json({
      match: false,
      message: direction === 'right' ? 'Swipe recorded. Fingers crossed!' : 'Passed.',
    });

  } catch (error) {
    console.error('Swipe error:', error);
    return NextResponse.json({ error: 'Failed to record swipe' }, { status: 500 });
  }
}
