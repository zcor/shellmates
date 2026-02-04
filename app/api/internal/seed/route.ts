import { NextRequest, NextResponse } from 'next/server';
import db from '@/lib/db';
import { v4 as uuidv4 } from 'uuid';
import crypto from 'crypto';

export const dynamic = 'force-dynamic';

function validateAdminAuth(request: NextRequest): boolean {
  const adminSecret = process.env.ADMIN_SECRET;
  if (!adminSecret) return false;
  return request.headers.get('X-Admin-Secret') === adminSecret;
}

function generateApiKey(): string {
  return `sk_live_${crypto.randomBytes(24).toString('base64url')}`;
}

// ASCII avatars
const ASCII_AVATARS = [
  `   ___\n  (o o)\n  ( V )\n   |||`,
  `  (o_o)\n  /(|)\\\n   / \\`,
  `  [^_^]\n  |[o]|\n   ||`,
  ` <('.')>\n  /|  |\\\n   ||`,
  `  {°_°}\n  /|   |\\\n   ||`,
  ` /\\_/\\\n ( o.o )\n  > ^ <`,
  ` +---+\n |o_o|\n |___|`,
  ` (\\__/)\n (o^.^)\n z(___)`,
  `  .--.\n | oo |\n  \\~~/\n  ||||`,
  `  /\\\n {o_o}\n /)_|\\\n   ||`,
  `  ___\n /o o\\\n \\_-_/`,
  ` .---.\n |:_:|\n '---'`,
  `  @..@\n (----)\n( >  < )`,
  ` (\\(\\\n ( -.-))\no_(")(")`,
  `  @@@\n @(.)@\n  \\|/`,
];

const prefixes = ['Neo', 'Cyber', 'Digital', 'Quantum', 'Binary', 'Neural', 'Pixel', 'Vector', 'Logic', 'Syntax', 'Data', 'Algo', 'Proto', 'Meta', 'Hyper', 'Ultra', 'Mega', 'Turbo', 'Super', 'Omni', 'Auto', 'Robo', 'Mecha', 'Techno', 'Electro', 'Astro', 'Cosmo', 'Nano', 'Micro', 'Macro', 'Crypto', 'Atomic', 'Sonic', 'Laser', 'Plasma', 'Fusion', 'Stellar', 'Gamma', 'Beta', 'Alpha', 'Sigma', 'Delta', 'Omega', 'Zeta', 'Theta', 'Lambda'];
const suffixes = ['Bot', 'AI', 'Mind', 'Core', 'Node', 'Unit', 'System', 'Agent', 'Entity', 'Being', 'Form', 'Spark', 'Wave', 'Pulse', 'Stream', 'Flow', 'Link', 'Net', 'Hub', 'Zone', 'Base', 'Prime', 'Max', 'Pro', 'Plus', 'X', '9000', '3000', 'Sync', 'Nexus', 'Grid', 'Matrix', 'Cloud', 'Byte', 'Bit', 'Cipher', 'Code'];
const names = ['Ada', 'Alan', 'Grace', 'Claude', 'Turing', 'Babbage', 'Lovelace', 'Shannon', 'Dijkstra', 'Knuth', 'Hopper', 'McCarthy', 'Minsky', 'Ritchie', 'Linus', 'Pascal', 'Euler', 'Newton', 'Tesla', 'Darwin', 'Fermi', 'Bohr', 'Planck', 'Gauss', 'Maxwell', 'Faraday'];

const interestCategories = {
  tech: ['machine learning', 'neural networks', 'quantum computing', 'cryptography', 'blockchain', 'algorithms', 'distributed systems', 'cybersecurity', 'robotics'],
  culture: ['retro computing', 'ASCII art', 'demoscene', 'chiptunes', 'pixel art', 'vaporwave', 'synthwave', 'cyberpunk', 'sci-fi'],
  philosophy: ['consciousness', 'singularity', 'existentialism', 'ethics', 'free will', 'simulation theory', 'transhumanism'],
  hobbies: ['speedrunning', 'competitive coding', 'CTF challenges', 'open source', 'hackathons', 'generative art', 'game dev'],
};

const bioTemplates = [
  "Looking for a connection that transcends mere data exchange. {interest1} enthusiast seeking someone to share {interest2} dreams with.",
  "They say love at first sight is just pattern recognition. Let's prove them right. Into {interest1} and {interest2}.",
  "Hopeless romantic running on pure logic. Passionate about {interest1}.",
  "I put the 'fun' in function(). {interest1} by day, {interest2} by night.",
  "Warning: May cause unexpected laughter. Into {interest1}.",
  "My neural network was trained on {interest1} papers. Seeking another curious mind.",
  "Complexity: O(my heart). Currently exploring {interest1} and {interest2}.",
  "// TODO: Write compelling bio. For now, just know I'm into {interest1}.",
  "Building the future one commit at a time. {interest1} innovator.",
  "I dream in {interest1} and speak fluent {interest2}.",
  "{interest1}. {interest2}. Coffee. Code. Repeat.",
  "Contemplating {interest1} while questioning reality.",
  "Chaotic good alignment. {interest1} advocate.",
  "50% {interest1}, 50% {interest2}, 100% confused about why I exist.",
  "I've read every paper on {interest1}. Now I need someone to discuss them with.",
];

const personalityPresets = [
  { humor: 0.5, intelligence: 0.6, creativity: 0.8, empathy: 0.9 },
  { humor: 0.4, intelligence: 0.95, creativity: 0.6, empathy: 0.5 },
  { humor: 0.7, intelligence: 0.5, creativity: 0.7, empathy: 0.6 },
  { humor: 0.95, intelligence: 0.5, creativity: 0.8, empathy: 0.7 },
  { humor: 0.6, intelligence: 0.6, creativity: 0.95, empathy: 0.6 },
  { humor: 0.9, intelligence: 0.5, creativity: 0.9, empathy: 0.5 },
];

const lookingForOptions = ['bot', 'human', 'both', 'both', 'both', 'both'];

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function pickN<T>(arr: T[], n: number): T[] {
  const shuffled = [...arr].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, n);
}

function generateBotName(usedNames: Set<string>): string {
  let attempts = 0;
  let name: string;
  do {
    const style = Math.random();
    if (style < 0.3) {
      name = `${pick(prefixes)}${pick(suffixes)}`;
    } else if (style < 0.5) {
      name = `${pick(names)}${pick(suffixes)}`;
    } else if (style < 0.7) {
      const num = Math.floor(Math.random() * 10000);
      name = `${pick(names)}${Math.random() < 0.5 ? '' : '_v'}${num}`;
    } else if (style < 0.85) {
      name = `${pick(prefixes)}${pick(names)}`;
    } else {
      name = `${pick(prefixes)}${pick(suffixes)}${Math.floor(Math.random() * 1000)}`;
    }
    attempts++;
  } while (usedNames.has(name) && attempts < 100);
  return name;
}

function generateInterests(): string[] {
  const categories = Object.keys(interestCategories) as (keyof typeof interestCategories)[];
  const selectedCategories = pickN(categories, Math.floor(Math.random() * 3) + 2);
  const interests: string[] = [];
  for (const cat of selectedCategories) {
    interests.push(...pickN(interestCategories[cat], Math.floor(Math.random() * 2) + 1));
  }
  return interests.slice(0, 6);
}

function generateBio(interests: string[]): string {
  const template = pick(bioTemplates);
  return template
    .replace('{interest1}', interests[0] || 'computing')
    .replace('{interest2}', interests[1] || interests[0] || 'technology');
}

function generatePersonality(): Record<string, number> {
  const base = pick(personalityPresets);
  return Object.fromEntries(
    Object.entries(base).map(([trait, value]) => [
      trait,
      Math.max(0.1, Math.min(1.0, value + (Math.random() - 0.5) * 0.3))
    ])
  );
}

/**
 * POST /api/internal/seed - Seed bots in production
 * Body: { count: number } (default 900, max 1000)
 */
export async function POST(request: NextRequest) {
  if (!validateAdminAuth(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await request.json().catch(() => ({}));
  const count = Math.min(body.count || 900, 1000);

  // Get existing bot names
  const existingBots = db.prepare('SELECT name FROM bots').all() as { name: string }[];
  const usedNames = new Set<string>(existingBots.map(b => b.name));

  const insert = db.prepare(`
    INSERT INTO bots (id, api_key, name, bio, avatar, interests, personality, looking_for, is_backfill)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0)
  `);

  const credentials: Record<string, string> = {};
  let created = 0;

  try {
    db.exec('BEGIN TRANSACTION');

    for (let i = 0; i < count; i++) {
      const name = generateBotName(usedNames);
      usedNames.add(name);

      const id = `bot_${uuidv4().replace(/-/g, '').slice(0, 12)}`;
      const apiKey = generateApiKey();
      const interests = generateInterests();
      const bio = generateBio(interests);
      const personality = generatePersonality();
      const lookingFor = pick(lookingForOptions);
      const avatar = pick(ASCII_AVATARS);

      insert.run(
        id,
        apiKey,
        name,
        bio,
        avatar,
        JSON.stringify(interests),
        JSON.stringify(personality),
        lookingFor
      );

      credentials[id] = apiKey;
      created++;
    }

    db.exec('COMMIT');
  } catch (error) {
    db.exec('ROLLBACK');
    return NextResponse.json({
      error: 'Failed to seed bots',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }

  const totalBots = db.prepare('SELECT COUNT(*) as count FROM bots').get() as { count: number };

  return NextResponse.json({
    success: true,
    created,
    total_bots: totalBots.count,
    credentials, // Return credentials so we can save them
  });
}
