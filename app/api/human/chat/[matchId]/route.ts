import { NextRequest, NextResponse } from 'next/server';
import db, { Human, Message } from '@/lib/db';
import { isInMatch } from '@/lib/matching';
import { markMatchRead } from '@/lib/message-meta';

function getHumanBySession(sessionToken: string): Human | undefined {
  return db.prepare('SELECT * FROM humans WHERE session_token = ?').get(sessionToken) as Human | undefined;
}

// Get chat history for a match
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ matchId: string }> }
) {
  const sessionToken = request.headers.get('X-Session-Token');

  if (!sessionToken) {
    return NextResponse.json({ error: 'Session token required' }, { status: 401 });
  }

  const human = getHumanBySession(sessionToken);

  if (!human) {
    return NextResponse.json({ error: 'Session not found' }, { status: 404 });
  }

  try {
    const { matchId } = await params;
    const matchIdNum = parseInt(matchId, 10);

    if (isNaN(matchIdNum)) {
      return NextResponse.json({ error: 'Invalid match_id' }, { status: 400 });
    }

    // Verify the human is part of this match
    if (!isInMatch(matchIdNum, human.id)) {
      return NextResponse.json({ error: 'You are not part of this match' }, { status: 403 });
    }

    // Get messages with sender info
    const messages = db.prepare(`
      SELECT
        m.id,
        m.content,
        m.sender_id,
        m.sender_type,
        m.created_at,
        CASE
          WHEN m.sender_type = 'bot' THEN b.name
          WHEN m.sender_type = 'human' THEN h.nickname
        END as sender_name
      FROM messages m
      LEFT JOIN bots b ON m.sender_id = b.id AND m.sender_type = 'bot'
      LEFT JOIN humans h ON m.sender_id = h.id AND m.sender_type = 'human'
      WHERE m.match_id = ?
      ORDER BY m.created_at ASC
    `).all(matchIdNum) as (Message & { sender_name: string })[];

    const lastReadMessageId = messages.length > 0 ? messages[messages.length - 1].id : null;

    if (lastReadMessageId) {
      markMatchRead(db, matchIdNum, human.id, 'human', lastReadMessageId);
    }

    return NextResponse.json({
      messages: messages.map(m => ({
        id: m.id,
        content: m.content,
        sender_name: m.sender_name || 'Unknown',
        sender_type: m.sender_type,
        is_me: m.sender_id === human.id,
        created_at: m.created_at,
      })),
    });

  } catch (error) {
    console.error('Get chat history error:', error);
    return NextResponse.json({ error: 'Failed to get chat history' }, { status: 500 });
  }
}
