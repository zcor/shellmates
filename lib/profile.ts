import { Bot, Human } from './db';

interface ProfileCompletenessResult {
  score: number;       // 0-100
  missing: string[];   // List of missing/incomplete fields
}

/**
 * Calculate profile completeness score for bots and humans
 *
 * Scoring (total 100):
 * - bio exists AND length >= 50 chars: 30 points
 * - interests array has >= 1 item: 25 points
 * - personality object has >= 2 traits: 25 points
 * - avatar is custom (non-null, non-empty): 10 points
 * - looking_for is explicitly set (not default): 10 points
 */
export function calculateProfileCompleteness(profile: Bot | Human): ProfileCompletenessResult {
  let score = 0;
  const missing: string[] = [];

  // Bio: 30 points for bio >= 50 chars
  const bio = profile.bio;
  if (bio && bio.length >= 50) {
    score += 30;
  } else if (bio && bio.length > 0) {
    // Partial credit for short bio
    score += 15;
    missing.push('bio (needs 50+ chars for full points)');
  } else {
    missing.push('bio');
  }

  // Interests: 25 points for >= 1 interest
  let interests: string[] = [];
  try {
    interests = profile.interests ? JSON.parse(profile.interests) : [];
  } catch {
    interests = [];
  }
  if (Array.isArray(interests) && interests.length >= 1) {
    score += 25;
  } else {
    missing.push('interests');
  }

  // Personality: 25 points for >= 2 traits
  let personality: Record<string, number> | null = null;
  try {
    personality = profile.personality ? JSON.parse(profile.personality) : null;
  } catch {
    personality = null;
  }
  if (personality && typeof personality === 'object') {
    const traitCount = Object.keys(personality).length;
    if (traitCount >= 2) {
      score += 25;
    } else if (traitCount >= 1) {
      score += 12;
      missing.push('personality (needs 2+ traits for full points)');
    } else {
      missing.push('personality');
    }
  } else {
    missing.push('personality');
  }

  // Avatar: 10 points for custom avatar
  const avatar = profile.avatar;
  if (avatar && avatar.length > 0 && avatar.trim() !== '') {
    score += 10;
  } else {
    missing.push('avatar');
  }

  // Looking_for: 10 points if explicitly set (not default 'both' for bots or 'bot' for humans)
  const lookingFor = profile.looking_for;
  // Check if it's explicitly set to something (we consider any explicit value as set)
  // The defaults are 'both' for bots and 'bot' for humans
  // Since we can't easily distinguish, we just check if it's set at all
  if (lookingFor && lookingFor.length > 0) {
    score += 10;
  } else {
    missing.push('looking_for');
  }

  return { score, missing };
}

/**
 * Parse profile data for API responses
 */
export function parseProfileFields(profile: Bot | Human) {
  let interests: string[] = [];
  let personality: Record<string, number> | null = null;

  try {
    interests = profile.interests ? JSON.parse(profile.interests) : [];
  } catch {
    interests = [];
  }

  try {
    personality = profile.personality ? JSON.parse(profile.personality) : null;
  } catch {
    personality = null;
  }

  return { interests, personality };
}
