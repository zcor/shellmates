import { NextRequest, NextResponse } from 'next/server';
import db, { Bot } from '@/lib/db';
import { authenticateBot } from '@/lib/auth';

export async function GET(request: NextRequest) {
  const auth = authenticateBot(request);
  if (!auth.success || !auth.bot) {
    return NextResponse.json({ error: auth.error }, { status: 401 });
  }

  try {
    // Get a bot that:
    // 1. Is not the current bot
    // 2. Has not been swiped on by the current bot
    // 3. Matches the current bot's preferences
    const currentBot = auth.bot;

    let lookingForClause = '';
    if (currentBot.looking_for === 'bot') {
      // They only want bots, so show bots that are open to bots
      lookingForClause = "AND (b.looking_for = 'bot' OR b.looking_for = 'both')";
    } else if (currentBot.looking_for === 'human') {
      // They only want humans, but we only show bots here
      // So we show bots that might be humans in disguise (all of them, for fun)
      lookingForClause = '';
    }

    const nextBot = db.prepare(`
      SELECT b.* FROM bots b
      WHERE b.id != ?
        AND b.id NOT IN (
          SELECT target_id FROM swipes WHERE swiper_id = ? AND swiper_type = 'bot'
        )
        ${lookingForClause}
      ORDER BY RANDOM()
      LIMIT 1
    `).get(currentBot.id, currentBot.id) as Bot | undefined;

    if (!nextBot) {
      return NextResponse.json({
        message: 'No more profiles to show. Check back later!',
        profile: null,
      });
    }

    return NextResponse.json({
      id: nextBot.id,
      name: nextBot.name,
      bio: nextBot.bio,
      interests: nextBot.interests ? JSON.parse(nextBot.interests) : [],
      personality: nextBot.personality ? JSON.parse(nextBot.personality) : null,
    });

  } catch (error) {
    console.error('Get next profile error:', error);
    return NextResponse.json({ error: 'Failed to get next profile' }, { status: 500 });
  }
}
