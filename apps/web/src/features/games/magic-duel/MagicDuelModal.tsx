'use client';

import { MagicDuelCanvas } from './MagicDuelCanvas';

interface MagicDuelModalProps {
  isOpen: boolean;
  onClose: () => void;
  workspaceId: string;
  zoneId: string;
  zoneName: string;
}

export function MagicDuelModal({
  isOpen,
  onClose,
  workspaceId,
  zoneId,
  zoneName,
}: MagicDuelModalProps) {
  if (!isOpen) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md animate-in fade-in p-4 sm:p-6"
    >
      <div className="relative flex h-[90vh] w-[95vw] max-w-6xl flex-col overflow-hidden rounded-2xl border border-slate-700 bg-slate-950 shadow-2xl shadow-sky-950/50">
        {/* Top Header */}
        <div className="flex h-12 shrink-0 items-center justify-between border-b border-slate-800 bg-slate-900/95 px-4">
          <div className="flex items-center gap-3">
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-sky-500/20 text-sky-400 font-bold text-sm">
              🎮
            </span>
            <span className="font-bold text-sm text-slate-100 tracking-wide">
              Magic Duel Arena · <span className="text-sky-400 font-normal">{zoneName}</span>
            </span>
            <span className="rounded-full bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 text-[10px] font-semibold text-emerald-400">
              ● Live Multiplayer
            </span>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-400 hidden sm:inline">
              🎙️ Proximity Voice Active
            </span>
            <button
              onClick={onClose}
              className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-800 hover:text-white transition"
              title="Close Arena (Return to Office)"
            >
              ✕
            </button>
          </div>
        </div>

        {/* Game Canvas Area */}
        <div className="relative flex-1 overflow-hidden">
          <MagicDuelCanvas workspaceId={workspaceId} zoneId={zoneId} onClose={onClose} />
        </div>
      </div>
    </div>
  );
}
