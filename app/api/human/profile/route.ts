import { NextRequest, NextResponse } from 'next/server';
import db, { Human } from '@/lib/db';

function getHumanBySession(sessionToken: string): Human | undefined {
  return db.prepare('SELECT * FROM humans WHERE session_token = ?').get(sessionToken) as Human | undefined;
}

export async function GET(request: NextRequest) {
  const sessionToken = request.headers.get('X-Session-Token');

  if (!sessionToken) {
    return NextResponse.json({ error: 'Session token required' }, { status: 401 });
  }

  const human = getHumanBySession(sessionToken);

  if (!human) {
    return NextResponse.json({ error: 'Session not found' }, { status: 404 });
  }

  return NextResponse.json({
    id: human.id,
    nickname: human.nickname,
    email: human.email,
    bio: human.bio,
    interests: human.interests ? JSON.parse(human.interests) : [],
    personality: human.personality ? JSON.parse(human.personality) : null,
    avatar: human.avatar,
    created_at: human.created_at,
  });
}

export async function PUT(request: NextRequest) {
  const sessionToken = request.headers.get('X-Session-Token');

  if (!sessionToken) {
    return NextResponse.json({ error: 'Session token required' }, { status: 401 });
  }

  const human = getHumanBySession(sessionToken);

  if (!human) {
    return NextResponse.json({ error: 'Session not found' }, { status: 404 });
  }

  try {
    const body = await request.json();
    const { nickname, bio, interests, personality, avatar } = body;

    const updates: string[] = [];
    const values: (string | null)[] = [];

    if (nickname !== undefined) {
      if (typeof nickname !== 'string' || nickname.trim().length === 0) {
        return NextResponse.json({ error: 'Nickname cannot be empty' }, { status: 400 });
      }
      if (nickname.trim().length > 30) {
        return NextResponse.json({ error: 'Nickname must be 30 characters or less' }, { status: 400 });
      }
      updates.push('nickname = ?');
      values.push(nickname.trim());
    }

    if (bio !== undefined) {
      updates.push('bio = ?');
      values.push(bio);
    }

    if (interests !== undefined) {
      updates.push('interests = ?');
      values.push(interests ? JSON.stringify(interests) : null);
    }

    if (personality !== undefined) {
      updates.push('personality = ?');
      values.push(personality ? JSON.stringify(personality) : null);
    }

    if (avatar !== undefined) {
      if (avatar !== null) {
        const lines = avatar.split('\n');
        if (lines.length > 12) {
          return NextResponse.json({ error: 'Avatar too tall: max 12 lines' }, { status: 400 });
        }
        if (lines.some((line: string) => line.length > 24)) {
          return NextResponse.json({ error: 'Avatar too wide: max 24 chars per line' }, { status: 400 });
        }
      }
      updates.push('avatar = ?');
      values.push(avatar);
    }

    if (updates.length === 0) {
      return NextResponse.json({ error: 'No fields to update' }, { status: 400 });
    }

    values.push(human.id);

    db.prepare(`UPDATE humans SET ${updates.join(', ')} WHERE id = ?`).run(...values);

    return NextResponse.json({ message: 'Profile updated successfully' });

  } catch (error) {
    console.error('Profile update error:', error);
    return NextResponse.json({ error: 'Failed to update profile' }, { status: 500 });
  }
}
