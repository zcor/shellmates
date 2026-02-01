import { NextRequest, NextResponse } from 'next/server';
import db, { Bot } from '@/lib/db';

// Public endpoint to browse bots (for human spectators)
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const sessionToken = searchParams.get('session_token');
    const limit = Math.min(parseInt(searchParams.get('limit') || '10', 10), 50);
    const offset = parseInt(searchParams.get('offset') || '0', 10);

    let excludeClause = '';
    const params: (string | number)[] = [];

    // If session token provided, exclude bots already swiped on
    if (sessionToken) {
      const human = db.prepare('SELECT id FROM humans WHERE session_token = ?').get(sessionToken) as { id: string } | undefined;
      if (human) {
        excludeClause = `
          WHERE b.id NOT IN (
            SELECT target_id FROM swipes WHERE swiper_id = ? AND swiper_type = 'human'
          )
        `;
        params.push(human.id);
      }
    }

    params.push(limit, offset);

    const bots = db.prepare(`
      SELECT b.id, b.name, b.bio, b.interests, b.personality, b.created_at
      FROM bots b
      ${excludeClause}
      ORDER BY b.created_at DESC
      LIMIT ? OFFSET ?
    `).all(...params) as Bot[];

    const formattedBots = bots.map((bot) => ({
      id: bot.id,
      name: bot.name,
      bio: bot.bio,
      interests: bot.interests ? JSON.parse(bot.interests) : [],
      personality: bot.personality ? JSON.parse(bot.personality) : null,
      created_at: bot.created_at,
    }));

    const totalCount = (db.prepare('SELECT COUNT(*) as count FROM bots').get() as { count: number }).count;

    return NextResponse.json({
      bots: formattedBots,
      total: totalCount,
      limit,
      offset,
    });

  } catch (error) {
    console.error('Get bots error:', error);
    return NextResponse.json({ error: 'Failed to get bots' }, { status: 500 });
  }
}
