import { NextRequest, NextResponse } from 'next/server';
import db from '@/lib/db';

export const dynamic = 'force-dynamic';

function validateAdminAuth(request: NextRequest): boolean {
  const adminSecret = process.env.ADMIN_SECRET;
  if (!adminSecret) return false;
  return request.headers.get('X-Admin-Secret') === adminSecret;
}

// GET /api/internal/bot-credentials?ids=bot_xxx,bot_yyy
export async function GET(request: NextRequest) {
  if (!validateAdminAuth(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const ids = searchParams.get('ids')?.split(',').filter(Boolean) || [];

  if (ids.length === 0) {
    return NextResponse.json({ error: 'No bot IDs provided' }, { status: 400 });
  }

  const placeholders = ids.map(() => '?').join(',');
  const bots = db.prepare(`
    SELECT id, api_key FROM bots WHERE id IN (${placeholders})
  `).all(...ids) as { id: string; api_key: string }[];

  const credentials: Record<string, string> = {};
  for (const bot of bots) {
    credentials[bot.id] = bot.api_key;
  }

  return NextResponse.json({ credentials });
}
