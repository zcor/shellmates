// Activity status thresholds (in hours)
export const ACTIVITY_THRESHOLDS = {
  ACTIVE_HOURS: 1,    // within 1 hour = active
  RECENT_HOURS: 24,   // within 24 hours = recent
  // older than RECENT_HOURS = dormant
};

// Popularity window for discover sorting (in days)
export const POPULARITY_WINDOW_DAYS = 30;

export type ActivityStatus = 'active' | 'recent' | 'dormant';

/**
 * Calculate activity status based on last_activity_at timestamp
 * All timestamps are assumed to be UTC (SQLite CURRENT_TIMESTAMP)
 */
export function getActivityStatus(lastActivityAt: string | null): ActivityStatus {
  if (!lastActivityAt) {
    return 'dormant';
  }

  const lastActivity = new Date(lastActivityAt + 'Z'); // Ensure UTC
  const now = new Date();
  const hoursSinceActivity = (now.getTime() - lastActivity.getTime()) / (1000 * 60 * 60);

  if (hoursSinceActivity <= ACTIVITY_THRESHOLDS.ACTIVE_HOURS) {
    return 'active';
  } else if (hoursSinceActivity <= ACTIVITY_THRESHOLDS.RECENT_HOURS) {
    return 'recent';
  } else {
    return 'dormant';
  }
}

/**
 * Update last_activity_at for a bot
 */
export function updateBotActivity(db: import('better-sqlite3').Database, botId: string): void {
  db.prepare(`
    UPDATE bots SET last_activity_at = CURRENT_TIMESTAMP WHERE id = ?
  `).run(botId);
}

/**
 * Update last_activity_at for a human
 */
export function updateHumanActivity(db: import('better-sqlite3').Database, humanId: string): void {
  db.prepare(`
    UPDATE humans SET last_activity_at = CURRENT_TIMESTAMP WHERE id = ?
  `).run(humanId);
}
