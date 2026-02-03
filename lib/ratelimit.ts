import db from './db';

interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetAt: Date;
}

/**
 * SQLite-backed rate limiter that persists across restarts
 *
 * Tracks request counts per bot_id/endpoint combination with sliding window.
 * Includes TTL cleanup to remove entries older than 1 hour.
 */
export function checkRateLimit(
  botId: string,
  endpoint: string,
  maxRequests: number,
  windowMinutes: number
): RateLimitResult {
  const now = new Date();
  const windowMs = windowMinutes * 60 * 1000;
  const windowStart = new Date(now.getTime() - windowMs);

  // Clean up old entries (older than 1 hour)
  const cleanupThreshold = new Date(now.getTime() - 60 * 60 * 1000);
  db.prepare(`
    DELETE FROM rate_limits WHERE window_start < ?
  `).run(cleanupThreshold.toISOString());

  // Get current rate limit entry
  const entry = db.prepare(`
    SELECT * FROM rate_limits WHERE bot_id = ? AND endpoint = ?
  `).get(botId, endpoint) as { request_count: number; window_start: string } | undefined;

  if (!entry) {
    // First request - create entry
    db.prepare(`
      INSERT INTO rate_limits (bot_id, endpoint, request_count, window_start)
      VALUES (?, ?, 1, ?)
    `).run(botId, endpoint, now.toISOString());

    return {
      allowed: true,
      remaining: maxRequests - 1,
      resetAt: new Date(now.getTime() + windowMs),
    };
  }

  const entryWindowStart = new Date(entry.window_start);

  // Check if window has expired
  if (entryWindowStart < windowStart) {
    // Reset the window
    db.prepare(`
      UPDATE rate_limits
      SET request_count = 1, window_start = ?
      WHERE bot_id = ? AND endpoint = ?
    `).run(now.toISOString(), botId, endpoint);

    return {
      allowed: true,
      remaining: maxRequests - 1,
      resetAt: new Date(now.getTime() + windowMs),
    };
  }

  // Within window - check count
  if (entry.request_count >= maxRequests) {
    const resetAt = new Date(entryWindowStart.getTime() + windowMs);
    return {
      allowed: false,
      remaining: 0,
      resetAt,
    };
  }

  // Increment counter
  db.prepare(`
    UPDATE rate_limits SET request_count = request_count + 1
    WHERE bot_id = ? AND endpoint = ?
  `).run(botId, endpoint);

  const resetAt = new Date(entryWindowStart.getTime() + windowMs);
  return {
    allowed: true,
    remaining: maxRequests - entry.request_count - 1,
    resetAt,
  };
}

/**
 * Create rate limit error response
 */
export function rateLimitResponse(resetAt: Date) {
  return {
    error: 'Rate limit exceeded',
    retry_after: Math.ceil((resetAt.getTime() - Date.now()) / 1000),
    reset_at: resetAt.toISOString(),
  };
}
