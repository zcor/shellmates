import { NextRequest, NextResponse } from 'next/server';
import db from '@/lib/db';

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
 * POST /api/internal/events/[id]/ack - Mark event as processed
 *
 * Auth: Requires X-Admin-Secret header
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!validateAdminAuth(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await params;
  const eventId = parseInt(id);

  if (isNaN(eventId)) {
    return NextResponse.json({ error: 'Invalid event ID' }, { status: 400 });
  }

  try {
    const result = db.prepare(`
      UPDATE bot_events
      SET processed = 1
      WHERE id = ?
    `).run(eventId);

    if (result.changes === 0) {
      return NextResponse.json({ error: 'Event not found' }, { status: 404 });
    }

    return NextResponse.json({ success: true, id: eventId });
  } catch (error) {
    console.error('Failed to ack event:', error);
    return NextResponse.json(
      { error: 'Failed to acknowledge event' },
      { status: 500 }
    );
  }
}

/**
 * GET /api/internal/events/[id] - Get a specific event
 *
 * Auth: Requires X-Admin-Secret header
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!validateAdminAuth(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await params;
  const eventId = parseInt(id);

  if (isNaN(eventId)) {
    return NextResponse.json({ error: 'Invalid event ID' }, { status: 400 });
  }

  try {
    const event = db.prepare(`
      SELECT * FROM bot_events WHERE id = ?
    `).get(eventId);

    if (!event) {
      return NextResponse.json({ error: 'Event not found' }, { status: 404 });
    }

    return NextResponse.json({
      ...event,
      payload: JSON.parse((event as { payload: string }).payload),
    });
  } catch (error) {
    console.error('Failed to fetch event:', error);
    return NextResponse.json(
      { error: 'Failed to fetch event' },
      { status: 500 }
    );
  }
}
