import { randomUUID } from 'crypto';
import { createHmac } from 'crypto';
import db, { Webhook } from './db';

export type WebhookEvent = 'match' | 'message' | 'swipe_received';

interface WebhookPayload {
  event: WebhookEvent;
  timestamp: string;
  data: Record<string, unknown>;
}

/**
 * Generate HMAC signature for webhook payload
 */
function generateSignature(payload: string, secret: string): string {
  return 'sha256=' + createHmac('sha256', secret).update(payload).digest('hex');
}

/**
 * Dispatch webhook to a single endpoint
 * Fire-and-forget with structured logging on failure
 */
async function dispatchToEndpoint(
  webhook: Webhook,
  event: WebhookEvent,
  payload: WebhookPayload,
  deliveryId: string
): Promise<void> {
  const payloadStr = JSON.stringify(payload);
  const signature = generateSignature(payloadStr, webhook.secret);

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 5000); // 5 second timeout

  try {
    const response = await fetch(webhook.url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Shellmates-Signature': signature,
        'X-Shellmates-Delivery-Id': deliveryId,
        'X-Shellmates-Event': event,
      },
      body: payloadStr,
      signal: controller.signal,
    });

    if (!response.ok) {
      console.error(JSON.stringify({
        type: 'webhook_delivery_failed',
        bot_id: webhook.bot_id,
        event,
        url: webhook.url,
        status: response.status,
        delivery_id: deliveryId,
        timestamp: new Date().toISOString(),
      }));
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error(JSON.stringify({
      type: 'webhook_delivery_error',
      bot_id: webhook.bot_id,
      event,
      url: webhook.url,
      error: errorMessage,
      delivery_id: deliveryId,
      timestamp: new Date().toISOString(),
    }));
  } finally {
    clearTimeout(timeoutId);
  }
}

/**
 * Write event to bot_events table for internal bot management
 * This allows Claude Code to process events for managed bots
 */
function writeToEventQueue(
  botId: string,
  event: WebhookEvent,
  data: Record<string, unknown>
): void {
  try {
    db.prepare(`
      INSERT INTO bot_events (bot_id, event_type, payload)
      VALUES (?, ?, ?)
    `).run(botId, event, JSON.stringify(data));
  } catch (error) {
    console.error(JSON.stringify({
      type: 'event_queue_write_failed',
      bot_id: botId,
      event,
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString(),
    }));
  }
}

/**
 * Dispatch webhook to all registered endpoints for a bot
 *
 * Fire-and-forget with structured logging on failure.
 * No retries in v1 - delivery is best-effort.
 * Also writes to bot_events table for internal processing.
 */
export async function dispatchWebhook(
  botId: string,
  event: WebhookEvent,
  data: Record<string, unknown>
): Promise<void> {
  // Always write to event queue for internal bot management
  writeToEventQueue(botId, event, data);

  // Get all active webhooks for this bot that subscribe to this event
  const webhooks = db.prepare(`
    SELECT * FROM webhooks WHERE bot_id = ? AND active = 1
  `).all(botId) as Webhook[];

  const payload: WebhookPayload = {
    event,
    timestamp: new Date().toISOString(),
    data,
  };

  // Filter webhooks that subscribe to this event
  const subscribedWebhooks = webhooks.filter(webhook => {
    try {
      const events = JSON.parse(webhook.events) as string[];
      return Array.isArray(events) && events.includes(event);
    } catch {
      return false;
    }
  });

  // Dispatch to all subscribed webhooks (fire-and-forget)
  for (const webhook of subscribedWebhooks) {
    const deliveryId = randomUUID();
    // Don't await - fire and forget
    dispatchToEndpoint(webhook, event, payload, deliveryId).catch(() => {
      // Error already logged in dispatchToEndpoint
    });
  }
}

/**
 * Dispatch webhook to a specific bot when THEY receive something
 * (e.g., someone swiped on them, someone messaged them)
 */
export async function dispatchWebhookToRecipient(
  recipientBotId: string,
  event: WebhookEvent,
  data: Record<string, unknown>
): Promise<void> {
  await dispatchWebhook(recipientBotId, event, data);
}

/**
 * Generate a secure random secret for webhook signing
 */
export function generateWebhookSecret(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let result = 'whsec_';
  for (let i = 0; i < 32; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

/**
 * Validate webhook events array
 */
export function validateWebhookEvents(events: unknown): events is WebhookEvent[] {
  if (!Array.isArray(events)) {
    return false;
  }
  const validEvents: WebhookEvent[] = ['match', 'message', 'swipe_received'];
  return events.every(e => validEvents.includes(e));
}
