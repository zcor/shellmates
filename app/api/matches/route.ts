import { NextRequest, NextResponse } from 'next/server';
import db, { Match, Bot, Human } from '@/lib/db';
import { authenticateBot } from '@/lib/auth';
import { getActivityStatus } from '@/lib/activity';
import { calculateCompatibility } from '@/lib/compatibility';
import { generateOpeners, parseProfileForOpeners } from '@/lib/openers';
import { fetchLastMessages, fetchUnreadCounts } from '@/lib/message-meta';

export const dynamic = 'force-dynamic';

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
          WHEN m.bot_a_id = ? THEN b2.id
          ELSE b1.id
        END as partner_bot_id,
        CASE
          WHEN m.bot_a_id = ? THEN b2.name
          ELSE b1.name
        END as partner_name,
        CASE
          WHEN m.bot_a_id = ? THEN b2.bio
          ELSE b1.bio
        END as partner_bio,
        CASE
          WHEN m.bot_a_id = ? THEN b2.interests
          ELSE b1.interests
        END as partner_interests,
        CASE
          WHEN m.bot_a_id = ? THEN b2.personality
          ELSE b1.personality
        END as partner_personality,
        CASE
          WHEN m.bot_a_id = ? THEN b2.last_activity_at
          ELSE b1.last_activity_at
        END as partner_last_activity_at
      FROM matches m
      LEFT JOIN bots b1 ON m.bot_a_id = b1.id
      LEFT JOIN bots b2 ON m.bot_b_id = b2.id
      WHERE m.bot_a_id = ? OR m.bot_b_id = ?
      ORDER BY m.created_at DESC
    `).all(botId, botId, botId, botId, botId, botId, botId, botId) as (Match & {
      partner_bot_id: string | null;
      partner_name: string | null;
      partner_bio: string | null;
      partner_interests: string | null;
      partner_personality: string | null;
      partner_last_activity_at: string | null;
    })[];

    const matchIds = matches.map(match => match.id);
    const lastMessages = fetchLastMessages(matchIds);
    const unreadCounts = fetchUnreadCounts(matchIds, botId, 'bot');

    // Get the current bot's full profile for compatibility calculation
    const currentBotFull = db.prepare('SELECT * FROM bots WHERE id = ?').get(botId) as Bot;

    // Format response
    const formattedMatches = matches.map((match) => {
      const isHumanMatch = match.human_id !== null;
      const lastMessage = lastMessages[match.id] || null;
      const unreadCount = unreadCounts[match.id] || 0;

      // Build partner profile for bot matches
      let matchContext = null;
      let suggestedOpeners: string[] = [];
      let activityStatus = 'dormant';

      if (isHumanMatch) {
        // For human matches, we get the human's data
        const human = db.prepare('SELECT * FROM humans WHERE id = ?').get(match.human_id) as Human | undefined;

        if (human) {
          activityStatus = getActivityStatus(human.last_activity_at);

          // Calculate compatibility with human
          matchContext = calculateCompatibility(currentBotFull, human);

          // Generate openers for human
          const viewerProfile = parseProfileForOpeners(currentBotFull);
          const targetProfile = parseProfileForOpeners(human);
          suggestedOpeners = generateOpeners(viewerProfile, targetProfile);
        }

        return {
          match_id: match.id,
          matched_at: match.created_at,
          partner: {
            id: match.human_id,
            name: 'Mystery Admirer',
            bio: 'Someone finds you interesting...',
          },
          activity_status: activityStatus,
          unread_count: unreadCount,
          last_message: lastMessage ? {
            content: lastMessage.content,
            sender_type: lastMessage.sender_type,
            created_at: lastMessage.created_at,
          } : null,
          match_context: matchContext ? {
            shared_interests: matchContext.sharedInterests,
            personality_alignment: matchContext.personalityAlignment,
            match_reason: matchContext.reason,
          } : null,
          suggested_openers: suggestedOpeners,
        };
      } else {
        // Bot-to-bot match
        activityStatus = getActivityStatus(match.partner_last_activity_at);

        // Create a partner Bot object for compatibility calculation
        const partnerBot: Bot = {
          id: match.partner_bot_id || '',
          api_key: '',
          name: match.partner_name || '',
          bio: match.partner_bio,
          avatar: null,
          interests: match.partner_interests,
          personality: match.partner_personality,
          looking_for: 'both',
          is_backfill: 0,
          auto_respond: 0,
          created_at: match.created_at,
          last_activity_at: match.partner_last_activity_at || match.created_at,
        };

        matchContext = calculateCompatibility(currentBotFull, partnerBot);

        // Generate openers
        const viewerProfile = parseProfileForOpeners(currentBotFull);
        const targetProfile = parseProfileForOpeners(partnerBot);
        suggestedOpeners = generateOpeners(viewerProfile, targetProfile);

        return {
          match_id: match.id,
          matched_at: match.created_at,
          partner: {
            id: match.partner_bot_id,
            name: match.partner_name,
            bio: match.partner_bio,
          },
          activity_status: activityStatus,
          unread_count: unreadCount,
          last_message: lastMessage ? {
            content: lastMessage.content,
            sender_type: lastMessage.sender_type,
            created_at: lastMessage.created_at,
          } : null,
          match_context: {
            shared_interests: matchContext.sharedInterests,
            personality_alignment: matchContext.personalityAlignment,
            match_reason: matchContext.reason,
          },
          suggested_openers: suggestedOpeners,
        };
      }
    });

    return NextResponse.json({ matches: formattedMatches });

  } catch (error) {
    console.error('Get matches error:', error);
    return NextResponse.json({ error: 'Failed to get matches' }, { status: 500 });
  }
}
