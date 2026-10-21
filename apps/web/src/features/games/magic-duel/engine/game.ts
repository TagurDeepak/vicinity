/**
 * Magic Duel - Core Game Loop & State Coordinator
 */

import { GAME_CONFIG, SPELLS, ARENA_MAPS } from './config';
import { Camera } from './camera';
import { InputManager } from './input';
import { GameAudio } from './audio';
import { GameRenderer, type VisualEffect, type FloatingNumber } from './renderer';
import {
  PlayerEntity,
  Projectile,
  circleIntersectsRect,
  circleIntersectsCircle,
} from './entities';
import { BotAI } from './bot';

export interface PlayerSummary {
  id: string;
  name: string;
  isBot: boolean;
  colorIndex: number;
  team: 'blue' | 'red' | 'none';
  isAdmin: boolean;
  score: number;
  kills: number;
  deaths: number;
  damageDealt: number;
  health: number;
}

export interface GameStats {
  playerHealth: number;
  playerHealthLag: number;
  playerMaxHealth: number;
  playerMana: number;
  playerMaxMana: number;
  playerScore: number;
  playerKills: number;
  playerDeaths: number;
  playerDamageDealt: number;
  botHealth: number;
  cooldowns: Record<string, number>;
  activeSpell: string;
  matchState: 'waiting' | 'in_progress' | 'ended';
  matchTimeRemaining: number;
  matchDuration: number;
  gameMode: 'ffa' | 'teams';
  hostId: string;
  isHost: boolean;
  teamScores: { blue: number; red: number };
  players: PlayerSummary[];
}

export interface KillFeedItem {
  id: number;
  text: string;
  time: number;
}

export class MagicDuelGame {
  canvas: HTMLCanvasElement;
  camera: Camera;
  input: InputManager;
  audio: GameAudio;
  renderer: GameRenderer;

  currentMapId: string;
  players: PlayerEntity[];
  projectiles: Projectile[];
  visualEffects: VisualEffect[];
  floatingNumbers: FloatingNumber[];
  killFeed: KillFeedItem[];

  localPlayerId: string;
  localPlayerName: string;
  localPlayer: PlayerEntity;
  botPlayer: PlayerEntity;
  botAI: BotAI;

  matchState: 'waiting' | 'in_progress' | 'ended';
  matchDuration: number;
  matchTimeRemaining: number;
  gameMode: 'ffa' | 'teams';
  hostId: string;
  teamScores: { blue: number; red: number };

  lastFrameTime: number;
  isRunning: boolean;
  isMultiplayer: boolean = false;
  nextProjId: number;

  onKillFeedChange: ((feed: KillFeedItem[]) => void) | null;
  onStatsChange: ((stats: GameStats) => void) | null;

  private animFrameId: number | null = null;

  constructor(
    canvas: HTMLCanvasElement,
    initialMapId = 'catacombs',
    localPlayerId = 'player-1',
    localPlayerName = 'Wizard (You)',
  ) {
    this.canvas = canvas;
    this.camera = new Camera();
    this.input = new InputManager(canvas);
    this.audio = new GameAudio();
    this.renderer = new GameRenderer(canvas);

    this.localPlayerId = localPlayerId;
    this.localPlayerName = localPlayerName;

    this.currentMapId = ARENA_MAPS[initialMapId] ? initialMapId : 'catacombs';
    this.players = [];
    this.projectiles = [];
    this.visualEffects = [];
    this.floatingNumbers = [];
    this.killFeed = [];

    this.matchState = 'waiting';
    this.matchDuration = 120;
    this.matchTimeRemaining = 120;
    this.gameMode = 'ffa';
    this.hostId = this.localPlayerId;
    this.teamScores = { blue: 0, red: 0 };

    this.lastFrameTime = performance.now();
    this.isRunning = false;
    this.nextProjId = 1;

    this.onKillFeedChange = null;
    this.onStatsChange = null;

    // Initialize with safe fallback entities so camera and world NEVER crash
    const map = ARENA_MAPS[this.currentMapId] || ARENA_MAPS.catacombs!;
    const spawnP1 = map.spawnPoints[0] || { x: 380, y: 380 };
    const spawnP2 = map.spawnPoints[1] || { x: 1620, y: 1020 };

    this.localPlayer = new PlayerEntity(
      this.localPlayerId,
      this.localPlayerName,
      0,
      spawnP1.x,
      spawnP1.y,
      false,
    );
    this.localPlayer.isAdmin = true;
    this.localPlayer.team = 'none';

    this.botPlayer = new PlayerEntity(
      'bot-ignis',
      'Archmage Ignis [BOT]',
      1,
      spawnP2.x,
      spawnP2.y,
      true,
    );
    this.botPlayer.isAdmin = false;
    this.botPlayer.team = 'none';

    this.players = [this.localPlayer, this.botPlayer];
    this.botAI = new BotAI(this.botPlayer);

    this.initGame();
  }

  handleResize(w?: number, h?: number) {
    const width = w ?? this.canvas.clientWidth ?? (typeof window !== 'undefined' ? window.innerWidth : 1280);
    const height = h ?? this.canvas.clientHeight ?? (typeof window !== 'undefined' ? window.innerHeight : 720);

    const rw = Math.max(320, Math.round(width));
    const rh = Math.max(240, Math.round(height));

    if (this.canvas.width !== rw || this.canvas.height !== rh) {
      this.canvas.width = rw;
      this.canvas.height = rh;
    }
    this.camera.resize(rw, rh);
  }

  setLocalPlayerId(id: string) {
    if (!id) return;
    const oldId = this.localPlayerId;
    this.localPlayerId = id;
    if (this.localPlayer) {
      this.localPlayer.id = id;
    }
    if (this.hostId === 'player-1' || this.hostId === oldId) {
      this.hostId = id;
    }
    // Remove any duplicate entities that had this ID or placeholder ID
    this.players = this.players.filter(
      (p) => p === this.localPlayer || (p.id !== id && p.id !== oldId && p.id !== 'player-1'),
    );
    if (!this.players.includes(this.localPlayer)) {
      this.players.unshift(this.localPlayer);
    }
  }

  updateLocalPlayerInfo(id: string, name: string) {
    this.setLocalPlayerId(id);
    this.localPlayerName = name;
    if (this.localPlayer) {
      this.localPlayer.name = name;
    }
  }

  syncServerState(serverState: any) {
    if (!serverState) return;
    this.isMultiplayer = true;

    if (serverState.matchState) {
      this.matchState = serverState.matchState;
    }
    if (typeof serverState.matchDuration === 'number') {
      this.matchDuration = serverState.matchDuration;
    }
    if (typeof serverState.matchTimeRemaining === 'number') {
      this.matchTimeRemaining = serverState.matchTimeRemaining;
    }
    if (serverState.gameMode) {
      this.gameMode = serverState.gameMode;
    }
    if (serverState.hostId) {
      this.hostId = serverState.hostId;
    }
    if (serverState.teamScores) {
      this.teamScores = { ...serverState.teamScores };
    }

    if (Array.isArray(serverState.players)) {
      const incomingIds = new Set<string>(serverState.players.map((p: any) => p.id));

      // If localPlayer still has placeholder 'player-1', auto-adopt the real user ID from snapshot
      if (this.localPlayerId === 'player-1' || this.localPlayer.id === 'player-1') {
        const matching = serverState.players.find((p: any) => !p.isBot);
        if (matching) {
          this.setLocalPlayerId(matching.id);
          this.localPlayer.name = matching.name;
        }
      }

      for (const sp of serverState.players) {
        const isLocal = sp.id === this.localPlayerId || sp.id === this.localPlayer.id;

        if (isLocal) {
          // Update local player stats from server authoritative snapshot
          this.localPlayer.id = sp.id;
          this.localPlayer.name = sp.name;
          this.localPlayer.colorIndex = sp.colorIndex;
          this.localPlayer.health = sp.health;
          this.localPlayer.maxHealth = sp.maxHealth;
          this.localPlayer.mana = sp.mana;
          this.localPlayer.maxMana = sp.maxMana;
          this.localPlayer.kills = sp.kills;
          this.localPlayer.deaths = sp.deaths;
          this.localPlayer.score = sp.score;
          this.localPlayer.damageDealt = sp.damageDealt ?? 0;
          this.localPlayer.team = sp.team ?? 'none';
          this.localPlayer.isAdmin = sp.isAdmin ?? false;
          this.localPlayer.hasShield = sp.hasShield;
          this.localPlayer.isAlive = sp.isAlive;
          if (typeof sp.hitFlashTimer === 'number') {
            this.localPlayer.hitFlashTimer = sp.hitFlashTimer;
          }
          if (sp.cooldowns) {
            this.localPlayer.cooldowns = { ...sp.cooldowns };
          }

          // Authoritative position reconciliation:
          // When the player is actively moving with keyboard, trust client prediction to avoid latency rubberbanding.
          // Only snap if distance is large (> 200px) or player died / respawned.
          const dx = sp.posX - this.localPlayer.x;
          const dy = sp.posY - this.localPlayer.y;
          const distSq = dx * dx + dy * dy;
          const move = this.input.getMovementVector();
          const isActivelyMoving = move.x !== 0 || move.y !== 0;

          if (!this.localPlayer.isAlive || distSq > 200 * 200) {
            this.localPlayer.x = sp.posX;
            this.localPlayer.y = sp.posY;
          } else if (!isActivelyMoving && distSq > 4) {
            // When stationary, gently ease to exact server coordinates
            this.localPlayer.x += dx * 0.25;
            this.localPlayer.y += dy * 0.25;
          }
        } else {
          // Remote human player or bot
          let existing = this.players.find((p) => p.id === sp.id && p !== this.localPlayer);
          if (!existing) {
            existing = new PlayerEntity(
              sp.id,
              sp.name,
              sp.colorIndex,
              sp.posX,
              sp.posY,
              sp.isBot,
            );
            existing.targetX = sp.posX;
            existing.targetY = sp.posY;
            this.players.push(existing);
          } else {
            existing.targetX = sp.posX;
            existing.targetY = sp.posY;
          }

          if (sp.isBot) {
            this.botPlayer = existing;
            this.botAI.bot = existing;
          }

          existing.facingAngle = sp.facingAngle;
          existing.name = sp.name;
          existing.colorIndex = sp.colorIndex;
          existing.health = sp.health;
          existing.maxHealth = sp.maxHealth;
          existing.mana = sp.mana;
          existing.maxMana = sp.maxMana;
          existing.kills = sp.kills;
          existing.deaths = sp.deaths;
          existing.score = sp.score;
          existing.damageDealt = sp.damageDealt ?? 0;
          existing.team = sp.team ?? 'none';
          existing.isAdmin = sp.isAdmin ?? false;
          existing.hasShield = sp.hasShield;
          existing.isAlive = sp.isAlive;
          existing.isDashing = sp.isDashing;
          existing.hitFlashTimer = sp.hitFlashTimer;
          existing.isBot = sp.isBot;
        }
      }

      // Ensure localPlayer is in this.players exactly once and remove obsolete/phantom entities
      this.players = this.players.filter(
        (p) => p === this.localPlayer || (incomingIds.has(p.id) && p.id !== 'player-1'),
      );
      if (!this.players.includes(this.localPlayer)) {
        this.players.unshift(this.localPlayer);
      }
    }

    // Synchronize authoritative projectiles
    if (Array.isArray(serverState.projectiles)) {
      const incomingIds = new Set(serverState.projectiles.map((p: any) => p.id));
      this.projectiles = this.projectiles.filter((p) => incomingIds.has(p.id));

      for (const sp of serverState.projectiles) {
        let p = this.projectiles.find((proj) => proj.id === sp.id);
        const angleDeg =
          sp.velX || sp.velY
            ? (Math.atan2(sp.velY ?? 0, sp.velX ?? 0) * 180) / Math.PI
            : 0;

        if (!p) {
          p = new Projectile(
            sp.id,
            sp.ownerId,
            sp.spellType,
            sp.posX,
            sp.posY,
            angleDeg,
            sp.team ?? 'none',
          );
          this.projectiles.push(p);
        }
        p.x = sp.posX;
        p.y = sp.posY;
        p.velX = sp.velX ?? 0;
        p.velY = sp.velY ?? 0;
        p.damage = sp.damage;
        p.radius = sp.radius;
        p.lifetime = sp.lifetime;
        p.facingAngle = angleDeg;
      }
    }

    // Synchronize visual effects from authoritative server
    if (Array.isArray(serverState.visualEffects)) {
      const now = Date.now();
      this.visualEffects = serverState.visualEffects
        .map((sfx: any) => ({
          x: sfx.x,
          y: sfx.y,
          type: sfx.type,
          color: sfx.color,
          age: Math.max(0, (now - sfx.createdAt) / 1000),
          duration: sfx.duration,
        }))
        .filter((fx: any) => fx.age < fx.duration);
    }

    // Synchronize kill feed if provided
    if (Array.isArray(serverState.killFeed) && serverState.killFeed.length > 0) {
      this.killFeed = serverState.killFeed.map((kf: any, idx: number) => ({
        id: idx,
        text:
          typeof kf === 'string'
            ? kf
            : (kf.text ?? `${kf.killerName || 'Player'} ⚡ ${kf.victimName || 'Player'}`),
        time: performance.now(),
      }));
      if (this.onKillFeedChange) {
        this.onKillFeedChange(this.killFeed);
      }
    }
  }

  initGame() {
    const map = ARENA_MAPS[this.currentMapId] || ARENA_MAPS.catacombs!;
    const spawnP1 = map.spawnPoints[0] || { x: 380, y: 380 };
    const spawnP2 = map.spawnPoints[1] || { x: 1620, y: 1020 };

    const playerId = this.localPlayerId || this.localPlayer?.id || 'player-1';
    const playerName = this.localPlayerName || this.localPlayer?.name || 'Wizard (You)';
    this.localPlayer = new PlayerEntity(
      playerId,
      playerName,
      0,
      spawnP1.x,
      spawnP1.y,
      false,
    );
    this.localPlayer.isAdmin = true;
    this.localPlayer.team = this.gameMode === 'teams' ? 'blue' : 'none';

    this.botPlayer = new PlayerEntity(
      'bot-ignis',
      'Archmage Ignis [BOT]',
      1,
      spawnP2.x,
      spawnP2.y,
      true,
    );
    this.botPlayer.isAdmin = false;
    this.botPlayer.team = this.gameMode === 'teams' ? 'red' : 'none';

    this.players = [this.localPlayer, this.botPlayer];
    this.botAI = new BotAI(this.botPlayer);

    this.projectiles = [];
    this.visualEffects = [];
    this.floatingNumbers = [];
    this.killFeed = [];

    this.matchState = 'waiting';
    this.matchTimeRemaining = this.matchDuration;
    this.teamScores = { blue: 0, red: 0 };
    this.hostId = this.localPlayer.id;

    // Center camera immediately on local player
    this.camera.lockOn(this.localPlayer.x, this.localPlayer.y);
  }

  startMatch(duration = 120, mode?: 'ffa' | 'teams') {
    this.matchDuration = duration;
    this.matchTimeRemaining = duration;
    if (mode) this.gameMode = mode;
    this.matchState = 'in_progress';

    // Reset scores & damage
    this.teamScores = { blue: 0, red: 0 };
    const map = ARENA_MAPS[this.currentMapId] || ARENA_MAPS.catacombs!;
    this.players.forEach((p, idx) => {
      const spawn = map.spawnPoints[idx % map.spawnPoints.length] || { x: 400, y: 400 };
      p.x = spawn.x;
      p.y = spawn.y;
      p.health = p.maxHealth;
      p.healthLag = p.maxHealth;
      p.mana = p.maxMana;
      p.isAlive = true;
      p.hasShield = true;
      p.shieldDuration = 2.5;
      p.score = 0;
      p.kills = 0;
      p.deaths = 0;
      p.damageDealt = 0;
      if (this.gameMode === 'teams') {
        if (p.team !== 'blue' && p.team !== 'red') {
          p.team = idx % 2 === 0 ? 'blue' : 'red';
        }
      } else {
        p.team = 'none';
      }
    });

    this.projectiles = [];
    this.visualEffects = [];
    this.floatingNumbers = [];
    this.addKillFeedItem(`⚡ Match Started! Mode: ${this.gameMode.toUpperCase()} · Duration: ${Math.round(this.matchDuration / 60)}m`);
    this.audio.playVictory();
  }

  setPlayerTeam(playerId: string, team: 'blue' | 'red' | 'none') {
    const pl = this.players.find((p) => p.id === playerId);
    if (pl) {
      pl.team = team;
      if (team === 'blue' || team === 'red') {
        this.gameMode = 'teams';
      }
      // In 1v1 vs bot, put bot on opposing team
      if (pl.id === this.localPlayer.id && this.gameMode === 'teams' && this.botPlayer) {
        this.botPlayer.team = team === 'blue' ? 'red' : 'blue';
      }
    }
  }

  setGameMode(mode: 'ffa' | 'teams') {
    this.gameMode = mode;
    if (mode === 'teams') {
      this.localPlayer.team = 'blue';
      this.botPlayer.team = 'red';
    } else {
      this.localPlayer.team = 'none';
      this.botPlayer.team = 'none';
    }
  }

  rematch() {
    this.matchState = 'waiting';
    this.matchTimeRemaining = this.matchDuration;
    this.teamScores = { blue: 0, red: 0 };
    const map = ARENA_MAPS[this.currentMapId] || ARENA_MAPS.catacombs!;
    this.players.forEach((p, idx) => {
      const spawn = map.spawnPoints[idx % map.spawnPoints.length] || { x: 400, y: 400 };
      p.x = spawn.x;
      p.y = spawn.y;
      p.health = p.maxHealth;
      p.healthLag = p.maxHealth;
      p.mana = p.maxMana;
      p.isAlive = true;
      p.hasShield = true;
      p.shieldDuration = 2.0;
      p.score = 0;
      p.kills = 0;
      p.deaths = 0;
      p.damageDealt = 0;
    });
    this.projectiles = [];
    this.visualEffects = [];
    this.floatingNumbers = [];
  }

  setMap(mapId: string) {
    if (!ARENA_MAPS[mapId]) return;
    this.currentMapId = mapId;
    this.initGame();
  }

  start() {
    if (this.isRunning) return;
    this.isRunning = true;
    this.lastFrameTime = performance.now();
    this.loop(this.lastFrameTime);
  }

  stop() {
    this.isRunning = false;
    if (this.animFrameId !== null) {
      cancelAnimationFrame(this.animFrameId);
      this.animFrameId = null;
    }
    this.input.destroy();
  }

  private loop(currentTime: number) {
    if (!this.isRunning) return;

    const dt = Math.min(0.05, (currentTime - this.lastFrameTime) / 1000);
    this.lastFrameTime = currentTime;

    this.update(dt);
    this.render();

    this.animFrameId = requestAnimationFrame((t) => this.loop(t));
  }

  update(dt: number) {
    const map = ARENA_MAPS[this.currentMapId] || ARENA_MAPS.catacombs!;
    const p = this.localPlayer;
    const bot = this.botPlayer;

    // 0. Update Match Timer
    if (this.matchState === 'in_progress') {
      this.matchTimeRemaining = Math.max(0, this.matchTimeRemaining - dt);
      if (this.matchTimeRemaining <= 0) {
        this.matchState = 'ended';
        this.addKillFeedItem('🏁 Match Ended! Time is up!');
        this.audio.playVictory();
      }
    }

    // 1. Process Local Player Input
    if (p.isAlive && this.matchState !== 'ended') {
      // Movement
      const move = this.input.getMovementVector();
      p.move(move.x, move.y, dt, map.obstacles, map.width, map.height);

      // Aiming: angle towards mouse from screen center
      const screenCenterX = this.canvas.width / 2;
      const screenCenterY = this.canvas.height / 2;
      p.facingAngle = this.input.getAimAngle(screenCenterX, screenCenterY);

      // Dash
      if (this.input.consumeDash()) {
        if (p.triggerDash()) {
          this.audio.playDash();
        }
      }

      // Casting (strictly only during active in_progress match; completely disabled in waiting room)
      if (this.input.isMouseDown && this.matchState === 'in_progress') {
        const spellType = this.input.activeSpell;
        const def = SPELLS[spellType] || SPELLS.fireball!;
        if ((p.cooldowns[spellType] ?? 0) <= 0 && p.mana >= def.manaCost) {
          p.mana -= def.manaCost;
          p.cooldowns[spellType] = def.cooldown;

          // Apply GCD (0.28s) across offensive spells locally as well
          if (spellType !== 'shield') {
            for (const key of ['fireball', 'frost', 'lightning']) {
              if ((p.cooldowns[key] ?? 0) < 0.28) {
                p.cooldowns[key] = 0.28;
              }
            }
          }

          if (spellType === 'shield') {
            p.triggerShield();
            this.audio.playShield();
          } else {
            if (!this.isMultiplayer) {
              this.spawnProjectile(p.id, spellType, p.x, p.y, p.facingAngle);
            }
            if (spellType === 'fireball') this.audio.playFireball();
            else if (spellType === 'frost') this.audio.playFrost();
            else if (spellType === 'lightning') this.audio.playLightning();
          }
        }
      }
    }

    // 2. Lock Camera Directly on Local Player (Guarantees wizard is dead-centered)
    this.camera.lockOn(p.x, p.y);
    this.camera.update(dt);

    // 3. Update Entities
    p.update(dt, map.obstacles, map.width, map.height);
    for (const pl of this.players) {
      if (pl !== p) {
        if (typeof pl.targetX === 'number' && typeof pl.targetY === 'number') {
          const dx = pl.targetX - pl.x;
          const dy = pl.targetY - pl.y;
          if (Math.abs(dx) > 180 || Math.abs(dy) > 180) {
            pl.x = pl.targetX;
            pl.y = pl.targetY;
          } else {
            const factor = 1 - Math.exp(-18 * dt);
            pl.x += dx * factor;
            pl.y += dy * factor;
          }
        }
        pl.update(dt, map.obstacles, map.width, map.height);
      }
    }

    // 4. Update Bot AI (strictly in offline singleplayer mode during active in_progress match)
    if (!this.isMultiplayer && this.matchState === 'in_progress') {
      this.botAI.update(
        dt,
        p,
        this.projectiles,
        map.obstacles,
        map.width,
        map.height,
        (ownerId, spellType, x, y, angleDeg) => {
          this.spawnProjectile(ownerId, spellType, x, y, angleDeg);
          if (spellType === 'fireball') this.audio.playFireball();
          else if (spellType === 'frost') this.audio.playFrost();
          else if (spellType === 'lightning') this.audio.playLightning();
        },
      );
    }

    // 5. Update Projectiles & Check Collisions
    for (let i = this.projectiles.length - 1; i >= 0; i--) {
      const proj = this.projectiles[i];
      if (!proj) continue;
      proj.update(dt);

      let destroyed = false;

      // In multiplayer mode, the authoritative server handles projectile lifetime, boundaries, and collisions.
      if (!this.isMultiplayer) {
        // Check lifetime
        if (proj.lifetime <= 0) {
          destroyed = true;
        }

        // Check collision with arena boundaries
        if (proj.x < 0 || proj.x > map.width || proj.y < 0 || proj.y > map.height) {
          destroyed = true;
        }

        // Check collision with obstacles
        if (!destroyed) {
          for (const obs of map.obstacles) {
            if (circleIntersectsRect(proj.x, proj.y, proj.radius, obs.x, obs.y, obs.w, obs.h)) {
              destroyed = true;
              this.spawnExplosion(proj.x, proj.y, proj.spellType);
              break;
            }
          }
        }
      }

      // Check collision with wizards (in offline singleplayer mode; in multiplayer the server is authoritative)
      if (!destroyed && !this.isMultiplayer) {
        for (const target of this.players) {
          if (target.id === proj.ownerId || !target.isAlive) continue;

          // FRIENDLY FIRE FILTER: Same team players cannot hit each other!
          if (
            this.gameMode === 'teams' &&
            proj.team !== 'none' &&
            target.team !== 'none' &&
            proj.team === target.team
          ) {
            continue; // Projectile passes right through teammates
          }

          if (
            circleIntersectsCircle(
              proj.x,
              proj.y,
              proj.radius,
              target.x,
              target.y,
              GAME_CONFIG.PLAYER_RADIUS,
            )
          ) {
            destroyed = true;
            this.spawnExplosion(proj.x, proj.y, proj.spellType);

            const result = target.takeDamage(proj.damage, proj.spellType);
            const attacker = this.players.find((pl) => pl.id === proj.ownerId);

            if (result.absorbed) {
              this.addFloatingNumber(target.x, target.y - 30, '🛡️ SHIELDED', '#38bdf8');
            } else {
              this.audio.playHit();
              const color =
                proj.spellType === 'lightning'
                  ? '#c084fc'
                  : proj.spellType === 'frost'
                    ? '#38bdf8'
                    : '#ef4444';
              this.addFloatingNumber(target.x, target.y - 30, `-${result.damageDealt}`, color);

              if (attacker) {
                attacker.damageDealt = (attacker.damageDealt || 0) + result.damageDealt;
              }

              if (target.id === p.id) {
                this.camera.triggerShake(9);
              }

              if (result.killed) {
                if (attacker) {
                  attacker.kills += 1;
                  attacker.score += 100;
                  if (attacker.team === 'blue') this.teamScores.blue += 100;
                  else if (attacker.team === 'red') this.teamScores.red += 100;
                }
                const bannerText =
                  attacker?.id === p.id
                    ? `🔥 You eliminated ${target.name}!`
                    : `💀 You were eliminated by ${attacker?.name}!`;
                this.addKillFeedItem(bannerText);

                if (attacker?.id === p.id) {
                  this.audio.playVictory();
                }
              }
            }
            break;
          }
        }
      }

      if (destroyed) {
        this.projectiles.splice(i, 1);
      }
    }

    // 6. Update Visual Effects & Floating Numbers
    for (let i = this.visualEffects.length - 1; i >= 0; i--) {
      const fx = this.visualEffects[i];
      if (!fx) continue;
      fx.age += dt;
      if (fx.age >= fx.duration) {
        this.visualEffects.splice(i, 1);
      }
    }

    for (let i = this.floatingNumbers.length - 1; i >= 0; i--) {
      const fn = this.floatingNumbers[i];
      if (!fn) continue;
      fn.y -= dt * 45;
      fn.age += dt;
      if (fn.age >= fn.duration) {
        this.floatingNumbers.splice(i, 1);
      }
    }

    // 7. Fire Stats Callback for UI Sync
    if (this.onStatsChange) {
      this.onStatsChange({
        playerHealth: p.health,
        playerHealthLag: p.healthLag,
        playerMaxHealth: p.maxHealth,
        playerMana: p.mana,
        playerMaxMana: p.maxMana,
        playerScore: p.score,
        playerKills: p.kills,
        playerDeaths: p.deaths,
        playerDamageDealt: p.damageDealt,
        botHealth: bot.health,
        cooldowns: p.cooldowns,
        activeSpell: this.input.activeSpell,
        matchState: this.matchState,
        matchTimeRemaining: this.matchTimeRemaining,
        matchDuration: this.matchDuration,
        gameMode: this.gameMode,
        hostId: this.hostId,
        isHost: this.localPlayer.isAdmin || this.localPlayer.id === this.hostId,
        teamScores: { ...this.teamScores },
        players: this.players.map((pl) => ({
          id: pl.id,
          name: pl.name,
          isBot: pl.isBot,
          colorIndex: pl.colorIndex,
          team: pl.team,
          isAdmin: pl.isAdmin,
          score: pl.score,
          kills: pl.kills,
          deaths: pl.deaths,
          damageDealt: pl.damageDealt,
          health: pl.health,
        })),
      });
    }
  }

  render() {
    this.renderer.render(
      this.camera,
      this.currentMapId,
      this.players,
      this.projectiles,
      this.visualEffects,
      this.floatingNumbers,
      this.localPlayer,
    );
  }

  spawnProjectile(
    ownerId: string,
    spellType: string,
    x: number,
    y: number,
    angleDeg: number,
  ) {
    const owner = this.players.find((pl) => pl.id === ownerId);
    const team = owner?.team ?? 'none';
    const proj = new Projectile(this.nextProjId++, ownerId, spellType, x, y, angleDeg, team);
    this.projectiles.push(proj);
  }

  spawnExplosion(x: number, y: number, spellType: string) {
    const color =
      spellType === 'frost'
        ? '#38bdf8'
        : spellType === 'lightning'
          ? '#c084fc'
          : '#ea580c';
    this.visualEffects.push({
      x,
      y,
      type: 'burst',
      color,
      age: 0,
      duration: 0.35,
    });
  }

  addFloatingNumber(x: number, y: number, text: string, color: string) {
    this.floatingNumbers.push({
      x,
      y,
      text,
      color,
      age: 0,
      duration: 1.1,
    });
  }

  addKillFeedItem(text: string) {
    const item: KillFeedItem = { id: Date.now(), text, time: performance.now() };
    this.killFeed.unshift(item);
    if (this.killFeed.length > 4) this.killFeed.pop();

    if (this.onKillFeedChange) {
      this.onKillFeedChange(this.killFeed);
    }
  }
}
