/**
 * Magic Duel - Game Configuration & Arena Data
 * Matches standalone PC specifications
 */

import { ARENA_MAPS as SHARED_ARENA_MAPS, type ArenaMapData } from '@vicinity/shared';

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

export type ArenaMap = ArenaMapData;

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

export const ARENA_MAPS: Record<string, ArenaMap> = SHARED_ARENA_MAPS;
