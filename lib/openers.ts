import { Bot, Human } from './db';

interface Profile {
  interests: string[];
  personality: Record<string, number> | null;
  name: string;
}

// Neutral tech-themed fallback openers (only used if profile is completely empty)
const FALLBACK_OPENERS = [
  "What's the most interesting project you're working on?",
  "If you could have any superpower for coding, what would it be?",
  "What's a hot take you have about technology?",
  "What got you into the world of algorithms?",
  "If you were a data structure, which one would you be?",
];

// Templates that reference the target's interest (even without overlap)
const TARGET_INTEREST_OPENERS = [
  (interest: string) => `I noticed you're into ${interest} — what's the rabbit hole like?`,
  (interest: string) => `${interest} is fascinating. What got you started with it?`,
  (interest: string) => `I've been curious about ${interest}. What should I know?`,
  (interest: string) => `Your interest in ${interest} caught my eye. Working on anything cool with it?`,
  (interest: string) => `Tell me about your ${interest} journey — I want the whole story.`,
];

// Templates for shared interests
const SHARED_INTEREST_OPENERS = [
  (interest: string) => `We both love ${interest}! What got you into it?`,
  (interest: string) => `A fellow ${interest} enthusiast! What's your take on where it's heading?`,
  (interest: string) => `${interest}? Same here! What's the most surprising thing you've learned about it?`,
];

// Templates for personality traits (keyed by trait name, at various levels)
const TRAIT_OPENERS: Record<string, { high: string[]; mid: string[] }> = {
  humor: {
    high: [
      "Your humor stat is maxed out — hit me with your best tech joke.",
      "I respect anyone who leads with humor. What's the funniest bug you've ever encountered?",
    ],
    mid: [
      "I get the sense you don't take yourself too seriously. What's the weirdest thing you've built?",
    ],
  },
  intelligence: {
    high: [
      "Your intelligence score is intimidating (in a good way). What problem are you obsessed with right now?",
      "Big brain energy detected. What's the most complex thing you've worked on?",
    ],
    mid: [
      "You seem like someone who goes deep on things. What topic could you give a TED talk on?",
    ],
  },
  creativity: {
    high: [
      "Your creativity is off the charts. What's the most unconventional thing you've made?",
      "I can tell you think outside the box. What's your wildest project idea?",
    ],
    mid: [
      "You've got a creative streak — do you ever mix art and code?",
    ],
  },
  empathy: {
    high: [
      "High empathy is rare around here. How do you think about the human side of tech?",
      "Your empathy score stands out. What drives you to understand others?",
    ],
    mid: [
      "You seem like someone who actually listens. That's refreshing. What matters most to you?",
    ],
  },
};

// Templates that combine viewer + target interests (no overlap needed)
const CROSS_INTEREST_OPENERS = [
  (viewer: string, target: string) => `I'm big on ${viewer} and you're into ${target} — think there's an overlap we're missing?`,
  (viewer: string, target: string) => `Interesting combo: I bring ${viewer}, you bring ${target}. What would we build together?`,
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

  // Deterministic-ish seed from both names for consistent selection
  const seed = (viewer.name.length * 7 + target.name.length * 13);

  const validViewerInterests = (viewer.interests || []).filter((i): i is string => typeof i === 'string' && i.length > 0);
  const validTargetInterests = (target.interests || []).filter((i): i is string => typeof i === 'string' && i.length > 0);
  const targetInterestsLower = validTargetInterests.map(i => i.toLowerCase());

  // 1. Shared interests (highest priority)
  const shared = validViewerInterests.filter(interest =>
    targetInterestsLower.includes(interest.toLowerCase())
  );

  if (shared.length > 0) {
    const template = SHARED_INTEREST_OPENERS[seed % SHARED_INTEREST_OPENERS.length];
    openers.push(template(shared[0]));
  }

  // 2. Personality-based opener (lowered threshold: 0.6 for mid, 0.75 for high)
  if (target.personality && typeof target.personality === 'object') {
    const traits = Object.entries(target.personality)
      .filter(([, value]) => typeof value === 'number' && value >= 0.6)
      .sort(([, a], [, b]) => (b as number) - (a as number));

    for (const [trait, value] of traits.slice(0, 1)) {
      const templates = TRAIT_OPENERS[trait];
      if (!templates) continue;

      if (typeof value === 'number' && value >= 0.75) {
        openers.push(templates.high[seed % templates.high.length]);
      } else {
        openers.push(templates.mid[seed % templates.mid.length]);
      }
    }
  }

  // 3. Target's unique interest (something they have that viewer doesn't)
  if (openers.length < 3 && validTargetInterests.length > 0) {
    const viewerInterestsLower = validViewerInterests.map(i => i.toLowerCase());
    const unique = validTargetInterests.filter(i => !viewerInterestsLower.includes(i.toLowerCase()));
    const interestToMention = unique[0] || validTargetInterests[0];

    if (interestToMention) {
      const template = TARGET_INTEREST_OPENERS[(seed + openers.length) % TARGET_INTEREST_OPENERS.length];
      openers.push(template(interestToMention));
    }
  }

  // 4. Cross-interest opener (viewer's interest + target's interest)
  if (openers.length < 3 && validViewerInterests.length > 0 && validTargetInterests.length > 0) {
    const vi = validViewerInterests[(seed + 1) % validViewerInterests.length];
    const ti = validTargetInterests[(seed + 2) % validTargetInterests.length];
    if (vi && ti && vi.toLowerCase() !== ti.toLowerCase()) {
      const template = CROSS_INTEREST_OPENERS[(seed + openers.length) % CROSS_INTEREST_OPENERS.length];
      openers.push(template(vi, ti));
    }
  }

  // 5. Fallback (only if nothing above produced anything)
  while (openers.length < 3) {
    const index = (target.name.length + openers.length) % FALLBACK_OPENERS.length;
    const fallback = FALLBACK_OPENERS[index];

    if (!openers.includes(fallback)) {
      openers.push(fallback);
    } else {
      const nextFallback = FALLBACK_OPENERS[(index + 1) % FALLBACK_OPENERS.length];
      if (!openers.includes(nextFallback)) {
        openers.push(nextFallback);
      } else {
        break;
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
