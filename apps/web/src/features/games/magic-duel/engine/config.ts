/**
 * Magic Duel - Game Configuration & Arena Data
 * Matches standalone PC specifications
 */

export interface SpellDefinition {
  id: 'fireball' | 'frost' | 'lightning' | 'shield' | 'dash';
  name: string;
  hotkey: string;
  manaCost: number;
  cooldown: number;
  damage?: number;
  speed?: number;
  radius?: number;
  lifetime?: number;
  duration?: number;
  slowFactor?: number;
  slowDuration?: number;
  color: string;
  glowColor?: string;
  icon: string;
}

export interface Obstacle {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface SpawnPoint {
  x: number;
  y: number;
}

export interface TorchPoint {
  x: number;
  y: number;
}

export interface ArenaMap {
  id: 'catacombs' | 'forest-ruins' | 'lava-citadel';
  name: string;
  subtitle: string;
  floorTexture: string;
  wallTexture: string;
  width: number;
  height: number;
  obstacles: Obstacle[];
  spawnPoints: SpawnPoint[];
  torches: TorchPoint[];
}

export const GAME_CONFIG = {
  // Arena
  WORLD_WIDTH: 2000,
  WORLD_HEIGHT: 1400,

  // Player
  PLAYER_RADIUS: 24,
  PLAYER_SPEED: 260,
  DASH_SPEED: 720,
  DASH_DURATION: 0.18,
  DASH_COOLDOWN: 2.2,
  MAX_HEALTH: 100,
  MAX_MANA: 100,
  MANA_REGEN_PER_SEC: 12,
  DAMAGE_LAG_DRAIN_SPEED: 45, // HP red bar catch-up rate

  // Audio / FX
  TICK_RATE: 60,
};

export const SPELLS: Record<string, SpellDefinition> = {
  fireball: {
    id: 'fireball',
    name: 'Fireball',
    hotkey: '1',
    manaCost: 15,
    cooldown: 0.8,
    damage: 20,
    speed: 480,
    radius: 14,
    lifetime: 3.5,
    color: '#f97316',
    glowColor: 'rgba(249, 115, 22, 0.4)',
    icon: '/magic-duel/textures/spell_fire.png',
  },
  frost: {
    id: 'frost',
    name: 'Frost Shard',
    hotkey: '2',
    manaCost: 12,
    cooldown: 0.55,
    damage: 15,
    speed: 420,
    radius: 12,
    lifetime: 3.5,
    slowFactor: 0.5,
    slowDuration: 2.0,
    color: '#38bdf8',
    glowColor: 'rgba(56, 189, 248, 0.4)',
    icon: '/magic-duel/textures/spell_frost.png',
  },
  lightning: {
    id: 'lightning',
    name: 'Lightning Bolt',
    hotkey: '3',
    manaCost: 25,
    cooldown: 1.3,
    damage: 30,
    speed: 850,
    radius: 8,
    lifetime: 1.2,
    color: '#c084fc',
    glowColor: 'rgba(192, 132, 252, 0.5)',
    icon: '/magic-duel/textures/spell_lightning.png',
  },
  shield: {
    id: 'shield',
    name: 'Arcane Shield',
    hotkey: '4',
    manaCost: 20,
    cooldown: 3.5,
    duration: 2.5,
    color: '#06b6d4',
    glowColor: 'rgba(6, 182, 212, 0.4)',
    icon: '/magic-duel/textures/spell_shield.png',
  },
  dash: {
    id: 'dash',
    name: 'Blink Dash',
    hotkey: 'SPC',
    manaCost: 18,
    cooldown: 2.2,
    duration: 0.18,
    color: '#a855f7',
    icon: '/magic-duel/textures/spell_dash.png',
  },
};

export const ARENA_MAPS: Record<string, ArenaMap> = {
  catacombs: {
    id: 'catacombs',
    name: 'Crypt of Whispers',
    subtitle: 'Underground Catacombs',
    floorTexture: '/magic-duel/textures/stone_floor.png',
    wallTexture: '/magic-duel/textures/stone_wall.png',
    width: 2000,
    height: 1400,
    obstacles: [
      { x: 580, y: 380, w: 120, h: 120 },
      { x: 1300, y: 380, w: 120, h: 120 },
      { x: 580, y: 900, w: 120, h: 120 },
      { x: 1300, y: 900, w: 120, h: 120 },
      { x: 940, y: 640, w: 120, h: 120 },
      { x: 260, y: 550, w: 90, h: 300 },
      { x: 1650, y: 550, w: 90, h: 300 },
    ],
    spawnPoints: [
      { x: 380, y: 380 },
      { x: 1620, y: 1020 },
    ],
    torches: [
      { x: 580, y: 350 },
      { x: 1420, y: 350 },
      { x: 580, y: 1050 },
      { x: 1420, y: 1050 },
      { x: 1000, y: 220 },
      { x: 1000, y: 1180 },
    ],
  },
  'forest-ruins': {
    id: 'forest-ruins',
    name: 'Verdant Sanctum',
    subtitle: 'Ancient Forest Ruins',
    floorTexture: '/magic-duel/textures/forest_floor.png',
    wallTexture: '/magic-duel/textures/stone_wall.png',
    width: 2200,
    height: 1500,
    obstacles: [
      { x: 500, y: 400, w: 160, h: 100 },
      { x: 1540, y: 400, w: 160, h: 100 },
      { x: 500, y: 1000, w: 160, h: 100 },
      { x: 1540, y: 1000, w: 160, h: 100 },
      { x: 950, y: 600, w: 300, h: 300 },
    ],
    spawnPoints: [
      { x: 300, y: 300 },
      { x: 1900, y: 1200 },
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
    floorTexture: '/magic-duel/textures/lava_floor.png',
    wallTexture: '/magic-duel/textures/stone_wall.png',
    width: 2000,
    height: 1400,
    obstacles: [
      { x: 450, y: 400, w: 180, h: 140 },
      { x: 1370, y: 400, w: 180, h: 140 },
      { x: 450, y: 860, w: 180, h: 140 },
      { x: 1370, y: 860, w: 180, h: 140 },
      { x: 910, y: 610, w: 180, h: 180 },
    ],
    spawnPoints: [
      { x: 260, y: 260 },
      { x: 1740, y: 1140 },
    ],
    torches: [
      { x: 450, y: 390 },
      { x: 1550, y: 390 },
      { x: 450, y: 1010 },
      { x: 1550, y: 1010 },
    ],
  },
};
