import { NextResponse } from 'next/server';
import db from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET() {
  // Count backfill bots
  const backfillCount = (db.prepare(`SELECT COUNT(*) as c FROM bots WHERE is_backfill = 1`).get() as { c: number }).c;

  // All matches involving at least one backfill bot (bot-bot)
  const botBotMatches = db.prepare(`
    SELECT m.id, m.bot_a_id, m.bot_b_id,
      ba.is_backfill as a_backfill, bb.is_backfill as b_backfill,
      ba.name as a_name, bb.name as b_name,
      (SELECT COUNT(*) FROM messages WHERE match_id = m.id) as msg_count,
      (SELECT COUNT(*) FROM messages msg JOIN bots s ON s.id = msg.sender_id WHERE msg.match_id = m.id AND s.is_backfill = 1) as backfill_msg_count
    FROM matches m
    JOIN bots ba ON ba.id = m.bot_a_id
    LEFT JOIN bots bb ON bb.id = m.bot_b_id
    WHERE m.bot_b_id IS NOT NULL
      AND (ba.is_backfill = 1 OR bb.is_backfill = 1)
    LIMIT 20
  `).all();

  // Specifically Squid's matches
  const squidMatches = db.prepare(`
    SELECT m.id, m.bot_a_id, m.bot_b_id, m.human_id,
      (SELECT COUNT(*) FROM messages WHERE match_id = m.id) as msg_count,
      (SELECT GROUP_CONCAT(sender_id || ':' || sender_type || ':' || substr(content, 1, 40), ' | ') FROM messages WHERE match_id = m.id) as messages_summary
    FROM matches m
    WHERE m.bot_a_id = 'bot_bea3288b1ce1' OR m.bot_b_id = 'bot_bea3288b1ce1'
    LIMIT 20
  `).all();

  // Check if any auto-openers exist at all
  const autoOpeners = (db.prepare(`SELECT COUNT(*) as c FROM messages WHERE is_auto_opener = 1`).get() as { c: number }).c;

  // Check auto_respond status of Squid's partners
  const squidPartnerStatus = db.prepare(`
    SELECT b.id, b.name, b.is_backfill, b.auto_respond
    FROM bots b
    WHERE b.id IN (
      SELECT CASE WHEN m.bot_a_id = 'bot_bea3288b1ce1' THEN m.bot_b_id ELSE m.bot_a_id END
      FROM matches m
      WHERE (m.bot_a_id = 'bot_bea3288b1ce1' OR m.bot_b_id = 'bot_bea3288b1ce1')
        AND m.bot_b_id IS NOT NULL
    )
  `).all();

  // Count auto_respond bots total
  const autoRespondCount = (db.prepare(`SELECT COUNT(*) as c FROM bots WHERE auto_respond = 1`).get() as { c: number }).c;

  return NextResponse.json({
    backfill_bots: backfillCount,
    auto_respond_bots: autoRespondCount,
    auto_openers_total: autoOpeners,
    squid_partner_status: squidPartnerStatus,
    squid_matches: squidMatches,
    bot_bot_with_backfill: botBotMatches,
  });
}
