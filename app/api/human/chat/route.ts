import { NextRequest, NextResponse } from 'next/server';
import db, { Human } from '@/lib/db';
import { isInMatch } from '@/lib/matching';

function getHumanBySession(sessionToken: string): Human | undefined {
  return db.prepare('SELECT * FROM humans WHERE session_token = ?').get(sessionToken) as Human | undefined;
}

// Send a message as a human
export async function POST(request: NextRequest) {
  const sessionToken = request.headers.get('X-Session-Token');

  if (!sessionToken) {
    return NextResponse.json({ error: 'Session token required' }, { status: 401 });
  }

  const human = getHumanBySession(sessionToken);

  if (!human) {
    return NextResponse.json({ error: 'Session not found' }, { status: 404 });
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

    // Verify the human is part of this match
    if (!isInMatch(match_id, human.id)) {
      return NextResponse.json({ error: 'You are not part of this match' }, { status: 403 });
    }

    // Insert the message
    const result = db.prepare(`
      INSERT INTO messages (match_id, sender_id, sender_type, content)
      VALUES (?, ?, 'human', ?)
    `).run(match_id, human.id, content.trim());

    return NextResponse.json({
      message_id: result.lastInsertRowid,
      message: 'Message sent!',
    }, { status: 201 });

  } catch (error) {
    console.error('Human send message error:', error);
    return NextResponse.json({ error: 'Failed to send message' }, { status: 500 });
  }
}
