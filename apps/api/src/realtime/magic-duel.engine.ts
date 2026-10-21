import type { Server, Socket } from 'socket.io';
import {
  SPELL_CONFIGS,
  type ArenaMapData,
  type ClientToServerEvents,
  type GameClientInput,
  type GameKillFeedItem,
  type GameMapTheme,
  type GamePlayerState,
  type GameProjectile,
  type GameVisualEffect,
  type GameWorldState,
  type ServerToClientEvents,
  type SpellType,
} from '@vicinity/shared';
import { logger } from '../lib/logger';

// Default Arena Maps
export const ARENA_MAPS: Record<GameMapTheme, ArenaMapData> = {
  catacombs: {
    id: 'catacombs',
    name: 'Catacombs',
    subtitle: 'Dungeon Crypt',
    description: 'Stone dungeon with mossy pillars, perimeter walls, and torchlit halls.',
    width: 2000,
    height: 1400,
    floorTexture: '/magic-duel/textures/stone_floor.png',
    wallTexture: '/magic-duel/textures/stone_wall.png',
    obstacles: [
      // 4 central stone pillars
      { x: 600, y: 400, w: 120, h: 120 },
      { x: 1280, y: 400, w: 120, h: 120 },
      { x: 600, y: 880, w: 120, h: 120 },
      { x: 1280, y: 880, w: 120, h: 120 },
      // Central sarcophagus altar
      { x: 920, y: 640, w: 160, h: 120 },
      // Side barrier walls
      { x: 280, y: 550, w: 100, h: 300 },
      { x: 1620, y: 550, w: 100, h: 300 },
    ],
    spawnPoints: [
      { x: 200, y: 200 },
      { x: 1800, y: 200 },
      { x: 200, y: 1200 },
      { x: 1800, y: 1200 },
      { x: 1000, y: 220 },
      { x: 1000, y: 1180 },
    ],
    torchPositions: [
      { x: 600, y: 390 },
      { x: 1400, y: 390 },
      { x: 600, y: 1010 },
      { x: 1400, y: 1010 },
      { x: 1000, y: 630 },
      { x: 1000, y: 770 },
    ],
  },
  'forest-ruins': {
    id: 'forest-ruins',
    name: 'Forest Ruins',
    subtitle: 'Overgrown Sanctuary',
    description: 'Sprawling temple with ancient monoliths, overgrown flora, and ruins.',
    width: 2200,
    height: 1500,
    floorTexture: '/magic-duel/textures/forest_floor.png',
    wallTexture: '/magic-duel/textures/stone_wall.png',
    obstacles: [
      { x: 500, y: 350, w: 160, h: 160 },
      { x: 1540, y: 350, w: 160, h: 160 },
      { x: 500, y: 990, w: 160, h: 160 },
      { x: 1540, y: 990, w: 160, h: 160 },
      { x: 1020, y: 670, w: 160, h: 160 },
      { x: 300, y: 650, w: 140, h: 200 },
      { x: 1760, y: 650, w: 140, h: 200 },
    ],
    spawnPoints: [
      { x: 250, y: 250 },
      { x: 1950, y: 250 },
      { x: 250, y: 1250 },
      { x: 1950, y: 1250 },
      { x: 1100, y: 200 },
      { x: 1100, y: 1300 },
    ],
    torchPositions: [
      { x: 500, y: 340 },
      { x: 1700, y: 340 },
      { x: 500, y: 1160 },
      { x: 1700, y: 1160 },
    ],
  },
  'lava-citadel': {
    id: 'lava-citadel',
    name: 'Lava Citadel',
    subtitle: 'Volcanic Forge',
    description: 'Hazardous obsidian arena forged amidst bubbling lava trenches.',
    width: 2000,
    height: 1400,
    floorTexture: '/magic-duel/textures/lava_floor.png',
    wallTexture: '/magic-duel/textures/stone_wall.png',
    obstacles: [
      { x: 450, y: 400, w: 180, h: 140 },
      { x: 1370, y: 400, w: 180, h: 140 },
      { x: 450, y: 860, w: 180, h: 140 },
      { x: 1370, y: 860, w: 180, h: 140 },
      { x: 910, y: 610, w: 180, h: 180 },
    ],
    spawnPoints: [
      { x: 220, y: 220 },
      { x: 1780, y: 220 },
      { x: 220, y: 1180 },
      { x: 1780, y: 1180 },
      { x: 1000, y: 200 },
      { x: 1000, y: 1200 },
    ],
    torchPositions: [
      { x: 450, y: 390 },
      { x: 1550, y: 390 },
      { x: 450, y: 1010 },
      { x: 1550, y: 1010 },
    ],
  },
};

interface InternalPlayer extends GamePlayerState {
  socket?: Socket<ClientToServerEvents, ServerToClientEvents>;
  moveX: number;
  moveY: number;
  isFiring: boolean;
  slowTimer: number;
  respawnTimer: number;
  botNextActionTime: number;
  botTargetId: string | null;
  botStrafeDir?: number;
  botStrafeTimer?: number;
}

export function gameRoomKey(workspaceId: string, zoneId: string): string {
  return `game:${workspaceId}:${zoneId}`;
}

export class MagicDuelEngine {
  private io: Server<ClientToServerEvents, ServerToClientEvents>;
  private rooms = new Map<
    string,
    {
      workspaceId: string;
      zoneId: string;
      mapId: GameMapTheme;
      map: ArenaMapData;
      players: Map<string, InternalPlayer>;
      projectiles: GameProjectile[];
      visualEffects: GameVisualEffect[];
      killFeed: GameKillFeedItem[];
      matchState: 'waiting' | 'in_progress' | 'ended';
      matchDuration: number;
      matchTimeRemaining: number;
      hostId: string;
      gameMode: 'ffa' | 'teams';
      teamScores: { blue: number; red: number };
      matchTimer: number;
      roundResetTimer: number;
      winnerId: string | null;
      nextProjectileId: number;
      timer: NodeJS.Timeout | null;
    }
  >();

  constructor(io: Server<ClientToServerEvents, ServerToClientEvents>) {
    this.io = io;
  }

  public joinGame(
    workspaceId: string,
    zoneId: string,
    userId: string,
    displayName: string,
    socket: Socket<ClientToServerEvents, ServerToClientEvents>,
  ): void {
    const key = gameRoomKey(workspaceId, zoneId);
    let room = this.rooms.get(key);

    if (!room) {
      const defaultMapId: GameMapTheme = 'catacombs';
      const map = ARENA_MAPS[defaultMapId];
      room = {
        workspaceId,
        zoneId,
        mapId: defaultMapId,
        map,
        players: new Map(),
        projectiles: [],
        visualEffects: [],
        killFeed: [],
        matchState: 'waiting',
        matchDuration: 120,
        matchTimeRemaining: 120,
        hostId: userId,
        gameMode: 'ffa',
        teamScores: { blue: 0, red: 0 },
        matchTimer: 0,
        roundResetTimer: 0,
        winnerId: null,
        nextProjectileId: 1,
        timer: null,
      };
      this.rooms.set(key, room);
    }

    void socket.join(key);

    // Ensure room always has an active human host
    const activeHumansBefore = Array.from(room.players.values()).filter((p) => !p.isBot);
    const hostIsActive = activeHumansBefore.some((p) => p.id === room.hostId);
    if (!hostIsActive || activeHumansBefore.length === 0) {
      room.hostId = userId;
    }

    // Pick spawn point
    const spawnIdx = room.players.size % room.map.spawnPoints.length;
    const spawn = room.map.spawnPoints[spawnIdx] || { x: 400, y: 400 };

    const playerColors = [0, 1, 2, 3];
    const colorIndex = playerColors[room.players.size % playerColors.length];

    const team = room.gameMode === 'teams' ? (room.players.size % 2 === 0 ? 'blue' : 'red') : 'none';

    const isHost = room.hostId === userId || activeHumansBefore.length === 0;
    if (isHost) {
      room.hostId = userId;
    }

    const player: InternalPlayer = {
      id: userId,
      name: displayName || 'Wizard',
      colorIndex,
      posX: spawn.x,
      posY: spawn.y,
      facingAngle: 0,
      health: 100,
      maxHealth: 100,
      mana: 80,
      maxMana: 100,
      kills: 0,
      deaths: 0,
      score: 0,
      damageDealt: 0,
      team,
      isAdmin: isHost,
      hasShield: true,
      shieldDuration: 2.0, // Free 2s shield on spawn
      isAlive: true,
      activeSpell: 'fireball',
      cooldowns: {
        fireball: 0,
        frost: 0,
        lightning: 0,
        shield: 0,
        dash: 0,
      },
      isBot: false,
      isDashing: false,
      dashTimer: 0,
      hitFlashTimer: 0,
      socket,
      moveX: 0,
      moveY: 0,
      isFiring: false,
      slowTimer: 0,
      respawnTimer: 0,
      botNextActionTime: 0,
      botTargetId: null,
    };

    room.players.set(userId, player);
    logger.info({ key, userId, displayName, isHost: player.isAdmin }, 'player joined Magic Duel');

    // If only 1 human player and no bot, spawn a Sparring Bot!
    this.ensureBotPopulation(room);

    // Start tick loop if not running
    if (!room.timer) {
      room.timer = setInterval(() => this.tickRoom(key), 16); // 60 FPS authoritative server tick
    }

    // Immediately send player assignment and current snapshot
    socket.emit('game:init', { playerId: userId });
    this.io.to(key).emit('game:state', this.buildSnapshot(room));
  }

  public leaveGame(workspaceId: string, zoneId: string, userId: string): void {
    const key = gameRoomKey(workspaceId, zoneId);
    const room = this.rooms.get(key);
    if (!room) return;

    const p = room.players.get(userId);
    if (p?.socket) {
      void p.socket.leave(key);
    }
    const leavingWasHost = room.hostId === userId;
    room.players.delete(userId);
    logger.info({ key, userId }, 'player left Magic Duel');

    if (leavingWasHost) {
      const nextHost = Array.from(room.players.values()).find((pl) => !pl.isBot);
      if (nextHost) {
        room.hostId = nextHost.id;
        nextHost.isAdmin = true;
      }
    }

    // Count remaining human players
    const humanCount = Array.from(room.players.values()).filter((p) => !p.isBot).length;
    if (humanCount === 0) {
      // Clean up room
      if (room.timer) {
        clearInterval(room.timer);
      }
      this.rooms.delete(key);
      logger.info({ key }, 'Magic Duel room closed (empty)');
    } else {
      // Re-balance bots if needed
      this.ensureBotPopulation(room);
      this.io.to(key).emit('game:state', this.buildSnapshot(room));
    }
  }

  public selectDuration(workspaceId: string, zoneId: string, userId: string, duration: number): void {
    const key = gameRoomKey(workspaceId, zoneId);
    const room = this.rooms.get(key);
    if (!room) return;

    const activeHumans = Array.from(room.players.values()).filter((p) => !p.isBot);
    const isAuthorized = room.hostId === userId || activeHumans.length <= 1;
    if (!isAuthorized) return;

    room.matchDuration = duration;
    room.matchTimeRemaining = duration;
    this.io.to(key).emit('game:state', this.buildSnapshot(room));
  }

  public selectMode(workspaceId: string, zoneId: string, _userId: string, gameMode: 'ffa' | 'teams'): void {
    const key = gameRoomKey(workspaceId, zoneId);
    const room = this.rooms.get(key);
    if (!room) return;

    room.gameMode = gameMode;
    if (gameMode === 'teams') {
      let idx = 0;
      for (const p of room.players.values()) {
        if (p.team !== 'blue' && p.team !== 'red') {
          p.team = idx % 2 === 0 ? 'blue' : 'red';
          idx++;
        }
      }
    } else {
      for (const p of room.players.values()) {
        p.team = 'none';
      }
    }
    this.io.to(key).emit('game:state', this.buildSnapshot(room));
  }

  public startMatch(
    workspaceId: string,
    zoneId: string,
    userId: string,
    duration = 120,
    gameMode: 'ffa' | 'teams' = 'ffa',
  ): void {
    const key = gameRoomKey(workspaceId, zoneId);
    const room = this.rooms.get(key);
    if (!room) return;

    const activeHumans = Array.from(room.players.values()).filter((p) => !p.isBot);
    const isAuthorized = room.hostId === userId || activeHumans.length <= 1;
    if (!isAuthorized) {
      logger.warn({ userId, hostId: room.hostId }, 'non-host attempted to start match');
      return;
    }
    room.hostId = userId;

    room.matchDuration = duration;
    room.matchTimeRemaining = duration;
    room.gameMode = gameMode;
    room.matchState = 'in_progress';
    room.teamScores = { blue: 0, red: 0 };
    room.projectiles = [];
    room.visualEffects = [];

    let i = 0;
    for (const player of room.players.values()) {
      const pt = room.map.spawnPoints[i % room.map.spawnPoints.length] || { x: 300, y: 300 };
      player.posX = pt.x;
      player.posY = pt.y;
      player.health = 100;
      player.mana = 80;
      player.isAlive = true;
      player.hasShield = true;
      player.shieldDuration = 2.5;
      player.kills = 0;
      player.deaths = 0;
      player.score = 0;
      player.damageDealt = 0;
      if (gameMode === 'teams') {
        if (player.team !== 'blue' && player.team !== 'red') {
          const blueCount = Array.from(room.players.values()).filter((p) => p.team === 'blue').length;
          const redCount = Array.from(room.players.values()).filter((p) => p.team === 'red').length;
          player.team = blueCount <= redCount ? 'blue' : 'red';
        }
      } else {
        player.team = 'none';
      }
      i++;
    }

    this.io.to(key).emit('game:state', this.buildSnapshot(room));
  }

  public setTeam(
    workspaceId: string,
    zoneId: string,
    userId: string,
    team: 'blue' | 'red' | 'none',
  ): void {
    const key = gameRoomKey(workspaceId, zoneId);
    const room = this.rooms.get(key);
    if (!room) return;

    const player = room.players.get(userId);
    if (player) {
      player.team = team;
      if (team === 'blue' || team === 'red') {
        room.gameMode = 'teams';
      }
      this.io.to(key).emit('game:state', this.buildSnapshot(room));
    }
  }

  public rematch(workspaceId: string, zoneId: string, _userId?: string): void {
    const key = gameRoomKey(workspaceId, zoneId);
    const room = this.rooms.get(key);
    if (!room) return;

    room.matchState = 'waiting';
    room.matchTimeRemaining = room.matchDuration;
    room.teamScores = { blue: 0, red: 0 };
    room.projectiles = [];
    room.visualEffects = [];

    let i = 0;
    for (const player of room.players.values()) {
      const pt = room.map.spawnPoints[i % room.map.spawnPoints.length] || { x: 300, y: 300 };
      player.posX = pt.x;
      player.posY = pt.y;
      player.health = 100;
      player.mana = 80;
      player.isAlive = true;
      player.hasShield = true;
      player.shieldDuration = 2.0;
      player.kills = 0;
      player.deaths = 0;
      player.score = 0;
      player.damageDealt = 0;
      i++;
    }

    this.io.to(key).emit('game:state', this.buildSnapshot(room));
  }

  public handleInput(
    workspaceId: string,
    zoneId: string,
    userId: string,
    input: GameClientInput,
  ): void {
    const key = gameRoomKey(workspaceId, zoneId);
    const room = this.rooms.get(key);
    if (!room) return;

    const player = room.players.get(userId);
    if (!player || !player.isAlive) return;

    player.moveX = Math.max(-1, Math.min(1, input.moveX));
    player.moveY = Math.max(-1, Math.min(1, input.moveY));
    player.facingAngle = input.facingAngle;
    player.activeSpell = input.activeSpell;
    player.isFiring = input.isFiring;

    // Handle instant dash trigger
    if (input.isDashing && player.cooldowns.dash <= 0 && player.mana >= SPELL_CONFIGS.dash.manaCost) {
      player.mana -= SPELL_CONFIGS.dash.manaCost;
      player.cooldowns.dash = SPELL_CONFIGS.dash.cooldown;
      player.isDashing = true;
      player.dashTimer = 0.22;

      // Spawn dash explosion particle
      room.visualEffects.push({
        id: `fx-${Date.now()}-${Math.random()}`,
        type: 'spark_explosion',
        x: player.posX,
        y: player.posY,
        color: '#38bdf8',
        duration: 0.4,
        createdAt: Date.now(),
      });
    }
  }

  public selectMap(workspaceId: string, zoneId: string, mapId: GameMapTheme): void {
    const key = gameRoomKey(workspaceId, zoneId);
    const room = this.rooms.get(key);
    if (!room || !ARENA_MAPS[mapId]) return;

    room.mapId = mapId;
    room.map = ARENA_MAPS[mapId];
    room.projectiles = [];
    room.visualEffects = [];

    // Respawn all players
    let i = 0;
    for (const player of room.players.values()) {
      const pt = room.map.spawnPoints[i % room.map.spawnPoints.length] || { x: 300, y: 300 };
      player.posX = pt.x;
      player.posY = pt.y;
      player.health = 100;
      player.mana = 80;
      player.isAlive = true;
      player.hasShield = true;
      player.shieldDuration = 2.0;
      i++;
    }
  }

  private ensureBotPopulation(room: ReturnType<typeof this.rooms.get> extends infer T ? NonNullable<T> : never): void {
    const humanCount = Array.from(room.players.values()).filter((p) => !p.isBot).length;
    const botCount = Array.from(room.players.values()).filter((p) => p.isBot).length;

    // We keep 1 bot if 1 human player is playing alone, or 0 bots if 2+ humans are dueling
    if (humanCount === 1 && botCount === 0) {
      const botId = `bot-${Date.now()}`;
      const spawn = room.map.spawnPoints[1] || { x: 1600, y: 1000 };
      const bot: InternalPlayer = {
        id: botId,
        name: 'Sparring Bot',
        colorIndex: 1, // Red
        posX: spawn.x,
        posY: spawn.y,
        facingAngle: 180,
        health: 100,
        maxHealth: 100,
        mana: 80,
        maxMana: 100,
        kills: 0,
        deaths: 0,
        score: 0,
        hasShield: true,
        shieldDuration: 2.0,
        isAlive: true,
        activeSpell: 'fireball',
        cooldowns: {
          fireball: 0,
          frost: 0,
          lightning: 0,
          shield: 0,
          dash: 0,
        },
        isBot: true,
        isDashing: false,
        dashTimer: 0,
        hitFlashTimer: 0,
        moveX: 0,
        moveY: 0,
        isFiring: false,
        slowTimer: 0,
        respawnTimer: 0,
        botNextActionTime: 0,
        botTargetId: null,
      };
      room.players.set(botId, bot);
    } else if (humanCount >= 2 && botCount > 0) {
      // Remove bot when 2 or more real players are present
      for (const [id, p] of room.players.entries()) {
        if (p.isBot) {
          room.players.delete(id);
          break;
        }
      }
    }
  }

  private tickRoom(key: string): void {
    const room = this.rooms.get(key);
    if (!room) return;

    const dt = 0.0166; // 60 FPS delta
    room.matchTimer += dt;

    // Countdown match timer
    if (room.matchState === 'in_progress') {
      room.matchTimeRemaining = Math.max(0, room.matchTimeRemaining - dt);
      if (room.matchTimeRemaining <= 0) {
        room.matchState = 'ended';
      }
    }

    // Clean old visual effects
    const now = Date.now();
    room.visualEffects = room.visualEffects.filter((fx) => now - fx.createdAt < fx.duration * 1000);

    // Update AI Bots (strictly during active match or solo practice in waiting state)
    const humanCount = Array.from(room.players.values()).filter((p) => !p.isBot).length;
    if (room.matchState === 'in_progress' || (room.matchState === 'waiting' && humanCount === 1)) {
      this.updateBots(room, dt);
    } else {
      for (const bot of room.players.values()) {
        if (bot.isBot) {
          bot.moveX = 0;
          bot.moveY = 0;
          bot.isFiring = false;
        }
      }
    }

    // Update Players
    for (const player of room.players.values()) {
      // Handle Dead / Respawn
      if (!player.isAlive) {
        player.respawnTimer -= dt;
        if (player.respawnTimer <= 0) {
          player.isAlive = true;
          player.health = 100;
          player.mana = 80;
          player.hasShield = true;
          player.shieldDuration = 2.0;
          // Spawn at random spawn point
          const sp = room.map.spawnPoints[Math.floor(Math.random() * room.map.spawnPoints.length)];
          player.posX = sp.x;
          player.posY = sp.y;
        }
        continue;
      }

      // Mana Regen (+12/sec)
      player.mana = Math.min(player.maxMana, player.mana + 12 * dt);

      // Cooldowns
      for (const sp of Object.keys(player.cooldowns) as SpellType[]) {
        if (player.cooldowns[sp] > 0) {
          player.cooldowns[sp] = Math.max(0, player.cooldowns[sp] - dt);
        }
      }

      // Hit Flash timer
      if (player.hitFlashTimer > 0) {
        player.hitFlashTimer = Math.max(0, player.hitFlashTimer - dt);
      }

      // Slow timer
      if (player.slowTimer > 0) {
        player.slowTimer = Math.max(0, player.slowTimer - dt);
      }

      // Shield duration
      if (player.hasShield) {
        player.shieldDuration -= dt;
        if (player.shieldDuration <= 0) {
          player.hasShield = false;
        }
      }

      // Dash timer
      if (player.isDashing) {
        player.dashTimer -= dt;
        if (player.dashTimer <= 0) {
          player.isDashing = false;
        }
      }

      // Calculate speed
      let speed = 260; // Base speed px/s, matches client GAME_CONFIG.PLAYER_SPEED
      if (player.isDashing) {
        speed = 720;
      } else if (player.slowTimer > 0) {
        speed = 130; // Slowed by frost
      }

      // Move player with collision checks
      const vx = player.moveX * speed * dt;
      const vy = player.moveY * speed * dt;
      this.movePlayerWithCollision(room, player, vx, vy);

      // Handle spell casting (during active match or during solo practice)
      if (player.isFiring && (room.matchState === 'in_progress' || (room.matchState === 'waiting' && humanCount === 1))) {
        this.castPlayerSpell(room, player);
      }
    }

    // Update Projectiles
    this.updateProjectiles(room, dt);

    // Broadcast Snapshot to all sockets in room
    this.io.to(key).emit('game:state', this.buildSnapshot(room));
  }

  private castPlayerSpell(
    room: ReturnType<typeof this.rooms.get> extends infer T ? NonNullable<T> : never,
    player: InternalPlayer,
  ): void {
    const spell = SPELL_CONFIGS[player.activeSpell];
    if (!spell) return;

    if (player.cooldowns[player.activeSpell] > 0 || player.mana < spell.manaCost) {
      return;
    }

    // Cast Arcane Shield
    if (player.activeSpell === 'shield') {
      player.mana -= spell.manaCost;
      player.cooldowns.shield = spell.cooldown;
      player.hasShield = true;
      player.shieldDuration = 2.5;

      room.visualEffects.push({
        id: `fx-${Date.now()}-${Math.random()}`,
        type: 'cast_aura',
        x: player.posX,
        y: player.posY,
        color: '#60a5fa',
        duration: 0.6,
        createdAt: Date.now(),
      });
      return;
    }

    // Cast Projectile spells (fireball, frost, lightning)
    player.mana -= spell.manaCost;
    player.cooldowns[player.activeSpell] = spell.cooldown;

    const rad = (player.facingAngle * Math.PI) / 180;
    const spawnDist = 25;
    const spawnX = player.posX + Math.cos(rad) * spawnDist;
    const spawnY = player.posY + Math.sin(rad) * spawnDist;

    const proj: GameProjectile = {
      id: room.nextProjectileId++,
      ownerId: player.id,
      posX: spawnX,
      posY: spawnY,
      velX: Math.cos(rad) * spell.speed,
      velY: Math.sin(rad) * spell.speed,
      spellType: player.activeSpell,
      damage: spell.damage,
      radius: spell.radius,
      lifetime: player.activeSpell === 'lightning' ? 1.2 : 3.5,
      team: player.team || 'none',
    };

    room.projectiles.push(proj);

    // Visual effect at wizard staff
    const fxColor =
      player.activeSpell === 'fireball'
        ? '#f97316'
        : player.activeSpell === 'frost'
          ? '#38bdf8'
          : '#a855f7';

    room.visualEffects.push({
      id: `fx-${Date.now()}-${Math.random()}`,
      type: 'cast_aura',
      x: spawnX,
      y: spawnY,
      color: fxColor,
      duration: 0.3,
      createdAt: Date.now(),
    });
  }

  private updateProjectiles(
    room: ReturnType<typeof this.rooms.get> extends infer T ? NonNullable<T> : never,
    dt: number,
  ): void {
    const aliveProjectiles: GameProjectile[] = [];

    for (const proj of room.projectiles) {
      proj.posX += proj.velX * dt;
      proj.posY += proj.velY * dt;
      proj.lifetime -= dt;

      if (proj.lifetime <= 0) continue;

      // Check map bounds
      if (
        proj.posX < 40 ||
        proj.posX > room.map.width - 40 ||
        proj.posY < 40 ||
        proj.posY > room.map.height - 40
      ) {
        room.visualEffects.push({
          id: `fx-${Date.now()}-${Math.random()}`,
          type: 'impact_shockwave',
          x: proj.posX,
          y: proj.posY,
          color: proj.spellType === 'fireball' ? '#f97316' : '#38bdf8',
          duration: 0.3,
          createdAt: Date.now(),
        });
        continue;
      }

      // Check obstacle collisions
      let hitObstacle = false;
      for (const obs of room.map.obstacles) {
        if (
          proj.posX >= obs.x &&
          proj.posX <= obs.x + obs.w &&
          proj.posY >= obs.y &&
          proj.posY <= obs.y + obs.h
        ) {
          hitObstacle = true;
          room.visualEffects.push({
            id: `fx-${Date.now()}-${Math.random()}`,
            type: 'spark_explosion',
            x: proj.posX,
            y: proj.posY,
            color: '#e2e8f0',
            duration: 0.35,
            createdAt: Date.now(),
          });
          break;
        }
      }
      if (hitObstacle) continue;

      // Check Player collisions
      let hitPlayer = false;
      for (const target of room.players.values()) {
        if (!target.isAlive || target.id === proj.ownerId) continue;

        // Friendly fire filter: same team wizards cannot hit each other!
        if (
          room.gameMode === 'teams' &&
          proj.team &&
          target.team &&
          proj.team !== 'none' &&
          target.team !== 'none' &&
          proj.team === target.team
        ) {
          continue; // Friendly fire blocked!
        }

        const dist = Math.hypot(target.posX - proj.posX, target.posY - proj.posY);
        if (dist <= 22 + proj.radius) {
          hitPlayer = true;
          const attacker = room.players.get(proj.ownerId);

          // If shielded: deflect/absorb
          if (target.hasShield) {
            room.visualEffects.push({
              id: `fx-${Date.now()}-${Math.random()}`,
              type: 'spell_clash',
              x: proj.posX,
              y: proj.posY,
              color: '#38bdf8',
              duration: 0.4,
              createdAt: Date.now(),
            });
            break;
          }

          // Deal damage
          const dmgDealt = Math.min(target.health, proj.damage);
          target.health = Math.max(0, target.health - proj.damage);
          target.hitFlashTimer = 0.2;

          if (attacker) {
            attacker.damageDealt = (attacker.damageDealt || 0) + dmgDealt;
          }

          if (proj.spellType === 'frost') {
            target.slowTimer = 2.0; // Slowed for 2 seconds
          }

          room.visualEffects.push({
            id: `fx-${Date.now()}-${Math.random()}`,
            type: 'impact_shockwave',
            x: proj.posX,
            y: proj.posY,
            color: proj.spellType === 'fireball' ? '#ef4444' : '#8b5cf6',
            duration: 0.45,
            createdAt: Date.now(),
          });

          // Check for elimination
          if (target.health <= 0) {
            target.isAlive = false;
            target.deaths += 1;
            target.respawnTimer = 3.0;

            if (attacker) {
              attacker.kills += 1;
              attacker.score += 100;
              if (attacker.team === 'blue') room.teamScores.blue += 100;
              else if (attacker.team === 'red') room.teamScores.red += 100;
            }

            room.killFeed.unshift({
              id: `kf-${Date.now()}-${Math.random()}`,
              killerName: attacker?.name || 'Wizard',
              victimName: target.name,
              spellType: proj.spellType,
              timestamp: Date.now(),
            });

            if (room.killFeed.length > 6) {
              room.killFeed.pop();
            }
          }

          break;
        }
      }

      if (!hitPlayer) {
        aliveProjectiles.push(proj);
      }
    }

    room.projectiles = aliveProjectiles;
  }

  private movePlayerWithCollision(
    room: ReturnType<typeof this.rooms.get> extends infer T ? NonNullable<T> : never,
    player: InternalPlayer,
    vx: number,
    vy: number,
  ): void {
    const radius = 24; // Match GAME_CONFIG.PLAYER_RADIUS
    let nextX = player.posX + vx;
    let nextY = player.posY;

    // Check X collision first
    for (const obs of room.map.obstacles) {
      const minX = obs.x - radius;
      const maxX = obs.x + obs.w + radius;
      const minY = obs.y - radius;
      const maxY = obs.y + obs.h + radius;

      if (nextX > minX && nextX < maxX && nextY > minY && nextY < maxY) {
        nextX = player.posX;
        break;
      }
    }

    // Then check Y collision
    let testY = player.posY + vy;
    for (const obs of room.map.obstacles) {
      const minX = obs.x - radius;
      const maxX = obs.x + obs.w + radius;
      const minY = obs.y - radius;
      const maxY = obs.y + obs.h + radius;

      if (nextX > minX && nextX < maxX && testY > minY && testY < maxY) {
        testY = player.posY;
        break;
      }
    }
    nextY = testY;

    // Bounds clamp
    player.posX = Math.max(radius + 30, Math.min(room.map.width - radius - 30, nextX));
    player.posY = Math.max(radius + 30, Math.min(room.map.height - radius - 30, nextY));
  }

  private updateBots(
    room: ReturnType<typeof this.rooms.get> extends infer T ? NonNullable<T> : never,
    dt: number,
  ): void {
    const now = Date.now();

    for (const bot of room.players.values()) {
      if (!bot.isBot || !bot.isAlive) continue;

      // Find nearest living opponent
      let nearestDist = Infinity;
      let target: InternalPlayer | null = null;

      for (const other of room.players.values()) {
        if (other.id === bot.id || !other.isAlive) continue;
        if (room.gameMode === 'teams' && bot.team !== 'none' && other.team === bot.team) continue;
        const d = Math.hypot(other.posX - bot.posX, other.posY - bot.posY);
        if (d < nearestDist) {
          nearestDist = d;
          target = other;
        }
      }

      if (!target) {
        bot.moveX = 0;
        bot.moveY = 0;
        bot.isFiring = false;
        continue;
      }

      // Aim at opponent with slight predictive lead
      const dx = target.posX - bot.posX;
      const dy = target.posY - bot.posY;
      const angle = (Math.atan2(dy, dx) * 180) / Math.PI;
      bot.facingAngle = (angle + 360) % 360;

      // Defensive dodge against incoming enemy projectiles
      let dodgeX = 0;
      let dodgeY = 0;
      let underThreat = false;
      for (const proj of room.projectiles) {
        if (proj.ownerId === bot.id) continue;
        const pdx = bot.posX - proj.posX;
        const pdy = bot.posY - proj.posY;
        const pdist = Math.hypot(pdx, pdy);
        if (pdist < 180) {
          const dot = proj.velX * pdx + proj.velY * pdy;
          if (dot > 0) {
            underThreat = true;
            const vMag = Math.hypot(proj.velX, proj.velY) || 1;
            dodgeX += -proj.velY / vMag;
            dodgeY += proj.velX / vMag;
          }
        }
      }

      // If under threat, trigger dash if available
      if (underThreat && bot.cooldowns.dash <= 0 && bot.mana >= SPELL_CONFIGS.dash.manaCost && Math.random() < 0.25) {
        bot.mana -= SPELL_CONFIGS.dash.manaCost;
        bot.cooldowns.dash = SPELL_CONFIGS.dash.cooldown;
        bot.isDashing = true;
        bot.dashTimer = 0.22;
      }

      // Smooth strafing & spacing
      if (typeof bot.botStrafeDir !== 'number') bot.botStrafeDir = 1;
      if (typeof bot.botStrafeTimer !== 'number') bot.botStrafeTimer = 2.0;
      bot.botStrafeTimer -= dt;
      if (bot.botStrafeTimer <= 0) {
        bot.botStrafeDir *= -1;
        bot.botStrafeTimer = 1.5 + Math.random() * 2.0;
      }

      if (underThreat) {
        const dMag = Math.hypot(dodgeX, dodgeY) || 1;
        bot.moveX = dodgeX / dMag;
        bot.moveY = dodgeY / dMag;
      } else {
        const idealDist = 380;
        const distError = nearestDist - idealDist;
        const safeDist = Math.max(nearestDist, 1);
        const radialX = (dx / safeDist) * Math.sign(distError);
        const radialY = (dy / safeDist) * Math.sign(distError);
        const tangX = (-dy / safeDist) * bot.botStrafeDir;
        const tangY = (dx / safeDist) * bot.botStrafeDir;

        const mx = radialX * 0.45 + tangX * 0.8;
        const my = radialY * 0.45 + tangY * 0.8;
        const mMag = Math.hypot(mx, my) || 1;
        bot.moveX = mx / mMag;
        bot.moveY = my / mMag;
      }

      // Bot spell tactics
      if (now > bot.botNextActionTime) {
        bot.botNextActionTime = now + 450 + Math.random() * 500;

        // If high mana and low health, try shield
        if (bot.health < 40 && bot.cooldowns.shield <= 0 && bot.mana >= SPELL_CONFIGS.shield.manaCost && Math.random() < 0.6) {
          bot.activeSpell = 'shield';
          bot.isFiring = true;
        } else if (nearestDist > 380 && bot.cooldowns.lightning <= 0 && bot.mana >= SPELL_CONFIGS.lightning.manaCost && Math.random() < 0.5) {
          bot.activeSpell = 'lightning';
          bot.isFiring = true;
        } else if (target.slowTimer <= 0 && bot.cooldowns.frost <= 0 && bot.mana >= SPELL_CONFIGS.frost.manaCost && Math.random() < 0.55) {
          bot.activeSpell = 'frost';
          bot.isFiring = true;
        } else if (bot.cooldowns.fireball <= 0 && bot.mana >= SPELL_CONFIGS.fireball.manaCost) {
          bot.activeSpell = 'fireball';
          bot.isFiring = true;
        }
      }
    }
  }

  private buildSnapshot(
    room: ReturnType<typeof this.rooms.get> extends infer T ? NonNullable<T> : never,
  ): GameWorldState {
    const players: GamePlayerState[] = Array.from(room.players.values()).map((p) => ({
      id: p.id,
      name: p.name,
      colorIndex: p.colorIndex,
      posX: p.posX,
      posY: p.posY,
      facingAngle: p.facingAngle,
      health: p.health,
      maxHealth: p.maxHealth,
      mana: Math.floor(p.mana),
      maxMana: p.maxMana,
      kills: p.kills,
      deaths: p.deaths,
      score: p.score,
      damageDealt: p.damageDealt || 0,
      team: p.team || 'none',
      isAdmin: p.isAdmin || false,
      hasShield: p.hasShield,
      shieldDuration: p.shieldDuration,
      isAlive: p.isAlive,
      activeSpell: p.activeSpell,
      cooldowns: { ...p.cooldowns },
      isBot: p.isBot,
      isDashing: p.isDashing,
      dashTimer: p.dashTimer,
      hitFlashTimer: p.hitFlashTimer,
    }));

    return {
      workspaceId: room.workspaceId,
      zoneId: room.zoneId,
      mapId: room.mapId,
      mapWidth: room.map.width,
      mapHeight: room.map.height,
      obstacles: room.map.obstacles,
      players,
      projectiles: room.projectiles,
      visualEffects: room.visualEffects,
      killFeed: room.killFeed,
      matchState: room.matchState,
      matchTimer: room.matchTimer,
      roundResetTimer: room.roundResetTimer,
      winnerId: room.winnerId,
      matchDuration: room.matchDuration,
      matchTimeRemaining: room.matchTimeRemaining,
      hostId: room.hostId,
      gameMode: room.gameMode,
      teamScores: { ...room.teamScores },
    };
  }
}
