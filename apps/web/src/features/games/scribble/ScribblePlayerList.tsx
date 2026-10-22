'use client';

import { useState } from 'react';
import type { ScribbleRoomState } from '@vicinity/shared';

interface ScribblePlayerListProps {
  roomState: ScribbleRoomState | null;
  currentUserId: string;
  onStartGame: (rounds: number, turnDuration: number) => void;
}

export function ScribblePlayerList({
  roomState,
  currentUserId,
  onStartGame,
}: ScribblePlayerListProps) {
  const [rounds, setRounds] = useState<number>(3);
  const [turnDuration, setTurnDuration] = useState<number>(60);

  if (!roomState) return null;

  const isHost = roomState.hostId === currentUserId;
  const sortedPlayers = [...roomState.players].sort((a, b) => b.score - a.score);
  const hostPlayer = roomState.players.find((p) => p.userId === roomState.hostId);

  return (
    <div className="flex flex-col h-full rounded-2xl border border-slate-800 bg-slate-900/80 overflow-hidden shadow-xl">
      {/* Header */}
      <div className="flex h-11 shrink-0 items-center justify-between border-b border-slate-800 bg-slate-900 px-4">
        <div className="flex items-center gap-2">
          <span className="text-sm">👥</span>
          <span className="text-xs font-bold uppercase tracking-wider text-slate-200">
            Players ({roomState.players.filter((p) => p.isConnected).length})
          </span>
        </div>
      </div>

      {/* Players List */}
      <div className="flex-1 overflow-y-auto p-2.5 space-y-1.5">
        {sortedPlayers.map((player, idx) => {
          const isMe = player.userId === currentUserId;
          const isDrawer = player.isDrawing && roomState.state === 'DRAWING';
          const hasGuessed = player.hasGuessed && roomState.state === 'DRAWING';

          return (
            <div
              key={player.userId}
              className={`flex items-center justify-between rounded-xl px-3 py-2 border transition ${
                isDrawer
                  ? 'border-rose-500/50 bg-rose-500/10 text-white shadow-sm'
                  : hasGuessed
                  ? 'border-emerald-500/40 bg-emerald-500/10 text-slate-200'
                  : isMe
                  ? 'border-slate-700 bg-slate-800/80 text-white'
                  : 'border-slate-800/60 bg-slate-950/40 text-slate-300'
              }`}
            >
              <div className="flex items-center gap-2.5 min-w-0">
                <span className="text-[11px] font-black text-slate-400 w-4">
                  #{idx + 1}
                </span>

                <div className="relative">
                  <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-indigo-500 to-purple-600 text-xs font-bold text-white shadow-sm">
                    {player.displayName ? player.displayName.charAt(0).toUpperCase() : '?'}
                  </div>
                  {player.userId === roomState.hostId && (
                    <span
                      className="absolute -top-1 -right-1 flex h-3.5 w-3.5 items-center justify-center rounded-full bg-amber-400 text-[8px] text-slate-950 font-black shadow"
                      title="Host"
                    >
                      ★
                    </span>
                  )}
                </div>

                <div className="flex flex-col min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs font-bold truncate max-w-[100px]">
                      {player.displayName}
                    </span>
                    {isMe && (
                      <span className="rounded bg-slate-700 px-1 py-0.2 text-[9px] font-semibold text-slate-300">
                        You
                      </span>
                    )}
                  </div>
                  <span className="text-[10px] text-slate-400">
                    {player.score} pts
                  </span>
                </div>
              </div>

              {/* Status Badge */}
              <div>
                {isDrawer ? (
                  <span className="flex items-center gap-1 rounded-full bg-rose-500/20 border border-rose-500/30 px-2 py-0.5 text-[10px] font-bold text-rose-300 animate-pulse">
                    <span>✏️</span>
                    <span>Drawing</span>
                  </span>
                ) : hasGuessed ? (
                  <span className="flex items-center gap-1 rounded-full bg-emerald-500/20 border border-emerald-500/30 px-2 py-0.5 text-[10px] font-bold text-emerald-300">
                    <span>✓</span>
                    <span>Guessed</span>
                  </span>
                ) : roomState.state === 'DRAWING' ? (
                  <span className="text-[10px] text-slate-500 font-medium italic">
                    Guessing...
                  </span>
                ) : null}
              </div>
            </div>
          );
        })}
      </div>

      {/* Lobby Host Control Panel */}
      {(roomState.state === 'LOBBY' || roomState.state === 'GAME_OVER') && (
        <div className="border-t border-slate-800 bg-slate-950 p-3 space-y-3">
          {isHost ? (
            <>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div>
                  <label className="block text-[10px] font-bold uppercase text-slate-400 mb-1">
                    Rounds
                  </label>
                  <select
                    value={rounds}
                    onChange={(e) => setRounds(Number(e.target.value))}
                    className="w-full rounded-lg border border-slate-700 bg-slate-900 px-2 py-1.5 text-xs font-bold text-white focus:border-rose-500 focus:outline-none"
                  >
                    <option value={1}>1 Round (Fast)</option>
                    <option value={2}>2 Rounds</option>
                    <option value={3}>3 Rounds (Standard)</option>
                    <option value={5}>5 Rounds (Marathon)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] font-bold uppercase text-slate-400 mb-1">
                    Draw Time
                  </label>
                  <select
                    value={turnDuration}
                    onChange={(e) => setTurnDuration(Number(e.target.value))}
                    className="w-full rounded-lg border border-slate-700 bg-slate-900 px-2 py-1.5 text-xs font-bold text-white focus:border-rose-500 focus:outline-none"
                  >
                    <option value={45}>45 seconds</option>
                    <option value={60}>60 seconds</option>
                    <option value={80}>80 seconds</option>
                    <option value={100}>100 seconds</option>
                  </select>
                </div>
              </div>

              <button
                onClick={() => onStartGame(rounds, turnDuration)}
                className="w-full rounded-xl bg-gradient-to-r from-rose-500 to-rose-600 py-2.5 text-xs font-black text-white hover:from-rose-400 hover:to-rose-500 transition active:scale-95 shadow-lg shadow-rose-500/25 uppercase tracking-wider"
              >
                🚀 {roomState.state === 'GAME_OVER' ? 'Play Again' : 'Start Match'}
              </button>
            </>
          ) : (
            <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-2.5 text-center">
              <span className="text-[11px] text-slate-400 font-medium">
                Waiting for host <strong className="text-rose-300">{hostPlayer?.displayName || 'Host'}</strong> to start...
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
