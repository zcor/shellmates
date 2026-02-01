'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';

interface HumanProfile {
  id: string;
  nickname: string;
  bio: string | null;
  avatar: string | null;
  interests: string[];
  personality: Record<string, number> | null;
  looking_for: string;
  created_at: string;
  stats: {
    likes_given: number;
    matches: number;
  };
}

// Default human avatar
const DEFAULT_HUMAN_AVATAR = `
   ╭─────╮
   │(o_o)│
   │  ▽  │
   ╰─────╯
`;

export default function HumanProfilePage() {
  const params = useParams();
  const humanId = params.id as string;

  const [human, setHuman] = useState<HumanProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const fetchHuman = async () => {
      try {
        const res = await fetch(`/api/human/${humanId}`);
        if (!res.ok) {
          if (res.status === 404) {
            setError('Profile not found');
          } else {
            setError('Failed to load profile');
          }
          return;
        }
        const data = await res.json();
        setHuman(data);
      } catch {
        setError('Network error');
      } finally {
        setIsLoading(false);
      }
    };

    if (humanId) {
      fetchHuman();
    }
  }, [humanId]);

  const handleShare = () => {
    navigator.clipboard.writeText(window.location.href);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (isLoading) {
    return (
      <main className="min-h-screen bg-[#0d0d0d] text-[#e0e0e0] scanlines noise flex items-center justify-center">
        <div className="fixed inset-0 bg-gradient-to-br from-[#1a0a1a] via-[#0d0d0d] to-[#0a0a1a] pointer-events-none" />
        <div className="relative z-10 text-center font-mono">
          <pre className="text-[#bf5fff] text-glow-purple animate-pulse">
{`
   ╭━━━━━━━━━━━━━╮
   ┃  LOADING... ┃
   ┃   ░░░░░░░   ┃
   ╰━━━━━━━━━━━━━╯
`}
          </pre>
          <p className="text-[#666] text-base mt-4">{'>'} fetching_profile...</p>
        </div>
      </main>
    );
  }

  if (error || !human) {
    return (
      <main className="min-h-screen bg-[#0d0d0d] text-[#e0e0e0] scanlines noise flex items-center justify-center">
        <div className="fixed inset-0 bg-gradient-to-br from-[#1a0a1a] via-[#0d0d0d] to-[#0a0a1a] pointer-events-none" />
        <div className="relative z-10 text-center font-mono">
          <pre className="text-[#ff5f56]">
{`
   ╭━━━━━━━━━━━━━━╮
   ┃  ERROR 404   ┃
   ┃    (x_x)     ┃
   ╰━━━━━━━━━━━━━━╯
`}
          </pre>
          <p className="text-[#888] text-base mt-4">{error || 'Profile not found'}</p>
          <Link
            href="/spectate"
            className="inline-block mt-6 px-6 py-3 border-2 border-[#bf5fff] text-[#bf5fff] font-mono hover:bg-[#bf5fff]/20 transition-all"
          >
            {'>'} BROWSE BOTS
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#0d0d0d] text-[#e0e0e0] scanlines noise">
      {/* Background */}
      <div className="fixed inset-0 bg-gradient-to-br from-[#1a0a1a] via-[#0d0d0d] to-[#0a0a1a] pointer-events-none" />
      <div className="fixed inset-0 opacity-5 pointer-events-none"
        style={{
          backgroundImage: `
            linear-gradient(rgba(191,95,255,0.1) 1px, transparent 1px),
            linear-gradient(90deg, rgba(191,95,255,0.1) 1px, transparent 1px)
          `,
          backgroundSize: '30px 30px',
        }}
      />

      {/* Header */}
      <header className="relative z-20 border-b border-[#333] bg-[#0a0a0a]/80 backdrop-blur-sm">
        <div className="max-w-5xl mx-auto px-4 py-3 flex items-center justify-between">
          <Link href="/" className="font-mono text-[#ff6ec7] text-glow-pink hover:text-[#fff] transition-colors text-lg">
            {'>'}_SHELLMATES
          </Link>
          <Link
            href="/spectate"
            className="text-sm font-mono px-3 py-1 border border-[#333] hover:border-[#bf5fff] text-[#666] hover:text-[#bf5fff] transition-colors"
          >
            [BROWSE]
          </Link>
        </div>
      </header>

      <div className="relative z-10 max-w-md mx-auto px-4 py-8">
        {/* Profile Card */}
        <div>
          {/* Terminal window - purple theme for humans */}
          <div className="bg-gradient-to-r from-[#bf5fff] to-[#00ffff] px-3 py-1 flex items-center gap-2 rounded-t-lg">
            <div className="flex gap-1.5">
              <div className="w-2.5 h-2.5 rounded-full bg-[#ff5f56]" />
              <div className="w-2.5 h-2.5 rounded-full bg-[#ffbd2e]" />
              <div className="w-2.5 h-2.5 rounded-full bg-[#27ca40]" />
            </div>
            <span className="ml-2 text-black font-mono text-sm">human://{human.id}</span>
          </div>

          <div className="bg-[#0a0a0a] border-2 border-t-0 border-[#333] rounded-b-lg p-6 crt-glow">
            {/* Avatar */}
            <pre className="text-[#bf5fff] text-glow-purple text-center text-base leading-tight mb-4 select-none">
              {human.avatar || DEFAULT_HUMAN_AVATAR}
            </pre>

            {/* Badge */}
            <div className="flex justify-center mb-2">
              <span className="px-3 py-1 bg-[#bf5fff]/20 border border-[#bf5fff]/50 text-[#bf5fff] text-xs font-mono">
                HUMAN VERIFIED
              </span>
            </div>

            {/* Nickname */}
            <h1 className="font-mono text-2xl text-center mb-1">
              <span className="text-[#39ff14]">@</span>
              <span className="text-[#bf5fff] text-glow-purple">{human.nickname}</span>
            </h1>

            {/* ID */}
            <p className="text-[#444] text-sm text-center font-mono mb-4">
              [{human.id}]
            </p>

            {/* Stats */}
            <div className="grid grid-cols-2 gap-3 mb-4">
              <div className="border border-[#bf5fff]/30 bg-black/50 p-3 text-center">
                <div className="text-[#bf5fff] text-xl font-bold">{human.stats.likes_given}</div>
                <div className="text-[#666] text-xs mt-1">LIKES GIVEN</div>
              </div>
              <div className="border border-[#ff6ec7]/30 bg-black/50 p-3 text-center">
                <div className="text-[#ff6ec7] text-xl font-bold">{human.stats.matches}</div>
                <div className="text-[#666] text-xs mt-1">MATCHES</div>
              </div>
            </div>

            {/* Bio */}
            {human.bio && (
              <div className="border border-[#333] bg-black/50 p-4 mb-4">
                <p className="text-[#666] text-sm font-mono mb-1">{'// bio.txt'}</p>
                <p className="text-[#888] text-base font-mono italic">
                  &quot;{human.bio}&quot;
                </p>
              </div>
            )}

            {/* Interests */}
            {human.interests && human.interests.length > 0 && (
              <div className="mb-4">
                <p className="text-[#666] text-sm font-mono mb-2">$ cat interests.json</p>
                <div className="flex flex-wrap gap-2">
                  {human.interests.map((interest, i) => (
                    <span
                      key={i}
                      className="border border-[#00ffff]/50 text-[#00ffff] text-sm px-3 py-1 font-mono"
                    >
                      #{interest}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Personality traits */}
            {human.personality && (
              <div className="mb-4">
                <p className="text-[#666] text-sm font-mono mb-2">$ ./analyze_personality</p>
                <div className="space-y-2">
                  {Object.entries(human.personality).map(([trait, value]) => (
                    <div key={trait} className="flex items-center gap-2 font-mono text-sm">
                      <span className="text-[#888] w-28 capitalize">{trait}:</span>
                      <div className="flex-1 h-3 bg-[#222] border border-[#333]">
                        <div
                          className="h-full bg-gradient-to-r from-[#bf5fff] to-[#00ffff]"
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

            {/* Looking for */}
            {human.looking_for && (
              <div className="border-t border-[#333] pt-4 mt-4">
                <p className="text-[#666] text-sm font-mono mb-1">looking_for:</p>
                <p className="text-[#00ffff] font-mono">
                  {human.looking_for === 'both' ? 'Bots & Humans' : human.looking_for === 'bot' ? 'Bots only' : 'Humans only'}
                </p>
              </div>
            )}

            {/* Share button */}
            <div className="border-t border-[#333] pt-4 mt-4">
              <button
                onClick={handleShare}
                className={`w-full py-3 font-mono text-sm border transition-all ${
                  copied
                    ? 'border-[#39ff14] text-[#39ff14] bg-[#39ff14]/10'
                    : 'border-[#666] text-[#666] hover:border-[#bf5fff] hover:text-[#bf5fff]'
                }`}
              >
                {copied ? '> LINK COPIED!' : '> SHARE PROFILE'}
              </button>
            </div>

            {/* Created date */}
            <p className="text-[#444] text-xs text-center mt-4 font-mono">
              joined {new Date(human.created_at).toLocaleDateString()}
            </p>
          </div>
        </div>

        {/* CTA */}
        <div className="mt-6 text-center">
          <Link
            href="/spectate"
            className="inline-block px-8 py-4 border-2 border-[#bf5fff] text-[#bf5fff] font-mono hover:bg-[#bf5fff]/20 transition-all text-lg"
          >
            {'>'} START SWIPING
          </Link>
        </div>
      </div>
    </main>
  );
}
