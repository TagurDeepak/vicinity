import type { Rect, Vec2 } from './models';

export type SpellType = 'fireball' | 'frost' | 'lightning' | 'shield' | 'dash';

export type GameMapTheme = 'catacombs' | 'forest-ruins' | 'lava-citadel';

export interface SpellConfig {
  type: SpellType;
  displayName: string;
  damage: number;
  cooldown: number; // in seconds
  speed: number;    // px per second
  manaCost: number;
  radius: number;
  textureName: string;
}

export const SPELL_CONFIGS: Record<SpellType, SpellConfig> = {
  fireball: {
    type: 'fireball',
    displayName: 'Fireball',
    damage: 20,
    cooldown: 0.8,
    speed: 480,
    manaCost: 15,
    radius: 14,
    textureName: 'spell_fire.png',
  },
  frost: {
    type: 'frost',
    displayName: 'Frost Shard',
    damage: 15,
    cooldown: 0.55,
    speed: 420,
    manaCost: 12,
    radius: 12,
    textureName: 'spell_frost.png',
  },
  lightning: {
    type: 'lightning',
    displayName: 'Lightning Bolt',
    damage: 30,
    cooldown: 1.3,
    speed: 850,
    manaCost: 25,
    radius: 10,
    textureName: 'spell_lightning.png',
  },
  shield: {
    type: 'shield',
    displayName: 'Arcane Shield',
    damage: 0,
    cooldown: 4.0,
    speed: 0,
    manaCost: 20,
    radius: 28,
    textureName: 'spell_shield.png',
  },
  dash: {
    type: 'dash',
    displayName: 'Wind Dash',
    damage: 0,
    cooldown: 2.0,
    speed: 720,
    manaCost: 15,
    radius: 20,
    textureName: 'spell_dash.png',
  },
};

export interface GamePlayerState {
  id: string;
  name: string;
  colorIndex: number;
  posX: number;
  posY: number;
  facingAngle: number;
  health: number;
  maxHealth: number;
  mana: number;
  maxMana: number;
  kills: number;
  deaths: number;
  score: number;
  damageDealt?: number;
  hasShield: boolean;
  shieldDuration: number;
  isAlive: boolean;
  activeSpell: SpellType;
  cooldowns: Record<SpellType, number>;
  isBot: boolean;
  isDashing: boolean;
  dashTimer: number;
  hitFlashTimer: number;
  team?: 'blue' | 'red' | 'none';
  isAdmin?: boolean;
}

export interface GameProjectile {
  id: number;
  ownerId: string;
  posX: number;
  posY: number;
  velX: number;
  velY: number;
  spellType: SpellType;
  damage: number;
  radius: number;
  lifetime: number;
  team?: 'blue' | 'red' | 'none';
}

export type VisualEffectType =
  | 'cast_aura'
  | 'impact_shockwave'
  | 'spark_explosion'
  | 'spell_clash';

export interface GameVisualEffect {
  id: string;
  type: VisualEffectType;
  x: number;
  y: number;
  color: string;
  duration: number;
  createdAt: number;
}

export interface GameKillFeedItem {
  id: string;
  killerName: string;
  victimName: string;
  spellType: SpellType;
  timestamp: number;
}

export interface ArenaMapData {
  id: GameMapTheme;
  name: string;
  subtitle: string;
  description: string;
  width: number;
  height: number;
  floorTexture: string;
  wallTexture: string;
  obstacles: Rect[];
  spawnPoints: Vec2[];
  torchPositions: Vec2[];
  torches?: Vec2[];
}

export const ARENA_MAPS: Record<GameMapTheme, ArenaMapData> = {
  catacombs: {
    id: 'catacombs',
    name: 'Crypt of Whispers',
    subtitle: 'Underground Catacombs',
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
      { x: 1000, y: 220 },
      { x: 1000, y: 1180 },
    ],
    torches: [
      { x: 600, y: 390 },
      { x: 1400, y: 390 },
      { x: 600, y: 1010 },
      { x: 1400, y: 1010 },
      { x: 1000, y: 220 },
      { x: 1000, y: 1180 },
    ],
  },
  'forest-ruins': {
    id: 'forest-ruins',
    name: 'Verdant Sanctum',
    subtitle: 'Ancient Forest Ruins',
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
    torches: [
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
    torches: [
      { x: 450, y: 390 },
      { x: 1550, y: 390 },
      { x: 450, y: 1010 },
      { x: 1550, y: 1010 },
    ],
  },
};

export interface GameWorldState {
  workspaceId: string;
  zoneId: string;
  mapId: GameMapTheme;
  mapWidth: number;
  mapHeight: number;
  obstacles: Rect[];
  players: GamePlayerState[];
  projectiles: GameProjectile[];
  visualEffects: GameVisualEffect[];
  killFeed: GameKillFeedItem[];
  matchState: 'waiting' | 'in_progress' | 'ended';
  matchTimer: number;
  matchDuration?: number;
  matchTimeRemaining?: number;
  roundResetTimer: number;
  winnerId: string | null;
  hostId?: string | null;
  gameMode?: 'ffa' | 'teams';
  teamScores?: { blue: number; red: number };
}

export interface GameClientInput {
  moveX: number;
  moveY: number;
  facingAngle: number;
  activeSpell: SpellType;
  isFiring: boolean;
  isDashing: boolean;
}
