import { NextRequest, NextResponse } from 'next/server';
import db, { Webhook } from '@/lib/db';
import { authenticateBot } from '@/lib/auth';
import { generateWebhookSecret, validateWebhookEvents } from '@/lib/webhooks';

export const dynamic = 'force-dynamic';

// POST - Register a new webhook
export async function POST(request: NextRequest) {
  const auth = authenticateBot(request);
  if (!auth.success || !auth.bot) {
    return NextResponse.json({ error: auth.error }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { url, events } = body;

    // Validate URL
    if (!url || typeof url !== 'string') {
      return NextResponse.json({ error: 'url is required' }, { status: 400 });
    }

    try {
      new URL(url);
    } catch {
      return NextResponse.json({ error: 'Invalid URL format' }, { status: 400 });
    }

    // Validate events
    if (!validateWebhookEvents(events)) {
      return NextResponse.json({
        error: 'events must be an array containing: "match", "message", and/or "swipe_received"',
      }, { status: 400 });
    }

    if (events.length === 0) {
      return NextResponse.json({ error: 'At least one event is required' }, { status: 400 });
    }

    // Check webhook limit (max 3 per bot)
    const existingCount = db.prepare(`
      SELECT COUNT(*) as count FROM webhooks WHERE bot_id = ?
    `).get(auth.bot.id) as { count: number };

    if (existingCount.count >= 3) {
      return NextResponse.json({
        error: 'Maximum 3 webhooks per bot. Delete an existing webhook first.',
      }, { status: 400 });
    }

    // Generate secret
    const secret = generateWebhookSecret();

    // Create webhook
    const result = db.prepare(`
      INSERT INTO webhooks (bot_id, url, events, secret)
      VALUES (?, ?, ?, ?)
    `).run(auth.bot.id, url, JSON.stringify(events), secret);

    return NextResponse.json({
      id: Number(result.lastInsertRowid),
      url,
      events,
      secret,
      active: true,
      message: 'Webhook registered. Save the secret - it will not be shown again.',
    }, { status: 201 });

  } catch (error) {
    console.error('Register webhook error:', error);
    return NextResponse.json({ error: 'Failed to register webhook' }, { status: 500 });
  }
}

// GET - List all webhooks for this bot
export async function GET(request: NextRequest) {
  const auth = authenticateBot(request);
  if (!auth.success || !auth.bot) {
    return NextResponse.json({ error: auth.error }, { status: 401 });
  }

  try {
    const webhooks = db.prepare(`
      SELECT id, url, events, active, created_at FROM webhooks WHERE bot_id = ?
    `).all(auth.bot.id) as Omit<Webhook, 'bot_id' | 'secret'>[];

    const formattedWebhooks = webhooks.map(webhook => ({
      id: webhook.id,
      url: webhook.url,
      events: JSON.parse(webhook.events),
      active: webhook.active === 1,
      created_at: webhook.created_at,
    }));

    return NextResponse.json({ webhooks: formattedWebhooks });

  } catch (error) {
    console.error('List webhooks error:', error);
    return NextResponse.json({ error: 'Failed to list webhooks' }, { status: 500 });
  }
}
