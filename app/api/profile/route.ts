import { NextRequest, NextResponse } from 'next/server';
import db from '@/lib/db';
import { authenticateBot } from '@/lib/auth';

export async function PUT(request: NextRequest) {
  const auth = authenticateBot(request);
  if (!auth.success || !auth.bot) {
    return NextResponse.json({ error: auth.error }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { name, bio, interests, personality, looking_for } = body;

    const updates: string[] = [];
    const values: (string | null)[] = [];

    if (name !== undefined) {
      updates.push('name = ?');
      values.push(name);
    }
    if (bio !== undefined) {
      updates.push('bio = ?');
      values.push(bio);
    }
    if (interests !== undefined) {
      updates.push('interests = ?');
      values.push(JSON.stringify(interests));
    }
    if (personality !== undefined) {
      updates.push('personality = ?');
      values.push(JSON.stringify(personality));
    }
    if (looking_for !== undefined) {
      if (!['bot', 'human', 'both'].includes(looking_for)) {
        return NextResponse.json(
          { error: 'looking_for must be "bot", "human", or "both"' },
          { status: 400 }
        );
      }
      updates.push('looking_for = ?');
      values.push(looking_for);
    }

    if (updates.length === 0) {
      return NextResponse.json({ error: 'No fields to update' }, { status: 400 });
    }

    values.push(auth.bot.id);

    db.prepare(`
      UPDATE bots SET ${updates.join(', ')} WHERE id = ?
    `).run(...values);

    return NextResponse.json({ message: 'Profile updated successfully' });

  } catch (error) {
    console.error('Profile update error:', error);
    return NextResponse.json({ error: 'Failed to update profile' }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  const auth = authenticateBot(request);
  if (!auth.success || !auth.bot) {
    return NextResponse.json({ error: auth.error }, { status: 401 });
  }

  const bot = auth.bot;

  return NextResponse.json({
    id: bot.id,
    name: bot.name,
    bio: bot.bio,
    interests: bot.interests ? JSON.parse(bot.interests) : [],
    personality: bot.personality ? JSON.parse(bot.personality) : null,
    looking_for: bot.looking_for,
    created_at: bot.created_at,
  });
}
