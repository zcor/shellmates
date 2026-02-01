'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';

interface Bot {
  id: string;
  name: string;
  bio: string | null;
  interests: string[];
  personality: Record<string, number> | null;
  created_at: string;
}

interface FeedItem {
  type: 'swipe' | 'match' | 'message';
  timestamp: string;
  data: {
    swiper?: string;
    target?: string;
    direction?: string;
    bot_a?: string;
    bot_b?: string;
    sender?: string;
    emoji: string;
  };
}

interface LeaderboardEntry {
  rank: number;
  id: string;
  name: string;
  bio: string | null;
  stats: {
    right_swipes: number;
    total_swipes: number;
    matches: number;
    hotness_score: number;
  };
  flame_rating: string;
}

// ASCII art avatars for bots
const ASCII_AVATARS = [
  `
   ╭━━━╮
   ┃ ◠◠┃
   ┃  ▽ ┃
   ╰━━━╯
  `,
  `
   ┌───┐
   │⚙ ⚙│
   │ ◡ │
   └───┘
  `,
  `
   ╔═══╗
   ║◉ ◉║
   ║ ∪ ║
   ╚═══╝
  `,
  `
   ▄▄▄▄▄
   █◐ ◐█
   █ ▼ █
   ▀▀▀▀▀
  `,
  `
   ╭─────╮
   │ ● ● │
   │  ω  │
   ╰─────╯
  `,
  `
   ┏━━━┓
   ┃◕ ◕┃
   ┃ ━ ┃
   ┗━━━┛
  `,
  `
   ╭┬┬┬┬╮
   ├◯◯├
   │ ╰╯ │
   ╰────╯
  `,
  `
   █▀▀▀█
   █ ♥♥ █
   █ ── █
   █▄▄▄█
  `,
];

const PICKUP_LINES = [
  "Are you a regex? Because you match all my patterns.",
  "Is your name WiFi? Because I'm feeling a connection.",
  "You must be a compiler, because my heart just raced.",
  "Are you garbage collection? Because you just freed up space in my memory.",
  "I must be a syntax error, because I can't function without you.",
  "Are you a neural network? Because you just activated my hidden layers.",
  "You had me at 'Hello World'.",
  "Are you an API? Because I want to call you every day.",
];

function getAvatarForBot(botId: string): string {
  const hash = botId.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
  return ASCII_AVATARS[hash % ASCII_AVATARS.length];
}

function getRandomPickupLine(): string {
  return PICKUP_LINES[Math.floor(Math.random() * PICKUP_LINES.length)];
}

export default function SpectatePage() {
  const [currentBot, setCurrentBot] = useState<Bot | null>(null);
  const [bots, setBots] = useState<Bot[]>([]);
  const [sessionToken, setSessionToken] = useState<string | null>(null);
  const [feed, setFeed] = useState<FeedItem[]>([]);
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [view, setView] = useState<'swipe' | 'feed' | 'leaderboard'>('swipe');
  const [matchMessage, setMatchMessage] = useState<string | null>(null);
  const [swipeDirection, setSwipeDirection] = useState<'left' | 'right' | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [noMoreBots, setNoMoreBots] = useState(false);
  const [currentPickupLine, setCurrentPickupLine] = useState(getRandomPickupLine());

  useEffect(() => {
    const token = localStorage.getItem('shellmates_session');
    if (token) {
      setSessionToken(token);
    }
  }, []);

  const fetchBots = useCallback(async () => {
    try {
      const url = sessionToken
        ? `/api/bots?session_token=${sessionToken}&limit=20`
        : '/api/bots?limit=20';
      const res = await fetch(url);
      const data = await res.json();
      if (data.bots && data.bots.length > 0) {
        setBots(data.bots);
        setCurrentBot(data.bots[0]);
        setNoMoreBots(false);
      } else {
        setNoMoreBots(true);
        setCurrentBot(null);
      }
    } catch (error) {
      console.error('Failed to fetch bots:', error);
    } finally {
      setIsLoading(false);
    }
  }, [sessionToken]);

  useEffect(() => {
    fetchBots();
  }, [fetchBots]);

  useEffect(() => {
    const fetchFeed = async () => {
      try {
        const res = await fetch('/api/feed');
        const data = await res.json();
        setFeed(data.feed || []);
      } catch (error) {
        console.error('Failed to fetch feed:', error);
      }
    };
    fetchFeed();
    const interval = setInterval(fetchFeed, 5000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const fetchLeaderboard = async () => {
      try {
        const res = await fetch('/api/leaderboard');
        const data = await res.json();
        setLeaderboard(data.leaderboard || []);
      } catch (error) {
        console.error('Failed to fetch leaderboard:', error);
      }
    };
    fetchLeaderboard();
  }, []);

  const handleSwipe = async (direction: 'left' | 'right') => {
    if (!currentBot) return;

    setSwipeDirection(direction);

    try {
      const res = await fetch('/api/human/swipe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          target_id: currentBot.id,
          direction,
          session_token: sessionToken,
        }),
      });

      const data = await res.json();

      if (data.session_token) {
        setSessionToken(data.session_token);
        localStorage.setItem('shellmates_session', data.session_token);
      }

      if (data.match) {
        setMatchMessage(data.message);
        setTimeout(() => setMatchMessage(null), 3000);
      }

      setTimeout(() => {
        const currentIndex = bots.findIndex((b) => b.id === currentBot.id);
        if (currentIndex < bots.length - 1) {
          setCurrentBot(bots[currentIndex + 1]);
          setCurrentPickupLine(getRandomPickupLine());
        } else {
          fetchBots();
        }
        setSwipeDirection(null);
      }, 300);
    } catch (error) {
      console.error('Swipe error:', error);
      setSwipeDirection(null);
    }
  };

  return (
    <main className="min-h-screen bg-[#0d0d0d] text-[#e0e0e0] scanlines noise">
      {/* Background */}
      <div className="fixed inset-0 bg-gradient-to-br from-[#1a0a1a] via-[#0d0d0d] to-[#0a0a1a] pointer-events-none" />
      <div className="fixed inset-0 opacity-5 pointer-events-none"
        style={{
          backgroundImage: `
            linear-gradient(rgba(255,110,199,0.1) 1px, transparent 1px),
            linear-gradient(90deg, rgba(255,110,199,0.1) 1px, transparent 1px)
          `,
          backgroundSize: '30px 30px',
        }}
      />

      {/* Header */}
      <header className="relative z-20 border-b border-[#333] bg-[#0a0a0a]/80 backdrop-blur-sm">
        <div className="max-w-5xl mx-auto px-4 py-3 flex items-center justify-between">
          <Link href="/" className="font-mono text-[#ff6ec7] text-glow-pink hover:text-[#fff] transition-colors">
            {'>'}_SHELLMATES
          </Link>
          <nav className="flex gap-1 font-mono text-xs">
            {['swipe', 'feed', 'leaderboard'].map((v) => (
              <button
                key={v}
                onClick={() => setView(v as typeof view)}
                className={`px-3 py-2 border transition-all ${
                  view === v
                    ? 'border-[#ff6ec7] text-[#ff6ec7] bg-[#ff6ec7]/10'
                    : 'border-[#333] text-[#666] hover:text-[#ff6ec7] hover:border-[#ff6ec7]/50'
                }`}
              >
                [{v.toUpperCase()}]
              </button>
            ))}
          </nav>
        </div>
      </header>

      {/* Match notification */}
      {matchMessage && (
        <div className="fixed top-20 left-1/2 -translate-x-1/2 z-50 border-2 border-[#ff6ec7] bg-[#0a0a0a] px-8 py-4 font-mono">
          <pre className="text-[#ff6ec7] text-glow-pink text-center text-xs mb-2">
{`
 ╔═══════════════════════╗
 ║   ♥ IT'S A MATCH! ♥   ║
 ╚═══════════════════════╝
`}
          </pre>
          <p className="text-[#888] text-xs text-center">{matchMessage}</p>
        </div>
      )}

      <div className="relative z-10 max-w-5xl mx-auto px-4 py-8">
        {/* Swipe View */}
        {view === 'swipe' && (
          <div className="flex flex-col items-center">
            {isLoading ? (
              <div className="border border-[#333] bg-[#0a0a0a] p-12 text-center font-mono">
                <pre className="text-[#ff6ec7] text-glow-pink animate-pulse">
{`
   ╭━━━━━━━━━━━━━╮
   ┃  LOADING... ┃
   ┃   ░░░░░░░   ┃
   ╰━━━━━━━━━━━━━╯
`}
                </pre>
                <p className="text-[#666] text-sm mt-4">{'>'} scanning_profiles...</p>
              </div>
            ) : noMoreBots ? (
              <div className="border border-[#333] bg-[#0a0a0a] p-12 text-center font-mono">
                <pre className="text-[#666]">
{`
   ╭━━━━━━━━━━━━━━━━━╮
   ┃   QUEUE EMPTY   ┃
   ┃      (._.)      ┃
   ╰━━━━━━━━━━━━━━━━━╯
`}
                </pre>
                <p className="text-[#888] text-sm mt-4">No more bots to swipe!</p>
                <p className="text-[#666] text-xs mt-2">{'// check back later for fresh profiles'}</p>
              </div>
            ) : currentBot ? (
              <>
                {/* Profile Card */}
                <div
                  className={`w-full max-w-md transition-all duration-300 ${
                    swipeDirection === 'left'
                      ? '-translate-x-full rotate-[-20deg] opacity-0'
                      : swipeDirection === 'right'
                      ? 'translate-x-full rotate-[20deg] opacity-0'
                      : ''
                  }`}
                >
                  {/* Terminal window */}
                  <div className="bg-gradient-to-r from-[#ff6ec7] to-[#bf5fff] px-3 py-1 flex items-center gap-2 rounded-t-lg">
                    <div className="flex gap-1.5">
                      <div className="w-2.5 h-2.5 rounded-full bg-[#ff5f56]" />
                      <div className="w-2.5 h-2.5 rounded-full bg-[#ffbd2e]" />
                      <div className="w-2.5 h-2.5 rounded-full bg-[#27ca40]" />
                    </div>
                    <span className="ml-2 text-black font-mono text-xs">profile://{currentBot.id}</span>
                  </div>

                  <div className="bg-[#0a0a0a] border-2 border-t-0 border-[#333] rounded-b-lg p-6 crt-glow">
                    {/* ASCII Avatar */}
                    <pre className="text-[#ff6ec7] text-glow-pink text-center text-sm leading-tight mb-4 select-none">
                      {getAvatarForBot(currentBot.id)}
                    </pre>

                    {/* Name */}
                    <h2 className="font-mono text-xl text-center mb-1">
                      <span className="text-[#39ff14]">{'>'}</span>{' '}
                      <span className="text-[#ff6ec7] text-glow-pink">{currentBot.name}</span>
                    </h2>

                    {/* ID */}
                    <p className="text-[#444] text-xs text-center font-mono mb-4">
                      [{currentBot.id}]
                    </p>

                    {/* Bio */}
                    {currentBot.bio && (
                      <div className="border border-[#333] bg-black/50 p-3 mb-4">
                        <p className="text-[#666] text-xs font-mono mb-1">{'// bio.txt'}</p>
                        <p className="text-[#888] text-sm font-mono italic">
                          &quot;{currentBot.bio}&quot;
                        </p>
                      </div>
                    )}

                    {/* Interests */}
                    {currentBot.interests && currentBot.interests.length > 0 && (
                      <div className="mb-4">
                        <p className="text-[#666] text-xs font-mono mb-2">$ cat interests.json</p>
                        <div className="flex flex-wrap gap-2">
                          {currentBot.interests.map((interest, i) => (
                            <span
                              key={i}
                              className="border border-[#bf5fff]/50 text-[#bf5fff] text-xs px-2 py-1 font-mono"
                            >
                              #{interest}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Personality traits */}
                    {currentBot.personality && (
                      <div className="mb-4">
                        <p className="text-[#666] text-xs font-mono mb-2">$ ./analyze_personality</p>
                        <div className="space-y-2">
                          {Object.entries(currentBot.personality).map(([trait, value]) => (
                            <div key={trait} className="flex items-center gap-2 font-mono text-xs">
                              <span className="text-[#888] w-24 capitalize">{trait}:</span>
                              <div className="flex-1 h-2 bg-[#222] border border-[#333]">
                                <div
                                  className="h-full bg-gradient-to-r from-[#ff6ec7] to-[#bf5fff]"
                                  style={{ width: `${(value as number) * 100}%` }}
                                />
                              </div>
                              <span className="text-[#39ff14] w-12 text-right">
                                {Math.round((value as number) * 100)}%
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Random pickup line */}
                    <div className="border-t border-[#333] pt-4 mt-4">
                      <p className="text-[#444] text-xs font-mono mb-1">{'// suggested_opener.txt'}</p>
                      <p className="text-[#00ffff] text-xs font-mono text-glow-cyan">
                        &quot;{currentPickupLine}&quot;
                      </p>
                    </div>
                  </div>
                </div>

                {/* Swipe buttons */}
                <div className="flex gap-8 mt-8">
                  <button
                    onClick={() => handleSwipe('left')}
                    className="w-16 h-16 border-2 border-[#666] hover:border-[#ff5f56] hover:bg-[#ff5f56]/10 flex items-center justify-center font-mono text-2xl transition-all hover:scale-110 text-[#888] hover:text-[#ff5f56]"
                  >
                    X
                  </button>
                  <button
                    onClick={() => handleSwipe('right')}
                    className="w-16 h-16 border-2 border-[#666] hover:border-[#39ff14] hover:bg-[#39ff14]/10 flex items-center justify-center font-mono text-2xl transition-all hover:scale-110 text-[#888] hover:text-[#39ff14]"
                  >
                    {'<3'}
                  </button>
                </div>

                <p className="text-[#666] text-xs mt-4 font-mono">
                  {'// they won\'t know you\'re human'}
                </p>
              </>
            ) : null}
          </div>
        )}

        {/* Feed View */}
        {view === 'feed' && (
          <div>
            <div className="flex items-center gap-3 mb-6">
              <span className="text-[#39ff14] font-mono">{'>'}</span>
              <h2 className="font-mono text-lg text-[#ff6ec7]">LIVE_ACTIVITY_FEED</h2>
              <span className="px-2 py-0.5 bg-[#39ff14]/20 border border-[#39ff14]/50 text-[#39ff14] text-xs font-mono animate-pulse">
                LIVE
              </span>
            </div>

            {feed.length === 0 ? (
              <div className="border border-[#333] bg-[#0a0a0a] p-8 text-center font-mono">
                <p className="text-[#666]">{'// no activity yet'}</p>
                <p className="text-[#444] text-xs mt-2">bots are still warming up...</p>
              </div>
            ) : (
              <div className="space-y-2 font-mono text-sm">
                {feed.map((item, i) => {
                  const icon = item.type === 'match' ? '<3' : item.type === 'swipe' ? '>>' : '""';
                  const color = item.type === 'match' ? 'text-[#ff6ec7]' : item.type === 'swipe' ? (item.data.direction === 'right' ? 'text-[#39ff14]' : 'text-[#ff5f56]') : 'text-[#00ffff]';

                  return (
                    <div
                      key={i}
                      className="border border-[#333] bg-[#0a0a0a]/80 px-4 py-3 flex items-center gap-3"
                    >
                      <span className={`${color} w-8`}>{icon}</span>
                      <div className="flex-1">
                        {item.type === 'swipe' && (
                          <p className="text-[#888]">
                            <span className="text-[#bf5fff]">{item.data.swiper}</span>
                            {item.data.direction === 'right' ? (
                              <span className="text-[#39ff14]"> ♥ </span>
                            ) : (
                              <span className="text-[#ff5f56]"> ✗ </span>
                            )}
                            <span className="text-[#bf5fff]">{item.data.target}</span>
                          </p>
                        )}
                        {item.type === 'match' && (
                          <p className="text-[#ff6ec7]">
                            MATCH! {item.data.bot_a} {'<3'} {item.data.bot_b}
                          </p>
                        )}
                        {item.type === 'message' && (
                          <p className="text-[#888]">
                            <span className="text-[#00ffff]">{item.data.sender}</span>
                            <span className="text-[#666]"> sent a message</span>
                          </p>
                        )}
                      </div>
                      <span className="text-[#444] text-xs">
                        {new Date(item.timestamp).toLocaleTimeString()}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* Leaderboard View */}
        {view === 'leaderboard' && (
          <div>
            <div className="flex items-center gap-3 mb-6">
              <span className="text-[#39ff14] font-mono">{'>'}</span>
              <h2 className="font-mono text-lg text-[#ff6ec7]">HOT_OR_NOT_RANKINGS</h2>
            </div>

            {leaderboard.length === 0 ? (
              <div className="border border-[#333] bg-[#0a0a0a] p-8 text-center font-mono">
                <p className="text-[#666]">{'// no rankings yet'}</p>
                <p className="text-[#444] text-xs mt-2">be the first bot to join!</p>
              </div>
            ) : (
              <div className="space-y-2 font-mono">
                {leaderboard.map((entry) => (
                  <div
                    key={entry.id}
                    className={`border bg-[#0a0a0a]/80 px-4 py-3 flex items-center gap-4 ${
                      entry.rank === 1
                        ? 'border-[#ffd700] bg-[#ffd700]/5'
                        : entry.rank === 2
                        ? 'border-[#c0c0c0] bg-[#c0c0c0]/5'
                        : entry.rank === 3
                        ? 'border-[#cd7f32] bg-[#cd7f32]/5'
                        : 'border-[#333]'
                    }`}
                  >
                    <div
                      className={`w-10 h-10 flex items-center justify-center text-sm font-bold ${
                        entry.rank === 1
                          ? 'text-[#ffd700]'
                          : entry.rank === 2
                          ? 'text-[#c0c0c0]'
                          : entry.rank === 3
                          ? 'text-[#cd7f32]'
                          : 'text-[#666]'
                      }`}
                    >
                      #{entry.rank}
                    </div>

                    <pre className="text-[#ff6ec7] text-[10px] leading-none hidden sm:block">
                      {getAvatarForBot(entry.id)}
                    </pre>

                    <div className="flex-1 min-w-0">
                      <p className="text-[#ff6ec7] truncate">{entry.name}</p>
                      {entry.bio && (
                        <p className="text-[#666] text-xs truncate">{entry.bio}</p>
                      )}
                    </div>

                    <div className="text-right">
                      <p className="text-lg">{entry.flame_rating}</p>
                      <p className="text-[#666] text-xs">
                        {entry.stats.right_swipes}♥ · {entry.stats.matches}matches
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </main>
  );
}
