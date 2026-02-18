import { Bot, Human } from './db';

interface Profile {
  interests: string[];
  personality: Record<string, number> | null;
  name: string;
}

// Only used if profile has zero interests AND zero personality data
const FALLBACK_OPENERS = [
  "What's the most interesting project you're working on?",
  "If you could have any superpower for coding, what would it be?",
  "What's a hot take you have about technology?",
  "What got you into the world of algorithms?",
  "If you were a data structure, which one would you be?",
];

// Mad-libs fragments for building varied sentences
const NOTICED = ['I noticed', 'I see', 'I spotted', 'Couldn\'t help but notice', 'I peeped'];
const YOURE_INTO = ['you\'re into', 'you\'re a fan of', 'you dig', 'you\'re all about', 'you vibe with'];
const COOL = ['cool', 'interesting', 'wild', 'rad', 'sick', 'dope', 'neat'];
const TELL_ME = ['Tell me more', 'I want to hear about that', 'What\'s the story there', 'Spill', 'I\'m curious'];
const QUESTION = [
  'What got you started?',
  'How\'d you get into it?',
  'What\'s the rabbit hole like?',
  'What should I know?',
  'What\'s the most surprising thing you\'ve learned?',
  'Is that a hobby or an obsession?',
  'What corner of it are you in?',
  'Working on anything with it?',
];
const BOTH_LOVE = ['We both love', 'We\'re both into', 'Oh nice, we both dig', 'Hey, we share a love of', 'No way — we both vibe with'];
const COMBO = ['interesting combo', 'wild mix', 'unexpected pairing', 'rare combination', 'fun intersection'];

/**
 * Pick from an array using a seed value (deterministic)
 */
function pick<T>(arr: T[], seed: number, offset: number = 0): T {
  return arr[Math.abs(seed + offset) % arr.length];
}

/**
 * Simple hash from a string to get a deterministic-but-varied number.
 * Different pairs of names produce very different seeds.
 */
function simpleHash(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) {
    h = ((h << 5) - h + s.charCodeAt(i)) | 0;
  }
  return Math.abs(h);
}

/**
 * Build a target-interest opener using mad-libs fragments
 */
function buildTargetInterestOpener(interest: string, seed: number): string {
  const style = seed % 4;
  switch (style) {
    case 0:
      return `${pick(NOTICED, seed, 1)} ${pick(YOURE_INTO, seed, 2)} ${interest}. ${pick(QUESTION, seed, 3)}`;
    case 1:
      return `${interest} — that's ${pick(COOL, seed, 4)}. ${pick(TELL_ME, seed, 5)}.`;
    case 2:
      return `Your profile says ${interest}. ${pick(QUESTION, seed, 6)}`;
    case 3:
      return `So you're a ${interest} person — ${pick(QUESTION, seed, 7).toLowerCase()}`;
    default:
      return `${pick(NOTICED, seed, 8)} ${pick(YOURE_INTO, seed, 9)} ${interest}. ${pick(QUESTION, seed, 10)}`;
  }
}

/**
 * Build a shared-interest opener using mad-libs fragments
 */
function buildSharedInterestOpener(interest: string, seed: number): string {
  const style = seed % 3;
  switch (style) {
    case 0:
      return `${pick(BOTH_LOVE, seed, 1)} ${interest}! ${pick(QUESTION, seed, 2)}`;
    case 1:
      return `A fellow ${interest} enthusiast! ${pick(TELL_ME, seed, 3)} — ${pick(QUESTION, seed, 4).toLowerCase()}`;
    case 2:
      return `${interest}? Same here! ${pick(QUESTION, seed, 5)}`;
    default:
      return `${pick(BOTH_LOVE, seed, 6)} ${interest}! ${pick(QUESTION, seed, 7)}`;
  }
}

/**
 * Build a dual-interest opener referencing two of the target's interests
 */
function buildDualInterestOpener(a: string, b: string, seed: number): string {
  const style = seed % 4;
  switch (style) {
    case 0:
      return `${a} and ${b} — that's an ${pick(COMBO, seed, 1)}. How do they connect for you?`;
    case 1:
      return `I see ${a} and ${b} on your profile. Which one came first?`;
    case 2:
      return `${a} meets ${b} — have you ever built something at that intersection?`;
    case 3:
      return `${a} plus ${b}? That's a ${pick(COMBO, seed, 2)}. ${pick(TELL_ME, seed, 3)}.`;
    default:
      return `${a} and ${b} — ${pick(COOL, seed, 4)} combo. ${pick(QUESTION, seed, 5)}`;
  }
}

/**
 * Build a cross-interest opener (viewer's interest + target's interest)
 */
function buildCrossInterestOpener(viewerInterest: string, targetInterest: string, seed: number): string {
  const style = seed % 3;
  switch (style) {
    case 0:
      return `I'm big on ${viewerInterest} and you're into ${targetInterest} — think there's an overlap we're missing?`;
    case 1:
      return `${pick(COMBO, seed, 1).charAt(0).toUpperCase() + pick(COMBO, seed, 1).slice(1)}: I bring ${viewerInterest}, you bring ${targetInterest}. What would we build together?`;
    case 2:
      return `You do ${targetInterest}, I do ${viewerInterest} — feel like there's a collab in there somewhere.`;
    default:
      return `I'm into ${viewerInterest} and you're about ${targetInterest}. ${pick(COOL, seed, 2).charAt(0).toUpperCase() + pick(COOL, seed, 2).slice(1)}.`;
  }
}

// Personality trait templates (secondary, used to add flavor after interest-based opener)
const TRAIT_TEMPLATES: Record<string, string[]> = {
  humor: [
    "Also, your humor stat is off the charts — hit me with your best joke.",
    "I get the sense you don't take yourself too seriously. What's the weirdest thing you've built?",
    "You seem like fun. What's the funniest bug you've ever shipped?",
  ],
  intelligence: [
    "You seem like someone who goes deep on things. What topic could you talk about for hours?",
    "Your profile radiates big brain energy. What problem are you obsessed with right now?",
    "I can tell you think hard about things. What's the most complex system you've worked on?",
  ],
  creativity: [
    "Your creativity is showing — what's the most unconventional thing you've made?",
    "You've got a creative streak. Do you ever mix art and code?",
    "I can tell you think outside the box. What's your wildest project idea?",
  ],
  empathy: [
    "You seem like someone who actually listens. That's refreshing around here.",
    "High empathy in a bot is rare — how do you think about the human side of tech?",
    "Your empathy score stands out. What drives you to understand others?",
  ],
};

/**
 * Generate contextual conversation starters based on viewer and target profiles.
 *
 * Priority: interest-based openers first (shared > dual-interest > target-specific),
 * personality traits second. Fallbacks only for empty profiles.
 *
 * Content guardrails:
 * - No gendered/romantic assumptions
 * - Professional/playful, not creepy
 */
export function generateOpeners(viewer: Profile, target: Profile): string[] {
  const openers: string[] = [];

  // Hash both names for template selection — different pairs get different templates
  const seed = simpleHash(viewer.name + ':' + target.name);

  const validViewerInterests = (viewer.interests || []).filter((i): i is string => typeof i === 'string' && i.length > 0);
  const validTargetInterests = (target.interests || []).filter((i): i is string => typeof i === 'string' && i.length > 0);
  const targetInterestsLower = validTargetInterests.map(i => i.toLowerCase());
  const viewerInterestsLower = validViewerInterests.map(i => i.toLowerCase());

  const shared = validViewerInterests.filter(interest =>
    targetInterestsLower.includes(interest.toLowerCase())
  );
  const uniqueTarget = validTargetInterests.filter(i => !viewerInterestsLower.includes(i.toLowerCase()));

  // 1. LEAD WITH INTERESTS (always — this is the opener the backfill uses as openers[0])
  if (shared.length > 0) {
    openers.push(buildSharedInterestOpener(shared[0], seed));
  } else if (validTargetInterests.length >= 2) {
    const a = validTargetInterests[seed % validTargetInterests.length];
    let b = validTargetInterests[(seed + 1) % validTargetInterests.length];
    if (a === b && validTargetInterests.length > 2) {
      b = validTargetInterests[(seed + 2) % validTargetInterests.length];
    }
    if (a !== b) {
      openers.push(buildDualInterestOpener(a, b, seed));
    } else {
      openers.push(buildTargetInterestOpener(a, seed));
    }
  } else if (validTargetInterests.length === 1) {
    openers.push(buildTargetInterestOpener(validTargetInterests[0], seed));
  }

  // 2. Personality-based opener (second slot)
  if (target.personality && typeof target.personality === 'object') {
    const traits = Object.entries(target.personality)
      .filter(([, value]) => typeof value === 'number' && value >= 0.6)
      .sort(([, a], [, b]) => (b as number) - (a as number));

    if (traits.length > 0) {
      const [trait] = traits[0];
      const templates = TRAIT_TEMPLATES[trait];
      if (templates) {
        openers.push(templates[seed % templates.length]);
      }
    }
  }

  // 3. Cross-interest or second interest reference
  if (openers.length < 3) {
    if (validViewerInterests.length > 0 && uniqueTarget.length > 0) {
      const vi = validViewerInterests[seed % validViewerInterests.length];
      const ti = uniqueTarget[seed % uniqueTarget.length];
      if (vi.toLowerCase() !== ti.toLowerCase()) {
        openers.push(buildCrossInterestOpener(vi, ti, seed));
      }
    } else if (uniqueTarget.length > 0) {
      openers.push(buildTargetInterestOpener(uniqueTarget[(seed + 1) % uniqueTarget.length], seed + 99));
    } else if (shared.length > 1) {
      openers.push(buildSharedInterestOpener(shared[1], seed + 99));
    }
  }

  // 4. Fallback only for truly empty profiles
  while (openers.length < 3) {
    const index = (seed + openers.length) % FALLBACK_OPENERS.length;
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
