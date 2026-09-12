'use client';

import { useEffect, useRef, useState } from 'react';
import {
  FLOOR_HEIGHT,
  FLOOR_WIDTH,
  PROXIMITY_RADIUS,
  type Vec2,
  type Zone,
} from '@vicinity/shared';
import { usePresenceStore } from '@/stores/presence';

const SPEED = 260; // world units / second

interface ZoneStyle {
  fill: string;
  border: string;
  icon: string;
}
const ZONE_STYLE: Record<string, ZoneStyle> = {
  open: { fill: 'rgba(95,92,240,0.06)', border: 'rgba(95,92,240,0.30)', icon: '🌿' },
  focus: { fill: 'rgba(34,176,125,0.10)', border: 'rgba(34,176,125,0.40)', icon: '🎧' },
  meeting: { fill: 'rgba(75,65,219,0.12)', border: 'rgba(75,65,219,0.40)', icon: '📊' },
  lounge: { fill: 'rgba(245,181,68,0.14)', border: 'rgba(214,150,40,0.45)', icon: '☕' },
  private: { fill: 'rgba(229,72,77,0.10)', border: 'rgba(229,72,77,0.40)', icon: '🔒' },
};

const STATUS_COLOR: Record<string, string> = {
  available: '#22b07d',
  busy: '#e5484d',
  'in-meeting': '#5f5cf0',
  away: '#f5b544',
};

const SKIN_TONES = ['#f8d9b8', '#f0c19a', '#d9a074', '#b87a4b', '#8d5a34'];

function hueFor(seed: string): number {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) hash = (hash * 31 + seed.charCodeAt(i)) % 360;
  return hash;
}
const shirtFor = (name: string): string => `hsl(${hueFor(name)} 60% 52%)`;
const hairFor = (name: string): string => `hsl(${hueFor(name)} 30% 26%)`;
const skinFor = (name: string): string => SKIN_TONES[hueFor(name) % SKIN_TONES.length]!;

export function getZoneAt(zones: Zone[], p: Vec2): Zone | null {
  for (const z of zones) {
    const g = z.geometry;
    if (p.x >= g.x && p.x <= g.x + g.w && p.y >= g.y && p.y <= g.y + g.h) {
      return z;
    }
  }
  return null;
}

export function OfficeCanvas({
  zones,
  onMove,
  onZoneEnter,
  onZoneLeave,
  onZoneChange,
}: {
  zones: Zone[];
  onMove: (p: Vec2) => void;
  onZoneEnter?: (zoneId: string) => void;
  onZoneLeave?: (zoneId?: string) => void;
  onZoneChange?: (zone: Zone | null) => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(FLOOR_WIDTH);

  const keys = useRef<Set<string>>(new Set());
  const target = useRef<Vec2 | null>(null);
  const pos = useRef<Vec2>({ x: 200, y: 200 });
  const currentZoneRef = useRef<Zone | null>(null);

  const onZoneEnterRef = useRef(onZoneEnter);
  const onZoneLeaveRef = useRef(onZoneLeave);
  const onZoneChangeRef = useRef(onZoneChange);
  const onMoveRef = useRef(onMove);
  useEffect(() => {
    onZoneEnterRef.current = onZoneEnter;
    onZoneLeaveRef.current = onZoneLeave;
    onZoneChangeRef.current = onZoneChange;
    onMoveRef.current = onMove;
  });

  // Per-user animation state (facing + walk phase) derived from movement.
  const anim = useRef<Map<string, { x: number; y: number; facing: number; phase: number }>>(
    new Map(),
  );

  // Track container width for responsive scaling.
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => {
      if (entry) setWidth(entry.contentRect.width);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Keyboard input.
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) e.preventDefault();
      keys.current.add(e.key.toLowerCase());
    };
    const up = (e: KeyboardEvent) => keys.current.delete(e.key.toLowerCase());
    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    return () => {
      window.removeEventListener('keydown', down);
      window.removeEventListener('keyup', up);
    };
  }, []);

  // Seed local position from the store once we know who we are & check initial zone.
  useEffect(() => {
    const { me, users } = usePresenceStore.getState();
    if (me && users[me]) pos.current = { ...users[me]!.position };
    const initialZone = getZoneAt(zones, pos.current);
    if (initialZone?.id !== currentZoneRef.current?.id) {
      currentZoneRef.current = initialZone;
      if (initialZone) onZoneEnterRef.current?.(initialZone.id);
      onZoneChangeRef.current?.(initialZone);
    }
  }, [zones]);

  useEffect(() => {
    return () => {
      if (currentZoneRef.current) {
        onZoneLeaveRef.current?.(currentZoneRef.current.id);
      }
    };
  }, []);

  // Render + movement loop.
  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;

    let raf = 0;
    let last = performance.now();
    const dpr = window.devicePixelRatio || 1;
    const scale = () => width / FLOOR_WIDTH;

    const step = (now: number) => {
      const dt = Math.min((now - last) / 1000, 0.05);
      last = now;

      // --- movement ---
      let dx = 0;
      let dy = 0;
      if (keys.current.has('arrowup') || keys.current.has('w')) dy -= 1;
      if (keys.current.has('arrowdown') || keys.current.has('s')) dy += 1;
      if (keys.current.has('arrowleft') || keys.current.has('a')) dx -= 1;
      if (keys.current.has('arrowright') || keys.current.has('d')) dx += 1;

      let moved = false;
      if (dx !== 0 || dy !== 0) {
        target.current = null;
        const len = Math.hypot(dx, dy) || 1;
        pos.current.x += (dx / len) * SPEED * dt;
        pos.current.y += (dy / len) * SPEED * dt;
        moved = true;
      } else if (target.current) {
        const tx = target.current.x - pos.current.x;
        const ty = target.current.y - pos.current.y;
        const dist = Math.hypot(tx, ty);
        if (dist < 4) {
          target.current = null;
        } else {
          const move = Math.min(SPEED * dt, dist);
          pos.current.x += (tx / dist) * move;
          pos.current.y += (ty / dist) * move;
          moved = true;
        }
      }
      if (moved) {
        pos.current.x = Math.max(16, Math.min(FLOOR_WIDTH - 16, pos.current.x));
        pos.current.y = Math.max(16, Math.min(FLOOR_HEIGHT - 16, pos.current.y));
        const currentCoord = { x: Math.round(pos.current.x), y: Math.round(pos.current.y) };
        onMoveRef.current(currentCoord);

        const activeZone = getZoneAt(zones, currentCoord);
        if (activeZone?.id !== currentZoneRef.current?.id) {
          const prev = currentZoneRef.current;
          currentZoneRef.current = activeZone;
          if (prev) onZoneLeaveRef.current?.(prev.id);
          if (activeZone) onZoneEnterRef.current?.(activeZone.id);
          onZoneChangeRef.current?.(activeZone);
        }
      }

      // --- draw ---
      const s = scale();
      const cssHeight = width * (FLOOR_HEIGHT / FLOOR_WIDTH);
      const { me, users, group } = usePresenceStore.getState();
      // Draw in CSS pixels; scale the backing store for crisp HiDPI rendering.
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      // floor backdrop + subtle grid
      ctx.fillStyle = '#eef1f8';
      ctx.fillRect(0, 0, width, cssHeight);
      ctx.strokeStyle = 'rgba(61,67,86,0.05)';
      ctx.lineWidth = 1;
      for (let gx = 0; gx <= FLOOR_WIDTH; gx += 80) {
        ctx.beginPath();
        ctx.moveTo(gx * s, 0);
        ctx.lineTo(gx * s, cssHeight);
        ctx.stroke();
      }
      for (let gy = 0; gy <= FLOOR_HEIGHT; gy += 80) {
        ctx.beginPath();
        ctx.moveTo(0, gy * s);
        ctx.lineTo(width, gy * s);
        ctx.stroke();
      }

      // rooms + furniture
      for (const z of zones) drawZone(ctx, z, s);

      const groupSet = new Set(group?.members ?? []);

      // proximity ring around me
      if (me && users[me]) {
        const m = users[me]!;
        const cx = m.position.x * s;
        const cy = m.position.y * s;
        ctx.beginPath();
        ctx.arc(cx, cy, PROXIMITY_RADIUS * s, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(95,92,240,0.05)';
        ctx.fill();
        ctx.setLineDash([6 * s, 6 * s]);
        ctx.strokeStyle = 'rgba(95,92,240,0.35)';
        ctx.lineWidth = 1.5 * s;
        ctx.stroke();
        ctx.setLineDash([]);
      }

      // avatars — painter's order by y so nearer ones overlap correctly
      const roster = Object.values(users).sort((a, b) => a.position.y - b.position.y);
      for (const u of roster) {
        const x = u.position.x * s;
        const y = u.position.y * s;
        const prev = anim.current.get(u.userId);
        const dxu = prev ? u.position.x - prev.x : 0;
        const moved = prev ? Math.hypot(dxu, u.position.y - prev.y) : 0;
        const moving = moved > 0.4;
        const facing = dxu > 0.4 ? 1 : dxu < -0.4 ? -1 : (prev?.facing ?? 1);
        const phase = moving ? (prev?.phase ?? 0) + dt * 9 : 0;
        anim.current.set(u.userId, { x: u.position.x, y: u.position.y, facing, phase });

        drawCharacter(ctx, x, y, s, {
          color: shirtFor(u.displayName),
          hair: hairFor(u.displayName),
          skin: skinFor(u.displayName),
          name: u.displayName + (u.userId === me ? ' (you)' : ''),
          facing,
          moving,
          phase,
          talking: groupSet.has(u.userId),
          isSelf: u.userId === me,
          statusColor: STATUS_COLOR[u.status] ?? '#8b93a7',
          t: now,
        });
      }

      raf = requestAnimationFrame(step);
    };

    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [width, zones, onMove]);

  const height = width * (FLOOR_HEIGHT / FLOOR_WIDTH);
  const dpr = typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1;

  return (
    <div ref={containerRef} className="h-full w-full overflow-hidden rounded-2xl border border-surface-3 bg-surface-1">
      <canvas
        ref={canvasRef}
        width={Math.round(width * dpr)}
        height={Math.round(height * dpr)}
        style={{ width, height }}
        className="cursor-pointer"
        role="application"
        aria-label="Virtual office floor. Use arrow keys or WASD to move your avatar, or click to walk."
        tabIndex={0}
        onClick={(e) => {
          const rect = e.currentTarget.getBoundingClientRect();
          const s = width / FLOOR_WIDTH;
          target.current = {
            x: (e.clientX - rect.left) / s,
            y: (e.clientY - rect.top) / s,
          };
        }}
      />
    </div>
  );
}

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
): void {
  const radius = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.arcTo(x + w, y, x + w, y + h, radius);
  ctx.arcTo(x + w, y + h, x, y + h, radius);
  ctx.arcTo(x, y + h, x, y, radius);
  ctx.arcTo(x, y, x + w, y, radius);
  ctx.closePath();
}

interface CharOpts {
  color: string;
  hair: string;
  skin: string;
  name: string;
  facing: number;
  moving: boolean;
  phase: number;
  talking: boolean;
  isSelf: boolean;
  statusColor: string;
  t: number;
}

/** Draws a small human character ("toy") with a walking bob and name tag. */
function drawCharacter(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  s: number,
  o: CharOpts,
): void {
  const bob = o.moving ? Math.sin(o.phase) * 2 * s : 0;
  const swing = o.moving ? Math.sin(o.phase) * 3 * s : 0;
  const cy = y + bob;

  // ground shadow
  ctx.beginPath();
  ctx.ellipse(x, y + 22 * s, 15 * s, 5 * s, 0, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(20,22,40,0.12)';
  ctx.fill();

  // talking glow
  if (o.talking) {
    const a = 0.28 + 0.16 * Math.sin(o.t / 180);
    ctx.beginPath();
    ctx.arc(x, cy - 4 * s, 27 * s, 0, Math.PI * 2);
    ctx.strokeStyle = `rgba(95,92,240,${a})`;
    ctx.lineWidth = 3 * s;
    ctx.stroke();
  }

  // legs
  ctx.fillStyle = '#3d4356';
  roundRect(ctx, x - 8 * s, cy + 10 * s, 6 * s, 12 * s, 3 * s);
  ctx.fill();
  roundRect(ctx, x + 2 * s, cy + 10 * s, 6 * s, 12 * s, 3 * s);
  ctx.fill();

  // arms (swing opposite phases)
  ctx.fillStyle = o.color;
  roundRect(ctx, x - 15 * s, cy - 6 * s + swing, 6 * s, 16 * s, 3 * s);
  ctx.fill();
  roundRect(ctx, x + 9 * s, cy - 6 * s - swing, 6 * s, 16 * s, 3 * s);
  ctx.fill();

  // torso
  roundRect(ctx, x - 13 * s, cy - 8 * s, 26 * s, 22 * s, 8 * s);
  ctx.fillStyle = o.color;
  ctx.fill();

  // head
  const hy = cy - 20 * s;
  ctx.beginPath();
  ctx.arc(x, hy, 11 * s, 0, Math.PI * 2);
  ctx.fillStyle = o.skin;
  ctx.fill();

  // hair (top cap)
  ctx.beginPath();
  ctx.arc(x, hy, 11.5 * s, Math.PI, 2 * Math.PI);
  ctx.fillStyle = o.hair;
  ctx.fill();

  // eyes (shift slightly with facing)
  const ex = o.facing * 2 * s;
  ctx.fillStyle = '#2b2b33';
  ctx.beginPath();
  ctx.arc(x - 3.5 * s + ex, hy + 2 * s, 1.4 * s, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(x + 3.5 * s + ex, hy + 2 * s, 1.4 * s, 0, Math.PI * 2);
  ctx.fill();

  // status dot on the shoulder
  ctx.beginPath();
  ctx.arc(x + 8 * s, hy - 8 * s, 3.4 * s, 0, Math.PI * 2);
  ctx.fillStyle = o.statusColor;
  ctx.fill();
  ctx.lineWidth = 1.5 * s;
  ctx.strokeStyle = '#ffffff';
  ctx.stroke();

  // name pill
  ctx.font = `600 ${11 * s}px Inter, sans-serif`;
  const tw = ctx.measureText(o.name).width;
  const padX = 7 * s;
  const pillH = 17 * s;
  const pillW = tw + padX * 2;
  const px = x - pillW / 2;
  const py = hy - 16 * s - pillH;
  roundRect(ctx, px, py, pillW, pillH, 8 * s);
  ctx.fillStyle = o.isSelf ? '#4b41db' : 'rgba(255,255,255,0.96)';
  ctx.fill();
  if (!o.isSelf) {
    ctx.strokeStyle = 'rgba(61,67,86,0.18)';
    ctx.lineWidth = 1;
    ctx.stroke();
  }
  ctx.fillStyle = o.isSelf ? '#ffffff' : '#1b1e2b';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(o.name, x, py + pillH / 2);
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
}

function drawZone(ctx: CanvasRenderingContext2D, z: Zone, s: number): void {
  const g = z.geometry;
  const X = g.x * s;
  const Y = g.y * s;
  const W = g.w * s;
  const H = g.h * s;
  const style = ZONE_STYLE[z.type] ?? ZONE_STYLE.open!;

  roundRect(ctx, X, Y, W, H, 16 * s);
  ctx.fillStyle = style.fill;
  ctx.fill();
  ctx.lineWidth = 1.5 * s;
  ctx.strokeStyle = style.border;
  ctx.stroke();

  drawFurniture(ctx, z.type, X, Y, W, H, s);

  // header pill (icon + name)
  ctx.font = `600 ${13 * s}px Inter, sans-serif`;
  const label = `${style.icon}  ${z.name}`;
  const tw = ctx.measureText(label).width;
  roundRect(ctx, X + 12 * s, Y + 12 * s, tw + 18 * s, 26 * s, 13 * s);
  ctx.fillStyle = 'rgba(255,255,255,0.92)';
  ctx.fill();
  ctx.strokeStyle = style.border;
  ctx.lineWidth = 1;
  ctx.stroke();
  ctx.fillStyle = '#3d4356';
  ctx.textBaseline = 'middle';
  ctx.fillText(label, X + 21 * s, Y + 25 * s);
  ctx.textBaseline = 'alphabetic';
}

function drawFurniture(
  ctx: CanvasRenderingContext2D,
  type: string,
  X: number,
  Y: number,
  W: number,
  H: number,
  s: number,
): void {
  const wood = '#d9c3a5';
  const woodEdge = '#bda583';
  const furn = '#dfe3ee';
  const furnEdge = '#c4c9d8';
  const screen = '#9aa4c0';
  const cx = X + W / 2;
  const cy = Y + H / 2;
  ctx.lineWidth = 1.5 * s;

  const desk = (dx: number, dy: number, w: number, h: number): void => {
    roundRect(ctx, dx, dy, w, h, 4 * s);
    ctx.fillStyle = wood;
    ctx.fill();
    ctx.strokeStyle = woodEdge;
    ctx.stroke();
    roundRect(ctx, dx + w * 0.3, dy + 2 * s, w * 0.4, h * 0.4, 2 * s);
    ctx.fillStyle = screen;
    ctx.fill();
  };

  if (type === 'meeting') {
    ctx.beginPath();
    ctx.ellipse(cx, cy + 6 * s, Math.min(W, H) * 0.26, Math.min(W, H) * 0.16, 0, 0, Math.PI * 2);
    ctx.fillStyle = wood;
    ctx.fill();
    ctx.strokeStyle = woodEdge;
    ctx.stroke();
    const rx = Math.min(W, H) * 0.34;
    const ry = Math.min(W, H) * 0.24;
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2;
      ctx.beginPath();
      ctx.arc(cx + Math.cos(a) * rx, cy + 6 * s + Math.sin(a) * ry, 5 * s, 0, Math.PI * 2);
      ctx.fillStyle = furn;
      ctx.fill();
      ctx.strokeStyle = furnEdge;
      ctx.stroke();
    }
  } else if (type === 'focus') {
    const dw = W * 0.26;
    const dh = H * 0.16;
    desk(X + W * 0.16, cy - dh / 2, dw, dh);
    desk(X + W * 0.58, cy - dh / 2, dw, dh);
  } else if (type === 'lounge') {
    const sw = W * 0.34;
    const sh = H * 0.18;
    roundRect(ctx, cx - sw / 2, cy - 6 * s, sw, 8 * s, 4 * s);
    ctx.fillStyle = furn;
    ctx.fill();
    ctx.strokeStyle = furnEdge;
    ctx.stroke();
    roundRect(ctx, cx - sw / 2, cy, sw, sh, 6 * s);
    ctx.fillStyle = furn;
    ctx.fill();
    ctx.stroke();
    ctx.beginPath();
    ctx.ellipse(cx, cy + sh + 12 * s, sw * 0.55, 9 * s, 0, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(95,92,240,0.08)';
    ctx.fill();
    drawPlant(ctx, X + W * 0.82, Y + H * 0.7, s);
  } else if (type === 'private') {
    roundRect(ctx, cx - W * 0.16, cy - H * 0.1, W * 0.32, H * 0.2, 5 * s);
    ctx.fillStyle = wood;
    ctx.fill();
    ctx.strokeStyle = woodEdge;
    ctx.stroke();
  } else {
    drawPlant(ctx, cx, cy, s);
  }
}

function drawPlant(ctx: CanvasRenderingContext2D, x: number, y: number, s: number): void {
  roundRect(ctx, x - 6 * s, y, 12 * s, 12 * s, 2 * s);
  ctx.fillStyle = '#c98a5e';
  ctx.fill();
  ctx.fillStyle = '#4caf7d';
  ctx.beginPath();
  ctx.arc(x, y - 4 * s, 9 * s, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(x - 6 * s, y - 2 * s, 6 * s, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(x + 6 * s, y - 2 * s, 6 * s, 0, Math.PI * 2);
  ctx.fill();
}
