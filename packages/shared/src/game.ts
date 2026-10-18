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
  hasShield: boolean;
  shieldDuration: number;
  isAlive: boolean;
  activeSpell: SpellType;
  cooldowns: Record<SpellType, number>;
  isBot: boolean;
  isDashing: boolean;
  dashTimer: number;
  hitFlashTimer: number;
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
}

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
  roundResetTimer: number;
  winnerId: string | null;
}

export interface GameClientInput {
  moveX: number;
  moveY: number;
  facingAngle: number;
  activeSpell: SpellType;
  isFiring: boolean;
  isDashing: boolean;
}
