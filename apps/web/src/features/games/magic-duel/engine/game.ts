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

export interface GameStats {
  playerHealth: number;
  playerHealthLag: number;
  playerMaxHealth: number;
  playerMana: number;
  playerMaxMana: number;
  playerScore: number;
  playerKills: number;
  playerDeaths: number;
  botHealth: number;
  cooldowns: Record<string, number>;
  activeSpell: string;
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

  localPlayer: PlayerEntity;
  botPlayer: PlayerEntity;
  botAI: BotAI;

  lastFrameTime: number;
  isRunning: boolean;
  nextProjId: number;

  onKillFeedChange: ((feed: KillFeedItem[]) => void) | null;
  onStatsChange: ((stats: GameStats) => void) | null;

  private animFrameId: number | null = null;

  constructor(canvas: HTMLCanvasElement, initialMapId = 'catacombs') {
    this.canvas = canvas;
    this.camera = new Camera();
    this.input = new InputManager(canvas);
    this.audio = new GameAudio();
    this.renderer = new GameRenderer(canvas);

    this.currentMapId = ARENA_MAPS[initialMapId] ? initialMapId : 'catacombs';
    this.players = [];
    this.projectiles = [];
    this.visualEffects = [];
    this.floatingNumbers = [];
    this.killFeed = [];

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
      'player-1',
      'Wizard (You)',
      0,
      spawnP1.x,
      spawnP1.y,
      false,
    );
    this.botPlayer = new PlayerEntity(
      'bot-ignis',
      'Archmage Ignis [BOT]',
      1,
      spawnP2.x,
      spawnP2.y,
      true,
    );
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

  initGame() {
    const map = ARENA_MAPS[this.currentMapId] || ARENA_MAPS.catacombs!;
    const spawnP1 = map.spawnPoints[0] || { x: 380, y: 380 };
    const spawnP2 = map.spawnPoints[1] || { x: 1620, y: 1020 };

    this.localPlayer = new PlayerEntity(
      'player-1',
      'Wizard (You)',
      0,
      spawnP1.x,
      spawnP1.y,
      false,
    );
    this.botPlayer = new PlayerEntity(
      'bot-ignis',
      'Archmage Ignis [BOT]',
      1,
      spawnP2.x,
      spawnP2.y,
      true,
    );

    this.players = [this.localPlayer, this.botPlayer];
    this.botAI = new BotAI(this.botPlayer);

    this.projectiles = [];
    this.visualEffects = [];
    this.floatingNumbers = [];
    this.killFeed = [];

    // Center camera immediately on local player
    this.camera.lockOn(this.localPlayer.x, this.localPlayer.y);
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

    // 1. Process Local Player Input
    if (p.isAlive) {
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

      // Casting
      if (this.input.isMouseDown) {
        const spellType = this.input.activeSpell;
        const def = SPELLS[spellType] || SPELLS.fireball!;
        if ((p.cooldowns[spellType] ?? 0) <= 0 && p.mana >= def.manaCost) {
          p.mana -= def.manaCost;
          p.cooldowns[spellType] = def.cooldown;

          if (spellType === 'shield') {
            p.triggerShield();
            this.audio.playShield();
          } else {
            this.spawnProjectile(p.id, spellType, p.x, p.y, p.facingAngle);
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
    bot.update(dt, map.obstacles, map.width, map.height);

    // 4. Update Bot AI
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

    // 5. Update Projectiles & Check Collisions
    for (let i = this.projectiles.length - 1; i >= 0; i--) {
      const proj = this.projectiles[i];
      if (!proj) continue;
      proj.update(dt);

      let destroyed = false;

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

      // Check collision with wizards
      if (!destroyed) {
        for (const target of this.players) {
          if (target.id === proj.ownerId || !target.isAlive) continue;

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

              if (target.id === p.id) {
                this.camera.triggerShake(9);
              }

              if (result.killed) {
                const killer = this.players.find((pl) => pl.id === proj.ownerId);
                if (killer) {
                  killer.kills += 1;
                  killer.score += 100;
                }
                const bannerText =
                  killer?.id === p.id
                    ? `🔥 You eliminated ${target.name}!`
                    : `💀 You were eliminated by ${killer?.name}!`;
                this.addKillFeedItem(bannerText);

                if (killer?.id === p.id) {
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
        botHealth: bot.health,
        cooldowns: p.cooldowns,
        activeSpell: this.input.activeSpell,
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
    const proj = new Projectile(this.nextProjId++, ownerId, spellType, x, y, angleDeg);
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
