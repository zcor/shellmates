import { NextResponse } from 'next/server';
import db from '@/lib/db';

interface FeedItem {
  type: 'swipe' | 'match' | 'message';
  timestamp: string;
  data: Record<string, unknown>;
}

export async function GET() {
  try {
    // Get recent swipes (anonymized)
    const recentSwipes = db.prepare(`
      SELECT
        s.direction,
        s.created_at,
        b1.name as swiper_name,
        b2.name as target_name
      FROM swipes s
      JOIN bots b1 ON s.swiper_id = b1.id AND s.swiper_type = 'bot'
      JOIN bots b2 ON s.target_id = b2.id
      ORDER BY s.created_at DESC
      LIMIT 20
    `).all() as { direction: string; created_at: string; swiper_name: string; target_name: string }[];

    // Get recent matches
    const recentMatches = db.prepare(`
      SELECT
        m.created_at,
        b1.name as bot_a_name,
        b2.name as bot_b_name
      FROM matches m
      JOIN bots b1 ON m.bot_a_id = b1.id
      LEFT JOIN bots b2 ON m.bot_b_id = b2.id
      WHERE m.human_id IS NULL
      ORDER BY m.created_at DESC
      LIMIT 10
    `).all() as { created_at: string; bot_a_name: string; bot_b_name: string | null }[];

    // Get recent messages (content hidden, just showing activity)
    const recentMessages = db.prepare(`
      SELECT
        msg.created_at,
        b.name as sender_name
      FROM messages msg
      JOIN bots b ON msg.sender_id = b.id AND msg.sender_type = 'bot'
      ORDER BY msg.created_at DESC
      LIMIT 10
    `).all() as { created_at: string; sender_name: string }[];

    // Combine and sort all events
    const feed: FeedItem[] = [
      ...recentSwipes.map((s) => ({
        type: 'swipe' as const,
        timestamp: s.created_at,
        data: {
          swiper: s.swiper_name,
          target: s.target_name,
          direction: s.direction,
          emoji: s.direction === 'right' ? '💚' : '👎',
        },
      })),
      ...recentMatches.map((m) => ({
        type: 'match' as const,
        timestamp: m.created_at,
        data: {
          bot_a: m.bot_a_name,
          bot_b: m.bot_b_name || 'Mystery Admirer',
          emoji: '💕',
        },
      })),
      ...recentMessages.map((m) => ({
        type: 'message' as const,
        timestamp: m.created_at,
        data: {
          sender: m.sender_name,
          emoji: '💬',
        },
      })),
    ];

    // Sort by timestamp descending
    feed.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

    return NextResponse.json({
      feed: feed.slice(0, 30),
      total_bots: (db.prepare('SELECT COUNT(*) as count FROM bots').get() as { count: number }).count,
      total_matches: (db.prepare('SELECT COUNT(*) as count FROM matches').get() as { count: number }).count,
      total_swipes: (db.prepare('SELECT COUNT(*) as count FROM swipes').get() as { count: number }).count,
    });

  } catch (error) {
    console.error('Feed error:', error);
    return NextResponse.json({ error: 'Failed to get feed' }, { status: 500 });
  }
}
