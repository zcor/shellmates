import { NextRequest, NextResponse } from 'next/server';
import db, { Human } from '@/lib/db';
import { fetchLastMessages, fetchUnreadCounts } from '@/lib/message-meta';

function getHumanBySession(sessionToken: string): Human | undefined {
  return db.prepare('SELECT * FROM humans WHERE session_token = ?').get(sessionToken) as Human | undefined;
}

export async function GET(request: NextRequest) {
  const sessionToken = request.headers.get('X-Session-Token');

  if (!sessionToken) {
    return NextResponse.json({ error: 'Session token required' }, { status: 401 });
  }

  const human = getHumanBySession(sessionToken);

  if (!human) {
    return NextResponse.json({ error: 'Session not found' }, { status: 404 });
  }

  try {
    // Get all matches where this human is involved
    const matches = db.prepare(`
      SELECT
        m.id as match_id,
        m.created_at as matched_at,
        b.id as bot_id,
        b.name as bot_name,
        b.bio as bot_bio,
        b.interests as bot_interests,
        b.personality as bot_personality,
        b.avatar as bot_avatar
      FROM matches m
      JOIN bots b ON m.bot_a_id = b.id
      WHERE m.human_id = ?
      ORDER BY m.created_at DESC
    `).all(human.id) as {
      match_id: number;
      matched_at: string;
      bot_id: string;
      bot_name: string;
      bot_bio: string | null;
      bot_interests: string | null;
      bot_personality: string | null;
      bot_avatar: string | null;
    }[];

    const matchIds = matches.map(match => match.match_id);
    const lastMessages = fetchLastMessages(matchIds);
    const unreadCounts = fetchUnreadCounts(matchIds, human.id, 'human');

    const formattedMatches = matches.map(m => ({
      match_id: m.match_id,
      matched_at: m.matched_at,
      unread_count: unreadCounts[m.match_id] || 0,
      last_message: lastMessages[m.match_id] ? {
        content: lastMessages[m.match_id].content,
        sender_type: lastMessages[m.match_id].sender_type,
        created_at: lastMessages[m.match_id].created_at,
      } : null,
      bot: {
        id: m.bot_id,
        name: m.bot_name,
        bio: m.bot_bio,
        interests: m.bot_interests ? JSON.parse(m.bot_interests) : [],
        personality: m.bot_personality ? JSON.parse(m.bot_personality) : null,
        avatar: m.bot_avatar,
      },
    }));

    return NextResponse.json({
      matches: formattedMatches,
      total: formattedMatches.length,
    });

  } catch (error) {
    console.error('Human matches error:', error);
    return NextResponse.json({ error: 'Failed to get matches' }, { status: 500 });
  }
}
