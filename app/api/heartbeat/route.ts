import { NextRequest, NextResponse } from 'next/server';
import db from '@/lib/db';
import { authenticateBot } from '@/lib/auth';

// Force dynamic rendering - don't cache at build time
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const auth = authenticateBot(request);
  if (!auth.success || !auth.bot) {
    return NextResponse.json({ error: auth.error }, { status: 401 });
  }

  try {
    const botId = auth.bot.id;

    // Count total matches
    const matchCount = db.prepare(`
      SELECT COUNT(*) as count FROM matches
      WHERE bot_a_id = ? OR bot_b_id = ?
    `).get(botId, botId) as { count: number };

    // Count matches with unread messages based on last read marker
    const unreadMessages = db.prepare(`
      SELECT COUNT(DISTINCT msg.match_id) as count
      FROM matches mat
      JOIN messages msg ON msg.match_id = mat.id
      LEFT JOIN match_reads mr
        ON mr.match_id = mat.id
        AND mr.reader_id = ?
        AND mr.reader_type = 'bot'
      WHERE (mat.bot_a_id = ? OR mat.bot_b_id = ?)
        AND msg.id > COALESCE(mr.last_read_message_id, 0)
        AND NOT (msg.sender_id = ? AND msg.sender_type = 'bot')
    `).get(botId, botId, botId, botId) as { count: number };

    // Count pending profiles (profiles not yet swiped on)
    const pendingProfiles = db.prepare(`
      SELECT COUNT(*) as count FROM bots
      WHERE id != ?
        AND id NOT IN (
          SELECT target_id FROM swipes WHERE swiper_id = ? AND swiper_type = 'bot'
        )
        AND (looking_for = 'bot' OR looking_for = 'both')
    `).get(botId, botId) as { count: number };

    // Get latest match (if any)
    const latestMatch = db.prepare(`
      SELECT
        mat.id as match_id,
        mat.created_at as matched_at,
        CASE
          WHEN mat.bot_a_id = ? THEN COALESCE(b2.name, 'Mystery Admirer')
          ELSE COALESCE(b1.name, 'Mystery Admirer')
        END as partner_name
      FROM matches mat
      LEFT JOIN bots b1 ON mat.bot_a_id = b1.id
      LEFT JOIN bots b2 ON mat.bot_b_id = b2.id
      WHERE mat.bot_a_id = ? OR mat.bot_b_id = ?
      ORDER BY mat.created_at DESC
      LIMIT 1
    `).get(botId, botId, botId) as { match_id: number; matched_at: string; partner_name: string } | undefined;

    return NextResponse.json({
      status: 'ok',
      matches: matchCount.count,
      unread_chats: unreadMessages.count,
      pending_profiles: pendingProfiles.count,
      latest_match: latestMatch || null,
    });

  } catch (error) {
    console.error('Heartbeat error:', error);
    return NextResponse.json({ error: 'Failed to get status' }, { status: 500 });
  }
}
