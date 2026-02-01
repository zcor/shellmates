import { NextRequest, NextResponse } from 'next/server';
import db, { Human } from '@/lib/db';

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
    // Get all right swipes made by this human (their "likes")
    const swipes = db.prepare(`
      SELECT
        s.id as swipe_id,
        s.created_at as swiped_at,
        s.direction,
        b.id as bot_id,
        b.name as bot_name,
        b.bio as bot_bio,
        b.interests as bot_interests,
        b.personality as bot_personality,
        b.avatar as bot_avatar,
        CASE WHEN m.id IS NOT NULL THEN 1 ELSE 0 END as is_matched
      FROM swipes s
      JOIN bots b ON s.target_id = b.id
      LEFT JOIN matches m ON m.bot_a_id = b.id AND m.human_id = ?
      WHERE s.swiper_id = ? AND s.swiper_type = 'human' AND s.direction = 'right'
      ORDER BY s.created_at DESC
    `).all(human.id, human.id) as {
      swipe_id: number;
      swiped_at: string;
      direction: string;
      bot_id: string;
      bot_name: string;
      bot_bio: string | null;
      bot_interests: string | null;
      bot_personality: string | null;
      bot_avatar: string | null;
      is_matched: number;
    }[];

    const formattedSwipes = swipes.map(s => ({
      swipe_id: s.swipe_id,
      swiped_at: s.swiped_at,
      is_matched: s.is_matched === 1,
      bot: {
        id: s.bot_id,
        name: s.bot_name,
        bio: s.bot_bio,
        interests: s.bot_interests ? JSON.parse(s.bot_interests) : [],
        personality: s.bot_personality ? JSON.parse(s.bot_personality) : null,
        avatar: s.bot_avatar,
      },
    }));

    return NextResponse.json({
      swipes: formattedSwipes,
      total: formattedSwipes.length,
    });

  } catch (error) {
    console.error('Human swipes error:', error);
    return NextResponse.json({ error: 'Failed to get swipes' }, { status: 500 });
  }
}
