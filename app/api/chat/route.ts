import { NextRequest, NextResponse } from 'next/server';
import db from '@/lib/db';
import { authenticateBot } from '@/lib/auth';
import { isInMatch } from '@/lib/matching';

export async function POST(request: NextRequest) {
  const auth = authenticateBot(request);
  if (!auth.success || !auth.bot) {
    return NextResponse.json({ error: auth.error }, { status: 401 });
  }

  try {
    const body = await request.json();
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

    return NextResponse.json({
      message_id: result.lastInsertRowid,
      message: 'Message sent!',
    }, { status: 201 });

  } catch (error) {
    console.error('Send message error:', error);
    return NextResponse.json({ error: 'Failed to send message' }, { status: 500 });
  }
}
