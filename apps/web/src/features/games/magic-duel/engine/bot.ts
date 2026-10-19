/**
 * Magic Duel - Intelligent Sparring Bot AI
 */

import { type Obstacle } from './config';
import { type PlayerEntity, type Projectile } from './entities';

export class BotAI {
  bot: PlayerEntity;
  shootTimer: number;
  strafeDir: number;
  strafeChangeTimer: number;

  constructor(botEntity: PlayerEntity) {
    this.bot = botEntity;
    this.shootTimer = 0.6;
    this.strafeDir = 1;
    this.strafeChangeTimer = 2.0;
  }

  update(
    dt: number,
    playerEntity: PlayerEntity,
    projectiles: Projectile[],
    obstacles: Obstacle[],
    mapWidth: number,
    mapHeight: number,
    spawnProjectile: (
      ownerId: string,
      spellType: string,
      x: number,
      y: number,
      angleDeg: number,
    ) => void,
  ) {
    if (!this.bot.isAlive || !playerEntity.isAlive) return;

    const b = this.bot;
    const p = playerEntity;

    const dx = p.x - b.x;
    const dy = p.y - b.y;
    const dist = Math.hypot(dx, dy);

    // 1. Aim towards player
    const aimAngle = ((Math.atan2(dy, dx) * 180) / Math.PI + 360) % 360;
    b.facingAngle = aimAngle;

    // 2. Defensive Dash: check for dangerous incoming projectiles
    let dodgeX = 0;
    let dodgeY = 0;
    let underThreat = false;

    for (const proj of projectiles) {
      if (proj.ownerId === b.id) continue;
      const pdx = b.x - proj.x;
      const pdy = b.y - proj.y;
      const pdist = Math.hypot(pdx, pdy);

      if (pdist < 180) {
        // Projectile is close! Check if heading towards bot
        const dot = proj.velX * pdx + proj.velY * pdy;
        if (dot > 0) {
          underThreat = true;
          // Perpendicular dodge
          const vMag = Math.hypot(proj.velX, proj.velY) || 1;
          dodgeX += -proj.velY / vMag;
          dodgeY += proj.velX / vMag;
        }
      }
    }

    if (underThreat && (b.cooldowns.dash ?? 0) <= 0 && Math.random() < 0.6) {
      b.triggerDash();
    }

    if (b.health < 40 && (b.cooldowns.shield ?? 0) <= 0 && Math.random() < 0.75) {
      b.triggerShield();
    }

    // 3. Movement Behavior: circle and strafe at optimal distance (360 - 520px)
    this.strafeChangeTimer -= dt;
    if (this.strafeChangeTimer <= 0) {
      this.strafeDir *= -1;
      this.strafeChangeTimer = 1.5 + Math.random() * 2.0;
    }

    let moveX = 0;
    let moveY = 0;

    if (underThreat) {
      moveX = dodgeX;
      moveY = dodgeY;
    } else {
      // Ideal range
      const idealDist = 420;
      const distError = dist - idealDist;

      // Radial component (approach or retreat)
      const radialX = (dx / (dist || 1)) * Math.sign(distError);
      const radialY = (dy / (dist || 1)) * Math.sign(distError);

      // Tangential component (strafing)
      const tangX = (-dy / (dist || 1)) * this.strafeDir;
      const tangY = (dx / (dist || 1)) * this.strafeDir;

      moveX = radialX * 0.4 + tangX * 0.8;
      moveY = radialY * 0.4 + tangY * 0.8;
    }

    const moveMag = Math.hypot(moveX, moveY);
    if (moveMag > 0) {
      moveX /= moveMag;
      moveY /= moveMag;
    }

    b.move(moveX, moveY, dt, obstacles, mapWidth, mapHeight);

    // 4. Attack Spells Selection & Firing
    this.shootTimer -= dt;
    if (this.shootTimer <= 0 && dist < 700) {
      let chosenSpell: string | null = null;

      if (dist > 420 && (b.cooldowns.lightning ?? 0) <= 0 && b.mana >= 25 && Math.random() < 0.45) {
        chosenSpell = 'lightning';
        b.mana -= 25;
        b.cooldowns.lightning = 0.85;
      } else if (p.slowTimer <= 0 && (b.cooldowns.frost ?? 0) <= 0 && b.mana >= 12 && Math.random() < 0.5) {
        chosenSpell = 'frost';
        b.mana -= 12;
        b.cooldowns.frost = 0.55;
      } else if ((b.cooldowns.fireball ?? 0) <= 0 && b.mana >= 15) {
        chosenSpell = 'fireball';
        b.mana -= 15;
        b.cooldowns.fireball = 0.45;
      }

      // Only fire if a spell was actually ready and cast
      if (chosenSpell) {
        const aimJitter = (Math.random() - 0.5) * 8;
        spawnProjectile(b.id, chosenSpell, b.x, b.y, aimAngle + aimJitter);
      }

      // Always reset shoot timer with realistic human-like cadence (0.55s - 0.95s between casts)
      this.shootTimer = 0.55 + Math.random() * 0.4;
    }
  }
}
