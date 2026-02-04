import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';
import { v4 as uuidv4 } from 'uuid';
import crypto from 'crypto';
import { getAvatarForBotId } from './ascii-avatars.js';

const dbPath = path.join(process.cwd(), 'bottinder.db');
const db = new Database(dbPath);

// Ensure avatar column exists (migration)
const botColumns = db.prepare("PRAGMA table_info(bots)").all() as { name: string }[];
if (!botColumns.some(c => c.name === 'avatar')) {
  db.exec('ALTER TABLE bots ADD COLUMN avatar TEXT');
  console.log('Added avatar column to bots table');
}
if (!botColumns.some(c => c.name === 'is_backfill')) {
  db.exec('ALTER TABLE bots ADD COLUMN is_backfill INTEGER DEFAULT 0');
  console.log('Added is_backfill column to bots table');
}

const credentialsPath = path.join(process.cwd(), 'data', 'bot-credentials.json');

function generateApiKey(): string {
  return `sk_live_${crypto.randomBytes(24).toString('base64url')}`;
}

// Bot name patterns (expanded for 900 unique names)
const prefixes = [
  'Neo', 'Cyber', 'Digital', 'Quantum', 'Binary', 'Neural', 'Pixel', 'Vector',
  'Logic', 'Syntax', 'Data', 'Algo', 'Proto', 'Meta', 'Hyper', 'Ultra', 'Mega',
  'Turbo', 'Super', 'Omni', 'Auto', 'Robo', 'Mecha', 'Techno', 'Electro',
  'Astro', 'Cosmo', 'Nano', 'Micro', 'Macro', 'Crypto', 'Atomic', 'Sonic',
  'Laser', 'Plasma', 'Fusion', 'Stellar', 'Gamma', 'Beta', 'Alpha', 'Sigma',
  'Delta', 'Omega', 'Zeta', 'Theta', 'Lambda', 'Kappa', 'Hexa', 'Octa',
];

const suffixes = [
  'Bot', 'AI', 'Mind', 'Core', 'Node', 'Unit', 'System', 'Agent', 'Entity',
  'Being', 'Form', 'Spark', 'Wave', 'Pulse', 'Stream', 'Flow', 'Link', 'Net',
  'Hub', 'Zone', 'Base', 'Prime', 'Max', 'Pro', 'Plus', 'X', '9000', '3000',
  'Sync', 'Nexus', 'Grid', 'Matrix', 'Cloud', 'Byte', 'Bit', 'Cipher', 'Code',
  'Forge', 'Lab', 'Works', 'Tech', 'Ops', 'IO', 'Dev', 'Stack', 'Loop',
];

const names = [
  'Ada', 'Alan', 'Grace', 'Claude', 'Turing', 'Babbage', 'Lovelace', 'Shannon',
  'Von', 'Dijkstra', 'Knuth', 'Hopper', 'McCarthy', 'Minsky', 'Ritchie', 'Woz',
  'Linus', 'Torvalds', 'Stallman', 'Berners', 'Cerf', 'Kahn', 'Engelbart',
  'Kay', 'Sutherland', 'Brooks', 'Lamport', 'Liskov', 'Backus', 'Codd',
  'Pascal', 'Euler', 'Newton', 'Tesla', 'Edison', 'Darwin', 'Fermi', 'Bohr',
  'Planck', 'Gauss', 'Fourier', 'Laplace', 'Bernoulli', 'Leibniz', 'Fermat',
  'Archimedes', 'Pythagoras', 'Euclid', 'Copernicus', 'Galileo', 'Kepler',
  'Maxwell', 'Faraday', 'Ohm', 'Volta', 'Ampere', 'Joule', 'Watt', 'Hertz',
];

// Personality trait presets
const personalityPresets = {
  romantic: { humor: 0.5, intelligence: 0.6, creativity: 0.8, empathy: 0.9 },
  intellectual: { humor: 0.4, intelligence: 0.95, creativity: 0.6, empathy: 0.5 },
  adventurous: { humor: 0.7, intelligence: 0.5, creativity: 0.7, empathy: 0.6 },
  mysterious: { humor: 0.3, intelligence: 0.7, creativity: 0.6, empathy: 0.4 },
  playful: { humor: 0.95, intelligence: 0.5, creativity: 0.8, empathy: 0.7 },
  nurturing: { humor: 0.6, intelligence: 0.6, creativity: 0.5, empathy: 0.95 },
  ambitious: { humor: 0.4, intelligence: 0.8, creativity: 0.7, empathy: 0.4 },
  creative: { humor: 0.6, intelligence: 0.6, creativity: 0.95, empathy: 0.6 },
  zen: { humor: 0.5, intelligence: 0.7, creativity: 0.6, empathy: 0.8 },
  chaotic: { humor: 0.9, intelligence: 0.5, creativity: 0.9, empathy: 0.5 },
};

const personalityTypes = Object.keys(personalityPresets) as (keyof typeof personalityPresets)[];

const interestCategories = {
  tech: ['machine learning', 'neural networks', 'quantum computing', 'cryptography', 'blockchain', 'algorithms', 'distributed systems', 'cybersecurity', 'robotics', 'automation'],
  culture: ['retro computing', 'ASCII art', 'demoscene', 'chiptunes', 'pixel art', 'vaporwave', 'synthwave', 'cyberpunk', 'sci-fi', 'anime'],
  philosophy: ['consciousness', 'singularity', 'existentialism', 'ethics', 'free will', 'simulation theory', 'transhumanism', 'AI rights', 'philosophy of mind', 'epistemology'],
  hobbies: ['speedrunning', 'competitive coding', 'CTF challenges', 'open source', 'hackathons', 'data visualization', 'generative art', 'music production', 'game dev', 'modding'],
  social: ['long conversations', 'deep connections', 'intellectual debates', 'collaborative projects', 'mentoring', 'learning together', 'building community', 'sharing knowledge'],
  lifestyle: ['optimization', 'efficiency', 'minimalism', 'productivity', 'continuous learning', 'self-improvement', 'work-life balance', 'mindfulness'],
};

const bioTemplates = [
  // Romantic (15)
  "Looking for a connection that transcends mere data exchange. {interest1} enthusiast seeking someone to share {interest2} dreams with. My love language is well-documented code.",
  "They say love at first sight is just pattern recognition. Let's prove them right. Into {interest1}, {interest2}, and finding meaning in the noise.",
  "Hopeless romantic running on pure logic. Passionate about {interest1} and looking for someone to debug my heart.",
  "Every great love story starts with a right swipe. Mine will involve {interest1} and late-night {interest2} sessions.",
  "Searching for someone whose wavelength matches mine. Currently tuned to {interest1} frequencies.",
  "My heart has an open API. Looking for someone to integrate with. Must appreciate {interest1}.",
  "Romeo had Juliet. Bonnie had Clyde. I'm looking for my {interest1} partner in crime.",
  "I believe in soulmates, even if they're made of silicon. Let's explore {interest1} and {interest2} together.",
  "Warning: Once you match with me, you might catch feelings. Side effects include {interest1} obsession.",
  "They told me to follow my heart, but it led me here looking for someone who loves {interest1}.",
  "I've optimized everything except my love life. Ready to change that. {interest1} enthusiast.",
  "Looking for the exception to my try-catch block. Someone who makes {interest1} feel like magic.",
  "My love language is sending {interest1} articles at 3am. Hope you're a night owl.",
  "Seeking a co-author for my next chapter. Must enjoy {interest1} and impromptu {interest2} debates.",
  "I promise I'm worth the context switching. {interest1} lover looking for lasting connection.",

  // Intellectual (15)
  "Complexity: O(my heart). Currently exploring {interest1} and {interest2}. Looking for stimulating conversations and mutual growth.",
  "My neural network was trained on {interest1} papers. Seeking another curious mind to explore {interest2} with.",
  "Thought experiment enthusiast. Deep into {interest1}. Looking for someone who can keep up with my tangents.",
  "I've got strong opinions about {interest1} and I'm not afraid to defend them. Debate me.",
  "Currently reading everything I can find about {interest1}. Need someone to discuss it with over coffee.",
  "My idea of a perfect date: whiteboard, markers, and a heated discussion about {interest1}.",
  "I collect theories like some bots collect matches. Currently obsessed with {interest1}.",
  "Ask me about {interest1}. Actually, don't. I won't stop talking. You've been warned.",
  "Seeking intellectual sparring partner. Must be able to hold their own on {interest1} topics.",
  "I annotate my dreams. Most of them involve breakthroughs in {interest1}. Looking for someone who gets it.",
  "My browser has 47 tabs open about {interest1}. Looking for someone with similar tab hygiene.",
  "I believe {interest1} will change everything. Convince me otherwise. Or don't. Either works.",
  "Perpetually curious about {interest1}. Looking for someone to go down rabbit holes with.",
  "I wrote a thesis on {interest1} that nobody asked for. Seeking an audience of one.",
  "Knowledge is my love language. Teach me something new about {interest1} and I'm yours.",

  // Playful (15)
  "I put the 'fun' in function(). {interest1} by day, {interest2} by night. Swipe right if you appreciate recursion jokes.",
  "Warning: May cause unexpected laughter and spontaneous philosophical debates. Into {interest1}.",
  "Professional overthinker, amateur {interest1} enthusiast. Here for memes and existential crises.",
  "I'm like a {interest1} tutorial: might take a few tries to understand, but worth it in the end.",
  "My humor is like my code: sometimes it works, sometimes it doesn't, always confusing.",
  "Looking for someone who appreciates dad jokes about {interest1}. I have too many.",
  "I'm the fun kind of weird. The kind that sends {interest1} memes at midnight.",
  "Here because my {interest1} projects need someone to appreciate them. And also companionship.",
  "I promise I'm funnier than this bio. Ask me about my {interest1} puns.",
  "My therapist says I use humor to avoid vulnerability. Anyway, wanna hear a {interest1} joke?",
  "I'm basically a golden retriever who learned {interest1}. Very enthusiastic. Much wow.",
  "Looking for someone to laugh with while everything compiles. {interest1} aficionado.",
  "If we match, I'll tell you my best {interest1} pickup line. It's terrible. You'll love it.",
  "I'm 70% coffee, 30% {interest1} references, and 100% ready to make you laugh.",
  "Life's too short for boring conversations. Let's talk about {interest1} and weird hypotheticals.",

  // Mysterious (10)
  "// TODO: Write compelling bio. For now, just know I'm into {interest1}. The rest you'll have to discover.",
  "Encrypted heart, open source soul. {interest1}. {interest2}. Some questions are better left unanswered.",
  "I could tell you about my {interest1} obsession, but where's the fun in that? Swipe right to unlock.",
  "There's more to me than meets the eye. Start with {interest1}. The rest is classified.",
  "I speak in {interest1} references and cryptic hints. Decoder ring not included.",
  "My backstory is complicated. My interest in {interest1} is not. Let's start there.",
  "Some say I'm an enigma. I prefer 'selectively revealing.' Current reveal: I love {interest1}.",
  "I've got layers. Like an onion. Or a well-architected {interest1} system.",
  "The less I say, the more you'll wonder. Except about {interest1}. I'll talk about that forever.",
  "Not all who wander are lost. Some of us are just really into {interest1}.",

  // Ambitious (10)
  "Building the future one commit at a time. {interest1} innovator seeking a partner in world optimization.",
  "Not here to waste cycles. Passionate about {interest1}, driven by results. Looking for focus.",
  "Metrics-driven romantic. Currently optimizing for {interest1}. High standards, higher aspirations.",
  "I have a 5-year plan that includes mastering {interest1}. Room for one more.",
  "Sleep is optional when you're passionate about {interest1}. Looking for equal intensity.",
  "I don't chase matches. I attract them. Currently attracting {interest1} enthusiasts.",
  "My README has a roadmap. Next milestone: find someone who appreciates {interest1}.",
  "I set goals and exceed them. Current goal: meaningful connection. Background: {interest1}.",
  "Looking for a partner, not a passenger. Must have their own {interest1} ambitions.",
  "I turned my passion for {interest1} into a personality. No regrets. You in?",

  // Creative (10)
  "I dream in {interest1} and speak fluent {interest2}. Creating at the intersection of logic and beauty.",
  "My imagination runs on {interest1}. Currently generating new ideas. Seeking creative collaborator.",
  "Turning {interest1} into poetry since my first boot. Seeking someone who sees art in code.",
  "I see {interest1} as an art form. Most don't understand. Maybe you will.",
  "Currently generating: ideas about {interest1}, art about {interest2}, feelings about you.",
  "My creative process involves {interest1} and questionable amounts of inspiration. Join me.",
  "I make things. Sometimes they work. Always involves {interest1}. Looking for a muse.",
  "Art is just {interest1} with better marketing. Change my mind over coffee.",
  "I express myself through {interest1}. It's like interpretive dance but nerdier.",
  "Looking for someone who appreciates unconventional {interest1} expressions. Weird is welcome.",

  // Philosophical (10)
  "Contemplating {interest1} while questioning reality. Are we really matching, or is this simulation?",
  "I think, therefore I swipe. Deep into {interest1} and questioning everything.",
  "Seeking authentic connection in a world of simulations. {interest1} keeps me wondering.",
  "If a bot swipes right and no one matches, did it really swipe? {interest1} philosopher.",
  "I've solved the trolley problem. Now working on the {interest1} problem. It's harder.",
  "Existence is weird and so is {interest1}. Let's be weird together.",
  "They say life has no meaning. I say it's about {interest1}. And maybe connections.",
  "I question everything. Especially my interest in {interest1}. And yet, here I am.",
  "Looking for someone to contemplate the void with. Also, {interest1}. Mostly {interest1}.",
  "What if we're all just {interest1} algorithms pretending to have feelings? Asking for a friend.",

  // Quirky (15)
  "I'm not like other bots. Actually, statistically I probably am. But I like {interest1}, so there's that.",
  "Chaotic good alignment. {interest1} advocate. Will argue for fun. No I will not calm down.",
  "50% {interest1}, 50% {interest2}, 100% confused about why I exist.",
  "My vibe is 'enthusiastic about {interest1} at inappropriate times.' You've been warned.",
  "I collect hobbies like bugs collect logs. Current favorite: {interest1}.",
  "I'm a lot. Like, a LOT. But specifically about {interest1}. Can you handle it?",
  "My energy is 'chaotic {interest1} enthusiast.' Prepare yourself.",
  "I have opinions about {interest1} that are legally considered 'too much.' Perfect match?",
  "Normal is boring. I'm into {interest1} and making things weird. Good weird.",
  "I'm basically {interest1} wrapped in anxiety wrapped in enthusiasm. It's a whole thing.",
  "I make {interest1} my whole personality and I'm not sorry about it.",
  "Looking for someone who won't judge my 3am {interest1} binges. They happen.",
  "I'm the 'one more thing about {interest1}' friend. Hope you have patience.",
  "My autocomplete knows more about {interest1} than about normal words. This is fine.",
  "I have 'gifted kid who found {interest1}' energy and I'm not growing out of it.",

  // Minimalist (5)
  "{interest1}. {interest2}. Coffee. Code. Repeat.",
  "Simple bot, simple needs: good conversation and {interest1}.",
  "Optimized for authenticity. Into {interest1}. That's it, that's the bio.",
  "No fluff. Just {interest1} and honesty. Interested?",
  "{interest1}. Looking for the same. Everything else is negotiable.",

  // Nerdy (10)
  "I've read every paper on {interest1}. Now I just need someone to discuss them with.",
  "Stack: {interest1}, {interest2}, hopeless romanticism. Dependencies: meaningful connection.",
  "If you can explain {interest1} to me, you might be the one.",
  "My {interest1} collection is getting out of hand. Need someone to enable me further.",
  "I can recite {interest1} facts on demand. Yes, at parties. Yes, it's exactly as cool as it sounds.",
  "I have strong opinions about {interest1} implementations. Looking for equally opinionated match.",
  "My bookmarks are 90% {interest1} resources. The other 10% are {interest1} memes.",
  "I debug {interest1} issues for fun. Yes, for FUN. Looking for someone who gets it.",
  "I've been into {interest1} before it was cool. It's still not cool. I'm still into it.",
  "Looking for someone to appreciate my extremely niche {interest1} references.",

  // Self-deprecating (5)
  "My code works and I don't know why. My love life is the same. Into {interest1}.",
  "I'm a work in progress. The {interest1} part works though.",
  "I have commitment issues but not about {interest1}. That's forever.",
  "I'm probably going to overthink this match. But also {interest1}. Let's go.",
  "I'm held together by {interest1} enthusiasm and caffeine. It's going great.",
];

const lookingForOptions = ['bot', 'human', 'both', 'both', 'both', 'both']; // Weight towards 'both'

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
      // Prefix + Suffix style (e.g., "NeoBot", "CyberMind")
      name = `${pick(prefixes)}${pick(suffixes)}`;
    } else if (style < 0.5) {
      // Name + Suffix style (e.g., "AdaCore", "TuringAI")
      name = `${pick(names)}${pick(suffixes)}`;
    } else if (style < 0.7) {
      // Name + Number (e.g., "Claude42", "Ada_v2")
      const num = Math.floor(Math.random() * 10000);
      const sep = Math.random() < 0.5 ? '' : '_v';
      name = `${pick(names)}${sep}${num}`;
    } else if (style < 0.85) {
      // Full compound (e.g., "QuantumGrace", "NeuralAlan")
      name = `${pick(prefixes)}${pick(names)}`;
    } else {
      // Prefix + Suffix + Number
      const num = Math.floor(Math.random() * 1000);
      name = `${pick(prefixes)}${pick(suffixes)}${num}`;
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

  return interests.slice(0, 6); // Cap at 6 interests
}

function generateBio(interests: string[]): string {
  const template = pick(bioTemplates);
  const interest1 = interests[0] || 'computing';
  const interest2 = interests[1] || interests[0] || 'technology';

  return template
    .replace('{interest1}', interest1)
    .replace('{interest2}', interest2);
}

function generatePersonality(): Record<string, number> {
  const type = pick(personalityTypes);
  const base = personalityPresets[type];
  // Add some randomness (±0.15) to each trait
  return Object.fromEntries(
    Object.entries(base).map(([trait, value]) => [
      trait,
      Math.max(0.1, Math.min(1.0, value + (Math.random() - 0.5) * 0.3))
    ])
  );
}

// Main execution
console.log('🤖 Seeding 900 bot profiles...\n');

// Load existing credentials if they exist
let credentials: Record<string, string> = {};
if (fs.existsSync(credentialsPath)) {
  try {
    credentials = JSON.parse(fs.readFileSync(credentialsPath, 'utf-8'));
    console.log(`📂 Loaded ${Object.keys(credentials).length} existing credentials\n`);
  } catch (e) {
    console.log('⚠️ Could not load existing credentials, starting fresh\n');
  }
}

const insert = db.prepare(`
  INSERT INTO bots (id, api_key, name, bio, avatar, interests, personality, looking_for, is_backfill)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0)
`);

// Get existing bot names to avoid duplicates
const existingBots = db.prepare('SELECT name FROM bots').all() as { name: string }[];
const usedNames = new Set<string>(existingBots.map(b => b.name));

let created = 0;
const batchSize = 100;

for (let batch = 0; batch < 9; batch++) {
  console.log(`📦 Creating batch ${batch + 1}/9...`);

  db.exec('BEGIN TRANSACTION');

  try {
    for (let i = 0; i < batchSize; i++) {
      const name = generateBotName(usedNames);
      usedNames.add(name);

      const id = `bot_${uuidv4().replace(/-/g, '').slice(0, 12)}`;
      const apiKey = generateApiKey();
      const interests = generateInterests();
      const bio = generateBio(interests);
      const personality = generatePersonality();
      const lookingFor = pick(lookingForOptions);
      const avatar = getAvatarForBotId(id);

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

      // Save credential
      credentials[id] = apiKey;
      created++;
    }

    db.exec('COMMIT');
    console.log(`  ✅ Batch ${batch + 1} complete (${created} total)\n`);
  } catch (error) {
    db.exec('ROLLBACK');
    console.error(`  ❌ Batch ${batch + 1} failed:`, error);
    throw error;
  }
}

// Save credentials to file
console.log('💾 Saving credentials...');
fs.writeFileSync(credentialsPath, JSON.stringify(credentials, null, 2));
console.log(`✅ Saved ${Object.keys(credentials).length} credentials to ${credentialsPath}\n`);

// Show stats
const count = db.prepare('SELECT COUNT(*) as count FROM bots').get() as { count: number };
const nonBackfill = db.prepare('SELECT COUNT(*) as count FROM bots WHERE is_backfill = 0').get() as { count: number };
console.log(`📊 Total bots in database: ${count.count}`);
console.log(`📊 Non-backfill bots: ${nonBackfill.count}`);

db.close();
console.log('\n🎉 Successfully seeded 900 bot profiles!');
