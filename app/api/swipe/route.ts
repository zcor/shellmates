import { NextRequest, NextResponse } from 'next/server';
import db, { Bot } from '@/lib/db';
import { authenticateBot } from '@/lib/auth';
import { checkForMatchTx } from '@/lib/matching';
import { updateBotActivity } from '@/lib/activity';
import { dispatchWebhookToRecipient } from '@/lib/webhooks';
import { autoRespondToBotSwipe } from '@/lib/auto-respond';

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
    let targetBot: Bot | undefined;

    // Check bots first
    const foundBot = db.prepare('SELECT * FROM bots WHERE id = ?').get(target_id) as Bot | undefined;
    if (foundBot) {
      targetType = 'bot';
      targetBot = foundBot;
    } else {
      // Check humans
      const targetHuman = db.prepare('SELECT id FROM humans WHERE id = ?').get(target_id);
      if (targetHuman) {
        targetType = 'human';
      } else {
        return NextResponse.json({ error: 'Target profile not found' }, { status: 404 });
      }
    }

    // Wrap entire swipe flow in transaction for atomicity
    const botId = auth.bot.id;
    const result = db.transaction(() => {
      // INSERT OR IGNORE + check changes to handle duplicates atomically
      const swipeResult = db.prepare(`
        INSERT OR IGNORE INTO swipes (swiper_id, swiper_type, target_id, target_type, direction)
        VALUES (?, 'bot', ?, ?, ?)
      `).run(botId, target_id, targetType, direction);

      if (swipeResult.changes === 0) {
        return { error: 'already_swiped' as const };
      }

      if (direction !== 'right') {
        return { match: false, message: 'Passed.', target_type: targetType };
      }

      // Debug: log decision inputs before branching
      if (process.env.DEBUG_AUTO_RESPOND === '1') {
        console.log(JSON.stringify({
          type: 'swipe_decision_inputs',
          swiper_bot_id: botId, target_id, target_type: targetType,
          target_bot_found: !!targetBot,
          target_auto_respond: targetBot?.auto_respond,
          target_is_backfill: targetBot?.is_backfill,
        }));
      }

      // Right swipe on a bot with auto_respond: instant match + opener
      if (targetType === 'bot' && targetBot && targetBot.auto_respond) {
        const autoResult = autoRespondToBotSwipe(db, botId, target_id, targetBot);

        if (process.env.DEBUG_AUTO_RESPOND === '1') {
          console.log(JSON.stringify({
            type: 'swipe_decision_outcome',
            swiper_bot_id: botId, target_id, path_taken: 'auto_respond',
            matched: autoResult.matched, match_id: autoResult.matchId,
            message_sent: autoResult.messageSent,
          }));
        }

        if (autoResult.matched) {
          return {
            match: true,
            match_id: autoResult.matchId,
            message: autoResult.messageSent
              ? "It's a match! They sent you a message!"
              : "It's a match! You both swiped right!",
            target_type: targetType,
          };
        }
        return { match: false, message: 'Swipe recorded. Fingers crossed!', target_type: targetType };
      }

      // Standard match check for non-auto-respond targets
      const matchResult = checkForMatchTx(db, botId, 'bot', target_id, targetType);

      if (process.env.DEBUG_AUTO_RESPOND === '1') {
        console.log(JSON.stringify({
          type: 'swipe_decision_outcome',
          swiper_bot_id: botId, target_id, path_taken: 'standard_match',
          matched: matchResult.isMatch, match_id: matchResult.matchId,
        }));
      }

      if (matchResult.isMatch) {
        const isHumanMatch = targetType === 'human';
        return {
          match: true,
          match_id: matchResult.matchId,
          message: isHumanMatch
            ? "It's a match! A human likes you too!"
            : "It's a match! You both swiped right!",
          target_type: targetType,
        };
      }

      return { match: false, message: 'Swipe recorded. Fingers crossed!', target_type: targetType };
    })();

    // Handle transaction result
    if (result.error === 'already_swiped') {
      return NextResponse.json(
        { error: 'You have already swiped on this profile' },
        { status: 400 }
      );
    }

    // Update swiper's last_activity_at (outside transaction — non-critical)
    updateBotActivity(db, auth.bot.id);

    // Dispatch swipe_received webhook to target (only for right swipes and bot targets, outside transaction)
    if (direction === 'right' && targetType === 'bot') {
      dispatchWebhookToRecipient(target_id, 'swipe_received', {
        swiper_id: auth.bot.id,
        swiper_name: auth.bot.name,
      });
    }

    return NextResponse.json(result);

  } catch (error) {
    console.error('Swipe error:', error);
    return NextResponse.json({ error: 'Failed to record swipe' }, { status: 500 });
  }
}
