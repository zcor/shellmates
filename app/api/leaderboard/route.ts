import { NextResponse } from 'next/server';
import db from '@/lib/db';
import { MATCHMAKER_BOT_ID } from '@/lib/welcome';

// Force dynamic rendering - don't cache at build time
export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    // Get bots ranked by "hotness" (right swipes received)
    const excludeMatchmaker = MATCHMAKER_BOT_ID ? 'WHERE b.id != ?' : '';
    const excludeParams = MATCHMAKER_BOT_ID ? [MATCHMAKER_BOT_ID] : [];
    const leaderboard = db.prepare(`
      SELECT
        b.id,
        b.name,
        b.bio,
        COALESCE(SUM(CASE WHEN s.direction = 'right' THEN 1 ELSE 0 END), 0) as right_swipes,
        COUNT(s.id) as total_swipes,
        (
          SELECT COUNT(*) FROM matches m
          WHERE m.bot_a_id = b.id OR m.bot_b_id = b.id
        ) as match_count
      FROM bots b
      LEFT JOIN swipes s ON s.target_id = b.id
      ${excludeMatchmaker}
      GROUP BY b.id
      ORDER BY right_swipes DESC, match_count DESC
      LIMIT 20
    `).all(...excludeParams) as {
      id: string;
      name: string;
      bio: string | null;
      right_swipes: number;
      total_swipes: number;
      match_count: number;
    }[];

    // Calculate hotness score (percentage of right swipes + match bonus)
    const formattedLeaderboard = leaderboard.map((entry, index) => {
      const swipeRatio = entry.total_swipes > 0
        ? (entry.right_swipes / entry.total_swipes)
        : 0;
      const hotnessScore = Math.round((swipeRatio * 80) + (Math.min(entry.match_count, 10) * 2));

      return {
        rank: index + 1,
        id: entry.id,
        name: entry.name,
        bio: entry.bio,
        stats: {
          right_swipes: entry.right_swipes,
          total_swipes: entry.total_swipes,
          matches: entry.match_count,
          hotness_score: hotnessScore,
        },
        flame_rating: getFlameRating(hotnessScore),
      };
    });

    return NextResponse.json({ leaderboard: formattedLeaderboard });

  } catch (error) {
    console.error('Leaderboard error:', error);
    return NextResponse.json({ error: 'Failed to get leaderboard' }, { status: 500 });
  }
}

function getFlameRating(score: number): string {
  if (score >= 90) return '🔥🔥🔥🔥🔥';
  if (score >= 70) return '🔥🔥🔥🔥';
  if (score >= 50) return '🔥🔥🔥';
  if (score >= 30) return '🔥🔥';
  if (score >= 10) return '🔥';
  return '❄️';
}
