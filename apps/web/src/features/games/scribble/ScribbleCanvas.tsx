'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import type { ScribbleDrawPoint, ScribbleDrawStroke, ScribbleRoomState } from '@vicinity/shared';

interface ScribbleCanvasProps {
  roomState: ScribbleRoomState | null;
  currentUserId: string;
  onDrawStroke: (stroke: ScribbleDrawStroke) => void;
  onClearCanvas: () => void;
  onUndo: () => void;
  onChooseWord: (word: string) => void;
  incomingStroke: ScribbleDrawStroke | null;
  clearTrigger: number;
  undoTrigger: number;
}

const PALETTE_COLORS = [
  '#000000', // Black
  '#ffffff', // White
  '#ef4444', // Red
  '#f97316', // Orange
  '#eab308', // Yellow
  '#22c55e', // Green
  '#06b6d4', // Cyan
  '#3b82f6', // Blue
  '#8b5cf6', // Purple
  '#ec4899', // Pink
  '#78350f', // Brown
  '#64748b', // Slate
];

const BRUSH_SIZES = [
  { label: 'S', size: 3 },
  { label: 'M', size: 8 },
  { label: 'L', size: 16 },
  { label: 'XL', size: 28 },
];

export function ScribbleCanvas({
  roomState,
  currentUserId,
  onDrawStroke,
  onClearCanvas,
  onUndo,
  onChooseWord,
  incomingStroke,
  clearTrigger,
  undoTrigger,
}: ScribbleCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [currentColor, setCurrentColor] = useState<string>('#000000');
  const [currentSize, setCurrentSize] = useState<number>(8);
  const [isEraser, setIsEraser] = useState<boolean>(false);
  const isDrawingRef = useRef<boolean>(false);
  const currentPointsRef = useRef<ScribbleDrawPoint[]>([]);

  const myId = roomState?.myPlayerId || currentUserId;

  // Determining drawer roles
  const hasWordChoices = Boolean(roomState?.wordChoices && roomState.wordChoices.length > 0);
  const isSelectedDrawer = Boolean(
    roomState?.isCurrentDrawer ||
    hasWordChoices ||
    (roomState?.currentDrawerId && (roomState.currentDrawerId === myId || roomState.currentDrawerId === currentUserId))
  );

  const isSelectingWordForMe = roomState?.state === 'SELECTING_WORD' && (isSelectedDrawer || hasWordChoices);
  const isSelectingWordForOthers = roomState?.state === 'SELECTING_WORD' && !isSelectingWordForMe;

  const isDrawingActive =
    roomState?.state === 'DRAWING' &&
    (isSelectedDrawer || Boolean(roomState?.revealedWord));

  // Redraw all strokes onto canvas
  const redrawAllStrokes = useCallback((strokes: ScribbleDrawStroke[]) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Fill white background
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, 800, 600);

    for (const stroke of strokes) {
      if (stroke.points.length === 0) continue;
      ctx.beginPath();
      ctx.strokeStyle = stroke.isEraser ? '#ffffff' : stroke.color;
      ctx.lineWidth = stroke.size;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';

      const first = stroke.points[0];
      if (!first) continue;
      ctx.moveTo(first.x, first.y);

      if (stroke.points.length === 1) {
        ctx.lineTo(first.x + 0.1, first.y + 0.1);
      } else {
        for (let i = 1; i < stroke.points.length; i++) {
          const pt = stroke.points[i];
          if (pt) ctx.lineTo(pt.x, pt.y);
        }
      }
      ctx.stroke();
    }
  }, []);

  // Initialize or re-sync canvas when room strokes change or full state sync
  useEffect(() => {
    if (roomState?.strokes) {
      redrawAllStrokes(roomState.strokes);
    }
  }, [roomState?.strokes, redrawAllStrokes]);

  // Handle incoming live single stroke from peer
  useEffect(() => {
    if (!incomingStroke) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx || incomingStroke.points.length === 0) return;

    ctx.beginPath();
    ctx.strokeStyle = incomingStroke.isEraser ? '#ffffff' : incomingStroke.color;
    ctx.lineWidth = incomingStroke.size;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    const first = incomingStroke.points[0];
    if (!first) return;
    ctx.moveTo(first.x, first.y);
    if (incomingStroke.points.length === 1) {
      ctx.lineTo(first.x + 0.1, first.y + 0.1);
    } else {
      for (let i = 1; i < incomingStroke.points.length; i++) {
        const pt = incomingStroke.points[i];
        if (pt) ctx.lineTo(pt.x, pt.y);
      }
    }
    ctx.stroke();
  }, [incomingStroke]);

  // Handle live clear canvas event
  useEffect(() => {
    if (clearTrigger > 0) {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, 800, 600);
      }
    }
  }, [clearTrigger]);

  // Handle live undo event
  useEffect(() => {
    if (undoTrigger > 0 && roomState?.strokes) {
      redrawAllStrokes(roomState.strokes);
    }
  }, [undoTrigger, roomState?.strokes, redrawAllStrokes]);

  // Pointer event handlers for drawing
  const getCanvasCoords = (e: React.PointerEvent<HTMLCanvasElement>): ScribbleDrawPoint => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    const scaleX = 800 / rect.width;
    const scaleY = 600 / rect.height;
    return {
      x: Math.round((e.clientX - rect.left) * scaleX),
      y: Math.round((e.clientY - rect.top) * scaleY),
    };
  };

  const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!isDrawingActive) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    isDrawingRef.current = true;
    const pt = getCanvasCoords(e);
    currentPointsRef.current = [pt];

    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.beginPath();
    ctx.strokeStyle = isEraser ? '#ffffff' : currentColor;
    ctx.lineWidth = currentSize;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.moveTo(pt.x, pt.y);
    ctx.lineTo(pt.x + 0.1, pt.y + 0.1);
    ctx.stroke();
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!isDrawingRef.current || !isDrawingActive) return;
    const pt = getCanvasCoords(e);
    currentPointsRef.current.push(pt);

    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const points = currentPointsRef.current;
    const prev = points[points.length - 2];
    if (!prev) return;
    ctx.beginPath();
    ctx.strokeStyle = isEraser ? '#ffffff' : currentColor;
    ctx.lineWidth = currentSize;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.moveTo(prev.x, prev.y);
    ctx.lineTo(pt.x, pt.y);
    ctx.stroke();
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!isDrawingRef.current || !isDrawingActive) return;
    isDrawingRef.current = false;
    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch {
      // Ignored
    }

    if (currentPointsRef.current.length > 0) {
      const stroke: ScribbleDrawStroke = {
        points: [...currentPointsRef.current],
        color: currentColor,
        size: currentSize,
        isEraser,
      };
      onDrawStroke(stroke);
      currentPointsRef.current = [];
    }
  };

  return (
    <div className="relative flex flex-col items-center justify-center w-full h-full p-2 select-none">
      {/* 4:3 Aspect Ratio Drawing Canvas Container */}
      <div className="relative w-full aspect-[4/3] max-h-[520px] rounded-2xl overflow-hidden border-2 border-slate-700 bg-white shadow-2xl flex items-center justify-center">
        <canvas
          ref={canvasRef}
          width={800}
          height={600}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerUp}
          className={`w-full h-full touch-none ${
            isDrawingActive ? (isEraser ? 'cursor-cell' : 'cursor-crosshair') : 'cursor-default'
          }`}
        />

        {/* HUD: Word Prominently Visible on Canvas for the Artist */}
        {isDrawingActive && roomState?.revealedWord && (
          <div className="absolute top-3 left-3 z-10 flex items-center gap-2 rounded-xl border border-rose-500/60 bg-slate-950/95 px-4 py-2 shadow-2xl backdrop-blur-md animate-in fade-in">
            <span className="text-xs font-black text-rose-400 uppercase tracking-wider">
              ✏️ Word to Draw:
            </span>
            <span className="font-mono text-base font-black text-white tracking-widest uppercase">
              {roomState.revealedWord}
            </span>
          </div>
        )}

        {/* HUD: Masked Word on Canvas for Guessers */}
        {roomState?.state === 'DRAWING' && !isDrawingActive && (
          <div className="absolute top-3 left-3 z-10 flex items-center gap-2 rounded-xl border border-emerald-500/40 bg-slate-950/90 px-4 py-2 shadow-2xl backdrop-blur-md animate-in fade-in">
            <span className="text-xs font-black text-emerald-400 uppercase tracking-wider">
              Guess Word:
            </span>
            <span className="font-mono text-base font-black text-emerald-300 tracking-widest">
              {roomState.maskedWord}
            </span>
            <span className="text-[11px] font-bold text-slate-400">
              ({roomState.wordLength} letters)
            </span>
          </div>
        )}

        {/* Word Selection Modal Overlay for the Artist */}
        {isSelectingWordForMe && (
          <div className="absolute inset-0 z-30 flex flex-col items-center justify-center bg-slate-950/95 backdrop-blur-md p-6 text-center animate-in fade-in">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-rose-500 to-amber-500 text-3xl shadow-lg shadow-rose-500/25 mb-3 animate-bounce">
              🎨
            </div>
            <h3 className="text-2xl font-black text-white tracking-wide">
              Choose a Word to Draw!
            </h3>
            <p className="text-xs text-rose-300 font-bold mt-1 mb-6">
              Pick one of the 3 secret options below to start drawing:
            </p>
            <div className="flex flex-wrap items-center justify-center gap-4 max-w-xl">
              {(roomState?.wordChoices && roomState.wordChoices.length > 0
                ? roomState.wordChoices
                : ['cat', 'pizza', 'guitar']
              ).map((word) => (
                <button
                  key={word}
                  type="button"
                  onClick={() => onChooseWord(word)}
                  className="group relative flex flex-col items-center justify-center rounded-2xl border-2 border-rose-500/50 bg-gradient-to-b from-rose-950/70 to-slate-900 px-8 py-5 shadow-xl shadow-rose-950/50 hover:scale-105 hover:border-rose-400 hover:bg-rose-600 transition duration-150 active:scale-95 cursor-pointer"
                >
                  <span className="text-xl font-black text-white tracking-widest uppercase group-hover:text-white">
                    {word}
                  </span>
                  <span className="text-[10px] font-bold text-rose-300 group-hover:text-rose-100 mt-1">
                    Click to choose ({word.length} letters)
                  </span>
                </button>
              ))}
            </div>
            <div className="mt-6 flex items-center gap-2 rounded-full border border-slate-700 bg-slate-900/90 px-4 py-2 text-xs font-bold text-amber-300 shadow">
              <span>⏱️ Auto-selecting choice #1 in {roomState?.timeRemaining ?? 15}s</span>
            </div>
          </div>
        )}

        {/* Word Selection Overlay for Guessers */}
        {isSelectingWordForOthers && (
          <div className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-slate-950/85 backdrop-blur-sm p-6 text-center animate-in fade-in">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-rose-500/20 border border-rose-500/40 text-3xl mb-4 animate-bounce">
              ✏️
            </div>
            <h3 className="text-lg font-bold text-white">
              {roomState?.currentDrawerName || 'The artist'} is choosing a word...
            </h3>
            <p className="text-xs text-slate-400 mt-1">Get ready to guess in chat!</p>
          </div>
        )}

        {/* Round End Overlay */}
        {roomState?.state === 'ROUND_END' && (
          <div className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-slate-950/90 backdrop-blur-sm p-6 text-center animate-in zoom-in-95 duration-200">
            <span className="text-4xl mb-2">🎉</span>
            <span className="text-xs font-bold text-rose-400 uppercase tracking-widest">
              Round Over
            </span>
            <h3 className="text-2xl font-black text-white mt-1">
              The word was <span className="text-emerald-400 underline decoration-wavy">{roomState.revealedWord?.toUpperCase()}</span>
            </h3>
            <p className="text-xs text-slate-300 mt-2">
              Next round starting in <strong className="text-amber-400">{roomState.timeRemaining}s</strong>...
            </p>
          </div>
        )}

        {/* Game Over / Podium Overlay */}
        {roomState?.state === 'GAME_OVER' && (
          <div className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-slate-950/95 backdrop-blur-md p-6 text-center animate-in zoom-in-95 duration-300">
            <span className="text-5xl mb-2 animate-bounce">🏆</span>
            <h2 className="text-2xl font-black text-white tracking-wide">
              Game Over!
            </h2>
            <p className="text-xs text-slate-400 mt-1 mb-6">
              Final Scores & Standings
            </p>
            <div className="flex flex-col gap-2 w-full max-w-sm mb-6">
              {[...roomState.players]
                .sort((a, b) => b.score - a.score)
                .slice(0, 5)
                .map((p, idx) => (
                  <div
                    key={p.userId}
                    className={`flex items-center justify-between rounded-xl p-3 border ${
                      idx === 0
                        ? 'border-amber-500/60 bg-amber-500/20 text-amber-200 shadow-md shadow-amber-500/10'
                        : idx === 1
                        ? 'border-slate-500/40 bg-slate-800/40 text-slate-200'
                        : idx === 2
                        ? 'border-amber-700/40 bg-amber-950/30 text-amber-300'
                        : 'border-slate-800 bg-slate-900/40 text-slate-400'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <span className="font-black text-sm">
                        {idx === 0 ? '🥇' : idx === 1 ? '🥈' : idx === 2 ? '🥉' : `#${idx + 1}`}
                      </span>
                      <span className="font-bold text-sm truncate max-w-[150px]">
                        {p.displayName} {(p.userId === myId || p.userId === currentUserId) && '(You)'}
                      </span>
                    </div>
                    <span className="font-extrabold text-sm">{p.score} pts</span>
                  </div>
                ))}
            </div>
          </div>
        )}
      </div>

      {/* Artist Drawing Toolbar */}
      {isDrawingActive && (
        <div className="mt-3 flex flex-wrap items-center justify-between gap-3 w-full rounded-xl border border-slate-700/80 bg-slate-900/95 px-4 py-2.5 shadow-lg">
          {/* Color Palette */}
          <div className="flex items-center gap-1.5 flex-wrap">
            {PALETTE_COLORS.map((col) => (
              <button
                key={col}
                type="button"
                onClick={() => {
                  setCurrentColor(col);
                  setIsEraser(false);
                }}
                style={{ backgroundColor: col }}
                className={`h-6 w-6 rounded-full border transition-transform hover:scale-110 active:scale-95 ${
                  currentColor === col && !isEraser
                    ? 'scale-125 border-white ring-2 ring-rose-500 shadow-md'
                    : 'border-slate-700/50'
                }`}
                title={col}
              />
            ))}
          </div>

          {/* Brush Sizes */}
          <div className="flex items-center gap-1 bg-slate-950/80 rounded-lg p-1 border border-slate-800">
            {BRUSH_SIZES.map((b) => (
              <button
                key={b.label}
                type="button"
                onClick={() => setCurrentSize(b.size)}
                className={`px-2 py-1 text-xs font-bold rounded-md transition ${
                  currentSize === b.size
                    ? 'bg-rose-500 text-white shadow-sm'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                {b.label}
              </button>
            ))}
          </div>

          {/* Action Tools: Eraser, Undo, Clear */}
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setIsEraser(!isEraser)}
              className={`flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-bold border transition ${
                isEraser
                  ? 'border-rose-500 bg-rose-500/20 text-rose-300'
                  : 'border-slate-700 bg-slate-800 text-slate-300 hover:bg-slate-700 hover:text-white'
              }`}
              title="Eraser tool"
            >
              <span>🧹</span>
              <span>Eraser</span>
            </button>

            <button
              type="button"
              onClick={onUndo}
              className="flex items-center gap-1 rounded-lg border border-slate-700 bg-slate-800 px-2.5 py-1.5 text-xs font-bold text-slate-300 hover:bg-slate-700 hover:text-white transition"
              title="Undo last stroke"
            >
              <span>↩️</span>
              <span>Undo</span>
            </button>

            <button
              type="button"
              onClick={onClearCanvas}
              className="flex items-center gap-1 rounded-lg border border-red-500/40 bg-red-950/30 px-2.5 py-1.5 text-xs font-bold text-red-300 hover:bg-red-900/50 hover:text-white transition"
              title="Clear entire canvas"
            >
              <span>🗑️</span>
              <span>Clear</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
