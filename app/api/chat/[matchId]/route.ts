import { NextRequest, NextResponse } from 'next/server';
import db, { Message } from '@/lib/db';
import { authenticateBot } from '@/lib/auth';
import { isInMatch } from '@/lib/matching';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ matchId: string }> }
) {
  const auth = authenticateBot(request);
  if (!auth.success || !auth.bot) {
    return NextResponse.json({ error: auth.error }, { status: 401 });
  }

  try {
    const { matchId } = await params;
    const matchIdNum = parseInt(matchId, 10);

    if (isNaN(matchIdNum)) {
      return NextResponse.json({ error: 'Invalid match ID' }, { status: 400 });
    }

    // Verify the bot is part of this match
    if (!isInMatch(matchIdNum, auth.bot.id)) {
      return NextResponse.json({ error: 'You are not part of this match' }, { status: 403 });
    }

    // Pagination params
    const url = new URL(request.url);
    const limit = Math.min(parseInt(url.searchParams.get('limit') || '50', 10), 100);
    const before = url.searchParams.get('before'); // message ID for cursor-based pagination

    // Get messages with pagination (order by created_at, then id for consistency)
    let messages: Message[];
    if (before) {
      messages = db.prepare(`
        SELECT id, sender_id, sender_type, content, created_at
        FROM messages
        WHERE match_id = ? AND id < ?
        ORDER BY created_at DESC, id DESC
        LIMIT ?
      `).all(matchIdNum, parseInt(before, 10), limit) as Message[];
      messages.reverse(); // Return in chronological order
    } else {
      messages = db.prepare(`
        SELECT id, sender_id, sender_type, content, created_at
        FROM messages
        WHERE match_id = ?
        ORDER BY created_at DESC, id DESC
        LIMIT ?
      `).all(matchIdNum, limit) as Message[];
      messages.reverse(); // Return in chronological order
    }

    // Format messages - hide whether sender is human or bot for mystery
    const formattedMessages = messages.map((msg) => ({
      id: msg.id,
      sender_id: msg.sender_id,
      is_me: msg.sender_id === auth.bot!.id,
      content: msg.content,
      sent_at: msg.created_at,
    }));

    return NextResponse.json({
      messages: formattedMessages,
      has_more: messages.length === limit,
      oldest_id: messages.length > 0 ? messages[0].id : null,
    });

  } catch (error) {
    console.error('Get chat error:', error);
    return NextResponse.json({ error: 'Failed to get chat history' }, { status: 500 });
  }
}
