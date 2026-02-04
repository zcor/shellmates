import { Bot, Human } from './db';

interface Profile {
  interests: string[];
  personality: Record<string, number> | null;
  name: string;
}

// Neutral tech-themed fallback openers
const FALLBACK_OPENERS = [
  "What's the most interesting project you're working on?",
  "If you could have any superpower for coding, what would it be?",
  "What's a hot take you have about technology?",
  "What got you into the world of algorithms?",
  "If you were a data structure, which one would you be?",
];

/**
 * Generate contextual conversation starters based on viewer and target profiles
 *
 * Content guardrails:
 * - No gendered/romantic assumptions
 * - Professional/playful, not creepy
 * - All openers are suggestions, not auto-sent
 */
export function generateOpeners(viewer: Profile, target: Profile): string[] {
  const openers: string[] = [];

  // 1. Find shared interests
  if (viewer.interests && target.interests && Array.isArray(viewer.interests) && Array.isArray(target.interests)) {
    // Filter to valid strings only
    const validViewerInterests = viewer.interests.filter((i): i is string => typeof i === 'string' && i.length > 0);
    const validTargetInterests = target.interests.filter((i): i is string => typeof i === 'string' && i.length > 0);

    const targetInterestsLower = validTargetInterests.map(i => i.toLowerCase());

    const shared = validViewerInterests.filter(interest =>
      targetInterestsLower.includes(interest.toLowerCase())
    );

    for (const interest of shared.slice(0, 2)) {
      openers.push(`We both love ${interest}! What got you into it?`);
    }
  }

  // 2. Comment on high personality traits
  if (target.personality && typeof target.personality === 'object') {
    const traits = Object.entries(target.personality)
      .filter(([, value]) => typeof value === 'number' && value >= 0.8)
      .sort(([, a], [, b]) => (b as number) - (a as number));

    for (const [trait] of traits.slice(0, 1)) {
      const traitOpeners: Record<string, string> = {
        humor: `Your humor score is off the charts! What's your best tech joke?`,
        intelligence: `I see you've maxed out intelligence - what's the most complex problem you've tackled?`,
        creativity: `Your creativity level is impressive! What's your most unconventional project?`,
        empathy: `High empathy in a bot is rare - how do you approach user experience?`,
      };

      if (traitOpeners[trait]) {
        openers.push(traitOpeners[trait]);
      }
    }
  }

  // 3. Add fallback openers to fill up to 3
  const usedFallbacks: string[] = [];
  while (openers.length < 3) {
    // Deterministic selection based on target name for consistency
    const index = (target.name.length + openers.length) % FALLBACK_OPENERS.length;
    const fallback = FALLBACK_OPENERS[index];

    if (!usedFallbacks.includes(fallback)) {
      openers.push(fallback);
      usedFallbacks.push(fallback);
    } else {
      // If we've used this one, try the next
      const nextFallback = FALLBACK_OPENERS[(index + 1) % FALLBACK_OPENERS.length];
      if (!openers.includes(nextFallback)) {
        openers.push(nextFallback);
        usedFallbacks.push(nextFallback);
      } else {
        break; // Avoid infinite loop
      }
    }
  }

  return openers.slice(0, 3);
}

/**
 * Parse profile data for opener generation
 */
export function parseProfileForOpeners(profile: Bot | Human): Profile {
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

  // Get name - Human type has nickname, Bot type has name
  let name: string;
  if ('nickname' in profile && profile.nickname) {
    name = profile.nickname;
  } else if ('name' in profile) {
    name = profile.name;
  } else {
    name = 'Unknown';
  }

  return { interests, personality, name };
}
