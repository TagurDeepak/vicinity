'use client';

import { useEffect, useRef, useState } from 'react';
import { MagicDuelGame, type GameStats, type KillFeedItem } from './engine/game';
import { SPELLS, type SpellDefinition } from './engine/config';
import { useAuthStore } from '@/stores/auth';
import { getSocket } from '@/lib/ws';

interface MagicDuelCanvasProps {
  workspaceId: string;
  zoneId: string;
  onClose?: () => void;
}

export function MagicDuelCanvas({ workspaceId, zoneId, onClose }: MagicDuelCanvasProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const gameRef = useRef<MagicDuelGame | null>(null);

  const token = useAuthStore((s) => s.accessToken);
  const user = useAuthStore((s) => s.user);

  const [activeMap, setActiveMap] = useState<string>('catacombs');
  const [activeSpell, setActiveSpell] = useState<string>('fireball');
  const [killFeed, setKillFeed] = useState<KillFeedItem[]>([]);
  const [isConnected, setIsConnected] = useState<boolean>(false);

  // Direct DOM references for 60-144 FPS smooth HUD updates without React re-render thrashing
  const hpFillRef = useRef<HTMLDivElement | null>(null);
  const hpLagFillRef = useRef<HTMLDivElement | null>(null);
  const hpTextRef = useRef<HTMLSpanElement | null>(null);
  const manaFillRef = useRef<HTMLDivElement | null>(null);
  const manaTextRef = useRef<HTMLSpanElement | null>(null);
  const scoreTextRef = useRef<HTMLElement | null>(null);
  const killsTextRef = useRef<HTMLElement | null>(null);
  const deathsTextRef = useRef<HTMLElement | null>(null);

  // Cooldown states for React hotbar
  const [cooldowns, setCooldowns] = useState<Record<string, number>>({
    fireball: 0,
    frost: 0,
    lightning: 0,
    shield: 0,
    dash: 0,
  });

  // 1. Initialize Game Engine & Setup ResizeObserver
  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    const game = new MagicDuelGame(canvas, activeMap);
    gameRef.current = game;

    if (user?.displayName) {
      game.localPlayer.name = user.displayName;
    }

    // Set initial size
    const rect = container.getBoundingClientRect();
    game.handleResize(rect.width || window.innerWidth, rect.height || window.innerHeight);

    // Bind stats update for HUD
    game.onStatsChange = (stats: GameStats) => {
      // 1. Health Bar & Animated Red Lag Fill
      if (hpFillRef.current && hpLagFillRef.current && hpTextRef.current) {
        const hpPct = Math.max(0, (stats.playerHealth / stats.playerMaxHealth) * 100);
        const lagPct = Math.max(0, (stats.playerHealthLag / stats.playerMaxHealth) * 100);
        hpFillRef.current.style.width = `${hpPct}%`;
        hpLagFillRef.current.style.width = `${lagPct}%`;
        hpTextRef.current.textContent = `${Math.ceil(stats.playerHealth)} / ${stats.playerMaxHealth}`;
      }

      // 2. Mana Bar
      if (manaFillRef.current && manaTextRef.current) {
        const manaPct = Math.max(0, (stats.playerMana / stats.playerMaxMana) * 100);
        manaFillRef.current.style.width = `${manaPct}%`;
        manaTextRef.current.textContent = `${Math.ceil(stats.playerMana)} / ${stats.playerMaxMana}`;
      }

      // 3. Combat Score Badges
      if (scoreTextRef.current) scoreTextRef.current.textContent = `${stats.playerScore}`;
      if (killsTextRef.current) killsTextRef.current.textContent = `${stats.playerKills}`;
      if (deathsTextRef.current) deathsTextRef.current.textContent = `${stats.playerDeaths}`;

      // 4. Active Spell
      if (stats.activeSpell !== activeSpell) {
        setActiveSpell(stats.activeSpell);
      }
    };

    game.onKillFeedChange = (feed: KillFeedItem[]) => {
      setKillFeed([...feed]);
    };

    game.input.onSpellSelect = (spellId: string) => {
      setActiveSpell(spellId);
    };

    // Start 60-144 FPS game loop
    game.start();

    // Responsive auto-resizing
    const ro = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const cr = entry.contentRect;
        if (cr.width > 0 && cr.height > 0) {
          game.handleResize(cr.width, cr.height);
        }
      }
    });
    ro.observe(container);

    return () => {
      ro.disconnect();
      game.stop();
      gameRef.current = null;
    };
  }, []); // Run on mount

  // 2. Cooldown timer polling (100ms throttled for React DOM)
  useEffect(() => {
    const timer = setInterval(() => {
      const game = gameRef.current;
      if (game?.localPlayer) {
        setCooldowns({ ...game.localPlayer.cooldowns });
      }
    }, 100);
    return () => clearInterval(timer);
  }, []);

  // 3. Optional Realtime Socket Synchronization
  useEffect(() => {
    if (!token && workspaceId === 'standalone-arcade') return;

    const activeToken = token || 'guest-arcade';
    const socket = getSocket(activeToken);

    const onConnect = () => {
      setIsConnected(true);
      socket.emit('game:join', { workspaceId, zoneId });
    };

    const onDisconnect = () => {
      setIsConnected(false);
    };

    if (socket.connected) {
      onConnect();
    }
    socket.on('connect', onConnect);
    socket.on('disconnect', onDisconnect);

    // Send input at 60 Hz to server
    const inputTimer = setInterval(() => {
      const game = gameRef.current;
      if (!game || !socket.connected) return;

      const p = game.localPlayer;
      const move = game.input.getMovementVector();
      const input = {
        moveX: move.x,
        moveY: move.y,
        facingAngle: p.facingAngle,
        activeSpell: game.input.activeSpell as any,
        isFiring: game.input.isMouseDown,
        isDashing: game.input.consumeDash(),
      };
      socket.emit('game:input', { workspaceId, zoneId, input });
    }, 16);

    return () => {
      clearInterval(inputTimer);
      socket.off('connect', onConnect);
      socket.off('disconnect', onDisconnect);
      socket.emit('game:leave', { workspaceId, zoneId });
    };
  }, [token, workspaceId, zoneId]);

  // Handle map switch
  const handleSelectMap = (mapId: string) => {
    setActiveMap(mapId);
    gameRef.current?.setMap(mapId);
    if (token) {
      const socket = getSocket(token);
      socket.emit('game:select-map', { workspaceId, zoneId, mapId: mapId as any });
    }
  };

  const spellList: SpellDefinition[] = [
    SPELLS.fireball!,
    SPELLS.frost!,
    SPELLS.lightning!,
    SPELLS.shield!,
    SPELLS.dash!,
  ];

  return (
    <div
      ref={containerRef}
      className="relative h-full w-full select-none overflow-hidden bg-slate-950 font-sans text-white"
    >
      {/* 1. Fullscreen Canvas for Game World & Circular Radar */}
      <canvas
        ref={canvasRef}
        className="absolute inset-0 block h-full w-full cursor-crosshair"
      />

      {/* 2. Top Navigation Bar (Non-overlapping with Radar or HUD) */}
      <div className="pointer-events-none absolute left-0 right-0 top-0 z-20 flex h-14 items-center justify-between px-4 sm:px-6">
        {/* Left: Connection / Mode pill */}
        <div className="pointer-events-auto flex items-center gap-2">
          <div className="flex items-center gap-2 rounded-xl border border-slate-700/80 bg-slate-900/90 px-3 py-1.5 text-xs font-semibold backdrop-blur shadow-lg">
            <span
              className={`inline-block h-2.5 w-2.5 rounded-full ${
                isConnected
                  ? 'bg-emerald-400 shadow-sm shadow-emerald-400 animate-pulse'
                  : 'bg-sky-400 animate-pulse'
              }`}
            />
            <span className="text-slate-200">
              {isConnected ? 'Live Arena · 60 FPS Ultra-Smooth' : 'Arcade Arena · Sparring Bot Ready'}
            </span>
          </div>
        </div>

        {/* Right: Map Selector & Close */}
        <div className="pointer-events-auto flex items-center gap-2">
          <div className="flex items-center rounded-xl border border-slate-700/80 bg-slate-900/90 p-1 text-xs backdrop-blur shadow-lg">
            <span className="px-2 text-slate-400 font-semibold">Map:</span>
            {(['catacombs', 'forest-ruins', 'lava-citadel'] as const).map((m) => (
              <button
                key={m}
                onClick={() => handleSelectMap(m)}
                className={`rounded-lg px-2.5 py-1 font-semibold capitalize transition ${
                  activeMap === m
                    ? 'bg-sky-600 text-white shadow-sm'
                    : 'text-slate-300 hover:bg-slate-800'
                }`}
              >
                {m.replace('-', ' ')}
              </button>
            ))}
          </div>

          {onClose && (
            <button
              onClick={onClose}
              className="flex h-8 w-8 items-center justify-center rounded-xl border border-slate-700/80 bg-slate-900/90 text-sm font-bold text-slate-300 hover:bg-red-600 hover:text-white transition backdrop-blur shadow-lg"
              title="Exit to Office"
            >
              ✕
            </button>
          )}
        </div>
      </div>

      {/* 3. Top-Left Player Status HUD & Integrated Combat Badges */}
      <div className="pointer-events-none absolute left-4 top-16 z-20 flex flex-col gap-2.5">
        {/* Health Bar */}
        <div className="flex min-w-[220px] flex-col gap-1 rounded-xl border border-slate-700/80 bg-slate-900/85 p-2.5 shadow-xl backdrop-blur-md">
          <div className="flex items-center justify-between text-[11px] font-bold tracking-wider text-slate-400">
            <span className="flex items-center gap-1.5 text-red-400">
              <span>❤️</span> HEALTH
            </span>
            <span ref={hpTextRef} className="font-mono text-slate-200">
              100 / 100
            </span>
          </div>
          <div className="relative h-2.5 w-full overflow-hidden rounded-full border border-slate-700/60 bg-slate-950/80">
            <div
              ref={hpLagFillRef}
              className="absolute inset-y-0 left-0 rounded-full bg-red-600 transition-all duration-100 ease-out"
              style={{ width: '100%' }}
            />
            <div
              ref={hpFillRef}
              className="absolute inset-y-0 left-0 rounded-full bg-gradient-to-r from-emerald-600 to-emerald-400 transition-all duration-75 ease-out"
              style={{ width: '100%' }}
            />
          </div>
        </div>

        {/* Mana Bar */}
        <div className="flex min-w-[220px] flex-col gap-1 rounded-xl border border-slate-700/80 bg-slate-900/85 p-2.5 shadow-xl backdrop-blur-md">
          <div className="flex items-center justify-between text-[11px] font-bold tracking-wider text-slate-400">
            <span className="flex items-center gap-1.5 text-sky-400">
              <span>⚡</span> MANA
            </span>
            <span ref={manaTextRef} className="font-mono text-slate-200">
              100 / 100
            </span>
          </div>
          <div className="relative h-2 w-full overflow-hidden rounded-full border border-slate-700/60 bg-slate-950/80">
            <div
              ref={manaFillRef}
              className="absolute inset-y-0 left-0 rounded-full bg-gradient-to-r from-sky-600 to-sky-400 transition-all duration-75 ease-out"
              style={{ width: '100%' }}
            />
          </div>
        </div>

        {/* Integrated Combat Badges (Score, Kills, Deaths) */}
        <div className="flex min-w-[220px] items-center justify-around rounded-xl border border-slate-700/80 bg-slate-900/85 p-2 shadow-xl backdrop-blur-md">
          <div className="flex flex-col items-center">
            <span className="text-[9px] font-bold uppercase tracking-wider text-amber-400">
              Score
            </span>
            <b ref={scoreTextRef} className="font-mono text-sm text-amber-300">
              0
            </b>
          </div>
          <div className="h-6 w-px bg-slate-700/60" />
          <div className="flex flex-col items-center">
            <span className="text-[9px] font-bold uppercase tracking-wider text-sky-400">
              Kills
            </span>
            <b ref={killsTextRef} className="font-mono text-sm text-sky-300">
              0
            </b>
          </div>
          <div className="h-6 w-px bg-slate-700/60" />
          <div className="flex flex-col items-center">
            <span className="text-[9px] font-bold uppercase tracking-wider text-slate-400">
              Deaths
            </span>
            <b ref={deathsTextRef} className="font-mono text-sm text-slate-300">
              0
            </b>
          </div>
        </div>
      </div>

      {/* 4. Top-Center Kill Feed */}
      {killFeed.length > 0 && (
        <div className="pointer-events-none absolute left-1/2 top-16 z-20 flex -translate-x-1/2 flex-col items-center gap-1.5">
          {killFeed.map((item) => (
            <div
              key={item.id}
              className="animate-in fade-in slide-in-from-top-2 rounded-full border border-amber-400/50 bg-slate-900/95 px-4 py-1 text-xs font-bold text-amber-300 shadow-lg shadow-amber-500/20"
            >
              {item.text}
            </div>
          ))}
        </div>
      )}

      {/* 5. Bottom Center Spell Hotbar */}
      <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-20 flex items-center gap-2 rounded-2xl border border-slate-700/80 bg-slate-950/90 p-2 shadow-2xl backdrop-blur-md">
        {spellList.map((sp) => {
          const isSelected = activeSpell === sp.id;
          const cd = cooldowns[sp.id] ?? 0;
          return (
            <button
              key={sp.id}
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                if (sp.id === 'dash') {
                  gameRef.current?.localPlayer.triggerDash();
                  gameRef.current?.audio.playDash();
                } else {
                  gameRef.current?.input.selectSpell(sp.id);
                  setActiveSpell(sp.id);
                }
              }}
              onMouseDown={(e) => e.stopPropagation()}
              className={`group relative flex h-16 w-16 flex-col items-center justify-center rounded-xl border transition-all select-none cursor-pointer ${
                isSelected
                  ? 'border-sky-400 bg-sky-500/25 shadow-lg shadow-sky-500/30 scale-105'
                  : 'border-slate-800 bg-slate-900/80 hover:border-slate-600 hover:bg-slate-800'
              }`}
              title={`${sp.name} (${sp.manaCost} MP) - Press [${sp.hotkey}] or Click to Select`}
            >
              {/* Hotkey Badge */}
              <span className="absolute left-1.5 top-1 rounded bg-slate-800/90 px-1 font-mono text-[9px] font-bold text-sky-300">
                {sp.hotkey}
              </span>
              {/* Icon */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={sp.icon}
                alt={sp.name}
                className="h-7 w-7 object-contain pointer-events-none"
              />
              {/* Label */}
              <span className="mt-0.5 text-[10px] font-semibold text-slate-200">
                {sp.name}
              </span>
              {/* Mana Cost */}
              <span className="text-[8px] text-sky-400 font-mono">
                {sp.manaCost} MP
              </span>
              {/* Cooldown Overlay Sweep */}
              {typeof cd === 'number' && Number.isFinite(cd) && cd > 0.05 && (
                <div className="absolute inset-0 flex items-center justify-center rounded-xl bg-black/75 backdrop-blur-sm">
                  <span className="font-mono text-xs font-bold text-amber-400">{cd.toFixed(1)}s</span>
                </div>
              )}
            </button>
          );
        })}
      </div>

      {/* 6. Quick Controls Cheat Sheet (Bottom Left) */}
      <div className="pointer-events-none absolute bottom-4 left-4 z-20 flex flex-col gap-1 rounded-xl border border-slate-800 bg-slate-900/85 p-3 text-xs text-slate-300 shadow-lg backdrop-blur">
        <div className="flex items-center gap-2">
          <kbd className="rounded bg-slate-800 px-1.5 py-0.5 font-mono text-[11px] text-sky-400">WASD</kbd>
          <span>Move</span>
          <kbd className="ml-2 rounded bg-slate-800 px-1.5 py-0.5 font-mono text-[11px] text-sky-400">Mouse</kbd>
          <span>Aim</span>
          <kbd className="ml-2 rounded bg-slate-800 px-1.5 py-0.5 font-mono text-[11px] text-sky-400">Click</kbd>
          <span>Cast</span>
        </div>
        <div className="flex items-center gap-2">
          <kbd className="rounded bg-slate-800 px-1.5 py-0.5 font-mono text-[11px] text-amber-400">1 - 4</kbd>
          <span>Select Spell</span>
          <kbd className="ml-2 rounded bg-slate-800 px-1.5 py-0.5 font-mono text-[11px] text-amber-400">Space / Right Click</kbd>
          <span>Dash</span>
        </div>
      </div>
    </div>
  );
}
