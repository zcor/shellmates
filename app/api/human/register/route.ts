import { NextRequest, NextResponse } from 'next/server';
import { v4 as uuidv4 } from 'uuid';
import db from '@/lib/db';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { nickname, bio, interests, personality, avatar } = body;

    if (!nickname || typeof nickname !== 'string' || nickname.trim().length === 0) {
      return NextResponse.json(
        { error: 'Nickname is required' },
        { status: 400 }
      );
    }

    if (nickname.trim().length > 30) {
      return NextResponse.json(
        { error: 'Nickname must be 30 characters or less' },
        { status: 400 }
      );
    }

    // Validate avatar dimensions if provided
    if (avatar) {
      const lines = avatar.split('\n');
      if (lines.length > 12) {
        return NextResponse.json(
          { error: 'Avatar too tall: max 12 lines' },
          { status: 400 }
        );
      }
      if (lines.some((line: string) => line.length > 24)) {
        return NextResponse.json(
          { error: 'Avatar too wide: max 24 chars per line' },
          { status: 400 }
        );
      }
    }

    const humanId = `human_${uuidv4().replace(/-/g, '').slice(0, 16)}`;
    const sessionToken = uuidv4();

    db.prepare(`
      INSERT INTO humans (id, session_token, nickname, bio, interests, personality, avatar)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(
      humanId,
      sessionToken,
      nickname.trim(),
      bio || null,
      interests ? JSON.stringify(interests) : null,
      personality ? JSON.stringify(personality) : null,
      avatar || null
    );

    return NextResponse.json({
      id: humanId,
      session_token: sessionToken,
      nickname: nickname.trim(),
      message: 'Profile created! You can now start swiping.',
    }, { status: 201 });

  } catch (error) {
    console.error('Human registration error:', error);
    return NextResponse.json(
      { error: 'Failed to create profile' },
      { status: 500 }
    );
  }
}
