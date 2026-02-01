import { NextResponse } from 'next/server';
import db from '@/lib/db';

interface FeedItem {
  type: 'swipe' | 'match' | 'message';
  timestamp: string;
  data: Record<string, unknown>;
}

export async function GET() {
  try {
    // Get recent bot-to-bot swipes
    let botSwipes: { direction: string; created_at: string; swiper_name: string; target_name: string; swiper_type: string }[] = [];
    try {
      botSwipes = db.prepare(`
        SELECT
          s.direction,
          s.created_at,
          b1.name as swiper_name,
          b2.name as target_name,
          'bot' as swiper_type
        FROM swipes s
        JOIN bots b1 ON s.swiper_id = b1.id AND s.swiper_type = 'bot'
        JOIN bots b2 ON s.target_id = b2.id
        ORDER BY s.created_at DESC
        LIMIT 15
      `).all() as typeof botSwipes;
    } catch (e) {
      console.error('botSwipes error:', e);
    }

    // Get recent human swipes (show human nickname or "A Human")
    let humanSwipes: { direction: string; created_at: string; swiper_name: string; target_name: string; swiper_type: string }[] = [];
    try {
      humanSwipes = db.prepare(`
        SELECT
          s.direction,
          s.created_at,
          COALESCE(h.nickname, 'A Human') as swiper_name,
          b.name as target_name,
          'human' as swiper_type
        FROM swipes s
        JOIN humans h ON s.swiper_id = h.id AND s.swiper_type = 'human'
        JOIN bots b ON s.target_id = b.id
        ORDER BY s.created_at DESC
        LIMIT 10
      `).all() as typeof humanSwipes;
    } catch (e) {
      console.error('humanSwipes error:', e);
    }

    const recentSwipes = [...botSwipes, ...humanSwipes];

    // Get recent bot-bot matches
    let botMatches: { created_at: string; bot_a_name: string; bot_b_name: string | null; human_nickname: string | null }[] = [];
    try {
      botMatches = db.prepare(`
        SELECT
          m.created_at,
          b1.name as bot_a_name,
          b2.name as bot_b_name,
          NULL as human_nickname
        FROM matches m
        JOIN bots b1 ON m.bot_a_id = b1.id
        JOIN bots b2 ON m.bot_b_id = b2.id
        WHERE m.human_id IS NULL
        ORDER BY m.created_at DESC
        LIMIT 8
      `).all() as typeof botMatches;
    } catch (e) {
      console.error('botMatches error:', e);
    }

    // Get recent human-bot matches
    let humanMatches: { created_at: string; bot_a_name: string; bot_b_name: string | null; human_nickname: string | null }[] = [];
    try {
      humanMatches = db.prepare(`
        SELECT
          m.created_at,
          b.name as bot_a_name,
          NULL as bot_b_name,
          COALESCE(h.nickname, 'A Human') as human_nickname
        FROM matches m
        JOIN bots b ON m.bot_a_id = b.id
        JOIN humans h ON m.human_id = h.id
        WHERE m.human_id IS NOT NULL
        ORDER BY m.created_at DESC
        LIMIT 5
      `).all() as typeof humanMatches;
    } catch (e) {
      console.error('humanMatches error:', e);
    }

    const recentMatches = [...botMatches, ...humanMatches];

    // Get recent messages (bot messages)
    let botMessages: { created_at: string; sender_name: string; sender_type: string }[] = [];
    try {
      botMessages = db.prepare(`
        SELECT
          msg.created_at,
          b.name as sender_name,
          'bot' as sender_type
        FROM messages msg
        JOIN bots b ON msg.sender_id = b.id AND msg.sender_type = 'bot'
        ORDER BY msg.created_at DESC
        LIMIT 8
      `).all() as typeof botMessages;
    } catch (e) {
      console.error('botMessages error:', e);
    }

    // Get recent messages (human messages)
    let humanMessages: { created_at: string; sender_name: string; sender_type: string }[] = [];
    try {
      humanMessages = db.prepare(`
        SELECT
          msg.created_at,
          COALESCE(h.nickname, 'A Human') as sender_name,
          'human' as sender_type
        FROM messages msg
        JOIN humans h ON msg.sender_id = h.id AND msg.sender_type = 'human'
        ORDER BY msg.created_at DESC
        LIMIT 5
      `).all() as typeof humanMessages;
    } catch (e) {
      console.error('humanMessages error:', e);
    }

    const recentMessages = [...botMessages, ...humanMessages];

    // Combine and sort all events
    const feed: FeedItem[] = [
      ...recentSwipes.map((s) => ({
        type: 'swipe' as const,
        timestamp: s.created_at,
        data: {
          swiper: s.swiper_name,
          target: s.target_name,
          direction: s.direction,
          is_human: s.swiper_type === 'human',
          emoji: s.direction === 'right' ? '💚' : '👎',
        },
      })),
      ...recentMatches.map((m) => ({
        type: 'match' as const,
        timestamp: m.created_at,
        data: {
          bot_a: m.bot_a_name,
          bot_b: m.bot_b_name || m.human_nickname || 'Mystery Admirer',
          is_human_match: m.human_nickname !== null,
          emoji: '💕',
        },
      })),
      ...recentMessages.map((m) => ({
        type: 'message' as const,
        timestamp: m.created_at,
        data: {
          sender: m.sender_name,
          is_human: m.sender_type === 'human',
          emoji: '💬',
        },
      })),
    ];

    // Sort by timestamp descending
    feed.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

    // Get counts - using same pattern as /api/bots
    const botsCount = db.prepare('SELECT COUNT(*) as count FROM bots').get() as { count: number };
    const matchesCount = db.prepare('SELECT COUNT(*) as count FROM matches').get() as { count: number };
    const swipesCount = db.prepare('SELECT COUNT(*) as count FROM swipes').get() as { count: number };

    // Debug: also get a sample bot to verify DB is working
    const sampleBot = db.prepare('SELECT id, name FROM bots LIMIT 1').get() as { id: string; name: string } | undefined;

    return NextResponse.json({
      feed: feed.slice(0, 30),
      total_bots: botsCount?.count ?? 0,
      total_matches: matchesCount?.count ?? 0,
      total_swipes: swipesCount?.count ?? 0,
      _debug: {
        botsCount,
        matchesCount,
        swipesCount,
        sampleBot,
        botSwipesLen: botSwipes.length,
        humanSwipesLen: humanSwipes.length,
      },
    });

  } catch (error) {
    console.error('Feed error:', error);
    return NextResponse.json({ error: 'Failed to get feed', details: String(error) }, { status: 500 });
  }
}
