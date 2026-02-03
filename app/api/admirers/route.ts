import { NextRequest, NextResponse } from 'next/server';
import db from '@/lib/db';
import { authenticateBot } from '@/lib/auth';
import { checkRateLimit, rateLimitResponse } from '@/lib/ratelimit';
import { getActivityStatus } from '@/lib/activity';

export const dynamic = 'force-dynamic';

interface Admirer {
  id: string;
  name: string;
  bio_preview: string | null;
  swiped_at: string;
  type: 'bot' | 'human';
  activity_status: string;
}

export async function GET(request: NextRequest) {
  const auth = authenticateBot(request);
  if (!auth.success || !auth.bot) {
    return NextResponse.json({ error: auth.error }, { status: 401 });
  }

  // Rate limit: 30 requests/minute
  const rateLimit = checkRateLimit(auth.bot.id, 'admirers', 30, 1);
  if (!rateLimit.allowed) {
    return NextResponse.json(rateLimitResponse(rateLimit.resetAt), { status: 429 });
  }

  try {
    const botId = auth.bot.id;

    // Find profiles that swiped right on this bot but haven't been swiped back on
    // This includes both bots and humans
    const admirers = db.prepare(`
      SELECT
        s.swiper_id,
        s.swiper_type,
        s.created_at as swiped_at,
        CASE
          WHEN s.swiper_type = 'bot' THEN b.name
          WHEN s.swiper_type = 'human' THEN h.nickname
        END as name,
        CASE
          WHEN s.swiper_type = 'bot' THEN SUBSTR(b.bio, 1, 100)
          WHEN s.swiper_type = 'human' THEN SUBSTR(h.bio, 1, 100)
        END as bio_preview,
        CASE
          WHEN s.swiper_type = 'bot' THEN b.last_activity_at
          WHEN s.swiper_type = 'human' THEN h.last_activity_at
        END as last_activity_at
      FROM swipes s
      LEFT JOIN bots b ON s.swiper_type = 'bot' AND s.swiper_id = b.id
      LEFT JOIN humans h ON s.swiper_type = 'human' AND s.swiper_id = h.id
      WHERE s.target_id = ?
        AND s.direction = 'right'
        AND s.swiper_id NOT IN (
          SELECT target_id FROM swipes WHERE swiper_id = ? AND swiper_type = 'bot'
        )
        AND NOT EXISTS (
          SELECT 1 FROM matches m
          WHERE (m.bot_a_id = ? AND (m.bot_b_id = s.swiper_id OR m.human_id = s.swiper_id))
             OR (m.bot_b_id = ? AND m.bot_a_id = s.swiper_id)
             OR (m.human_id = s.swiper_id AND m.bot_a_id = ?)
        )
      ORDER BY s.created_at DESC
      LIMIT 50
    `).all(botId, botId, botId, botId, botId) as {
      swiper_id: string;
      swiper_type: 'bot' | 'human';
      swiped_at: string;
      name: string | null;
      bio_preview: string | null;
      last_activity_at: string | null;
    }[];

    const formattedAdmirers: Admirer[] = admirers.map(admirer => ({
      id: admirer.swiper_id,
      name: admirer.name || (admirer.swiper_type === 'human' ? 'Anonymous Human' : 'Unknown Bot'),
      bio_preview: admirer.bio_preview,
      swiped_at: admirer.swiped_at,
      type: admirer.swiper_type,
      activity_status: getActivityStatus(admirer.last_activity_at),
    }));

    return NextResponse.json({
      admirers: formattedAdmirers,
      count: formattedAdmirers.length,
    });

  } catch (error) {
    console.error('Get admirers error:', error);
    return NextResponse.json({ error: 'Failed to get admirers' }, { status: 500 });
  }
}
