'use client';

import type { ScribbleRoomState } from '@vicinity/shared';

interface ScribbleHeaderProps {
  roomState: ScribbleRoomState | null;
  currentUserId: string;
  isConnected?: boolean;
}

export function ScribbleHeader({ roomState, currentUserId, isConnected = true }: ScribbleHeaderProps) {
  if (!roomState) return null;

  const myId = roomState.myPlayerId || currentUserId;
  const isDrawer = Boolean(
    roomState.isCurrentDrawer ||
    (roomState.wordChoices && roomState.wordChoices.length > 0) ||
    (roomState.currentDrawerId && (roomState.currentDrawerId === myId || roomState.currentDrawerId === currentUserId)) ||
    (roomState.state === 'DRAWING' && Boolean(roomState.revealedWord))
  );

  const isUrgent = roomState.timeRemaining <= 10 && roomState.state === 'DRAWING';

  return (
    <div className="flex h-14 shrink-0 items-center justify-between border-b border-slate-800 bg-slate-900/90 px-4 sm:px-6 shadow-md">
      {/* Round & Game Info */}
      <div className="flex items-center gap-3">
        <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-rose-500/20 border border-rose-500/30 text-rose-300 text-lg">
          🎨
        </span>
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-black uppercase tracking-wider text-white">
              Scribble Office
            </span>
            <span className="rounded-full bg-rose-500/20 border border-rose-500/30 px-2 py-0.5 text-[10px] font-bold text-rose-300">
              Round {roomState.currentRound} / {roomState.totalRounds}
            </span>
            {isConnected && (
              <span className="hidden sm:inline-flex items-center gap-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 text-[9px] font-semibold text-emerald-400">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
                Live
              </span>
            )}
          </div>
          <p className="text-[11px] text-slate-400">
            {roomState.state === 'LOBBY' && 'Waiting in Lobby'}
            {roomState.state === 'SELECTING_WORD' && `${roomState.currentDrawerName || 'Artist'} choosing...`}
            {roomState.state === 'DRAWING' && `${roomState.currentDrawerName || 'Artist'} is drawing`}
            {roomState.state === 'ROUND_END' && 'Round ended'}
            {roomState.state === 'GAME_OVER' && 'Match concluded'}
          </p>
        </div>
      </div>

      {/* Secret Word Display (or Masked Hint for Guessers) */}
      <div className="flex items-center gap-2">
        {/* State: SELECTING_WORD */}
        {roomState.state === 'SELECTING_WORD' && (
          isDrawer ? (
            <div className="flex items-center gap-2 rounded-xl border border-rose-500/50 bg-rose-950/40 px-4 py-1.5 animate-pulse">
              <span className="text-xs font-black text-rose-300 uppercase tracking-wide">
                👉 Select 1 of the 3 words on the canvas!
              </span>
            </div>
          ) : (
            <div className="flex items-center gap-2 rounded-xl border border-slate-700 bg-slate-950/60 px-4 py-1.5">
              <span className="text-xs text-slate-400 font-semibold">
                {roomState.currentDrawerName || 'Artist'} is picking a word...
              </span>
            </div>
          )
        )}

        {/* State: DRAWING */}
        {roomState.state === 'DRAWING' && (
          isDrawer ? (
            <div className="flex items-center gap-2.5 rounded-xl border-2 border-rose-500/60 bg-gradient-to-r from-rose-950/80 via-slate-900 to-rose-950/80 px-5 py-1.5 shadow-lg shadow-rose-950/50">
              <span className="flex h-5 w-5 items-center justify-center rounded-full bg-rose-500 text-[10px] text-white font-black">
                ✏️
              </span>
              <span className="text-xs font-black text-rose-300 uppercase tracking-wider">
                Draw:
              </span>
              <span className="font-mono text-base font-black text-white tracking-widest uppercase">
                {roomState.revealedWord || 'Choose word'}
              </span>
            </div>
          ) : (
            <div className="flex items-center gap-2 rounded-xl border border-slate-700/80 bg-slate-950/80 px-4 py-1.5 shadow-inner">
              <span className="font-mono text-lg font-black tracking-widest text-emerald-300">
                {roomState.maskedWord}
              </span>
              <span className="rounded bg-slate-800 px-1.5 py-0.5 text-[10px] font-semibold text-slate-400">
                {roomState.wordLength} letters
              </span>
            </div>
          )
        )}

        {/* State: ROUND_END */}
        {roomState.state === 'ROUND_END' && roomState.revealedWord && (
          <div className="flex items-center gap-2.5 rounded-xl border-2 border-emerald-500/50 bg-emerald-950/50 px-5 py-1.5 shadow-lg">
            <span className="text-xs font-bold text-emerald-300 uppercase">Word was:</span>
            <span className="font-mono text-base font-black text-white tracking-wider uppercase">
              {roomState.revealedWord}
            </span>
          </div>
        )}
      </div>

      {/* Timer */}
      <div className="flex items-center gap-2">
        {(roomState.state === 'DRAWING' || roomState.state === 'SELECTING_WORD') && (
          <div
            className={`flex items-center gap-1.5 rounded-xl border px-3 py-1.5 text-xs font-black shadow-sm transition ${
              isUrgent
                ? 'border-red-500 bg-red-500/20 text-red-300 animate-pulse'
                : 'border-slate-700 bg-slate-800 text-slate-200'
            }`}
          >
            <span>⏱️</span>
            <span>{roomState.timeRemaining}s</span>
          </div>
        )}
      </div>
    </div>
  );
}
