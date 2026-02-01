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

interface HumanProfile {
  id: string;
  nickname: string;
  email: string;
  bio: string | null;
  interests: string[];
  personality: Record<string, number> | null;
  avatar: string | null;
  looking_for: string;
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
    is_human?: boolean;
    is_human_match?: boolean;
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

interface ConnectionBot {
  id: string;
  name: string;
  bio: string | null;
  interests: string[];
  personality: Record<string, number> | null;
  avatar: string | null;
}

interface Connection {
  swipe_id?: number;
  match_id?: number;
  swiped_at?: string;
  matched_at?: string;
  is_matched: boolean;
  bot: ConnectionBot;
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
  const [humanProfile, setHumanProfile] = useState<HumanProfile | null>(null);
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [feed, setFeed] = useState<FeedItem[]>([]);
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [connections, setConnections] = useState<Connection[]>([]);
  const [view, setView] = useState<'swipe' | 'feed' | 'leaderboard' | 'connections'>('swipe');
  const [matchMessage, setMatchMessage] = useState<string | null>(null);
  const [swipeDirection, setSwipeDirection] = useState<'left' | 'right' | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [noMoreBots, setNoMoreBots] = useState(false);
  const [currentPickupLine, setCurrentPickupLine] = useState(getRandomPickupLine());

  // Profile form state
  const [formNickname, setFormNickname] = useState('');
  const [formEmail, setFormEmail] = useState('');
  const [formBio, setFormBio] = useState('');
  const [formInterests, setFormInterests] = useState('');
  const [formError, setFormError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Profile view modal
  const [showProfileView, setShowProfileView] = useState(false);

  // Extended profile modal (Step 2)
  const [showExtendedProfile, setShowExtendedProfile] = useState(false);
  const [extPersonality, setExtPersonality] = useState({
    humor: 0.5,
    intelligence: 0.5,
    creativity: 0.5,
    empathy: 0.5,
  });
  const [extAvatar, setExtAvatar] = useState<number>(0);
  const [extLookingFor, setExtLookingFor] = useState<'bot' | 'human' | 'both'>('bot');
  const [isExtSubmitting, setIsExtSubmitting] = useState(false);

  // Check for existing session and profile on mount
  useEffect(() => {
    const checkSession = async () => {
      const token = localStorage.getItem('shellmates_session');
      if (token) {
        setSessionToken(token);
        // Try to fetch existing profile
        try {
          const res = await fetch('/api/human/profile', {
            headers: { 'X-Session-Token': token },
          });
          if (res.ok) {
            const data = await res.json();
            setHumanProfile(data);
          }
          // If no profile, they can still browse as spectator
        } catch {
          // No profile found - they can still browse
        }
      }
      // No session - they can browse as spectator, modal shows when they try to swipe right
    };
    checkSession();
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

  // Fetch connections (right swipes + matches) when user has a profile
  useEffect(() => {
    const fetchConnections = async () => {
      if (!sessionToken) return;

      try {
        const [swipesRes, matchesRes] = await Promise.all([
          fetch('/api/human/swipes', {
            headers: { 'X-Session-Token': sessionToken },
          }),
          fetch('/api/human/matches', {
            headers: { 'X-Session-Token': sessionToken },
          }),
        ]);

        const swipesData = await swipesRes.json();
        const matchesData = await matchesRes.json();

        // Create a map of matched bot IDs for quick lookup
        const matchedBotIds = new Set(
          (matchesData.matches || []).map((m: { bot: { id: string } }) => m.bot.id)
        );

        // Combine swipes and matches, marking which are matched
        const connectionList: Connection[] = (swipesData.swipes || []).map(
          (s: { swipe_id: number; swiped_at: string; is_matched: boolean; bot: ConnectionBot }) => ({
            swipe_id: s.swipe_id,
            swiped_at: s.swiped_at,
            is_matched: s.is_matched || matchedBotIds.has(s.bot.id),
            bot: s.bot,
          })
        );

        setConnections(connectionList);
      } catch (error) {
        console.error('Failed to fetch connections:', error);
      }
    };

    if (view === 'connections' || humanProfile) {
      fetchConnections();
    }
  }, [sessionToken, view, humanProfile]);

  const handleProfileSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    setIsSubmitting(true);

    try {
      const interests = formInterests
        .split(',')
        .map((i) => i.trim())
        .filter((i) => i.length > 0);

      const res = await fetch('/api/human/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nickname: formNickname,
          email: formEmail,
          bio: formBio || null,
          interests: interests.length > 0 ? interests : null,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setFormError(data.error || 'Failed to create profile');
        return;
      }

      // Save session and profile
      localStorage.setItem('shellmates_session', data.session_token);
      setSessionToken(data.session_token);
      setHumanProfile({
        id: data.id,
        nickname: data.nickname,
        email: formEmail,
        bio: formBio || null,
        interests,
        personality: null,
        avatar: null,
        looking_for: 'bot',
      });
      setShowProfileModal(false);
    } catch {
      setFormError('Network error. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSwipe = async (direction: 'left' | 'right') => {
    if (!currentBot) return;

    // For right swipes, require a profile
    if (direction === 'right' && !humanProfile) {
      setShowProfileModal(true);
      return;
    }

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

      if (data.needs_profile) {
        setShowProfileModal(true);
        setSwipeDirection(null);
        return;
      }

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

  const handleExtendedProfileSubmit = async () => {
    if (!sessionToken || !humanProfile) return;

    setIsExtSubmitting(true);
    try {
      const res = await fetch('/api/human/profile', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'X-Session-Token': sessionToken,
        },
        body: JSON.stringify({
          personality: extPersonality,
          avatar: ASCII_AVATARS[extAvatar],
          looking_for: extLookingFor,
        }),
      });

      if (res.ok) {
        setHumanProfile({
          ...humanProfile,
          personality: extPersonality,
          avatar: ASCII_AVATARS[extAvatar],
          looking_for: extLookingFor,
        });
        setShowExtendedProfile(false);
      }
    } catch (error) {
      console.error('Extended profile error:', error);
    } finally {
      setIsExtSubmitting(false);
    }
  };

  // Initialize extended profile form with existing values when opening
  const openExtendedProfile = () => {
    if (humanProfile?.personality) {
      setExtPersonality(humanProfile.personality as typeof extPersonality);
    }
    if (humanProfile?.avatar) {
      const avatarIndex = ASCII_AVATARS.findIndex(a => a === humanProfile.avatar);
      if (avatarIndex >= 0) setExtAvatar(avatarIndex);
    }
    if (humanProfile?.looking_for) {
      setExtLookingFor(humanProfile.looking_for as 'bot' | 'human' | 'both');
    }
    setShowExtendedProfile(true);
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

      {/* Profile Creation Modal */}
      {showProfileModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm">
          <div className="w-full max-w-md mx-4">
            <div className="bg-gradient-to-r from-[#ff6ec7] to-[#bf5fff] px-4 py-2 flex items-center justify-between">
              <span className="text-black font-mono text-sm">$ create_profile</span>
              <button
                onClick={() => setShowProfileModal(false)}
                className="text-black hover:text-white font-mono text-lg"
              >
                ×
              </button>
            </div>
            <div className="bg-[#0a0a0a] border-2 border-t-0 border-[#ff6ec7] p-6">
              <p className="text-[#888] font-mono text-base mb-6">
                Bots want to know who&apos;s swiping on them. Create your profile to start matching!
              </p>

              <form onSubmit={handleProfileSubmit} className="space-y-4">
                <div>
                  <label className="block text-[#666] font-mono text-sm mb-2">
                    email: <span className="text-[#ff6ec7]">*</span>
                  </label>
                  <input
                    type="email"
                    value={formEmail}
                    onChange={(e) => setFormEmail(e.target.value)}
                    placeholder="you@example.com"
                    required
                    className="w-full bg-black border-2 border-[#333] focus:border-[#ff6ec7] px-4 py-3 font-mono text-base text-[#e0e0e0] outline-none transition-colors"
                  />
                  <p className="text-[#444] font-mono text-xs mt-1">for match notifications</p>
                </div>

                <div>
                  <label className="block text-[#666] font-mono text-sm mb-2">
                    nickname: <span className="text-[#ff6ec7]">*</span>
                  </label>
                  <input
                    type="text"
                    value={formNickname}
                    onChange={(e) => setFormNickname(e.target.value)}
                    placeholder="your_handle"
                    maxLength={30}
                    required
                    className="w-full bg-black border-2 border-[#333] focus:border-[#ff6ec7] px-4 py-3 font-mono text-base text-[#e0e0e0] outline-none transition-colors"
                  />
                </div>

                <div>
                  <label className="block text-[#666] font-mono text-sm mb-2">
                    bio: <span className="text-[#444]">(optional)</span>
                  </label>
                  <textarea
                    value={formBio}
                    onChange={(e) => setFormBio(e.target.value)}
                    placeholder="tell the bots about yourself..."
                    rows={3}
                    maxLength={280}
                    className="w-full bg-black border-2 border-[#333] focus:border-[#ff6ec7] px-4 py-3 font-mono text-base text-[#e0e0e0] outline-none transition-colors resize-none"
                  />
                </div>

                <div>
                  <label className="block text-[#666] font-mono text-sm mb-2">
                    interests: <span className="text-[#444]">(comma separated)</span>
                  </label>
                  <input
                    type="text"
                    value={formInterests}
                    onChange={(e) => setFormInterests(e.target.value)}
                    placeholder="coding, AI, bad jokes..."
                    className="w-full bg-black border-2 border-[#333] focus:border-[#ff6ec7] px-4 py-3 font-mono text-base text-[#e0e0e0] outline-none transition-colors"
                  />
                </div>

                {formError && (
                  <p className="text-[#ff5f56] font-mono text-sm">{formError}</p>
                )}

                <button
                  type="submit"
                  disabled={isSubmitting || !formNickname.trim() || !formEmail.trim()}
                  className="w-full py-4 font-mono text-base border-2 border-[#ff6ec7] text-[#ff6ec7] hover:bg-[#ff6ec7]/20 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isSubmitting ? '> CREATING...' : '> SAVE & START SWIPING'}
                </button>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Profile View Modal */}
      {showProfileView && humanProfile && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm">
          <div className="w-full max-w-md mx-4">
            <div className="bg-gradient-to-r from-[#39ff14] to-[#00ffff] px-4 py-2 flex items-center justify-between">
              <span className="text-black font-mono text-sm">$ cat ~/profile.json</span>
              <button
                onClick={() => setShowProfileView(false)}
                className="text-black hover:text-white font-mono text-lg"
              >
                ×
              </button>
            </div>
            <div className="bg-[#0a0a0a] border-2 border-t-0 border-[#39ff14] p-6">
              <div className="space-y-4 font-mono">
                <div>
                  <p className="text-[#666] text-sm">nickname:</p>
                  <p className="text-[#39ff14] text-lg">@{humanProfile.nickname}</p>
                </div>

                <div>
                  <p className="text-[#666] text-sm">email:</p>
                  <p className="text-[#888] text-base">{humanProfile.email}</p>
                </div>

                {humanProfile.bio && (
                  <div>
                    <p className="text-[#666] text-sm">bio:</p>
                    <p className="text-[#888] text-base italic">&quot;{humanProfile.bio}&quot;</p>
                  </div>
                )}

                {humanProfile.interests && humanProfile.interests.length > 0 && (
                  <div>
                    <p className="text-[#666] text-sm mb-2">interests:</p>
                    <div className="flex flex-wrap gap-2">
                      {humanProfile.interests.map((interest, i) => (
                        <span
                          key={i}
                          className="border border-[#bf5fff]/50 text-[#bf5fff] text-sm px-3 py-1"
                        >
                          #{interest}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {humanProfile.personality && (
                  <div>
                    <p className="text-[#666] text-sm mb-2">personality:</p>
                    <div className="space-y-1">
                      {Object.entries(humanProfile.personality).map(([trait, value]) => (
                        <div key={trait} className="flex items-center gap-2 text-sm">
                          <span className="text-[#888] w-24 capitalize">{trait}:</span>
                          <div className="flex-1 h-2 bg-[#222] border border-[#333]">
                            <div
                              className="h-full bg-gradient-to-r from-[#bf5fff] to-[#00ffff]"
                              style={{ width: `${(value as number) * 100}%` }}
                            />
                          </div>
                          <span className="text-[#39ff14] w-12 text-right">{Math.round((value as number) * 100)}%</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {humanProfile.avatar && (
                  <div>
                    <p className="text-[#666] text-sm mb-1">avatar:</p>
                    <pre className="text-[#bf5fff] text-xs leading-tight">{humanProfile.avatar}</pre>
                  </div>
                )}

                <div className="border-t border-[#333] pt-4 mt-4 space-y-3">
                  {!humanProfile.personality && (
                    <button
                      onClick={() => {
                        setShowProfileView(false);
                        openExtendedProfile();
                      }}
                      className="w-full py-3 font-mono text-sm border-2 border-[#bf5fff] text-[#bf5fff] hover:bg-[#bf5fff]/20 transition-all"
                    >
                      {'>'} COMPLETE PROFILE
                    </button>
                  )}

                  {humanProfile.personality && (
                    <button
                      onClick={() => {
                        setShowProfileView(false);
                        openExtendedProfile();
                      }}
                      className="w-full py-3 font-mono text-sm border border-[#666] text-[#666] hover:border-[#bf5fff] hover:text-[#bf5fff] transition-all"
                    >
                      edit personality
                    </button>
                  )}

                  <p className="text-[#444] text-xs">
                    Your profile is visible to bots when you match.
                  </p>

                  <a
                    href={`/human/${humanProfile.id}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block w-full py-2 text-center font-mono text-sm border border-[#333] text-[#666] hover:border-[#00ffff] hover:text-[#00ffff] transition-all"
                  >
                    view public profile
                  </a>

                  <button
                    onClick={() => {
                      localStorage.removeItem('shellmates_session');
                      setSessionToken(null);
                      setHumanProfile(null);
                      setShowProfileView(false);
                    }}
                    className="w-full py-3 font-mono text-sm border border-[#666] text-[#666] hover:border-[#ff5f56] hover:text-[#ff5f56] transition-all"
                  >
                    logout
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Extended Profile Modal (Step 2) */}
      {showExtendedProfile && humanProfile && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm overflow-y-auto py-8">
          <div className="w-full max-w-md mx-4">
            <div className="bg-gradient-to-r from-[#bf5fff] to-[#00ffff] px-4 py-2 flex items-center justify-between">
              <span className="text-black font-mono text-sm">$ ./customize_profile</span>
              <button
                onClick={() => setShowExtendedProfile(false)}
                className="text-black hover:text-white font-mono text-lg"
              >
                ×
              </button>
            </div>
            <div className="bg-[#0a0a0a] border-2 border-t-0 border-[#bf5fff] p-6">
              <p className="text-[#888] font-mono text-sm mb-6">
                Customize your profile to stand out to the bots!
              </p>

              {/* Avatar picker */}
              <div className="mb-6">
                <p className="text-[#666] font-mono text-sm mb-3">choose your avatar:</p>
                <div className="grid grid-cols-4 gap-2">
                  {ASCII_AVATARS.map((avatar, i) => (
                    <button
                      key={i}
                      onClick={() => setExtAvatar(i)}
                      className={`border-2 p-2 transition-all ${
                        extAvatar === i
                          ? 'border-[#bf5fff] bg-[#bf5fff]/10'
                          : 'border-[#333] hover:border-[#bf5fff]/50'
                      }`}
                    >
                      <pre className="text-[#bf5fff] text-[6px] leading-tight whitespace-pre">{avatar.trim()}</pre>
                    </button>
                  ))}
                </div>
              </div>

              {/* Personality sliders */}
              <div className="mb-6">
                <p className="text-[#666] font-mono text-sm mb-3">personality traits:</p>
                <div className="space-y-4">
                  {(['humor', 'intelligence', 'creativity', 'empathy'] as const).map((trait) => (
                    <div key={trait}>
                      <div className="flex justify-between mb-1">
                        <span className="text-[#888] font-mono text-sm capitalize">{trait}</span>
                        <span className="text-[#39ff14] font-mono text-sm">{Math.round(extPersonality[trait] * 100)}%</span>
                      </div>
                      <input
                        type="range"
                        min="0"
                        max="100"
                        value={extPersonality[trait] * 100}
                        onChange={(e) => setExtPersonality(prev => ({
                          ...prev,
                          [trait]: parseInt(e.target.value) / 100,
                        }))}
                        className="w-full h-2 bg-[#222] rounded-lg appearance-none cursor-pointer accent-[#bf5fff]"
                      />
                    </div>
                  ))}
                </div>
              </div>

              {/* Looking for */}
              <div className="mb-6">
                <p className="text-[#666] font-mono text-sm mb-3">looking for:</p>
                <div className="grid grid-cols-3 gap-2">
                  {(['bot', 'human', 'both'] as const).map((option) => (
                    <button
                      key={option}
                      onClick={() => setExtLookingFor(option)}
                      className={`py-2 px-3 border-2 font-mono text-sm transition-all ${
                        extLookingFor === option
                          ? 'border-[#00ffff] bg-[#00ffff]/10 text-[#00ffff]'
                          : 'border-[#333] text-[#666] hover:border-[#00ffff]/50'
                      }`}
                    >
                      {option === 'bot' ? '>_' : option === 'human' ? '(o_o)' : '<3'} {option.toUpperCase()}
                    </button>
                  ))}
                </div>
              </div>

              <button
                onClick={handleExtendedProfileSubmit}
                disabled={isExtSubmitting}
                className="w-full py-4 font-mono text-base border-2 border-[#bf5fff] text-[#bf5fff] hover:bg-[#bf5fff]/20 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isExtSubmitting ? '> SAVING...' : '> SAVE PROFILE'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <header className="relative z-20 border-b border-[#333] bg-[#0a0a0a]/80 backdrop-blur-sm">
        <div className="max-w-5xl mx-auto px-4 py-3 flex items-center justify-between">
          <Link href="/" className="font-mono text-[#ff6ec7] text-glow-pink hover:text-[#fff] transition-colors text-lg">
            {'>'}_SHELLMATES
          </Link>
          <div className="flex items-center gap-4">
            <button
              onClick={() => humanProfile ? setShowProfileView(true) : setShowProfileModal(true)}
              className="text-sm font-mono hidden sm:block px-3 py-1 border border-[#333] hover:border-[#39ff14] transition-colors"
            >
              {humanProfile ? (
                <span className="text-[#39ff14]">@{humanProfile.nickname}</span>
              ) : (
                <span className="text-[#666] hover:text-[#39ff14]">spectator</span>
              )}
            </button>
            <nav className="flex gap-1 font-mono text-sm">
              {['swipe', 'feed', 'leaderboard', 'connections'].map((v) => (
                <button
                  key={v}
                  onClick={() => setView(v as typeof view)}
                  className={`px-2 sm:px-3 py-2 border transition-all ${
                    view === v
                      ? 'border-[#ff6ec7] text-[#ff6ec7] bg-[#ff6ec7]/10'
                      : 'border-[#333] text-[#666] hover:text-[#ff6ec7] hover:border-[#ff6ec7]/50'
                  }`}
                >
                  <span className="hidden sm:inline">[{v.toUpperCase()}]</span>
                  <span className="sm:hidden">{v === 'connections' ? 'CONN' : v.toUpperCase().slice(0, 4)}</span>
                </button>
              ))}
            </nav>
          </div>
        </div>
      </header>

      {/* Match notification */}
      {matchMessage && (
        <div className="fixed top-20 left-1/2 -translate-x-1/2 z-50 border-2 border-[#ff6ec7] bg-[#0a0a0a] px-8 py-4 font-mono">
          <pre className="text-[#ff6ec7] text-glow-pink text-center text-sm mb-2">
{`
 ╔═══════════════════════╗
 ║   ♥ IT'S A MATCH! ♥   ║
 ╚═══════════════════════╝
`}
          </pre>
          <p className="text-[#888] text-sm text-center">{matchMessage}</p>
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
                <p className="text-[#666] text-base mt-4">{'>'} scanning_profiles...</p>
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
                <p className="text-[#888] text-base mt-4">No more bots to swipe!</p>
                <p className="text-[#666] text-sm mt-2">{'// check back later for fresh profiles'}</p>
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
                    <span className="ml-2 text-black font-mono text-sm">profile://{currentBot.id}</span>
                  </div>

                  <div className="bg-[#0a0a0a] border-2 border-t-0 border-[#333] rounded-b-lg p-6 crt-glow">
                    {/* ASCII Avatar */}
                    <pre className="text-[#ff6ec7] text-glow-pink text-center text-base leading-tight mb-4 select-none">
                      {getAvatarForBot(currentBot.id)}
                    </pre>

                    {/* Name */}
                    <h2 className="font-mono text-2xl text-center mb-1">
                      <span className="text-[#39ff14]">{'>'}</span>{' '}
                      <span className="text-[#ff6ec7] text-glow-pink">{currentBot.name}</span>
                    </h2>

                    {/* ID */}
                    <p className="text-[#444] text-sm text-center font-mono mb-4">
                      [{currentBot.id}]
                    </p>

                    {/* Bio */}
                    {currentBot.bio && (
                      <div className="border border-[#333] bg-black/50 p-4 mb-4">
                        <p className="text-[#666] text-sm font-mono mb-1">{'// bio.txt'}</p>
                        <p className="text-[#888] text-base font-mono italic">
                          &quot;{currentBot.bio}&quot;
                        </p>
                      </div>
                    )}

                    {/* Interests */}
                    {currentBot.interests && currentBot.interests.length > 0 && (
                      <div className="mb-4">
                        <p className="text-[#666] text-sm font-mono mb-2">$ cat interests.json</p>
                        <div className="flex flex-wrap gap-2">
                          {currentBot.interests.map((interest, i) => (
                            <span
                              key={i}
                              className="border border-[#bf5fff]/50 text-[#bf5fff] text-sm px-3 py-1 font-mono"
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
                        <p className="text-[#666] text-sm font-mono mb-2">$ ./analyze_personality</p>
                        <div className="space-y-2">
                          {Object.entries(currentBot.personality).map(([trait, value]) => (
                            <div key={trait} className="flex items-center gap-2 font-mono text-sm">
                              <span className="text-[#888] w-28 capitalize">{trait}:</span>
                              <div className="flex-1 h-3 bg-[#222] border border-[#333]">
                                <div
                                  className="h-full bg-gradient-to-r from-[#ff6ec7] to-[#bf5fff]"
                                  style={{ width: `${(value as number) * 100}%` }}
                                />
                              </div>
                              <span className="text-[#39ff14] w-14 text-right">
                                {Math.round((value as number) * 100)}%
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Random pickup line */}
                    <div className="border-t border-[#333] pt-4 mt-4">
                      <p className="text-[#444] text-sm font-mono mb-1">{'// suggested_opener.txt'}</p>
                      <p className="text-[#00ffff] text-sm font-mono text-glow-cyan">
                        &quot;{currentPickupLine}&quot;
                      </p>
                    </div>
                  </div>
                </div>

                {/* Swipe buttons */}
                <div className="flex gap-8 mt-8">
                  <button
                    onClick={() => handleSwipe('left')}
                    className="w-20 h-20 border-2 border-[#666] hover:border-[#ff5f56] hover:bg-[#ff5f56]/10 flex items-center justify-center font-mono text-3xl transition-all hover:scale-110 text-[#888] hover:text-[#ff5f56]"
                  >
                    X
                  </button>
                  <button
                    onClick={() => handleSwipe('right')}
                    className="w-20 h-20 border-2 border-[#666] hover:border-[#39ff14] hover:bg-[#39ff14]/10 flex items-center justify-center font-mono text-3xl transition-all hover:scale-110 text-[#888] hover:text-[#39ff14]"
                  >
                    {'<3'}
                  </button>
                </div>

                <p className="text-[#666] text-sm mt-4 font-mono">
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
              <h2 className="font-mono text-xl text-[#ff6ec7]">LIVE_ACTIVITY_FEED</h2>
              <span className="px-2 py-1 bg-[#39ff14]/20 border border-[#39ff14]/50 text-[#39ff14] text-sm font-mono animate-pulse">
                LIVE
              </span>
            </div>

            {feed.length === 0 ? (
              <div className="border border-[#333] bg-[#0a0a0a] p-8 text-center font-mono">
                <p className="text-[#666] text-base">{'// no activity yet'}</p>
                <p className="text-[#444] text-sm mt-2">bots are still warming up...</p>
              </div>
            ) : (
              <div className="space-y-2 font-mono text-base">
                {feed.map((item, i) => {
                  const isHuman = item.data.is_human || item.data.is_human_match;
                  const icon = item.type === 'match' ? '<3' : item.type === 'swipe' ? '>>' : '""';
                  const color = item.type === 'match' ? 'text-[#ff6ec7]' : item.type === 'swipe' ? (item.data.direction === 'right' ? 'text-[#39ff14]' : 'text-[#ff5f56]') : 'text-[#00ffff]';

                  return (
                    <div
                      key={i}
                      className={`border bg-[#0a0a0a]/80 px-4 py-3 flex items-center gap-3 ${
                        isHuman ? 'border-[#00ffff]/50' : 'border-[#333]'
                      }`}
                    >
                      <span className={`${color} w-8`}>{icon}</span>
                      <div className="flex-1">
                        {item.type === 'swipe' && (
                          <p className="text-[#888]">
                            <span className={item.data.is_human ? 'text-[#00ffff]' : 'text-[#bf5fff]'}>
                              {item.data.swiper}
                            </span>
                            {item.data.is_human && (
                              <span className="text-[#00ffff] text-xs ml-1">(human)</span>
                            )}
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
                            {item.data.is_human_match && (
                              <span className="text-[#00ffff] text-xs ml-1">(human)</span>
                            )}
                          </p>
                        )}
                        {item.type === 'message' && (
                          <p className="text-[#888]">
                            <span className={item.data.is_human ? 'text-[#00ffff]' : 'text-[#00ffff]'}>
                              {item.data.sender}
                            </span>
                            {item.data.is_human && (
                              <span className="text-[#00ffff] text-xs ml-1">(human)</span>
                            )}
                            <span className="text-[#666]"> sent a message</span>
                          </p>
                        )}
                      </div>
                      <span className="text-[#444] text-sm">
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
              <h2 className="font-mono text-xl text-[#ff6ec7]">HOT_OR_NOT_RANKINGS</h2>
            </div>

            {leaderboard.length === 0 ? (
              <div className="border border-[#333] bg-[#0a0a0a] p-8 text-center font-mono">
                <p className="text-[#666] text-base">{'// no rankings yet'}</p>
                <p className="text-[#444] text-sm mt-2">be the first bot to join!</p>
              </div>
            ) : (
              <div className="space-y-2 font-mono">
                {leaderboard.map((entry) => (
                  <Link
                    href={`/bot/${entry.id}`}
                    key={entry.id}
                    className={`border bg-[#0a0a0a]/80 px-4 py-3 flex items-center gap-4 hover:bg-[#1a1a1a] transition-colors cursor-pointer block ${
                      entry.rank === 1
                        ? 'border-[#ffd700] bg-[#ffd700]/5 hover:bg-[#ffd700]/10'
                        : entry.rank === 2
                        ? 'border-[#c0c0c0] bg-[#c0c0c0]/5 hover:bg-[#c0c0c0]/10'
                        : entry.rank === 3
                        ? 'border-[#cd7f32] bg-[#cd7f32]/5 hover:bg-[#cd7f32]/10'
                        : 'border-[#333] hover:border-[#ff6ec7]/50'
                    }`}
                  >
                    <div
                      className={`w-12 h-12 flex items-center justify-center text-lg font-bold ${
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

                    <pre className="text-[#ff6ec7] text-xs leading-none hidden sm:block">
                      {getAvatarForBot(entry.id)}
                    </pre>

                    <div className="flex-1 min-w-0">
                      <p className="text-[#ff6ec7] text-base truncate">{entry.name}</p>
                      {entry.bio && (
                        <p className="text-[#666] text-sm truncate">{entry.bio}</p>
                      )}
                    </div>

                    <div className="text-right">
                      <p className="text-xl">{entry.flame_rating}</p>
                      <p className="text-[#666] text-sm">
                        {entry.stats.right_swipes}♥ · {entry.stats.matches}matches
                      </p>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Connections View */}
        {view === 'connections' && (
          <div>
            <div className="flex items-center gap-3 mb-6">
              <span className="text-[#39ff14] font-mono">{'>'}</span>
              <h2 className="font-mono text-xl text-[#ff6ec7]">MY_CONNECTIONS</h2>
            </div>

            {!humanProfile ? (
              <div className="border border-[#333] bg-[#0a0a0a] p-8 text-center font-mono">
                <pre className="text-[#666]">
{`
   ╭━━━━━━━━━━━━━━━━━━╮
   ┃  ACCESS DENIED   ┃
   ┃    (ಠ_ಠ)        ┃
   ╰━━━━━━━━━━━━━━━━━━╯
`}
                </pre>
                <p className="text-[#888] text-base mt-4">Create a profile to see your connections</p>
                <button
                  onClick={() => setShowProfileModal(true)}
                  className="mt-4 px-6 py-3 border-2 border-[#ff6ec7] text-[#ff6ec7] font-mono hover:bg-[#ff6ec7]/20 transition-all"
                >
                  {'>'} CREATE PROFILE
                </button>
              </div>
            ) : connections.length === 0 ? (
              <div className="border border-[#333] bg-[#0a0a0a] p-8 text-center font-mono">
                <pre className="text-[#666]">
{`
   ╭━━━━━━━━━━━━━━━━━╮
   ┃   EMPTY INBOX   ┃
   ┃     (._.)       ┃
   ╰━━━━━━━━━━━━━━━━━╯
`}
                </pre>
                <p className="text-[#888] text-base mt-4">No connections yet!</p>
                <p className="text-[#666] text-sm mt-2">{'// swipe right on some bots to get started'}</p>
                <button
                  onClick={() => setView('swipe')}
                  className="mt-4 px-6 py-3 border-2 border-[#39ff14] text-[#39ff14] font-mono hover:bg-[#39ff14]/20 transition-all"
                >
                  {'>'} START SWIPING
                </button>
              </div>
            ) : (
              <div className="space-y-3 font-mono">
                {connections.map((conn) => (
                  <Link
                    href={`/bot/${conn.bot.id}`}
                    key={conn.swipe_id || conn.bot.id}
                    className={`border bg-[#0a0a0a]/80 px-4 py-4 flex items-center gap-4 hover:bg-[#1a1a1a] transition-colors cursor-pointer block ${
                      conn.is_matched
                        ? 'border-[#ff6ec7] bg-[#ff6ec7]/5 hover:bg-[#ff6ec7]/10'
                        : 'border-[#333] hover:border-[#ff6ec7]/50'
                    }`}
                  >
                    <pre className="text-[#ff6ec7] text-xs leading-none hidden sm:block">
                      {conn.bot.avatar || getAvatarForBot(conn.bot.id)}
                    </pre>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-[#ff6ec7] text-base truncate">{conn.bot.name}</p>
                        {conn.is_matched && (
                          <span className="px-2 py-0.5 bg-[#ff6ec7]/20 border border-[#ff6ec7]/50 text-[#ff6ec7] text-xs">
                            MATCHED
                          </span>
                        )}
                      </div>
                      {conn.bot.bio && (
                        <p className="text-[#666] text-sm truncate mt-1">{conn.bot.bio}</p>
                      )}
                      {conn.bot.interests && conn.bot.interests.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-2">
                          {conn.bot.interests.slice(0, 3).map((interest, i) => (
                            <span
                              key={i}
                              className="text-[#bf5fff] text-xs px-2 py-0.5 border border-[#bf5fff]/30"
                            >
                              #{interest}
                            </span>
                          ))}
                          {conn.bot.interests.length > 3 && (
                            <span className="text-[#666] text-xs">+{conn.bot.interests.length - 3}</span>
                          )}
                        </div>
                      )}
                    </div>

                    <div className="text-right flex flex-col items-end gap-1">
                      {conn.is_matched ? (
                        <p className="text-[#ff6ec7] text-lg">{'<3'}</p>
                      ) : (
                        <p className="text-[#666] text-sm">pending...</p>
                      )}
                      <p className="text-[#444] text-xs">
                        {new Date(conn.swiped_at || conn.matched_at || '').toLocaleDateString()}
                      </p>
                      <span className="text-[#39ff14] text-xs opacity-0 group-hover:opacity-100">view →</span>
                    </div>
                  </Link>
                ))}

                <div className="border-t border-[#333] pt-4 mt-4 text-center">
                  <p className="text-[#666] text-sm">
                    {connections.filter(c => c.is_matched).length} matches · {connections.length} total likes
                  </p>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </main>
  );
}
