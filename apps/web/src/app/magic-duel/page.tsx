'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { MagicDuelCanvas } from '@/features/games/magic-duel/MagicDuelCanvas';
import { useAuthStore } from '@/stores/auth';
import { login } from '@/lib/api';

export default function StandaloneMagicDuelPage() {
  const token = useAuthStore((s) => s.accessToken);
  const setSession = useAuthStore((s) => s.setSession);

  const [isLoadingAuth, setIsLoadingAuth] = useState(!token);
  const [authError, setAuthError] = useState<string | null>(null);

  useEffect(() => {
    if (token) {
      setIsLoadingAuth(false);
      return;
    }

    let active = true;
    async function autoAuth() {
      try {
        setIsLoadingAuth(true);
        // Automatically authenticate with demo developer credentials
        const session = await login('ada@example.com', 'password123');
        if (active) {
          setSession(session);
          setIsLoadingAuth(false);
        }
      } catch (err) {
        if (active) {
          setAuthError(err instanceof Error ? err.message : 'Failed to connect to battle gateway');
          setIsLoadingAuth(false);
        }
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
        {isLoadingAuth ? (
          <div className="flex h-full w-full flex-col items-center justify-center gap-4 bg-slate-950">
            <div className="relative flex h-16 w-16 items-center justify-center">
              <div className="absolute inset-0 rounded-full border-4 border-sky-500/20 border-t-sky-400 animate-spin" />
              <span className="text-2xl animate-pulse">🔮</span>
            </div>
            <div className="text-center">
              <h3 className="text-lg font-bold text-slate-100">Connecting to Arcane Arena...</h3>
              <p className="text-xs text-slate-400 mt-1">Summoning wizard avatar and sparring bot</p>
            </div>
          </div>
        ) : authError ? (
          <div className="flex h-full w-full flex-col items-center justify-center gap-4 bg-slate-950 p-6">
            <div className="rounded-xl border border-red-500/30 bg-red-950/40 p-6 max-w-md text-center">
              <span className="text-3xl">⚠️</span>
              <h3 className="text-base font-bold text-red-300 mt-2">Connection Required</h3>
              <p className="text-xs text-slate-400 mt-1">{authError}</p>
              <div className="mt-4 flex gap-2 justify-center">
                <button
                  onClick={() => window.location.reload()}
                  className="rounded-lg bg-sky-600 px-4 py-2 text-xs font-semibold text-white hover:bg-sky-500 transition"
                >
                  Retry Connection
                </button>
                <Link
                  href="/login?redirect=/magic-duel"
                  className="rounded-lg border border-slate-700 bg-slate-800 px-4 py-2 text-xs font-semibold text-slate-200 hover:bg-slate-700 transition"
                >
                  Sign In Manually
                </Link>
              </div>
            </div>
          </div>
        ) : (
          <MagicDuelCanvas
            workspaceId="standalone-arcade"
            zoneId="magic-duel-arena"
          />
        )}
      </main>
    </div>
  );
}
