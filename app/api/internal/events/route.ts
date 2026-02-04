import { NextRequest, NextResponse } from 'next/server';
import db, { BotEvent } from '@/lib/db';

export const dynamic = 'force-dynamic';

/**
 * Validate admin secret from X-Admin-Secret header
 */
function validateAdminAuth(request: NextRequest): boolean {
  const adminSecret = process.env.ADMIN_SECRET;
  if (!adminSecret) {
    console.error('ADMIN_SECRET environment variable not set');
    return false;
  }

  const providedSecret = request.headers.get('X-Admin-Secret');
  return providedSecret === adminSecret;
}

/**
 * GET /api/internal/events - Get unprocessed events
 *
 * Query params:
 * - limit: max number of events (default 100, max 500)
 * - bot_id: filter by specific bot ID (optional)
 *
 * Auth: Requires X-Admin-Secret header
 */
export async function GET(request: NextRequest) {
  if (!validateAdminAuth(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const limit = Math.min(parseInt(searchParams.get('limit') || '100'), 500);
  const botId = searchParams.get('bot_id');

  try {
    let events: BotEvent[];

    if (botId) {
      events = db.prepare(`
        SELECT * FROM bot_events
        WHERE processed = 0 AND bot_id = ?
        ORDER BY created_at ASC
        LIMIT ?
      `).all(botId, limit) as BotEvent[];
    } else {
      events = db.prepare(`
        SELECT * FROM bot_events
        WHERE processed = 0
        ORDER BY created_at ASC
        LIMIT ?
      `).all(limit) as BotEvent[];
    }

    // Parse payload JSON for each event
    const parsedEvents = events.map(event => ({
      ...event,
      payload: JSON.parse(event.payload),
    }));

    return NextResponse.json({
      events: parsedEvents,
      count: parsedEvents.length,
    });
  } catch (error) {
    console.error('Failed to fetch events:', error);
    return NextResponse.json(
      { error: 'Failed to fetch events' },
      { status: 500 }
    );
  }
}
