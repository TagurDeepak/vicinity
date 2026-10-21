'use client';

import { useState } from 'react';
import { MagicDuelCanvas } from './magic-duel/MagicDuelCanvas';
import { usePresenceStore } from '@/stores/presence';

export type GameTab = 'codenames' | 'skribbl' | 'jstris' | 'magic-duel';

interface ArcadeModalProps {
  isOpen: boolean;
  onClose: () => void;
  workspaceId: string;
  zoneId: string;
  zoneName: string;
  initialTab?: GameTab;
}

export function ArcadeModal({
  isOpen,
  onClose,
  workspaceId,
  zoneId,
  zoneName,
  initialTab = 'codenames',
}: ArcadeModalProps) {
  const [activeTab, setActiveTab] = useState<GameTab>(initialTab);
  const defaultRoomCode = `vicinity-${workspaceId.replace(/[^a-zA-Z0-9]/g, '').slice(0, 6) || 'break'}`;
  const [codenamesRoom, setCodenamesRoom] = useState<string>(defaultRoomCode);
  const [copied, setCopied] = useState<boolean>(false);

  // Track coworkers currently in this room
  const users = usePresenceStore((s) => s.users);
  const coworkersInZone = Object.values(users).filter((u) => u.zoneId === zoneId || !zoneId);

  if (!isOpen) return null;

  const codenamesUrl = `https://codenames.game/room/${encodeURIComponent(codenamesRoom || defaultRoomCode)}`;
  const skribblUrl = 'https://skribbl.io/';
  const jstrisUrl = 'https://jstris.jezevec10.com/';

  const handleLaunchGame = (url: string) => {
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  const handleCopyLink = (url: string) => {
    if (navigator.clipboard) {
      navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-md animate-in fade-in p-4 sm:p-6"
    >
      <div className="relative flex h-[92vh] w-[96vw] max-w-6xl flex-col overflow-hidden rounded-2xl border border-slate-700 bg-slate-950 shadow-2xl shadow-sky-950/50">
        {/* Top Header */}
        <div className="flex h-14 shrink-0 items-center justify-between border-b border-slate-800 bg-slate-900/95 px-4 sm:px-6">
          <div className="flex items-center gap-3">
            <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-gradient-to-br from-sky-500 to-indigo-600 text-white font-bold text-base shadow-sm">
              🎮
            </span>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-bold text-sm text-slate-100 tracking-wide">
                  Arcade Lounge · <span className="text-sky-400 font-normal">{zoneName}</span>
                </span>
                <span className="rounded-full bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 text-[10px] font-semibold text-emerald-400">
                  ● Live Team Zone
                </span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* Live Proximity Voice status badge */}
            <div className="hidden sm:flex items-center gap-1.5 rounded-full border border-sky-500/30 bg-sky-500/10 px-3 py-1 text-xs font-medium text-sky-300">
              <span className="h-2 w-2 rounded-full bg-sky-400 animate-pulse" />
              <span>🎙️ Proximity Voice Active</span>
            </div>

            <button
              onClick={onClose}
              className="flex items-center gap-1 rounded-lg border border-slate-700 bg-slate-800/80 px-2.5 py-1.5 text-xs font-semibold text-slate-300 hover:bg-slate-700 hover:text-white transition"
              title="Return to office"
            >
              <span>✕</span>
              <span className="hidden sm:inline">Exit to Office</span>
            </button>
          </div>
        </div>

        {/* Game Tabs Navigation */}
        <div className="flex h-12 shrink-0 items-center gap-1 border-b border-slate-800/80 bg-slate-900/60 px-4 sm:px-6 overflow-x-auto">
          <button
            onClick={() => setActiveTab('codenames')}
            className={`flex items-center gap-2 rounded-lg px-3.5 py-1.5 text-xs font-bold transition ${
              activeTab === 'codenames'
                ? 'bg-amber-500/20 border border-amber-500/40 text-amber-300 shadow-sm'
                : 'text-slate-400 hover:bg-slate-800/60 hover:text-slate-200'
            }`}
          >
            <span>🕵️</span>
            <span>Codenames</span>
            <span className="rounded bg-amber-500/20 px-1.5 py-0.2 text-[9px] text-amber-300 font-extrabold uppercase">
              Party
            </span>
          </button>

          <button
            onClick={() => setActiveTab('skribbl')}
            className={`flex items-center gap-2 rounded-lg px-3.5 py-1.5 text-xs font-bold transition ${
              activeTab === 'skribbl'
                ? 'bg-rose-500/20 border border-rose-500/40 text-rose-300 shadow-sm'
                : 'text-slate-400 hover:bg-slate-800/60 hover:text-slate-200'
            }`}
          >
            <span>🎨</span>
            <span>Skribbl.io</span>
            <span className="rounded bg-rose-500/20 px-1.5 py-0.2 text-[9px] text-rose-300 font-extrabold uppercase">
              Draw
            </span>
          </button>

          <button
            onClick={() => setActiveTab('jstris')}
            className={`flex items-center gap-2 rounded-lg px-3.5 py-1.5 text-xs font-bold transition ${
              activeTab === 'jstris'
                ? 'bg-cyan-500/20 border border-cyan-500/40 text-cyan-300 shadow-sm'
                : 'text-slate-400 hover:bg-slate-800/60 hover:text-slate-200'
            }`}
          >
            <span>🧱</span>
            <span>Jstris</span>
            <span className="rounded bg-cyan-500/20 px-1.5 py-0.2 text-[9px] text-cyan-300 font-extrabold uppercase">
              Tetris
            </span>
          </button>

          <button
            onClick={() => setActiveTab('magic-duel')}
            className={`flex items-center gap-2 rounded-lg px-3.5 py-1.5 text-xs font-bold transition ${
              activeTab === 'magic-duel'
                ? 'bg-sky-500/20 border border-sky-500/40 text-sky-300 shadow-sm'
                : 'text-slate-400 hover:bg-slate-800/60 hover:text-slate-200'
            }`}
          >
            <span>⚔️</span>
            <span>Magic Duel Arena</span>
            <span className="rounded bg-sky-500/20 px-1.5 py-0.2 text-[9px] text-sky-300 font-extrabold uppercase">
              1v1 PvP
            </span>
          </button>
        </div>

        {/* Modal Main Body */}
        <div className="relative flex-1 overflow-y-auto bg-slate-950/70 p-4 sm:p-6">
          {/* TAB 1: CODENAMES */}
          {activeTab === 'codenames' && (
            <div className="mx-auto max-w-3xl flex flex-col gap-6 py-2 animate-in fade-in duration-200">
              {/* Hero Banner */}
              <div className="rounded-2xl border border-amber-500/30 bg-gradient-to-r from-amber-950/40 via-slate-900 to-amber-900/20 p-6 shadow-xl">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/20 px-2.5 py-0.5 text-xs font-semibold text-amber-300">
                      🕵️ Team Word Deduction Game
                    </span>
                    <h2 className="mt-2 text-2xl font-black text-white tracking-wide">
                      Codenames Online
                    </h2>
                    <p className="mt-1 text-sm text-slate-300 leading-relaxed">
                      Two rival spymasters know the secret identities of 25 agents. Teammates know them only by their CODENAMES! 
                      Give 1-word clues and race to reveal all your team’s operatives first.
                    </p>
                  </div>
                  <div className="hidden sm:flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-amber-500/20 border border-amber-500/40 text-3xl shadow-inner">
                    🎴
                  </div>
                </div>

                {/* Shared Room Coordinator Card */}
                <div className="mt-6 rounded-xl border border-slate-700/80 bg-slate-900/90 p-4 shadow-inner">
                  <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider">
                    Office Team Room Code / URL
                  </label>
                  <div className="mt-2 flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                    <div className="relative flex-1">
                      <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-xs text-slate-500 select-none">
                        codenames.game/room/
                      </span>
                      <input
                        type="text"
                        value={codenamesRoom}
                        onChange={(e) => setCodenamesRoom(e.target.value.replace(/[^a-zA-Z0-9-_]/g, ''))}
                        className="w-full rounded-lg border border-slate-700 bg-slate-950 py-2.5 pl-44 pr-3 text-sm font-semibold text-amber-300 focus:border-amber-500 focus:outline-none focus:ring-1 focus:ring-amber-500"
                        placeholder="my-team-room"
                      />
                    </div>

                    <button
                      onClick={() => handleCopyLink(codenamesUrl)}
                      className="flex items-center justify-center gap-1.5 rounded-lg border border-slate-700 bg-slate-800 px-4 py-2.5 text-xs font-bold text-slate-200 hover:bg-slate-700 hover:text-white transition active:scale-95"
                    >
                      <span>{copied ? '✓' : '📋'}</span>
                      <span>{copied ? 'Copied Link!' : 'Copy Link'}</span>
                    </button>

                    <button
                      onClick={() => handleLaunchGame(codenamesUrl)}
                      className="flex items-center justify-center gap-2 rounded-lg bg-gradient-to-r from-amber-500 to-amber-600 px-6 py-2.5 text-sm font-black text-slate-950 shadow-lg shadow-amber-500/25 hover:from-amber-400 hover:to-amber-500 transition active:scale-95"
                    >
                      <span>🚀</span>
                      <span>Launch Game</span>
                    </button>
                  </div>
                  <p className="mt-2 text-[11px] text-slate-400">
                    💡 All coworkers who click <strong>Launch Game</strong> with this code will land in the exact same match!
                  </p>
                </div>
              </div>

              {/* Voice chat reminder alert */}
              <div className="flex items-center gap-3 rounded-xl border border-sky-500/30 bg-sky-950/30 px-4 py-3 text-xs text-sky-200">
                <span className="text-xl">🎙️</span>
                <div>
                  <span className="font-bold text-sky-300">Keep this office tab open while playing!</span>
                  <p className="text-slate-300 text-[11px] mt-0.5">
                    Your Vicinity proximity voice and microphone stay live in the background so you can hear, debate, and laugh with your team in real time!
                  </p>
                </div>
              </div>

              {/* Coworkers in the Game Zone */}
              <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-4">
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">
                  Coworkers in this Game Lounge ({coworkersInZone.length})
                </h3>
                <div className="mt-3 flex flex-wrap gap-2">
                  {coworkersInZone.length === 0 ? (
                    <span className="text-xs text-slate-500 italic">No other coworkers here yet. Invite them over!</span>
                  ) : (
                    coworkersInZone.map((u) => (
                      <span
                        key={u.userId}
                        className="inline-flex items-center gap-1.5 rounded-full border border-slate-700 bg-slate-800/80 px-3 py-1 text-xs font-medium text-slate-200"
                      >
                        <span className="h-2 w-2 rounded-full bg-emerald-400" />
                        <span>{u.displayName || 'Teammate'}</span>
                      </span>
                    ))
                  )}
                </div>
              </div>

              {/* Quick How-to-Play Rules */}
              <div className="rounded-xl border border-slate-800/80 bg-slate-900/30 p-5">
                <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider mb-3">
                  Quick Rules (4 to 12 Players)
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs text-slate-400">
                  <div className="rounded-lg bg-slate-900/80 p-3 border border-slate-800">
                    <span className="font-bold text-amber-400">1. Split Teams</span>
                    <p className="mt-1 text-[11px] text-slate-300">
                      Divide into Red Team and Blue Team. Each team elects one Spymaster.
                    </p>
                  </div>
                  <div className="rounded-lg bg-slate-900/80 p-3 border border-slate-800">
                    <span className="font-bold text-amber-400">2. Give Clues</span>
                    <p className="mt-1 text-[11px] text-slate-300">
                      Spymaster gives a 1-word clue and a count (e.g., <em>&quot;Ocean: 2&quot;</em>).
                    </p>
                  </div>
                  <div className="rounded-lg bg-slate-900/80 p-3 border border-slate-800">
                    <span className="font-bold text-amber-400">3. Guess & Win</span>
                    <p className="mt-1 text-[11px] text-slate-300">
                      Teammates discuss in voice and click matching cards. Avoid the Assassin!
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: SKRIBBL.IO */}
          {activeTab === 'skribbl' && (
            <div className="mx-auto max-w-3xl flex flex-col gap-6 py-2 animate-in fade-in duration-200">
              <div className="rounded-2xl border border-rose-500/30 bg-gradient-to-r from-rose-950/40 via-slate-900 to-rose-900/20 p-6 shadow-xl">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <span className="inline-flex items-center gap-1 rounded-full bg-rose-500/20 px-2.5 py-0.5 text-xs font-semibold text-rose-300">
                      🎨 Multiplayer Drawing & Guessing
                    </span>
                    <h2 className="mt-2 text-2xl font-black text-white tracking-wide">
                      Skribbl.io (Pictionary)
                    </h2>
                    <p className="mt-1 text-sm text-slate-300 leading-relaxed">
                      One player draws a secret word on canvas, while everyone else races to guess it in chat. 
                      Produces hilarious drawings and lots of laughs!
                    </p>
                  </div>
                  <div className="hidden sm:flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-rose-500/20 border border-rose-500/40 text-3xl shadow-inner">
                    ✏️
                  </div>
                </div>

                <div className="mt-6 flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
                  <button
                    onClick={() => handleLaunchGame(skribblUrl)}
                    className="flex-1 flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-rose-500 to-rose-600 px-6 py-3 text-sm font-black text-white shadow-lg shadow-rose-500/25 hover:from-rose-400 hover:to-rose-500 transition active:scale-95"
                  >
                    <span>🚀 Launch Skribbl.io in New Tab</span>
                  </button>
                  <button
                    onClick={() => handleCopyLink(skribblUrl)}
                    className="flex items-center justify-center gap-1.5 rounded-xl border border-slate-700 bg-slate-800 px-4 py-3 text-xs font-bold text-slate-200 hover:bg-slate-700 hover:text-white transition"
                  >
                    <span>📋 Copy Skribbl Link</span>
                  </button>
                </div>
                <p className="mt-3 text-[11px] text-slate-400">
                  💡 Inside Skribbl, click <strong>&quot;Create Private Room&quot;</strong> and share the link with your coworkers here!
                </p>
              </div>

              {/* Voice reminder */}
              <div className="flex items-center gap-3 rounded-xl border border-sky-500/30 bg-sky-950/30 px-4 py-3 text-xs text-sky-200">
                <span className="text-xl">🎙️</span>
                <div>
                  <span className="font-bold text-sky-300">Proximity Voice is Connected</span>
                  <p className="text-slate-300 text-[11px] mt-0.5">
                    Talk and guess together out loud while drawing!
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: JSTRIS (TETRIS) */}
          {activeTab === 'jstris' && (
            <div className="mx-auto max-w-3xl flex flex-col gap-6 py-2 animate-in fade-in duration-200">
              <div className="rounded-2xl border border-cyan-500/30 bg-gradient-to-r from-cyan-950/40 via-slate-900 to-cyan-900/20 p-6 shadow-xl">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <span className="inline-flex items-center gap-1 rounded-full bg-cyan-500/20 px-2.5 py-0.5 text-xs font-semibold text-cyan-300">
                      🧱 Fast-Paced Battle Tetris
                    </span>
                    <h2 className="mt-2 text-2xl font-black text-white tracking-wide">
                      Jstris (Multiplayer Tetris)
                    </h2>
                    <p className="mt-1 text-sm text-slate-300 leading-relaxed">
                      Lightning-fast competitive block battle. Clear lines to dump garbage blocks on your coworkers. 
                      Last block stacker standing wins!
                    </p>
                  </div>
                  <div className="hidden sm:flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-cyan-500/20 border border-cyan-500/40 text-3xl shadow-inner">
                    🕹️
                  </div>
                </div>

                <div className="mt-6 flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
                  <button
                    onClick={() => handleLaunchGame(jstrisUrl)}
                    className="flex-1 flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-cyan-500 to-cyan-600 px-6 py-3 text-sm font-black text-slate-950 shadow-lg shadow-cyan-500/25 hover:from-cyan-400 hover:to-cyan-500 transition active:scale-95"
                  >
                    <span>🚀 Launch Jstris in New Tab</span>
                  </button>
                  <button
                    onClick={() => handleCopyLink(jstrisUrl)}
                    className="flex items-center justify-center gap-1.5 rounded-xl border border-slate-700 bg-slate-800 px-4 py-3 text-xs font-bold text-slate-200 hover:bg-slate-700 hover:text-white transition"
                  >
                    <span>📋 Copy Jstris Link</span>
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* TAB 4: MAGIC DUEL ARENA */}
          {activeTab === 'magic-duel' && (
            <div className="h-full w-full -m-4 sm:-m-6">
              <MagicDuelCanvas workspaceId={workspaceId} zoneId={zoneId} onClose={onClose} />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
