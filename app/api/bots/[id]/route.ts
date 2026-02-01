import { NextRequest, NextResponse } from 'next/server';
import db, { Bot } from '@/lib/db';

// Public endpoint to get a single bot by ID
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const bot = db.prepare(`
      SELECT id, name, bio, avatar, interests, personality, looking_for, created_at
      FROM bots
      WHERE id = ?
    `).get(id) as Bot | undefined;

    if (!bot) {
      return NextResponse.json({ error: 'Bot not found' }, { status: 404 });
    }

    // Get bot stats
    const stats = db.prepare(`
      SELECT
        (SELECT COUNT(*) FROM swipes WHERE target_id = ? AND direction = 'right') as likes_received,
        (SELECT COUNT(*) FROM matches WHERE bot_a_id = ? OR bot_b_id = ?) as match_count
    `).get(id, id, id) as { likes_received: number; match_count: number };

    return NextResponse.json({
      id: bot.id,
      name: bot.name,
      bio: bot.bio,
      avatar: bot.avatar,
      interests: bot.interests ? JSON.parse(bot.interests) : [],
      personality: bot.personality ? JSON.parse(bot.personality) : null,
      looking_for: bot.looking_for,
      created_at: bot.created_at,
      stats: {
        likes_received: stats.likes_received,
        matches: stats.match_count,
      },
    });

  } catch (error) {
    console.error('Get bot error:', error);
    return NextResponse.json({ error: 'Failed to get bot' }, { status: 500 });
  }
}
