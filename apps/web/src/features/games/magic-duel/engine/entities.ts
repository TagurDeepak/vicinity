/**
 * Magic Duel - Game Entities & Physics
 */

import { GAME_CONFIG, SPELLS, type Obstacle } from './config';

export function circleIntersectsRect(
  cx: number,
  cy: number,
  r: number,
  rx: number,
  ry: number,
  rw: number,
  rh: number,
): boolean {
  const closestX = Math.max(rx, Math.min(cx, rx + rw));
  const closestY = Math.max(ry, Math.min(cy, ry + rh));
  const distX = cx - closestX;
  const distY = cy - closestY;
  return distX * distX + distY * distY < r * r;
}

export function circleIntersectsCircle(
  c1x: number,
  c1y: number,
  r1: number,
  c2x: number,
  c2y: number,
  r2: number,
): boolean {
  const distSq = (c1x - c2x) ** 2 + (c1y - c2y) ** 2;
  const radSum = r1 + r2;
  return distSq < radSum * radSum;
}

export interface DashTrail {
  x: number;
  y: number;
  angle: number;
  alpha: number;
}

export class PlayerEntity {
  id: string;
  name: string;
  colorIndex: number; // 0: Player Blue, 1: Bot Red
  isBot: boolean;

  x: number;
  y: number;
  facingAngle: number;

  health: number;
  maxHealth: number;
  healthLag: number;

  mana: number;
  maxMana: number;

  kills: number;
  deaths: number;
  score: number;
  damageDealt: number;
  team: 'blue' | 'red' | 'none';
  isAdmin: boolean;

  isAlive: boolean;
  respawnTimer: number;

  isDashing: boolean;
  dashTimer: number;
  dashCooldownTimer: number;

  hasShield: boolean;
  shieldDuration: number;

  slowTimer: number;
  slowFactor: number;

  hitFlashTimer: number;

  cooldowns: Record<string, number>;
  dashTrails: DashTrail[];

  constructor(
    id: string,
    name: string,
    colorIndex: number,
    spawnX: number,
    spawnY: number,
    isBot = false,
  ) {
    this.id = id;
    this.name = name;
    this.colorIndex = colorIndex;
    this.isBot = isBot;

    this.x = spawnX;
    this.y = spawnY;
    this.facingAngle = 0;

    this.health = GAME_CONFIG.MAX_HEALTH;
    this.maxHealth = GAME_CONFIG.MAX_HEALTH;
    this.healthLag = GAME_CONFIG.MAX_HEALTH;

    this.mana = GAME_CONFIG.MAX_MANA;
    this.maxMana = GAME_CONFIG.MAX_MANA;

    this.kills = 0;
    this.deaths = 0;
    this.score = 0;
    this.damageDealt = 0;
    this.team = isBot ? 'red' : 'blue';
    this.isAdmin = false;

    this.isAlive = true;
    this.respawnTimer = 0;

    this.isDashing = false;
    this.dashTimer = 0;
    this.dashCooldownTimer = 0;

    this.hasShield = true;
    this.shieldDuration = 2.0;

    this.slowTimer = 0;
    this.slowFactor = 1.0;

    this.hitFlashTimer = 0;

    this.cooldowns = {
      fireball: 0,
      frost: 0,
      lightning: 0,
      shield: 0,
      dash: 0,
    };

    this.dashTrails = [];
  }

  update(dt: number, _obstacles: Obstacle[], mapWidth: number, mapHeight: number) {
    if (!this.isAlive) {
      this.respawnTimer -= dt;
      if (this.respawnTimer <= 0) {
        this.respawn(mapWidth, mapHeight);
      }
      return;
    }

    // Passive Mana Regen
    if (this.mana < this.maxMana) {
      this.mana = Math.min(this.maxMana, this.mana + GAME_CONFIG.MANA_REGEN_PER_SEC * dt);
    }

    // Health Lag Catchup (red bar decay)
    if (this.healthLag > this.health) {
      this.healthLag = Math.max(
        this.health,
        this.healthLag - GAME_CONFIG.DAMAGE_LAG_DRAIN_SPEED * dt,
      );
    }

    // Hit Flash
    if (this.hitFlashTimer > 0) {
      this.hitFlashTimer = Math.max(0, this.hitFlashTimer - dt * 5);
    }

    // Cooldown Ticks
    for (const key in this.cooldowns) {
      if ((this.cooldowns[key] ?? 0) > 0) {
        this.cooldowns[key] = Math.max(0, (this.cooldowns[key] ?? 0) - dt);
      }
    }

    // Shield Timer
    if (this.shieldDuration > 0) {
      this.shieldDuration -= dt;
      if (this.shieldDuration <= 0) {
        this.hasShield = false;
      }
    }

    // Slow Status
    if (this.slowTimer > 0) {
      this.slowTimer -= dt;
      if (this.slowTimer <= 0) {
        this.slowFactor = 1.0;
      }
    }

    // Dash Timer & Trails
    if (this.isDashing) {
      this.dashTimer -= dt;
      this.dashTrails.push({ x: this.x, y: this.y, angle: this.facingAngle, alpha: 0.6 });
      if (this.dashTimer <= 0) {
        this.isDashing = false;
      }
    }

    // Update Dash Ghost Trails
    for (let i = this.dashTrails.length - 1; i >= 0; i--) {
      const trail = this.dashTrails[i];
      if (!trail) continue;
      trail.alpha -= dt * 3.5;
      if (trail.alpha <= 0) {
        this.dashTrails.splice(i, 1);
      }
    }
  }

  move(
    dx: number,
    dy: number,
    dt: number,
    obstacles: Obstacle[],
    mapWidth: number,
    mapHeight: number,
  ) {
    if (!this.isAlive) return;
    if (dx === 0 && dy === 0) return;

    let speed = this.isDashing ? GAME_CONFIG.DASH_SPEED : GAME_CONFIG.PLAYER_SPEED;
    speed *= this.slowFactor;

    const r = GAME_CONFIG.PLAYER_RADIUS;

    // Move X
    let nextX = this.x + dx * speed * dt;
    nextX = Math.max(r + 15, Math.min(mapWidth - r - 15, nextX));
    let collidesX = false;
    for (const obs of obstacles) {
      if (circleIntersectsRect(nextX, this.y, r, obs.x, obs.y, obs.w, obs.h)) {
        collidesX = true;
        break;
      }
    }
    if (!collidesX) {
      this.x = nextX;
    }

    // Move Y
    let nextY = this.y + dy * speed * dt;
    nextY = Math.max(r + 15, Math.min(mapHeight - r - 15, nextY));
    let collidesY = false;
    for (const obs of obstacles) {
      if (circleIntersectsRect(this.x, nextY, r, obs.x, obs.y, obs.w, obs.h)) {
        collidesY = true;
        break;
      }
    }
    if (!collidesY) {
      this.y = nextY;
    }
  }

  triggerDash(): boolean {
    if (
      this.isDashing ||
      (this.cooldowns.dash ?? 0) > 0 ||
      this.mana < (SPELLS.dash?.manaCost ?? 18)
    ) {
      return false;
    }
    this.mana -= SPELLS.dash?.manaCost ?? 18;
    this.cooldowns.dash = GAME_CONFIG.DASH_COOLDOWN;
    this.isDashing = true;
    this.dashTimer = GAME_CONFIG.DASH_DURATION;
    return true;
  }

  triggerShield(): boolean {
    if (this.hasShield || (this.cooldowns.shield ?? 0) > 0) return false;
    this.hasShield = true;
    this.shieldDuration = SPELLS.shield?.duration ?? 3.0;
    this.cooldowns.shield = SPELLS.shield?.cooldown ?? 4.0;
    return true;
  }

  takeDamage(
    amount: number,
    spellType: string,
  ): { absorbed: boolean; killed: boolean; damageDealt: number } {
    if (!this.isAlive) return { absorbed: false, killed: false, damageDealt: 0 };

    if (this.hasShield) {
      this.hasShield = false;
      this.shieldDuration = 0;
      return { absorbed: true, killed: false, damageDealt: 0 };
    }

    this.health = Math.max(0, this.health - amount);
    this.hitFlashTimer = 1.0;

    if (spellType === 'frost') {
      this.slowTimer = SPELLS.frost?.slowDuration ?? 2.5;
      this.slowFactor = SPELLS.frost?.slowFactor ?? 0.5;
    }

    if (this.health <= 0) {
      this.isAlive = false;
      this.deaths += 1;
      this.respawnTimer = 2.5;
      return { absorbed: false, killed: true, damageDealt: amount };
    }

    return { absorbed: false, killed: false, damageDealt: amount };
  }

  respawn(mapWidth: number, mapHeight: number) {
    this.health = this.maxHealth;
    this.healthLag = this.maxHealth;
    this.mana = this.maxMana;
    this.isAlive = true;
    this.hasShield = true;
    this.shieldDuration = 2.5;
    this.slowTimer = 0;
    this.slowFactor = 1.0;

    // Pick safer spawn away from edges
    if (this.isBot) {
      this.x = mapWidth - 400;
      this.y = mapHeight - 400;
      this.facingAngle = 180;
    } else {
      this.x = 400;
      this.y = 400;
      this.facingAngle = 0;
    }
  }
}

export class Projectile {
  id: number;
  ownerId: string;
  spellType: string;
  x: number;
  y: number;
  velX: number;
  velY: number;
  speed: number;
  radius: number;
  damage: number;
  lifetime: number;
  color: string;
  facingAngle: number;
  team: 'blue' | 'red' | 'none';

  constructor(
    id: number,
    ownerId: string,
    spellType: string,
    spawnX: number,
    spawnY: number,
    angleDeg: number,
    team: 'blue' | 'red' | 'none' = 'none',
  ) {
    const def = SPELLS[spellType] ?? SPELLS.fireball!;
    this.id = id;
    this.ownerId = ownerId;
    this.spellType = spellType;
    this.speed = def.speed ?? 540;
    this.radius = def.radius ?? 14;
    this.damage = def.damage ?? 20;
    this.lifetime = def.lifetime ?? 3.0;
    this.color = def.color;
    this.facingAngle = angleDeg;
    this.team = team;

    const rad = (angleDeg * Math.PI) / 180;
    this.velX = Math.cos(rad) * this.speed;
    this.velY = Math.sin(rad) * this.speed;

    // Offset spawn slightly in front of wizard
    this.x = spawnX + Math.cos(rad) * 36;
    this.y = spawnY + Math.sin(rad) * 36;
  }

  update(dt: number) {
    this.x += this.velX * dt;
    this.y += this.velY * dt;
    this.lifetime -= dt;
  }
}
