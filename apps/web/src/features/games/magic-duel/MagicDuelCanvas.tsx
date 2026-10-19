'use client';

import { useEffect, useRef, useState } from 'react';
import {
  MagicDuelGame,
  type GameStats,
  type KillFeedItem,
  type PlayerSummary,
} from './engine/game';
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

  // Match State & Lobby State
  const [matchState, setMatchState] = useState<'waiting' | 'in_progress' | 'ended'>('waiting');
  const [matchTimeRemaining, setMatchTimeRemaining] = useState<number>(120);
  const [_matchDuration, setMatchDuration] = useState<number>(120);
  const [gameMode, setGameMode] = useState<'ffa' | 'teams'>('ffa');
  const [isHost, setIsHost] = useState<boolean>(true);
  const [_hostId, setHostId] = useState<string>('player-1');
  const [teamScores, setTeamScores] = useState<{ blue: number; red: number }>({ blue: 0, red: 0 });
  const [playersSummary, setPlayersSummary] = useState<PlayerSummary[]>([]);
  const [showLobbyModal, setShowLobbyModal] = useState<boolean>(true);
  const [selectedDuration, setSelectedDuration] = useState<number>(120);
  const [selectedMode, setSelectedMode] = useState<'ffa' | 'teams'>('ffa');

  // Direct DOM references for 60-144 FPS smooth HUD updates without React re-render thrashing
  const hpFillRef = useRef<HTMLDivElement | null>(null);
  const hpLagFillRef = useRef<HTMLDivElement | null>(null);
  const hpTextRef = useRef<HTMLSpanElement | null>(null);
  const manaFillRef = useRef<HTMLDivElement | null>(null);
  const manaTextRef = useRef<HTMLSpanElement | null>(null);
  const scoreTextRef = useRef<HTMLElement | null>(null);
  const killsTextRef = useRef<HTMLElement | null>(null);
  const deathsTextRef = useRef<HTMLElement | null>(null);

  // Synchronization refs to prevent 60 FPS React re-render flooding and name flickering
  const isConnectedRef = useRef<boolean>(false);
  const lastSecsRef = useRef<number>(-1);
  const lastSummaryJsonRef = useRef<string>('');

  // Cooldown states for React hotbar
  const [cooldowns, setCooldowns] = useState<Record<string, number>>({
    fireball: 0,
    frost: 0,
    lightning: 0,
    shield: 0,
    dash: 0,
  });

  // Keep local player identity in sync with user
  useEffect(() => {
    if (gameRef.current && user) {
      gameRef.current.updateLocalPlayerInfo(user.id, user.displayName || 'Wizard (You)');
    }
  }, [user?.id, user?.displayName]);

  // 1. Initialize Game Engine & Setup ResizeObserver
  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    const initialId = user?.id || 'player-1';
    const initialName = user?.displayName || 'Wizard (You)';
    const game = new MagicDuelGame(canvas, activeMap, initialId, initialName);
    gameRef.current = game;

    // Set initial size
    const rect = container.getBoundingClientRect();
    game.handleResize(rect.width || window.innerWidth, rect.height || window.innerHeight);

    // Bind stats update for HUD
    game.onStatsChange = (stats: GameStats) => {
      // 1. Health Bar & Animated Red Lag Fill (Direct DOM)
      if (hpFillRef.current && hpLagFillRef.current && hpTextRef.current) {
        const hpPct = Math.max(0, (stats.playerHealth / stats.playerMaxHealth) * 100);
        const lagPct = Math.max(0, (stats.playerHealthLag / stats.playerMaxHealth) * 100);
        hpFillRef.current.style.width = `${hpPct}%`;
        hpLagFillRef.current.style.width = `${lagPct}%`;
        hpTextRef.current.textContent = `${Math.ceil(stats.playerHealth)} / ${stats.playerMaxHealth}`;
      }

      // 2. Mana Bar (Direct DOM)
      if (manaFillRef.current && manaTextRef.current) {
        const manaPct = Math.max(0, (stats.playerMana / stats.playerMaxMana) * 100);
        manaFillRef.current.style.width = `${manaPct}%`;
        manaTextRef.current.textContent = `${Math.ceil(stats.playerMana)} / ${stats.playerMaxMana}`;
      }

      // 3. Combat Score Badges (Direct DOM)
      if (scoreTextRef.current) scoreTextRef.current.textContent = `${stats.playerScore}`;
      if (killsTextRef.current) killsTextRef.current.textContent = `${stats.playerKills}`;
      if (deathsTextRef.current) deathsTextRef.current.textContent = `${stats.playerDeaths}`;

      // 4. Active Spell
      if (stats.activeSpell !== activeSpell) {
        setActiveSpell(stats.activeSpell);
      }

      // 5. Match & Lobby State
      // When connected to server socket, server is the authoritative source!
      // Only drive match/player state from local engine if socket is NOT connected (offline / arcade).
      if (!isConnectedRef.current) {
        setMatchState((prev) => (prev !== stats.matchState ? stats.matchState : prev));
        const roundedSecs = Math.max(0, Math.ceil(stats.matchTimeRemaining));
        if (roundedSecs !== lastSecsRef.current) {
          lastSecsRef.current = roundedSecs;
          setMatchTimeRemaining(roundedSecs);
        }
        setMatchDuration((prev) => (prev !== stats.matchDuration ? stats.matchDuration : prev));
        setGameMode((prev) => (prev !== stats.gameMode ? stats.gameMode : prev));
        setIsHost((prev) => (prev !== stats.isHost ? stats.isHost : prev));
        setHostId((prev) => (prev !== stats.hostId ? stats.hostId : prev));
        setTeamScores(stats.teamScores);

        const summaryJson = JSON.stringify(stats.players);
        if (summaryJson !== lastSummaryJsonRef.current) {
          lastSummaryJsonRef.current = summaryJson;
          setPlayersSummary(stats.players);
        }
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
      isConnectedRef.current = true;
      socket.emit('game:join', { workspaceId, zoneId });
    };

    const onDisconnect = () => {
      setIsConnected(false);
      isConnectedRef.current = false;
    };

    const onGameState = (state: any) => {
      if (state.matchState) {
        setMatchState((prev) => (prev !== state.matchState ? state.matchState : prev));
      }
      if (typeof state.matchTimeRemaining === 'number') {
        const rounded = Math.max(0, Math.ceil(state.matchTimeRemaining));
        if (rounded !== lastSecsRef.current) {
          lastSecsRef.current = rounded;
          setMatchTimeRemaining(rounded);
        }
      }
      if (typeof state.matchDuration === 'number') {
        setMatchDuration(state.matchDuration);
      }
      if (state.gameMode) {
        setGameMode((prev) => (prev !== state.gameMode ? state.gameMode : prev));
      }
      if (state.hostId) {
        setHostId(state.hostId);
        setIsHost(state.hostId === user?.id);
      }
      if (state.teamScores) {
        setTeamScores(state.teamScores);
      }
      if (state.players) {
        const nextSummary: PlayerSummary[] = state.players.map((p: any) => ({
          id: p.id,
          name: p.name,
          isBot: p.isBot,
          colorIndex: p.colorIndex,
          team: p.team || 'none',
          isAdmin: p.isAdmin || false,
          score: p.score,
          kills: p.kills,
          deaths: p.deaths,
          damageDealt: p.damageDealt || 0,
          health: p.health,
        }));
        const summaryJson = JSON.stringify(nextSummary);
        if (summaryJson !== lastSummaryJsonRef.current) {
          lastSummaryJsonRef.current = summaryJson;
          setPlayersSummary(nextSummary);
        }
      }
    };

    if (socket.connected) {
      onConnect();
    }
    socket.on('connect', onConnect);
    socket.on('disconnect', onDisconnect);
    socket.on('game:state', onGameState);

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
      isConnectedRef.current = false;
      socket.off('connect', onConnect);
      socket.off('disconnect', onDisconnect);
      socket.off('game:state', onGameState);
      socket.emit('game:leave', { workspaceId, zoneId });
    };
  }, [token, workspaceId, zoneId, user?.id]);

  // Handle map switch
  const handleSelectMap = (mapId: string) => {
    setActiveMap(mapId);
    gameRef.current?.setMap(mapId);
    if (token) {
      const socket = getSocket(token);
      socket.emit('game:select-map', { workspaceId, zoneId, mapId: mapId as any });
    }
  };

  // Match control handlers
  const handleStartMatch = () => {
    gameRef.current?.startMatch(selectedDuration, selectedMode);
    setShowLobbyModal(false);
    if (token && isConnected) {
      const socket = getSocket(token);
      socket.emit('game:start-match', {
        workspaceId,
        zoneId,
        matchDuration: selectedDuration,
        gameMode: selectedMode,
      });
    }
  };

  const handleSelectTeam = (team: 'blue' | 'red') => {
    if (gameRef.current) {
      gameRef.current.setPlayerTeam(gameRef.current.localPlayer.id, team);
    }
    if (token && isConnected) {
      const socket = getSocket(token);
      socket.emit('game:set-team', { workspaceId, zoneId, team });
    }
  };

  const handleSelectMode = (mode: 'ffa' | 'teams') => {
    setSelectedMode(mode);
    setGameMode(mode);
    gameRef.current?.setGameMode(mode);
  };

  const handleRematch = () => {
    gameRef.current?.rematch();
    setShowLobbyModal(true);
    if (token && isConnected) {
      const socket = getSocket(token);
      socket.emit('game:rematch', { workspaceId, zoneId });
    }
  };

  // Format MM:SS
  const formatTime = (seconds: number) => {
    const s = Math.max(0, Math.ceil(seconds));
    const mins = Math.floor(s / 60);
    const secs = s % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const spellList: SpellDefinition[] = [
    SPELLS.fireball!,
    SPELLS.frost!,
    SPELLS.lightning!,
    SPELLS.shield!,
    SPELLS.dash!,
  ];

  const isLocalPlayer = (playerId: string) => {
    return (
      playerId === user?.id ||
      playerId === gameRef.current?.localPlayer.id ||
      playerId === 'player-1'
    );
  };

  // Team filtered rosters
  const blueTeamPlayers = playersSummary.filter((p) => p.team === 'blue');
  const redTeamPlayers = playersSummary.filter((p) => p.team === 'red');
  const localPlayerSummary = playersSummary.find((p) => isLocalPlayer(p.id));

  // Leaderboard sorted for Final Scoreboard
  const rankedPlayers = [...playersSummary].sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    if (b.kills !== a.kills) return b.kills - a.kills;
    return b.damageDealt - a.damageDealt;
  });

  const winner = rankedPlayers[0];

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
              {isConnected ? 'Live Arena · 60 FPS' : 'Arcade Arena · Sparring Bot Ready'}
            </span>
          </div>

          {matchState === 'waiting' && !showLobbyModal && (
            <button
              onClick={() => setShowLobbyModal(true)}
              className="flex items-center gap-1.5 rounded-xl border border-amber-500/60 bg-amber-500/20 px-3 py-1.5 text-xs font-bold text-amber-300 hover:bg-amber-500/30 transition shadow-lg backdrop-blur"
            >
              <span>🏛️</span> Open Waiting Room
            </button>
          )}
        </div>

        {/* Center: Match Countdown Timer & Team Scores */}
        <div className="pointer-events-auto flex items-center gap-3">
          {matchState === 'in_progress' ? (
            <div className="flex items-center gap-3 rounded-2xl border border-slate-700/80 bg-slate-900/95 px-4 py-1.5 shadow-2xl backdrop-blur">
              {gameMode === 'teams' && (
                <div className="flex items-center gap-2 font-mono font-bold text-xs">
                  <span className="text-sky-400">🔵 {teamScores.blue}</span>
                  <span className="text-slate-500">VS</span>
                  <span className="text-red-400">🔴 {teamScores.red}</span>
                  <div className="h-4 w-px bg-slate-700 mx-1" />
                </div>
              )}
              <div className="flex items-center gap-1.5">
                <span className="text-sm">⏱️</span>
                <span
                  className={`font-mono text-sm font-extrabold ${
                    matchTimeRemaining <= 15
                      ? 'text-red-400 animate-pulse scale-105'
                      : 'text-amber-300'
                  }`}
                >
                  {formatTime(matchTimeRemaining)}
                </span>
              </div>
            </div>
          ) : matchState === 'waiting' ? (
            <div className="flex items-center gap-2 rounded-2xl border border-amber-500/50 bg-slate-900/90 px-3.5 py-1 text-xs font-bold text-amber-300 shadow-lg backdrop-blur">
              <span className="animate-spin text-amber-400">⏳</span>
              <span>WAITING ROOM · {gameMode === 'teams' ? 'TEAM DUEL' : 'SOLO FFA'}</span>
            </div>
          ) : (
            <div className="flex items-center gap-2 rounded-2xl border border-emerald-500/50 bg-slate-900/90 px-3.5 py-1 text-xs font-bold text-emerald-300 shadow-lg backdrop-blur">
              <span>🏆</span>
              <span>MATCH CONCLUDED</span>
            </div>
          )}
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

        {/* Team & Role Status Badge */}
        <div className="flex items-center justify-between rounded-xl border border-slate-700/80 bg-slate-900/85 px-3 py-1.5 shadow-xl backdrop-blur-md text-xs">
          <span className="text-slate-400 font-semibold">
            {isHost ? '👑 Room Admin' : '🧙 Wizard'}
          </span>
          {gameMode === 'teams' ? (
            <span
              className={`font-bold px-2 py-0.5 rounded-md ${
                localPlayerSummary?.team === 'blue'
                  ? 'bg-sky-500/20 text-sky-400 border border-sky-500/40'
                  : localPlayerSummary?.team === 'red'
                    ? 'bg-red-500/20 text-red-400 border border-red-500/40'
                    : 'text-slate-400'
              }`}
            >
              {localPlayerSummary?.team === 'blue'
                ? '🔵 BLUE TEAM'
                : localPlayerSummary?.team === 'red'
                  ? '🔴 RED TEAM'
                  : 'NO TEAM'}
            </span>
          ) : (
            <span className="text-amber-400 font-bold">⚔️ SOLO (FFA)</span>
          )}
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

      {/* 5. WAITING ROOM / LOBBY MODAL OVERLAY */}
      {matchState === 'waiting' && showLobbyModal && (
        <div className="absolute inset-0 z-40 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in">
          <div className="relative w-full max-w-xl rounded-2xl border border-slate-700/80 bg-slate-900/95 p-6 shadow-2xl backdrop-blur-xl">
            {/* Header */}
            <div className="flex items-start justify-between border-b border-slate-800 pb-4">
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-2xl">🏛️</span>
                  <h2 className="text-lg font-extrabold text-white tracking-wide">
                    ARCANE WAITING ROOM & LOBBY
                  </h2>
                </div>
                <p className="mt-1 text-xs text-slate-400">
                  {isHost
                    ? '👑 You are the Room Host (Admin). Set the match rules and start when wizards are ready.'
                    : '⏳ Waiting for the Room Host to commence the battle.'}
                </p>
              </div>

              <button
                onClick={() => setShowLobbyModal(false)}
                className="rounded-lg p-1 text-slate-400 hover:bg-slate-800 hover:text-white transition"
                title="Minimize lobby to practice moving/casting"
              >
                ✕
              </button>
            </div>

            {/* Mode & Duration Config (Editable by Host) */}
            <div className="my-5 grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Game Mode Selector */}
              <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-3">
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block mb-2">
                  ⚔️ Game Mode
                </span>
                <div className="flex gap-2">
                  <button
                    disabled={!isHost}
                    onClick={() => handleSelectMode('ffa')}
                    className={`flex-1 rounded-lg py-2 text-xs font-bold transition ${
                      selectedMode === 'ffa'
                        ? 'bg-amber-500 text-black shadow-md shadow-amber-500/20'
                        : 'border border-slate-800 bg-slate-900 text-slate-300 hover:bg-slate-800'
                    } ${!isHost ? 'opacity-80 cursor-default' : ''}`}
                  >
                    Solo FFA
                  </button>
                  <button
                    disabled={!isHost}
                    onClick={() => handleSelectMode('teams')}
                    className={`flex-1 rounded-lg py-2 text-xs font-bold transition ${
                      selectedMode === 'teams'
                        ? 'bg-sky-500 text-white shadow-md shadow-sky-500/20'
                        : 'border border-slate-800 bg-slate-900 text-slate-300 hover:bg-slate-800'
                    } ${!isHost ? 'opacity-80 cursor-default' : ''}`}
                  >
                    Team Duel
                  </button>
                </div>
              </div>

              {/* Match Duration Selector */}
              <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-3">
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block mb-2">
                  ⏱️ Match Duration
                </span>
                <div className="grid grid-cols-4 gap-1.5">
                  {[60, 120, 180, 300].map((dur) => (
                    <button
                      key={dur}
                      disabled={!isHost}
                      onClick={() => setSelectedDuration(dur)}
                      className={`rounded-lg py-2 text-[11px] font-bold transition ${
                        selectedDuration === dur
                          ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30'
                          : 'border border-slate-800 bg-slate-900 text-slate-300 hover:bg-slate-800'
                      } ${!isHost ? 'opacity-80 cursor-default' : ''}`}
                    >
                      {dur / 60}m
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Team Selection Cards (if in Teams mode) */}
            {selectedMode === 'teams' ? (
              <div className="mb-5">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                    🛡️ Select Your Team
                  </span>
                  <span className="text-[11px] font-medium text-emerald-400">
                    Teammates cannot damage each other (Friendly Fire Disabled)
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  {/* Blue Team Column */}
                  <div className="rounded-xl border border-sky-500/40 bg-sky-950/20 p-3 flex flex-col justify-between">
                    <div>
                      <div className="flex items-center justify-between mb-2 pb-1.5 border-b border-sky-500/20">
                        <span className="text-xs font-extrabold text-sky-400 flex items-center gap-1.5">
                          <span>🔵</span> BLUE TEAM
                        </span>
                        <span className="text-[10px] font-mono text-sky-300 bg-sky-500/20 px-2 py-0.5 rounded-full">
                          {blueTeamPlayers.length}
                        </span>
                      </div>
                      <div className="space-y-1.5 max-h-32 overflow-y-auto">
                        {blueTeamPlayers.map((p) => {
                          const isLocal = isLocalPlayer(p.id);
                          return (
                            <div
                              key={isLocal ? 'local-player' : p.id}
                              className="flex items-center justify-between rounded-lg bg-sky-950/40 px-2.5 py-1 text-xs"
                            >
                              <span className="text-slate-200 truncate flex items-center gap-1">
                                {p.isAdmin && '👑'} {p.name} {isLocal && '(You)'}
                              </span>
                              <span className="text-[10px] text-sky-400 font-mono">READY</span>
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    <button
                      onClick={() => handleSelectTeam('blue')}
                      className={`mt-3 w-full rounded-lg py-1.5 text-xs font-bold transition shadow-sm ${
                        localPlayerSummary?.team === 'blue'
                          ? 'bg-sky-500 text-white font-extrabold shadow-sky-500/30'
                          : 'border border-sky-500/40 bg-sky-900/40 text-sky-200 hover:bg-sky-600 hover:text-white'
                      }`}
                    >
                      {localPlayerSummary?.team === 'blue' ? '✓ In Blue Team' : 'Join Blue'}
                    </button>
                  </div>

                  {/* Red Team Column */}
                  <div className="rounded-xl border border-red-500/40 bg-red-950/20 p-3 flex flex-col justify-between">
                    <div>
                      <div className="flex items-center justify-between mb-2 pb-1.5 border-b border-red-500/20">
                        <span className="text-xs font-extrabold text-red-400 flex items-center gap-1.5">
                          <span>🔴</span> RED TEAM
                        </span>
                        <span className="text-[10px] font-mono text-red-300 bg-red-500/20 px-2 py-0.5 rounded-full">
                          {redTeamPlayers.length}
                        </span>
                      </div>
                      <div className="space-y-1.5 max-h-32 overflow-y-auto">
                        {redTeamPlayers.map((p) => {
                          const isLocal = isLocalPlayer(p.id);
                          return (
                            <div
                              key={isLocal ? 'local-player' : p.id}
                              className="flex items-center justify-between rounded-lg bg-red-950/40 px-2.5 py-1 text-xs"
                            >
                              <span className="text-slate-200 truncate flex items-center gap-1">
                                {p.isAdmin && '👑'} {p.name} {isLocal && '(You)'}
                              </span>
                              <span className="text-[10px] text-red-400 font-mono">READY</span>
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    <button
                      onClick={() => handleSelectTeam('red')}
                      className={`mt-3 w-full rounded-lg py-1.5 text-xs font-bold transition shadow-sm ${
                        localPlayerSummary?.team === 'red'
                          ? 'bg-red-500 text-white font-extrabold shadow-red-500/30'
                          : 'border border-red-500/40 bg-red-900/40 text-red-200 hover:bg-red-600 hover:text-white'
                      }`}
                    >
                      {localPlayerSummary?.team === 'red' ? '✓ In Red Team' : 'Join Red'}
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              /* FFA Player Roster */
              <div className="mb-5">
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block mb-2">
                  🧙 Connected Wizards ({playersSummary.length})
                </span>
                <div className="grid grid-cols-2 gap-2 max-h-36 overflow-y-auto">
                  {playersSummary.map((p) => {
                    const isLocal = isLocalPlayer(p.id);
                    return (
                      <div
                        key={isLocal ? 'local-player' : p.id}
                        className="flex items-center justify-between rounded-xl border border-slate-800 bg-slate-950/60 px-3 py-2 text-xs"
                      >
                        <span className="text-slate-200 truncate flex items-center gap-1.5">
                          <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
                          {p.isAdmin && '👑'} {p.name} {isLocal && '(You)'}
                        </span>
                        <span className="text-[10px] font-bold text-amber-400">READY</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Footer / Host Start Button */}
            <div className="flex items-center gap-3 border-t border-slate-800 pt-4">
              <button
                onClick={() => setShowLobbyModal(false)}
                className="flex-1 rounded-xl border border-slate-700 bg-slate-800/80 py-2.5 text-xs font-bold text-slate-300 hover:bg-slate-700 hover:text-white transition shadow"
              >
                🎯 Practice in Arena
              </button>

              {isHost ? (
                <button
                  onClick={handleStartMatch}
                  className="flex-[2] rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 py-2.5 text-sm font-extrabold text-black shadow-lg shadow-amber-500/30 transition transform hover:scale-[1.02]"
                >
                  ⚡ START MATCH NOW
                </button>
              ) : (
                <div className="flex-[2] flex items-center justify-center gap-2 rounded-xl border border-slate-700 bg-slate-800/50 py-2.5 text-xs font-semibold text-slate-400">
                  <span className="h-2 w-2 rounded-full bg-amber-400 animate-ping" />
                  <span>Waiting for Host to start...</span>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* 6. FINAL SCOREBOARD RESULTS MODAL OVERLAY */}
      {matchState === 'ended' && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4 animate-in fade-in zoom-in-95">
          <div className="relative w-full max-w-2xl rounded-2xl border border-slate-700/80 bg-slate-900/95 p-6 shadow-2xl backdrop-blur-2xl">
            {/* Header Banner */}
            <div className="text-center pb-4 border-b border-slate-800">
              <span className="text-4xl inline-block mb-1 animate-bounce">🏆</span>
              <h2 className="text-xl sm:text-2xl font-black tracking-wider uppercase">
                {gameMode === 'teams' ? (
                  teamScores.blue > teamScores.red ? (
                    <span className="text-sky-400">BLUE TEAM VICTORY!</span>
                  ) : teamScores.red > teamScores.blue ? (
                    <span className="text-red-400">RED TEAM VICTORY!</span>
                  ) : (
                    <span className="text-amber-400">STALEMATE DRAW!</span>
                  )
                ) : (
                  <span className="text-amber-300">
                    {winner?.name ? `${winner.name} IS THE CHAMPION!` : 'MATCH COMPLETED!'}
                  </span>
                )}
              </h2>
              <p className="mt-1 text-xs text-slate-400">
                Battle Concluded · Time Limit Expired · Final Combat Statistics
              </p>

              {gameMode === 'teams' && (
                <div className="mt-3 inline-flex items-center gap-4 rounded-xl border border-slate-700 bg-slate-950/60 px-5 py-2 font-mono font-black text-sm">
                  <span className="text-sky-400">🔵 Blue Team: {teamScores.blue} pts</span>
                  <span className="text-slate-600">|</span>
                  <span className="text-red-400">🔴 Red Team: {teamScores.red} pts</span>
                </div>
              )}
            </div>

            {/* Scoreboard Table */}
            <div className="my-5 overflow-hidden rounded-xl border border-slate-800 bg-slate-950/80">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-900/90 text-slate-400 uppercase tracking-wider text-[10px] font-bold border-b border-slate-800">
                  <tr>
                    <th className="py-2.5 px-3">Rank</th>
                    <th className="py-2.5 px-3">Wizard</th>
                    {gameMode === 'teams' && <th className="py-2.5 px-3">Team</th>}
                    <th className="py-2.5 px-3 text-right">Score</th>
                    <th className="py-2.5 px-3 text-right">Kills</th>
                    <th className="py-2.5 px-3 text-right">Deaths</th>
                    <th className="py-2.5 px-3 text-right">Damage</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 font-mono">
                  {rankedPlayers.map((p, idx) => {
                    const isLocal = isLocalPlayer(p.id);
                    const rankMedals = ['🥇 1st', '🥈 2nd', '🥉 3rd'];
                    const medal = rankMedals[idx] || `#${idx + 1}`;

                    return (
                      <tr
                        key={isLocal ? 'local-player' : p.id}
                        className={`transition ${
                          isLocal
                            ? 'bg-sky-500/15 border-l-4 border-l-sky-400 font-bold'
                            : idx === 0
                              ? 'bg-amber-500/10'
                              : 'hover:bg-slate-900/40'
                        }`}
                      >
                        <td className="py-2.5 px-3 font-sans font-bold text-amber-300">
                          {medal}
                        </td>
                        <td className="py-2.5 px-3 font-sans font-medium text-slate-200 flex items-center gap-1.5 truncate">
                          {p.isAdmin && '👑'}
                          <span>{p.name}</span>
                          {isLocal && (
                            <span className="rounded bg-sky-500/20 px-1 py-0.5 text-[9px] text-sky-300 font-bold">
                              YOU
                            </span>
                          )}
                        </td>
                        {gameMode === 'teams' && (
                          <td className="py-2.5 px-3 font-sans font-bold">
                            {p.team === 'blue' ? (
                              <span className="text-sky-400">🔵 Blue</span>
                            ) : p.team === 'red' ? (
                              <span className="text-red-400">🔴 Red</span>
                            ) : (
                              <span className="text-slate-500">-</span>
                            )}
                          </td>
                        )}
                        <td className="py-2.5 px-3 text-right font-bold text-amber-300">
                          {p.score}
                        </td>
                        <td className="py-2.5 px-3 text-right text-emerald-400">
                          {p.kills}
                        </td>
                        <td className="py-2.5 px-3 text-right text-red-400">
                          {p.deaths}
                        </td>
                        <td className="py-2.5 px-3 text-right text-slate-300">
                          {Math.round(p.damageDealt)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Bottom Actions */}
            <div className="flex items-center gap-3 border-t border-slate-800 pt-4">
              {onClose ? (
                <button
                  onClick={onClose}
                  className="flex-1 rounded-xl border border-slate-700 bg-slate-800/80 py-2.5 text-xs font-bold text-slate-300 hover:bg-slate-700 hover:text-white transition shadow"
                >
                  🚪 Exit to Office
                </button>
              ) : (
                <a
                  href="/lobby"
                  className="flex-1 text-center rounded-xl border border-slate-700 bg-slate-800/80 py-2.5 text-xs font-bold text-slate-300 hover:bg-slate-700 hover:text-white transition shadow"
                >
                  🚪 Exit to Campus
                </a>
              )}

              {isHost ? (
                <button
                  onClick={handleRematch}
                  className="flex-[2] rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 py-2.5 text-sm font-extrabold text-black shadow-lg shadow-amber-500/30 transition transform hover:scale-[1.02]"
                >
                  🔄 Rematch / Return to Lobby
                </button>
              ) : (
                <button
                  onClick={() => setShowLobbyModal(true)}
                  className="flex-[2] rounded-xl bg-sky-600 hover:bg-sky-500 py-2.5 text-sm font-bold text-white transition shadow-lg"
                >
                  🏛️ Return to Waiting Room
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* 7. Bottom Center Spell Hotbar */}
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

      {/* 8. Quick Controls Cheat Sheet (Bottom Left) */}
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
