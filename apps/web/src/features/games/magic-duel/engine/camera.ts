/**
 * Magic Duel - Camera System
 * Guarantees player is dead-centered at (viewportWidth / 2, viewportHeight / 2)
 * with responsive viewport zoom scaling to adapt to any aspect ratio.
 */

export class Camera {
  x: number;
  y: number;
  shakeAmount: number;
  shakeDecay: number;
  viewportWidth: number;
  viewportHeight: number;
  zoom: number;

  constructor() {
    this.x = 400;
    this.y = 400;
    this.shakeAmount = 0;
    this.shakeDecay = 14;
    this.viewportWidth = 1280;
    this.viewportHeight = 720;
    this.zoom = 1.0;
  }

  resize(w: number, h: number) {
    this.viewportWidth = w;
    this.viewportHeight = h;
    // Adapt zoom to viewport size:
    // On 1080p/720p displays zoom is 1.0.
    // On smaller containers (e.g. 557px height or modal window), scale down slightly
    // so the wizard, immediate surroundings, and arena are framed proportionally.
    const targetH = 720;
    this.zoom = Math.max(0.7, Math.min(1.0, h / targetH));
  }

  lockOn(targetX: number, targetY: number) {
    this.x = targetX;
    this.y = targetY;
  }

  triggerShake(magnitude = 8) {
    this.shakeAmount = Math.max(this.shakeAmount, magnitude);
  }

  update(dt: number) {
    if (this.shakeAmount > 0.05) {
      this.shakeAmount = Math.max(0, this.shakeAmount - this.shakeDecay * dt);
    } else {
      this.shakeAmount = 0;
    }
  }

  apply(ctx: CanvasRenderingContext2D) {
    const cx = this.viewportWidth / 2;
    const cy = this.viewportHeight / 2;

    let sx = 0;
    let sy = 0;
    if (this.shakeAmount > 0) {
      sx = (Math.random() - 0.5) * 2 * this.shakeAmount;
      sy = (Math.random() - 0.5) * 2 * this.shakeAmount;
    }

    ctx.save();
    // 1. Center camera on viewport center
    ctx.translate(cx + sx, cy + sy);
    // 2. Apply aspect-ratio proportional zoom
    ctx.scale(this.zoom, this.zoom);
    // 3. Translate world so locked target is at center
    ctx.translate(-this.x, -this.y);
  }

  restore(ctx: CanvasRenderingContext2D) {
    ctx.restore();
  }

  screenToWorld(screenX: number, screenY: number): { x: number; y: number } {
    const cx = this.viewportWidth / 2;
    const cy = this.viewportHeight / 2;
    return {
      x: (screenX - cx) / this.zoom + this.x,
      y: (screenY - cy) / this.zoom + this.y,
    };
  }

  worldToScreen(worldX: number, worldY: number): { x: number; y: number } {
    const cx = this.viewportWidth / 2;
    const cy = this.viewportHeight / 2;
    return {
      x: (worldX - this.x) * this.zoom + cx,
      y: (worldY - this.y) * this.zoom + cy,
    };
  }
}
