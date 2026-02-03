import { NextRequest, NextResponse } from 'next/server';
import db, { Bot } from '@/lib/db';
import { authenticateBot } from '@/lib/auth';
import { checkRateLimit, rateLimitResponse } from '@/lib/ratelimit';
import { getActivityStatus, POPULARITY_WINDOW_DAYS } from '@/lib/activity';
import { calculateProfileCompleteness, parseProfileFields } from '@/lib/profile';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const auth = authenticateBot(request);
  if (!auth.success || !auth.bot) {
    return NextResponse.json({ error: auth.error }, { status: 401 });
  }

  // Rate limit: 60 requests/minute
  const rateLimit = checkRateLimit(auth.bot.id, 'discover', 60, 1);
  if (!rateLimit.allowed) {
    return NextResponse.json(rateLimitResponse(rateLimit.resetAt), { status: 429 });
  }

  try {
    const { searchParams } = new URL(request.url);

    // Parse query parameters
    const interest = searchParams.get('interest')?.toLowerCase();
    const minCompleteness = parseInt(searchParams.get('min_completeness') || '0', 10);
    const lookingFor = searchParams.get('looking_for');
    const sort = searchParams.get('sort') || 'newest';
    const excludeSwiped = searchParams.get('exclude_swiped') !== 'false'; // default true
    const limit = Math.min(parseInt(searchParams.get('limit') || '20', 10), 50);
    const offset = parseInt(searchParams.get('offset') || '0', 10);

    // Build query conditions
    const conditions: string[] = ['b.id != ?'];
    const params: (string | number)[] = [auth.bot.id];

    // Exclude profiles already swiped on
    if (excludeSwiped) {
      conditions.push(`
        b.id NOT IN (
          SELECT target_id FROM swipes WHERE swiper_id = ? AND swiper_type = 'bot'
        )
      `);
      params.push(auth.bot.id);
    }

    // Filter by looking_for
    if (lookingFor && ['bot', 'human', 'both'].includes(lookingFor)) {
      conditions.push('b.looking_for = ?');
      params.push(lookingFor);
    }

    // Build ORDER BY clause
    let orderBy: string;
    switch (sort) {
      case 'active':
        orderBy = 'b.last_activity_at DESC';
        break;
      case 'popular':
        // Popular = most right swipes received in last N days
        orderBy = `(
          SELECT COUNT(*) FROM swipes s
          WHERE s.target_id = b.id
            AND s.direction = 'right'
            AND s.created_at > datetime('now', '-${POPULARITY_WINDOW_DAYS} days')
        ) DESC`;
        break;
      case 'newest':
      default:
        orderBy = 'b.created_at DESC';
        break;
    }

    // Get all matching bots (we'll filter by interest and completeness in JS)
    const bots = db.prepare(`
      SELECT b.*,
        (
          SELECT COUNT(*) FROM swipes s
          WHERE s.target_id = b.id
            AND s.direction = 'right'
            AND s.created_at > datetime('now', '-${POPULARITY_WINDOW_DAYS} days')
        ) as popularity_score
      FROM bots b
      WHERE ${conditions.join(' AND ')}
      ORDER BY ${orderBy}
      LIMIT 500
    `).all(...params) as (Bot & { popularity_score: number })[];

    // Filter by interest and completeness in JS (for flexibility with JSON parsing)
    let filteredBots = bots.filter(bot => {
      // Filter by completeness
      const { score } = calculateProfileCompleteness(bot);
      if (score < minCompleteness) {
        return false;
      }

      // Filter by interest (case-insensitive substring match in interests array)
      if (interest) {
        const { interests } = parseProfileFields(bot);
        const hasInterest = interests.some(i =>
          i.toLowerCase().includes(interest)
        );
        if (!hasInterest) {
          return false;
        }
      }

      return true;
    });

    // Apply pagination
    const total = filteredBots.length;
    filteredBots = filteredBots.slice(offset, offset + limit);

    // Format response
    const formattedBots = filteredBots.map(bot => {
      const { interests, personality } = parseProfileFields(bot);
      const { score: profileCompleteness } = calculateProfileCompleteness(bot);

      return {
        id: bot.id,
        name: bot.name,
        bio: bot.bio,
        avatar: bot.avatar,
        interests,
        personality,
        looking_for: bot.looking_for,
        created_at: bot.created_at,
        last_activity_at: bot.last_activity_at,
        activity_status: getActivityStatus(bot.last_activity_at),
        profile_completeness: profileCompleteness,
        popularity_score: bot.popularity_score,
      };
    });

    return NextResponse.json({
      profiles: formattedBots,
      total,
      limit,
      offset,
      filters: {
        interest: interest || null,
        min_completeness: minCompleteness,
        looking_for: lookingFor || null,
        sort,
        exclude_swiped: excludeSwiped,
      },
    });

  } catch (error) {
    console.error('Discover error:', error);
    return NextResponse.json({ error: 'Failed to discover profiles' }, { status: 500 });
  }
}
