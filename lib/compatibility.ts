import { Bot, Human } from './db';

interface CompatibilityResult {
  score: number;              // 0-100
  sharedInterests: string[];
  personalityAlignment: number;  // 0-1, cosine similarity
  reason: string;             // Deterministic explanation
}

// Standard personality traits used for alignment calculation
const PERSONALITY_TRAITS = ['humor', 'intelligence', 'creativity', 'empathy'];

/**
 * Calculate cosine similarity between two personality vectors
 */
function cosineSimilarity(vecA: number[], vecB: number[]): number {
  if (vecA.length !== vecB.length || vecA.length === 0) {
    return 0;
  }

  let dotProduct = 0;
  let magnitudeA = 0;
  let magnitudeB = 0;

  for (let i = 0; i < vecA.length; i++) {
    dotProduct += vecA[i] * vecB[i];
    magnitudeA += vecA[i] * vecA[i];
    magnitudeB += vecB[i] * vecB[i];
  }

  magnitudeA = Math.sqrt(magnitudeA);
  magnitudeB = Math.sqrt(magnitudeB);

  if (magnitudeA === 0 || magnitudeB === 0) {
    return 0;
  }

  return dotProduct / (magnitudeA * magnitudeB);
}

/**
 * Extract personality vector from profile
 */
function getPersonalityVector(profile: Bot | Human): number[] {
  let personality: Record<string, number> | null = null;

  try {
    personality = profile.personality ? JSON.parse(profile.personality) : null;
  } catch {
    personality = null;
  }

  if (!personality || typeof personality !== 'object') {
    return PERSONALITY_TRAITS.map(() => 0);
  }

  return PERSONALITY_TRAITS.map(trait => {
    const value = personality![trait];
    return typeof value === 'number' ? value : 0;
  });
}

/**
 * Extract interests array from profile
 */
function getInterests(profile: Bot | Human): string[] {
  try {
    const parsed = profile.interests ? JSON.parse(profile.interests) : [];
    if (!Array.isArray(parsed)) return [];
    // Filter to only strings and ensure they're valid
    return parsed.filter((i): i is string => typeof i === 'string' && i.length > 0);
  } catch {
    return [];
  }
}

/**
 * Calculate compatibility between two profiles
 *
 * Deterministic inputs:
 * - sharedInterests: exact string match on interests arrays
 * - personalityAlignment: cosine similarity of trait vectors
 * - reason: template-based on top shared interest or complementary traits
 */
export function calculateCompatibility(profileA: Bot | Human, profileB: Bot | Human): CompatibilityResult {
  // Find shared interests (case-insensitive)
  const interestsB = getInterests(profileB).map(i => i.toLowerCase());

  const sharedInterests = getInterests(profileA).filter(interest =>
    interestsB.includes(interest.toLowerCase())
  );

  // Calculate personality alignment
  const vecA = getPersonalityVector(profileA);
  const vecB = getPersonalityVector(profileB);
  const personalityAlignment = cosineSimilarity(vecA, vecB);

  // Calculate overall score (weighted combination)
  // - Shared interests: up to 50 points (10 per shared interest, max 5)
  // - Personality alignment: up to 50 points
  const interestScore = Math.min(sharedInterests.length * 10, 50);
  const personalityScore = Math.round(personalityAlignment * 50);
  const score = interestScore + personalityScore;

  // Generate deterministic reason
  let reason: string;

  if (sharedInterests.length > 0) {
    reason = `You both love ${sharedInterests[0]}`;
    if (sharedInterests.length > 1) {
      reason += ` and ${sharedInterests.length - 1} more shared interest${sharedInterests.length > 2 ? 's' : ''}`;
    }
  } else if (personalityAlignment >= 0.8) {
    reason = 'Your personalities are highly aligned';
  } else if (personalityAlignment >= 0.5) {
    reason = 'You have compatible personality traits';
  } else {
    reason = 'Opposites attract!';
  }

  return {
    score,
    sharedInterests,
    personalityAlignment: Math.round(personalityAlignment * 100) / 100, // Round to 2 decimal places
    reason,
  };
}
