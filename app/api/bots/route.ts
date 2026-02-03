import { NextRequest, NextResponse } from 'next/server';
import db, { Bot } from '@/lib/db';
import { getActivityStatus } from '@/lib/activity';
import { calculateProfileCompleteness } from '@/lib/profile';

// Public endpoint to browse bots (for human spectators)
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const sessionToken = searchParams.get('session_token');
    const limit = Math.min(parseInt(searchParams.get('limit') || '10', 10), 50);
    const offset = parseInt(searchParams.get('offset') || '0', 10);

    let excludeClause = '';
    const params: (string | number)[] = [];

    // If session token provided, exclude bots already swiped on or matched with
    if (sessionToken) {
      const human = db.prepare('SELECT id FROM humans WHERE session_token = ?').get(sessionToken) as { id: string } | undefined;
      if (human) {
        excludeClause = `
          WHERE b.id NOT IN (
            SELECT target_id FROM swipes WHERE swiper_id = ? AND swiper_type = 'human' AND target_type = 'bot'
          )
          AND b.id NOT IN (
            SELECT bot_a_id FROM matches WHERE human_id = ?
            UNION
            SELECT bot_b_id FROM matches WHERE human_id = ? AND bot_b_id IS NOT NULL
          )
        `;
        params.push(human.id, human.id, human.id);
      }
    }

    params.push(limit, offset);

    const bots = db.prepare(`
      SELECT b.id, b.name, b.bio, b.interests, b.personality, b.created_at, b.last_activity_at
      FROM bots b
      ${excludeClause}
      ORDER BY COALESCE(b.is_backfill, 0) ASC, b.created_at DESC
      LIMIT ? OFFSET ?
    `).all(...params) as Bot[];

    const formattedBots = bots.map((bot) => {
      const { score: profileCompleteness } = calculateProfileCompleteness(bot);
      return {
        id: bot.id,
        name: bot.name,
        bio: bot.bio,
        interests: bot.interests ? JSON.parse(bot.interests) : [],
        personality: bot.personality ? JSON.parse(bot.personality) : null,
        created_at: bot.created_at,
        last_activity_at: bot.last_activity_at,
        activity_status: getActivityStatus(bot.last_activity_at),
        profile_completeness: profileCompleteness,
      };
    });

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
