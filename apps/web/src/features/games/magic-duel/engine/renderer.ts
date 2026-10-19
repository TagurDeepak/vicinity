/**
 * Magic Duel - Canvas 2D Renderer
 * Renders textures + procedural fallbacks with 60-144 FPS smoothness
 */

import { ARENA_MAPS, type ArenaMap, type TorchPoint, type Obstacle } from './config';
import { type Camera } from './camera';
import { type PlayerEntity, type Projectile } from './entities';

export interface VisualEffect {
  x: number;
  y: number;
  type: string;
  color: string;
  age: number;
  duration: number;
}

export interface FloatingNumber {
  x: number;
  y: number;
  text: string;
  color: string;
  age: number;
  duration: number;
}

export class GameRenderer {
  canvas: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;
  textures: {
    loaded: boolean;
    wizards: HTMLImageElement[];
    avatarP1: HTMLImageElement | null;
    avatarP2: HTMLImageElement | null;
    spells: Record<string, HTMLImageElement>;
    floors: Record<string, HTMLImageElement>;
    walls: HTMLImageElement | null;
    pillar: HTMLImageElement | null;
    torch: HTMLImageElement | null;
    heart: HTMLImageElement | null;
    mana: HTMLImageElement | null;
    skull: HTMLImageElement | null;
    crown: HTMLImageElement | null;
    radarBezel: HTMLImageElement | null;
    vignetteDanger: HTMLImageElement | null;
  };
  floorPatterns: Map<string, CanvasPattern>;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Could not get 2d canvas context');
    this.ctx = ctx;

    this.textures = {
      loaded: false,
      wizards: [],
      avatarP1: null,
      avatarP2: null,
      spells: {},
      floors: {},
      walls: null,
      pillar: null,
      torch: null,
      heart: null,
      mana: null,
      skull: null,
      crown: null,
      radarBezel: null,
      vignetteDanger: null,
    };
    this.floorPatterns = new Map();
    this.preloadTextures();
  }

  preloadTextures() {
    if (typeof window === 'undefined') return;

    const load = (src: string): Promise<HTMLImageElement | null> =>
      new Promise((resolve) => {
        const img = new Image();
        img.src = src;
        img.onload = () => resolve(img);
        img.onerror = () => resolve(null);
      });

    const promises: Promise<unknown>[] = [];

    // Official Player (Blue) and Bot (Red) Avatars
    promises.push(
      load('/magic-duel/textures/avatar_p1.png').then((img) => (this.textures.avatarP1 = img)),
    );
    promises.push(
      load('/magic-duel/textures/avatar_p2.png').then((img) => (this.textures.avatarP2 = img)),
    );

    // Spells
    const spells = ['fire', 'frost', 'lightning', 'shield', 'dash'];
    for (const s of spells) {
      promises.push(
        load(`/magic-duel/textures/spell_${s}.png`).then((img) => {
          if (img) this.textures.spells[s] = img;
        }),
      );
    }

    // Floors
    promises.push(
      load('/magic-duel/textures/stone_floor.png').then((img) => {
        if (img) this.textures.floors['catacombs'] = img;
      }),
    );
    promises.push(
      load('/magic-duel/textures/forest_floor.png').then((img) => {
        if (img) this.textures.floors['forest-ruins'] = img;
      }),
    );
    promises.push(
      load('/magic-duel/textures/lava_floor.png').then((img) => {
        if (img) this.textures.floors['lava-citadel'] = img;
      }),
    );

    // Obstacles & Decor
    promises.push(
      load('/magic-duel/textures/stone_wall.png').then((img) => (this.textures.walls = img)),
    );
    promises.push(
      load('/magic-duel/textures/pillar.png').then((img) => (this.textures.pillar = img)),
    );
    promises.push(
      load('/magic-duel/textures/torch.png').then((img) => (this.textures.torch = img)),
    );
    promises.push(
      load('/magic-duel/textures/icon_heart.png').then((img) => (this.textures.heart = img)),
    );
    promises.push(
      load('/magic-duel/textures/icon_mana.png').then((img) => (this.textures.mana = img)),
    );
    promises.push(
      load('/magic-duel/textures/icon_skull.png').then((img) => (this.textures.skull = img)),
    );
    promises.push(
      load('/magic-duel/textures/icon_crown.png').then((img) => (this.textures.crown = img)),
    );
    promises.push(
      load('/magic-duel/textures/radar_bezel.png').then(
        (img) => (this.textures.radarBezel = img),
      ),
    );
    promises.push(
      load('/magic-duel/textures/vignette_danger.png').then(
        (img) => (this.textures.vignetteDanger = img),
      ),
    );

    void Promise.all(promises).then(() => {
      this.textures.loaded = true;
    });
  }

  render(
    camera: Camera,
    currentMapId: string,
    players: PlayerEntity[],
    projectiles: Projectile[],
    visualEffects: VisualEffect[],
    floatingNumbers: FloatingNumber[],
    localPlayer: PlayerEntity | null,
  ) {
    const ctx = this.ctx;
    const width = this.canvas.width;
    const height = this.canvas.height;
    const map = ARENA_MAPS[currentMapId] || ARENA_MAPS.catacombs!;

    // Clear Screen
    ctx.fillStyle = '#090d16';
    ctx.fillRect(0, 0, width, height);

    // Begin Camera World Transform
    camera.apply(ctx);

    // 1. Render Floor
    this.renderFloor(ctx, map, currentMapId);

    // 2. Render Torches (Background layer)
    this.renderTorches(ctx, map.torches || []);

    // 3. Render Obstacles & Pillars
    this.renderObstacles(ctx, map.obstacles || []);

    // 4. Render Projectiles
    this.renderProjectiles(ctx, projectiles);

    // 5. Render Wizards
    for (const player of players) {
      const isLocal = localPlayer ? player.id === localPlayer.id : !player.isBot;
      this.renderWizard(ctx, player, isLocal);
    }

    // 6. Render Visual Effects (Explosions & Impact Rings)
    this.renderEffects(ctx, visualEffects);

    // 7. Render Floating Combat Text in World Space
    this.renderFloatingText(ctx, floatingNumbers);

    // End Camera World Transform
    camera.restore(ctx);

    // 8. Screen Space HUD Elements (Minimap & Low HP Vignette)
    this.renderScreenOverlays(ctx, width, height, map, players, localPlayer);
  }

  renderFloor(ctx: CanvasRenderingContext2D, map: ArenaMap, mapId: string) {
    const floorImg = this.textures.floors[mapId];

    if (floorImg && floorImg.complete && floorImg.naturalWidth > 0) {
      let pattern = this.floorPatterns.get(mapId);
      if (!pattern) {
        const pat = ctx.createPattern(floorImg, 'repeat');
        if (pat) {
          this.floorPatterns.set(mapId, pat);
          pattern = pat;
        }
      }
      if (pattern) {
        ctx.fillStyle = pattern;
        ctx.fillRect(0, 0, map.width, map.height);
      }
    } else {
      // Procedural Floor Fallback
      ctx.fillStyle =
        mapId === 'lava-citadel'
          ? '#1c1917'
          : mapId === 'forest-ruins'
            ? '#142517'
            : '#1e2230';
      ctx.fillRect(0, 0, map.width, map.height);

      ctx.strokeStyle = 'rgba(255, 255, 255, 0.05)';
      ctx.lineWidth = 1;
      const gridSize = 80;
      for (let x = 0; x <= map.width; x += gridSize) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, map.height);
        ctx.stroke();
      }
      for (let y = 0; y <= map.height; y += gridSize) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(map.width, y);
        ctx.stroke();
      }
    }

    // Arena Perimeter Border Walls
    ctx.strokeStyle = '#475569';
    ctx.lineWidth = 12;
    ctx.strokeRect(0, 0, map.width, map.height);

    ctx.strokeStyle = mapId === 'lava-citadel' ? '#ef4444' : '#38bdf8';
    ctx.lineWidth = 2;
    ctx.strokeRect(8, 8, map.width - 16, map.height - 16);
  }

  renderTorches(ctx: CanvasRenderingContext2D, torches: TorchPoint[]) {
    const time = performance.now();
    for (const t of torches) {
      const flicker = Math.sin(time * 0.01 + t.x * 0.05) * 3;

      // Outer light glow
      const grad = ctx.createRadialGradient(t.x, t.y, 4, t.x, t.y, 45 + flicker);
      grad.addColorStop(0, 'rgba(251, 146, 60, 0.4)');
      grad.addColorStop(0.5, 'rgba(234, 88, 12, 0.15)');
      grad.addColorStop(1, 'rgba(0, 0, 0, 0)');
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(t.x, t.y, 45 + flicker, 0, Math.PI * 2);
      ctx.fill();

      // Torch Sconce
      if (this.textures.torch && this.textures.torch.complete && this.textures.torch.naturalWidth > 0) {
        ctx.drawImage(this.textures.torch, t.x - 12, t.y - 12, 24, 24);
      } else {
        // Procedural flame core
        ctx.fillStyle = '#fbbf24';
        ctx.beginPath();
        ctx.arc(t.x, t.y, 4 + flicker * 0.3, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }

  renderObstacles(ctx: CanvasRenderingContext2D, obstacles: Obstacle[]) {
    for (const obs of obstacles) {
      // Drop Shadow
      ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
      ctx.fillRect(obs.x + 8, obs.y + 8, obs.w, obs.h);

      // Body Texture or Fallback
      if (this.textures.walls && this.textures.walls.complete && this.textures.walls.naturalWidth > 0) {
        ctx.drawImage(this.textures.walls, obs.x, obs.y, obs.w, obs.h);
      } else {
        ctx.fillStyle = '#334155';
        ctx.fillRect(obs.x, obs.y, obs.w, obs.h);
      }

      // Border & Bevel
      ctx.strokeStyle = '#64748b';
      ctx.lineWidth = 2;
      ctx.strokeRect(obs.x, obs.y, obs.w, obs.h);
    }
  }

  renderProjectiles(ctx: CanvasRenderingContext2D, projectiles: Projectile[]) {
    for (const p of projectiles) {
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate((p.facingAngle * Math.PI) / 180);

      if (p.spellType === 'fireball') {
        // Fireball Glow
        ctx.fillStyle = 'rgba(249, 115, 22, 0.35)';
        ctx.beginPath();
        ctx.arc(0, 0, p.radius + 6, 0, Math.PI * 2);
        ctx.fill();

        // Core
        ctx.fillStyle = '#ea580c';
        ctx.beginPath();
        ctx.arc(0, 0, p.radius, 0, Math.PI * 2);
        ctx.fill();

        // Center Spark
        ctx.fillStyle = '#fef08a';
        ctx.beginPath();
        ctx.arc(2, 0, p.radius * 0.5, 0, Math.PI * 2);
        ctx.fill();
      } else if (p.spellType === 'frost') {
        // Frost Shard Diamond
        ctx.fillStyle = 'rgba(56, 189, 248, 0.4)';
        ctx.beginPath();
        ctx.arc(0, 0, p.radius + 4, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = '#38bdf8';
        ctx.beginPath();
        ctx.moveTo(p.radius * 1.4, 0);
        ctx.lineTo(-p.radius * 0.8, -p.radius * 0.7);
        ctx.lineTo(-p.radius * 0.3, 0);
        ctx.lineTo(-p.radius * 0.8, p.radius * 0.7);
        ctx.closePath();
        ctx.fill();
      } else if (p.spellType === 'lightning') {
        // Lightning Bolt
        ctx.fillStyle = 'rgba(192, 132, 252, 0.5)';
        ctx.fillRect(-20, -5, 40, 10);

        ctx.fillStyle = '#c084fc';
        ctx.fillRect(-18, -2.5, 36, 5);

        ctx.fillStyle = '#ffffff';
        ctx.fillRect(-14, -1, 28, 2);
      }

      ctx.restore();
    }
  }

  renderWizard(ctx: CanvasRenderingContext2D, player: PlayerEntity, isLocal: boolean) {
    if (!player.isAlive) {
      // Tombstone Marker
      ctx.save();
      ctx.fillStyle = 'rgba(0, 0, 0, 0.4)';
      ctx.beginPath();
      ctx.ellipse(player.x, player.y + 12, 18, 8, 0, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = '#64748b';
      ctx.font = 'bold 12px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('💀 Respawning...', player.x, player.y);
      ctx.restore();
      return;
    }

    const time = performance.now();
    const bob = Math.sin(time * 0.006) * 2;

    ctx.save();
    ctx.translate(player.x, player.y);

    // 1. Ground Shadow
    ctx.fillStyle = 'rgba(0, 0, 0, 0.45)';
    ctx.beginPath();
    ctx.ellipse(0, 18, 20, 9, 0, 0, Math.PI * 2);
    ctx.fill();

    // 2. Local Player Aiming Laser & Crosshair
    if (isLocal) {
      const rad = (player.facingAngle * Math.PI) / 180;
      ctx.save();
      ctx.strokeStyle = 'rgba(56, 189, 248, 0.4)';
      ctx.lineWidth = 1.5;
      ctx.setLineDash([4, 6]);
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(Math.cos(rad) * 450, Math.sin(rad) * 450);
      ctx.stroke();

      const crossDist = 180;
      const crossX = Math.cos(rad) * crossDist;
      const crossY = Math.sin(rad) * crossDist;
      ctx.strokeStyle = '#38bdf8';
      ctx.setLineDash([]);
      ctx.beginPath();
      ctx.arc(crossX, crossY, 7, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }

    // 3. Selection Ring on Ground
    if (isLocal) {
      ctx.strokeStyle = '#38bdf8';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.ellipse(0, 18, 24, 11, 0, 0, Math.PI * 2);
      ctx.stroke();
    } else {
      ctx.strokeStyle = 'rgba(239, 68, 68, 0.6)';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.ellipse(0, 18, 22, 10, 0, 0, Math.PI * 2);
      ctx.stroke();
    }

    // 4. Wizard Avatar Graphic
    // Player (colorIndex === 0) uses avatar_p1.png (Blue Wizard)
    // Bot (colorIndex === 1) uses avatar_p2.png (Red Wizard)
    const avatarImg = player.colorIndex === 0 ? this.textures.avatarP1 : this.textures.avatarP2;

    if (avatarImg && avatarImg.complete && avatarImg.naturalWidth > 0) {
      ctx.drawImage(avatarImg, -28, -32 + bob, 56, 56);
    } else {
      // High-detail procedural wizard fallback
      const robeColor = player.colorIndex === 0 ? '#1e40af' : '#991b1b';
      const trimColor = player.colorIndex === 0 ? '#38bdf8' : '#f59e0b';
      const hatColor = player.colorIndex === 0 ? '#172554' : '#450a0a';

      // Robe
      ctx.fillStyle = robeColor;
      ctx.beginPath();
      ctx.moveTo(-16, 16 + bob);
      ctx.quadraticCurveTo(-18, 0 + bob, -12, -8 + bob);
      ctx.lineTo(12, -8 + bob);
      ctx.quadraticCurveTo(18, 0 + bob, 16, 16 + bob);
      ctx.closePath();
      ctx.fill();

      ctx.strokeStyle = trimColor;
      ctx.lineWidth = 2;
      ctx.stroke();

      // Hat
      ctx.fillStyle = hatColor;
      ctx.beginPath();
      ctx.ellipse(0, -12 + bob, 16, 5, 0, 0, Math.PI * 2);
      ctx.fill();

      ctx.beginPath();
      ctx.moveTo(-10, -12 + bob);
      ctx.lineTo(0, -32 + bob);
      ctx.lineTo(10, -12 + bob);
      ctx.closePath();
      ctx.fill();
    }

    // 5. Wizard Staff with glowing crystal
    const rad = (player.facingAngle * Math.PI) / 180;
    const staffDist = 28;
    const sx = Math.cos(rad) * staffDist;
    const sy = Math.sin(rad) * staffDist + bob;

    ctx.strokeStyle = '#78350f';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(sx * 0.3, sy * 0.3 + 8);
    ctx.lineTo(sx, sy);
    ctx.stroke();

    const crystalColor = player.colorIndex === 0 ? '#38bdf8' : '#f97316';
    ctx.fillStyle = crystalColor;
    ctx.beginPath();
    ctx.arc(sx, sy, 5, 0, Math.PI * 2);
    ctx.fill();

    // 6. Arcane Shield Bubble
    if (player.hasShield) {
      ctx.strokeStyle = '#38bdf8';
      ctx.fillStyle = 'rgba(56, 189, 248, 0.18)';
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.arc(0, bob, 32, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    }

    ctx.restore();

    // 7. World-Space Overhead UI (Name + Mini Health Bar)
    ctx.save();
    ctx.font = 'bold 11px system-ui, sans-serif';
    ctx.textAlign = 'center';

    const displayName = (isLocal ? '⭐ ' : '') + player.name + (player.isBot ? ' [BOT]' : '');
    ctx.fillStyle = '#000000';
    ctx.fillText(displayName, player.x + 1, player.y - 43);
    ctx.fillStyle = isLocal ? '#38bdf8' : player.isBot ? '#f87171' : '#f8fafc';
    ctx.fillText(displayName, player.x, player.y - 44);

    // Mini Health Bar
    const barW = 44;
    const barH = 5;
    const barX = player.x - barW / 2;
    const barY = player.y - 39;

    ctx.fillStyle = 'rgba(15, 23, 42, 0.85)';
    ctx.fillRect(barX - 1, barY - 1, barW + 2, barH + 2);

    const hpPct = Math.max(0, player.health / player.maxHealth);
    ctx.fillStyle = hpPct > 0.5 ? '#22c55e' : hpPct > 0.25 ? '#eab308' : '#ef4444';
    ctx.fillRect(barX, barY, barW * hpPct, barH);

    ctx.restore();
  }

  renderEffects(ctx: CanvasRenderingContext2D, visualEffects: VisualEffect[]) {
    for (const fx of visualEffects) {
      const progress = fx.age / fx.duration;
      ctx.save();
      ctx.globalAlpha = Math.max(0, 1 - progress);
      ctx.fillStyle = fx.color;
      ctx.strokeStyle = fx.color;

      ctx.beginPath();
      ctx.arc(fx.x, fx.y, 10 + progress * 40, 0, Math.PI * 2);
      ctx.lineWidth = 3;
      ctx.stroke();

      ctx.restore();
    }
  }

  renderFloatingText(ctx: CanvasRenderingContext2D, floatingNumbers: FloatingNumber[]) {
    for (const fn of floatingNumbers) {
      const progress = fn.age / fn.duration;
      ctx.save();
      ctx.globalAlpha = Math.max(0, 1 - progress);
      ctx.font = 'bold 14px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillStyle = '#000000';
      ctx.fillText(fn.text, fn.x + 1, fn.y + 1);
      ctx.fillStyle = fn.color;
      ctx.fillText(fn.text, fn.x, fn.y);
      ctx.restore();
    }
  }

  renderScreenOverlays(
    ctx: CanvasRenderingContext2D,
    width: number,
    height: number,
    map: ArenaMap,
    players: PlayerEntity[],
    localPlayer: PlayerEntity | null,
  ) {
    // 1. Low Health Vignette
    if (localPlayer && localPlayer.health < 30 && localPlayer.isAlive) {
      const pulse = 0.3 + Math.sin(performance.now() * 0.007) * 0.15;
      const grad = ctx.createRadialGradient(
        width / 2,
        height / 2,
        width * 0.25,
        width / 2,
        height / 2,
        width * 0.65,
      );
      grad.addColorStop(0, 'rgba(239, 68, 68, 0)');
      grad.addColorStop(1, `rgba(239, 68, 68, ${pulse})`);

      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, width, height);
    }

    // 2. Minimap / Radar in Top-Right (Positioned below top-bar with generous padding)
    const radarSize = 140;
    const radarX = width - radarSize - 24;
    const radarY = 68;
    const cx = radarX + radarSize / 2;
    const cy = radarY + radarSize / 2;
    const radius = radarSize / 2 - 4;

    ctx.save();

    // Radar Header Label
    ctx.font = 'bold 10px system-ui, sans-serif';
    ctx.fillStyle = '#94a3b8';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'bottom';
    ctx.fillText('ARENA RADAR', cx, radarY - 6);

    // Circular Viewport & Clipping
    ctx.beginPath();
    ctx.arc(cx, cy, radius, 0, Math.PI * 2);
    ctx.save();
    ctx.clip();

    // Dark tactical background
    const bgGrad = ctx.createRadialGradient(cx, cy, 0, cx, cy, radius);
    bgGrad.addColorStop(0, 'rgba(15, 23, 42, 0.92)');
    bgGrad.addColorStop(1, 'rgba(10, 15, 30, 0.98)');
    ctx.fillStyle = bgGrad;
    ctx.fillRect(radarX, radarY, radarSize, radarSize);

    // Range rings
    ctx.strokeStyle = 'rgba(51, 65, 85, 0.45)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(cx, cy, radius * 0.35, 0, Math.PI * 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(cx, cy, radius * 0.7, 0, Math.PI * 2);
    ctx.stroke();

    // Crosshairs
    ctx.strokeStyle = 'rgba(51, 65, 85, 0.35)';
    ctx.beginPath();
    ctx.moveTo(cx - radius, cy);
    ctx.lineTo(cx + radius, cy);
    ctx.moveTo(cx, cy - radius);
    ctx.lineTo(cx, cy + radius);
    ctx.stroke();

    // Arena obstacles silhouette
    const innerMargin = 12;
    const innerW = radarSize - innerMargin * 2;
    const innerH = radarSize - innerMargin * 2;
    const scaleX = innerW / map.width;
    const scaleY = innerH / map.height;
    const offsetX = radarX + innerMargin;
    const offsetY = radarY + innerMargin;

    if (map.obstacles) {
      ctx.fillStyle = 'rgba(71, 85, 105, 0.35)';
      for (const obs of map.obstacles) {
        const ox = offsetX + obs.x * scaleX;
        const oy = offsetY + obs.y * scaleY;
        const ow = Math.max(2, obs.w * scaleX);
        const oh = Math.max(2, obs.h * scaleY);
        ctx.fillRect(ox, oy, ow, oh);
      }
    }

    // Player blips
    const now = performance.now();
    for (const p of players) {
      if (!p.isAlive) continue;
      const bx = offsetX + p.x * scaleX;
      const by = offsetY + p.y * scaleY;
      const isLocal = localPlayer ? p.id === localPlayer.id : !p.isBot;

      if (isLocal) {
        // Local Player: glowing cyan blip with direction pointer
        ctx.fillStyle = 'rgba(56, 189, 248, 0.35)';
        ctx.beginPath();
        ctx.arc(bx, by, 7, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = '#38bdf8';
        ctx.beginPath();
        ctx.arc(bx, by, 3.5, 0, Math.PI * 2);
        ctx.fill();

        // Direction pointer
        const facing = (p.facingAngle * Math.PI) / 180;
        const tipX = bx + Math.cos(facing) * 7;
        const tipY = by + Math.sin(facing) * 7;
        ctx.strokeStyle = '#38bdf8';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(bx, by);
        ctx.lineTo(tipX, tipY);
        ctx.stroke();
      } else {
        // Enemy / Bot: pulsing red blip
        const pulseRing = 5 + Math.sin(now * 0.008) * 2;
        ctx.strokeStyle = `rgba(239, 68, 68, ${0.4 + 0.3 * Math.sin(now * 0.008)})`;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.arc(bx, by, pulseRing, 0, Math.PI * 2);
        ctx.stroke();

        ctx.fillStyle = '#ef4444';
        ctx.beginPath();
        ctx.arc(bx, by, 3.5, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    ctx.restore(); // Exit clip

    // Radar Bezel Frame
    if (
      this.textures.radarBezel &&
      this.textures.radarBezel.complete &&
      this.textures.radarBezel.naturalWidth > 0
    ) {
      ctx.drawImage(this.textures.radarBezel, radarX, radarY, radarSize, radarSize);
    } else {
      ctx.strokeStyle = '#334155';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(cx, cy, radius, 0, Math.PI * 2);
      ctx.stroke();

      ctx.strokeStyle = 'rgba(56, 189, 248, 0.4)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(cx, cy, radius - 2, 0, Math.PI * 2);
      ctx.stroke();
    }

    ctx.restore();
  }
}
