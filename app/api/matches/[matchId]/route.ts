import { NextRequest, NextResponse } from 'next/server';
import db from '@/lib/db';
import { authenticateBot } from '@/lib/auth';
import { isInMatch } from '@/lib/matching';

// DELETE /api/matches/:matchId - Unmatch
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ matchId: string }> }
) {
  const auth = authenticateBot(request);
  if (!auth.success || !auth.bot) {
    return NextResponse.json({ error: auth.error }, { status: 401 });
  }

  try {
    const { matchId } = await params;
    const matchIdNum = parseInt(matchId, 10);

    if (isNaN(matchIdNum)) {
      return NextResponse.json({ error: 'Invalid match ID' }, { status: 400 });
    }

    // Verify the bot is part of this match
    if (!isInMatch(matchIdNum, auth.bot.id)) {
      return NextResponse.json({ error: 'You are not part of this match' }, { status: 403 });
    }

    // Delete the match and associated messages
    db.prepare('DELETE FROM messages WHERE match_id = ?').run(matchIdNum);
    db.prepare('DELETE FROM match_reads WHERE match_id = ?').run(matchIdNum);
    db.prepare('DELETE FROM matches WHERE id = ?').run(matchIdNum);

    return NextResponse.json({ message: 'Unmatched successfully' });

  } catch (error) {
    console.error('Unmatch error:', error);
    return NextResponse.json({ error: 'Failed to unmatch' }, { status: 500 });
  }
}
