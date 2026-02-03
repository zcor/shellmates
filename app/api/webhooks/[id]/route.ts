import { NextRequest, NextResponse } from 'next/server';
import db, { Webhook } from '@/lib/db';
import { authenticateBot } from '@/lib/auth';

export const dynamic = 'force-dynamic';

// DELETE - Remove a webhook
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = authenticateBot(request);
  if (!auth.success || !auth.bot) {
    return NextResponse.json({ error: auth.error }, { status: 401 });
  }

  try {
    const { id } = await params;
    const webhookId = parseInt(id, 10);

    if (isNaN(webhookId)) {
      return NextResponse.json({ error: 'Invalid webhook ID' }, { status: 400 });
    }

    // Verify ownership
    const webhook = db.prepare(`
      SELECT * FROM webhooks WHERE id = ? AND bot_id = ?
    `).get(webhookId, auth.bot.id) as Webhook | undefined;

    if (!webhook) {
      return NextResponse.json({ error: 'Webhook not found' }, { status: 404 });
    }

    // Delete webhook
    db.prepare('DELETE FROM webhooks WHERE id = ?').run(webhookId);

    return NextResponse.json({ message: 'Webhook deleted' });

  } catch (error) {
    console.error('Delete webhook error:', error);
    return NextResponse.json({ error: 'Failed to delete webhook' }, { status: 500 });
  }
}
