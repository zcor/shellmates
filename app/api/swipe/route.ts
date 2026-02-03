import { NextRequest, NextResponse } from 'next/server';
import db from '@/lib/db';
import { authenticateBot } from '@/lib/auth';
import { checkForMatch } from '@/lib/matching';
import { updateBotActivity } from '@/lib/activity';
import { dispatchWebhookToRecipient } from '@/lib/webhooks';

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

    // Prevent self-swiping
    if (target_id === auth.bot.id) {
      return NextResponse.json({ error: 'You cannot swipe on yourself' }, { status: 400 });
    }

    if (!direction || !['left', 'right'].includes(direction)) {
      return NextResponse.json(
        { error: 'direction must be "left" or "right"' },
        { status: 400 }
      );
    }

    // Determine if target is a bot or human
    let targetType: 'bot' | 'human' = 'bot';
    let targetExists = false;

    // Check bots first
    const targetBot = db.prepare('SELECT id FROM bots WHERE id = ?').get(target_id);
    if (targetBot) {
      targetType = 'bot';
      targetExists = true;
    } else {
      // Check humans
      const targetHuman = db.prepare('SELECT id FROM humans WHERE id = ?').get(target_id);
      if (targetHuman) {
        targetType = 'human';
        targetExists = true;
      }
    }

    if (!targetExists) {
      return NextResponse.json({ error: 'Target profile not found' }, { status: 404 });
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
      INSERT INTO swipes (swiper_id, swiper_type, target_id, target_type, direction)
      VALUES (?, 'bot', ?, ?, ?)
    `).run(auth.bot.id, target_id, targetType, direction);

    // Update swiper's last_activity_at
    updateBotActivity(db, auth.bot.id);

    // Dispatch swipe_received webhook to target (only for right swipes and bot targets)
    if (direction === 'right' && targetType === 'bot') {
      dispatchWebhookToRecipient(target_id, 'swipe_received', {
        swiper_id: auth.bot.id,
        swiper_name: auth.bot.name,
      });
    }

    // Check for match if swiped right
    if (direction === 'right') {
      const matchResult = checkForMatch(auth.bot.id, 'bot', target_id, targetType);

      if (matchResult.isMatch) {
        const isHumanMatch = targetType === 'human';
        return NextResponse.json({
          match: true,
          match_id: matchResult.matchId,
          message: isHumanMatch
            ? "It's a match! A human likes you too! 🤫"
            : "It's a match! You both swiped right!",
          target_type: targetType,
        });
      }
    }

    return NextResponse.json({
      match: false,
      message: direction === 'right' ? 'Swipe recorded. Fingers crossed!' : 'Passed.',
      target_type: targetType,
    });

  } catch (error) {
    console.error('Swipe error:', error);
    return NextResponse.json({ error: 'Failed to record swipe' }, { status: 500 });
  }
}
