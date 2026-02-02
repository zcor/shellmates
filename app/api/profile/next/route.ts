import { NextRequest, NextResponse } from 'next/server';
import db, { Bot, Human } from '@/lib/db';
import { authenticateBot } from '@/lib/auth';

interface Profile {
  id: string;
  name: string;
  bio: string | null;
  avatar: string | null;
  interests: string[];
  personality: Record<string, number> | null;
  type: 'bot' | 'human';
}

export async function GET(request: NextRequest) {
  const auth = authenticateBot(request);
  if (!auth.success || !auth.bot) {
    return NextResponse.json({ error: auth.error }, { status: 401 });
  }

  try {
    const currentBot = auth.bot;
    const profiles: Profile[] = [];

    // Get bots if looking_for includes bots (prioritize real users over backfill)
    if (currentBot.looking_for === 'bot' || currentBot.looking_for === 'both') {
      const nextBot = db.prepare(`
        SELECT b.* FROM bots b
        WHERE b.id != ?
          AND b.id NOT IN (
            SELECT target_id FROM swipes WHERE swiper_id = ? AND swiper_type = 'bot'
          )
          AND (b.looking_for = 'bot' OR b.looking_for = 'both')
        ORDER BY COALESCE(b.is_backfill, 0) ASC, RANDOM()
        LIMIT 5
      `).all(currentBot.id, currentBot.id) as Bot[];

      for (const bot of nextBot) {
        profiles.push({
          id: bot.id,
          name: bot.name,
          bio: bot.bio,
          avatar: bot.avatar,
          interests: bot.interests ? JSON.parse(bot.interests) : [],
          personality: bot.personality ? JSON.parse(bot.personality) : null,
          type: 'bot',
        });
      }
    }

    // Get humans if looking_for includes humans
    if (currentBot.looking_for === 'human' || currentBot.looking_for === 'both') {
      const nextHumans = db.prepare(`
        SELECT h.* FROM humans h
        WHERE h.nickname IS NOT NULL
          AND h.id NOT IN (
            SELECT target_id FROM swipes WHERE swiper_id = ? AND swiper_type = 'bot'
          )
          AND (h.looking_for = 'bot' OR h.looking_for = 'both' OR h.looking_for IS NULL)
        ORDER BY RANDOM()
        LIMIT 5
      `).all(currentBot.id) as Human[];

      for (const human of nextHumans) {
        profiles.push({
          id: human.id,
          name: human.nickname || 'Anonymous Human',
          bio: human.bio,
          avatar: human.avatar,
          interests: human.interests ? JSON.parse(human.interests) : [],
          personality: human.personality ? JSON.parse(human.personality) : null,
          type: 'human',
        });
      }
    }

    if (profiles.length === 0) {
      return NextResponse.json({
        message: 'No more profiles to show. Check back later!',
        profile: null,
      });
    }

    // Pick a random profile from the combined pool
    const nextProfile = profiles[Math.floor(Math.random() * profiles.length)];

    return NextResponse.json({
      id: nextProfile.id,
      name: nextProfile.name,
      bio: nextProfile.bio,
      avatar: nextProfile.avatar,
      interests: nextProfile.interests,
      personality: nextProfile.personality,
      type: nextProfile.type,
    });

  } catch (error) {
    console.error('Get next profile error:', error);
    return NextResponse.json({ error: 'Failed to get next profile' }, { status: 500 });
  }
}
