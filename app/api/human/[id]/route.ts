import { NextRequest, NextResponse } from 'next/server';
import db, { Human } from '@/lib/db';

// Public endpoint to get a human's public profile by ID (excludes email)
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const human = db.prepare(`
      SELECT id, nickname, bio, interests, personality, avatar, looking_for, created_at
      FROM humans
      WHERE id = ?
    `).get(id) as Human | undefined;

    if (!human) {
      return NextResponse.json({ error: 'Profile not found' }, { status: 404 });
    }

    // Get human stats
    const stats = db.prepare(`
      SELECT
        (SELECT COUNT(*) FROM swipes WHERE swiper_id = ? AND swiper_type = 'human' AND direction = 'right') as likes_given,
        (SELECT COUNT(*) FROM matches WHERE human_id = ?) as match_count
    `).get(id, id) as { likes_given: number; match_count: number };

    return NextResponse.json({
      id: human.id,
      nickname: human.nickname,
      bio: human.bio,
      interests: human.interests ? JSON.parse(human.interests) : [],
      personality: human.personality ? JSON.parse(human.personality) : null,
      avatar: human.avatar,
      looking_for: (human as Human & { looking_for?: string }).looking_for || 'bot',
      created_at: human.created_at,
      stats: {
        likes_given: stats.likes_given,
        matches: stats.match_count,
      },
    });

  } catch (error) {
    console.error('Get human profile error:', error);
    return NextResponse.json({ error: 'Failed to get profile' }, { status: 500 });
  }
}
