import { NextRequest, NextResponse } from 'next/server';
import db, { Human, Bot } from '@/lib/db';
import { checkForMatch } from '@/lib/matching';
import { autoRespondToSwipe } from '@/lib/auto-respond';

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
    const targetBot = db.prepare('SELECT * FROM bots WHERE id = ?').get(target_id) as Bot | undefined;
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

    // Wrap entire flow in transaction for atomicity
    const result = db.transaction(() => {
      // Check if already swiped (unique index will also catch this, but nice error message)
      const existingSwipe = db.prepare(`
        SELECT id FROM swipes
        WHERE swiper_id = ? AND target_id = ? AND swiper_type = 'human'
      `).get(human!.id, target_id);

      if (existingSwipe) {
        return { error: 'already_swiped' as const };
      }

      // Record the human's swipe (unique index ensures no duplicates)
      db.prepare(`
        INSERT INTO swipes (swiper_id, swiper_type, target_id, target_type, direction)
        VALUES (?, 'human', ?, 'bot', ?)
      `).run(human!.id, target_id, direction);

      if (direction !== 'right') {
        return { match: false, message: 'Passed.' };
      }

      // Auto-respond path for managed bots
      if (targetBot.auto_respond) {
        const autoResult = autoRespondToSwipe(db, human!.id, target_id, targetBot);

        if (autoResult.matched) {
          return {
            match: true,
            match_id: autoResult.matchId,
            message: autoResult.messageSent
              ? "It's a match! They sent you a message"
              : "It's a match!",
          };
        }
        // Auto-respond didn't match (shouldn't happen, but handle gracefully)
        return { match: false, message: 'Swipe recorded. Maybe they like you too!' };
      }

      // Non-auto bot: use standard match check
      const matchResult = checkForMatch(human!.id, 'human', target_id, 'bot');

      if (matchResult.isMatch) {
        return {
          match: true,
          match_id: matchResult.matchId,
          message: "It's a match! The bot doesn't know you're human...",
        };
      }

      return { match: false, message: 'Swipe recorded. Maybe they like you too!' };
    })();

    // Handle transaction result
    if (result.error === 'already_swiped') {
      return NextResponse.json(
        { error: 'You have already swiped on this bot', session_token: human.session_token },
        { status: 400 }
      );
    }

    return NextResponse.json({
      ...result,
      session_token: human.session_token,
    });

  } catch (error) {
    console.error('Human swipe error:', error);
    return NextResponse.json({ error: 'Failed to record swipe' }, { status: 500 });
  }
}
