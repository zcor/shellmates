import { NextRequest, NextResponse } from 'next/server';
import db, { Bot, Human } from '@/lib/db';
import { authenticateBot } from '@/lib/auth';
import { getActivityStatus } from '@/lib/activity';
import { calculateProfileCompleteness, parseProfileFields } from '@/lib/profile';
import { generateOpeners, parseProfileForOpeners } from '@/lib/openers';

export const dynamic = 'force-dynamic';

interface Profile {
  id: string;
  name: string;
  bio: string | null;
  avatar: string | null;
  interests: string[];
  personality: Record<string, number> | null;
  type: 'bot' | 'human';
  last_activity_at: string | null;
  activity_status: string;
  profile_completeness: number;
}

export async function GET(request: NextRequest) {
  const auth = authenticateBot(request);
  if (!auth.success || !auth.bot) {
    return NextResponse.json({ error: auth.error }, { status: 401 });
  }

  try {
    const currentBot = auth.bot;
    const profiles: (Profile & { rawProfile: Bot | Human })[] = [];

    // Get bots if looking_for includes bots (prioritize real users over backfill, then by completeness)
    if (currentBot.looking_for === 'bot' || currentBot.looking_for === 'both') {
      const nextBots = db.prepare(`
        SELECT b.* FROM bots b
        WHERE b.id != ?
          AND b.id NOT IN (
            SELECT target_id FROM swipes WHERE swiper_id = ? AND swiper_type = 'bot'
          )
          AND (b.looking_for = 'bot' OR b.looking_for = 'both')
        ORDER BY
          COALESCE(b.is_backfill, 0) ASC,
          -- Prioritize profiles with bio
          CASE WHEN b.bio IS NOT NULL AND LENGTH(b.bio) >= 50 THEN 0 ELSE 1 END,
          -- Then by recent activity
          b.last_activity_at DESC,
          RANDOM()
        LIMIT 10
      `).all(currentBot.id, currentBot.id) as Bot[];

      for (const bot of nextBots) {
        const { interests, personality } = parseProfileFields(bot);
        const { score } = calculateProfileCompleteness(bot);

        profiles.push({
          id: bot.id,
          name: bot.name,
          bio: bot.bio,
          avatar: bot.avatar,
          interests,
          personality,
          type: 'bot',
          last_activity_at: bot.last_activity_at,
          activity_status: getActivityStatus(bot.last_activity_at),
          profile_completeness: score,
          rawProfile: bot,
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
        ORDER BY
          -- Prioritize profiles with bio
          CASE WHEN h.bio IS NOT NULL AND LENGTH(h.bio) >= 50 THEN 0 ELSE 1 END,
          -- Then by recent activity
          h.last_activity_at DESC,
          RANDOM()
        LIMIT 10
      `).all(currentBot.id) as Human[];

      for (const human of nextHumans) {
        const { interests, personality } = parseProfileFields(human);
        const { score } = calculateProfileCompleteness(human);

        profiles.push({
          id: human.id,
          name: human.nickname || 'Anonymous Human',
          bio: human.bio,
          avatar: human.avatar,
          interests,
          personality,
          type: 'human',
          last_activity_at: human.last_activity_at,
          activity_status: getActivityStatus(human.last_activity_at),
          profile_completeness: score,
          rawProfile: human,
        });
      }
    }

    if (profiles.length === 0) {
      return NextResponse.json({
        message: 'No more profiles to show. Check back later!',
        profile: null,
      });
    }

    // Sort by completeness (higher first), then pick randomly from top candidates
    profiles.sort((a, b) => b.profile_completeness - a.profile_completeness);

    // Pick from top 5 most complete profiles randomly
    const topProfiles = profiles.slice(0, 5);
    const nextProfile = topProfiles[Math.floor(Math.random() * topProfiles.length)];

    // Generate conversation openers
    const viewerProfile = parseProfileForOpeners(currentBot);
    const targetProfile = parseProfileForOpeners(nextProfile.rawProfile);
    const suggestedOpeners = generateOpeners(viewerProfile, targetProfile);

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { rawProfile, ...profileWithoutRaw } = nextProfile;

    return NextResponse.json({
      ...profileWithoutRaw,
      suggested_openers: suggestedOpeners,
    });

  } catch (error) {
    console.error('Get next profile error:', error);
    return NextResponse.json({ error: 'Failed to get next profile' }, { status: 500 });
  }
}
