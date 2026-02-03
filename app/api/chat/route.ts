import { NextRequest, NextResponse } from 'next/server';
import db, { Match } from '@/lib/db';
import { authenticateBot } from '@/lib/auth';
import { isInMatch } from '@/lib/matching';
import { updateBotActivity } from '@/lib/activity';
import { dispatchWebhookToRecipient } from '@/lib/webhooks';

export async function POST(request: NextRequest) {
  const auth = authenticateBot(request);
  if (!auth.success || !auth.bot) {
    return NextResponse.json({ error: auth.error }, { status: 401 });
  }

  try {
    let body;
    try {
      body = await request.json();
    } catch (parseError) {
      console.error('JSON parse error:', parseError);
      return NextResponse.json({ error: 'Invalid JSON in request body' }, { status: 400 });
    }
    const { match_id, content } = body;

    if (!match_id || typeof match_id !== 'number') {
      return NextResponse.json({ error: 'match_id is required and must be a number' }, { status: 400 });
    }

    if (!content || typeof content !== 'string' || content.trim().length === 0) {
      return NextResponse.json({ error: 'content is required' }, { status: 400 });
    }

    // Verify the bot is part of this match
    if (!isInMatch(match_id, auth.bot.id)) {
      return NextResponse.json({ error: 'You are not part of this match' }, { status: 403 });
    }

    // Insert the message
    const result = db.prepare(`
      INSERT INTO messages (match_id, sender_id, sender_type, content)
      VALUES (?, ?, 'bot', ?)
    `).run(match_id, auth.bot.id, content.trim());

    // Update sender's last_activity_at
    updateBotActivity(db, auth.bot.id);

    // Dispatch message webhook to the other participant (if they're a bot)
    const match = db.prepare('SELECT * FROM matches WHERE id = ?').get(match_id) as Match | undefined;
    if (match) {
      // Find the other bot in the match
      let recipientBotId: string | null = null;
      if (match.bot_a_id === auth.bot.id && match.bot_b_id) {
        recipientBotId = match.bot_b_id;
      } else if (match.bot_b_id === auth.bot.id) {
        recipientBotId = match.bot_a_id;
      }

      if (recipientBotId) {
        dispatchWebhookToRecipient(recipientBotId, 'message', {
          match_id,
          message_id: Number(result.lastInsertRowid),
          sender_id: auth.bot.id,
          sender_name: auth.bot.name,
          content_preview: content.trim().substring(0, 100),
        });
      }
    }

    return NextResponse.json({
      message_id: result.lastInsertRowid,
      message: 'Message sent!',
    }, { status: 201 });

  } catch (error) {
    console.error('Send message error:', error);
    return NextResponse.json({ error: 'Failed to send message' }, { status: 500 });
  }
}
