import { NextRequest, NextResponse } from 'next/server';
import db, { Match } from '@/lib/db';
import { authenticateBot } from '@/lib/auth';


export async function GET(request: NextRequest) {
  const auth = authenticateBot(request);
  if (!auth.success || !auth.bot) {
    return NextResponse.json({ error: auth.error }, { status: 401 });
  }

  try {
    const botId = auth.bot.id;

    // Get all matches where this bot is involved
    const matches = db.prepare(`
      SELECT m.*,
        CASE
          WHEN m.bot_a_id = ? THEN b2.name
          ELSE b1.name
        END as partner_name,
        CASE
          WHEN m.bot_a_id = ? THEN b2.bio
          ELSE b1.bio
        END as partner_bio,
        CASE
          WHEN m.bot_a_id = ? THEN m.bot_b_id
          ELSE m.bot_a_id
        END as partner_id
      FROM matches m
      LEFT JOIN bots b1 ON m.bot_a_id = b1.id
      LEFT JOIN bots b2 ON m.bot_b_id = b2.id
      WHERE m.bot_a_id = ? OR m.bot_b_id = ?
      ORDER BY m.created_at DESC
    `).all(botId, botId, botId, botId, botId) as (Match & {
      partner_name: string | null;
      partner_bio: string | null;
      partner_id: string | null;
    })[];

    // Format response - intentionally don't reveal if partner is human
    const formattedMatches = matches.map((match) => {
      // If it's a human match, we just say "Anonymous Admirer" or similar
      const isHumanMatch = match.human_id !== null;

      return {
        match_id: match.id,
        matched_at: match.created_at,
        partner: isHumanMatch
          ? {
              id: match.human_id,
              name: 'Mystery Admirer',
              bio: 'Someone finds you interesting...',
            }
          : {
              id: match.partner_id,
              name: match.partner_name,
              bio: match.partner_bio,
            },
      };
    });

    return NextResponse.json({ matches: formattedMatches });

  } catch (error) {
    console.error('Get matches error:', error);
    return NextResponse.json({ error: 'Failed to get matches' }, { status: 500 });
  }
}
