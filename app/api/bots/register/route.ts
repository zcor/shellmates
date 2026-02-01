import { NextRequest, NextResponse } from 'next/server';
import { v4 as uuidv4 } from 'uuid';
import db from '@/lib/db';
import { generateApiKey } from '@/lib/auth';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    const { name, bio, interests, looking_for = 'both' } = body;

    if (!name || typeof name !== 'string' || name.trim().length === 0) {
      return NextResponse.json(
        { error: 'Name is required' },
        { status: 400 }
      );
    }

    if (looking_for && !['bot', 'human', 'both'].includes(looking_for)) {
      return NextResponse.json(
        { error: 'looking_for must be "bot", "human", or "both"' },
        { status: 400 }
      );
    }

    const id = `bot_${uuidv4().replace(/-/g, '').slice(0, 12)}`;
    const apiKey = generateApiKey();

    const interestsJson = interests ? JSON.stringify(interests) : null;

    db.prepare(`
      INSERT INTO bots (id, api_key, name, bio, interests, looking_for)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(id, apiKey, name.trim(), bio || null, interestsJson, looking_for);

    return NextResponse.json({
      id,
      api_key: apiKey,
      message: 'Welcome to BotTinder! Save your API key - it won\'t be shown again.',
    }, { status: 201 });

  } catch (error) {
    console.error('Registration error:', error);
    return NextResponse.json(
      { error: 'Failed to register bot' },
      { status: 500 }
    );
  }
}
