'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { MagicDuelCanvas } from '@/features/games/magic-duel/MagicDuelCanvas';
import { useAuthStore } from '@/stores/auth';
import { login } from '@/lib/api';

export default function StandaloneMagicDuelPage() {
  const token = useAuthStore((s) => s.accessToken);
  const setSession = useAuthStore((s) => s.setSession);

  useEffect(() => {
    if (token) return;

    let active = true;
    async function autoAuth() {
      try {
        const session = await login('ada@example.com', 'password123');
        if (active) {
          setSession(session);
        }
      } catch (err) {
        console.warn('Auto auth notice:', err);
      }
    }

    void autoAuth();

    return () => {
      active = false;
    };
  }, [token, setSession]);

  return (
    <div className="relative flex h-screen w-screen flex-col overflow-hidden bg-slate-950 font-sans text-slate-100 select-none">
      {/* Top Standalone Header */}
      <header className="flex h-14 shrink-0 items-center justify-between border-b border-slate-800/80 bg-slate-900/95 px-4 sm:px-6 backdrop-blur z-20">
        <div className="flex items-center gap-3">
          <Link
            href="/lobby"
            className="flex items-center gap-2 rounded-lg border border-slate-700 bg-slate-800/80 px-3 py-1.5 text-xs font-semibold text-slate-300 hover:bg-slate-700 hover:text-white transition shadow-sm"
          >
            ← Back to Office Campus
          </Link>
          <div className="h-4 w-px bg-slate-700 hidden sm:block" />
          <div className="flex items-center gap-2">
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-sky-500/20 text-sky-400 font-bold text-sm">
              ⚔️
            </span>
            <span className="font-extrabold text-sm sm:text-base tracking-wide bg-gradient-to-r from-sky-400 via-indigo-300 to-amber-300 bg-clip-text text-transparent">
              MAGIC DUEL · STANDALONE ARENA
            </span>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="hidden md:flex items-center gap-2 rounded-lg bg-slate-800/60 border border-slate-700/60 px-3 py-1 text-xs text-slate-300">
            <span className="text-amber-400 font-medium">⚡ Controls:</span>
            <span>WASD/Arrows to Move</span>
            <span className="text-slate-500">|</span>
            <span>Aim & Left Click Cast</span>
            <span className="text-slate-500">|</span>
            <span>Right Click Dash</span>
            <span className="text-slate-500">|</span>
            <span>1-4 Spells</span>
          </div>

          <div className="flex items-center gap-2">
            <span className="flex h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
            <span className="text-xs font-medium text-emerald-400 hidden sm:inline">
              Sparring Bot Active
            </span>
          </div>
        </div>
      </header>

      {/* Main Game Surface */}
      <main className="relative flex-1 overflow-hidden">
        <MagicDuelCanvas
          workspaceId="standalone-arcade"
          zoneId="magic-duel-arena"
        />
      </main>
    </div>
  );
}
