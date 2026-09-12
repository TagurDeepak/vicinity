'use client';

import { useEffect, useRef, useState } from 'react';
import {
  FLOOR_HEIGHT,
  FLOOR_WIDTH,
  PROXIMITY_RADIUS,
  type PresenceState,
  type Vec2,
  type Zone,
} from '@vicinity/shared';
import { Avatar } from '@vicinity/ui';
import { usePresenceStore } from '@/stores/presence';
import { findPath, getDoorwayForZone, resolveMovement } from './collision';
import {
  drawCampusGrass,
  drawCampusWalkways,
  drawCampusFountainsAndPlaza,
  drawCampusOutdoorGardens,
  drawCampusTrees,
  drawCampusStreetLamps,
  drawCampusFurniture,
} from './campus-render';

const SPEED = 260; // world units / second

interface ZoneStyle {
  fill: string;
  border: string;
  icon: string;
  floorType: 'wood' | 'tile' | 'carpet';
}
const ZONE_STYLE: Record<string, ZoneStyle> = {
  open: { fill: 'rgba(95,92,240,0.06)', border: 'rgba(95,92,240,0.30)', icon: '🌿', floorType: 'tile' },
  focus: { fill: 'rgba(34,176,125,0.10)', border: 'rgba(34,176,125,0.40)', icon: '🎧', floorType: 'wood' },
  meeting: { fill: 'rgba(75,65,219,0.12)', border: 'rgba(75,65,219,0.40)', icon: '📊', floorType: 'carpet' },
  lounge: { fill: 'rgba(245,181,68,0.14)', border: 'rgba(214,150,40,0.45)', icon: '☕', floorType: 'carpet' },
  private: { fill: 'rgba(229,72,77,0.10)', border: 'rgba(229,72,77,0.40)', icon: '🔒', floorType: 'wood' },
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
  layoutTheme,
  lockedZoneIds = new Set(),
  walkToTarget = null,
  onMove,
  onZoneEnter,
  onZoneLeave,
  onZoneChange,
  onStartDm,
}: {
  zones: Zone[];
  layoutTheme?: 'standard' | 'campus-garden';
  lockedZoneIds?: Set<string>;
  walkToTarget?: Vec2 | null;
  onMove: (p: Vec2) => void;
  onZoneEnter?: (zoneId: string) => void;
  onZoneLeave?: (zoneId?: string) => void;
  onZoneChange?: (zone: Zone | null) => void;
  onStartDm?: (userId: string, displayName: string) => void;
}) {
  const isCampus =
    layoutTheme === 'campus-garden' ||
    zones.some(
      (z) =>
        z.name.toLowerCase().includes('fountain') ||
        z.name.toLowerCase().includes('coworking'),
    );
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(FLOOR_WIDTH);

  const keys = useRef<Set<string>>(new Set());
  const pathWaypoints = useRef<Vec2[]>([]);
  const pos = useRef<Vec2>({ x: 200, y: 200 });
  const currentZoneRef = useRef<Zone | null>(null);

  const [selectedUser, setSelectedUser] = useState<PresenceState | null>(null);
  const [waveToast, setWaveToast] = useState<string | null>(null);

  const lockedZoneIdsRef = useRef(lockedZoneIds);
  const onZoneEnterRef = useRef(onZoneEnter);
  const onZoneLeaveRef = useRef(onZoneLeave);
  const onZoneChangeRef = useRef(onZoneChange);
  const onMoveRef = useRef(onMove);
  const lastMoveSentRef = useRef<number>(0);
  const lastPosSentRef = useRef<Vec2>({ x: -1, y: -1 });

  useEffect(() => {
    if (walkToTarget) {
      const path = findPath(pos.current, walkToTarget, zones, lockedZoneIdsRef.current, isCampus);
      pathWaypoints.current = path;
    }
  }, [walkToTarget, zones, isCampus]);
  useEffect(() => {
    lockedZoneIdsRef.current = lockedZoneIds;
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
      let targetX = pos.current.x;
      let targetY = pos.current.y;

      if (dx !== 0 || dy !== 0) {
        pathWaypoints.current = [];
        const len = Math.hypot(dx, dy) || 1;
        targetX += (dx / len) * SPEED * dt;
        targetY += (dy / len) * SPEED * dt;
        moved = true;
      } else if (pathWaypoints.current.length > 0) {
        const nextPoint = pathWaypoints.current[0]!;
        const tx = nextPoint.x - pos.current.x;
        const ty = nextPoint.y - pos.current.y;
        const dist = Math.hypot(tx, ty);
        if (dist < 6) {
          pathWaypoints.current.shift();
        } else {
          const move = Math.min(SPEED * dt, dist);
          targetX += (tx / dist) * move;
          targetY += (ty / dist) * move;
          moved = true;
        }
      }
      if (moved) {
        const resolved = resolveMovement(
          pos.current,
          { x: targetX, y: targetY },
          zones,
          lockedZoneIdsRef.current,
          isCampus,
        );
        if (resolved.x !== pos.current.x || resolved.y !== pos.current.y) {
          pos.current = resolved;
          const currentCoord = { x: Math.round(pos.current.x), y: Math.round(pos.current.y) };

          // Throttle network presence updates to ~80ms (12-15Hz) to prevent websocket saturation and stutter
          const nowMs = performance.now();
          if (nowMs - lastMoveSentRef.current >= 80) {
            lastMoveSentRef.current = nowMs;
            lastPosSentRef.current = currentCoord;
            onMoveRef.current(currentCoord);
          }

          const activeZone = getZoneAt(zones, currentCoord);
          if (activeZone?.id !== currentZoneRef.current?.id) {
            const prev = currentZoneRef.current;
            currentZoneRef.current = activeZone;
            if (prev) onZoneLeaveRef.current?.(prev.id);
            if (activeZone) onZoneEnterRef.current?.(activeZone.id);
            onZoneChangeRef.current?.(activeZone);
          }
        }
      } else {
        // When avatar has stopped moving, ensure the final resting position was sent
        const currentCoord = { x: Math.round(pos.current.x), y: Math.round(pos.current.y) };
        if (
          lastPosSentRef.current.x !== currentCoord.x ||
          lastPosSentRef.current.y !== currentCoord.y
        ) {
          lastPosSentRef.current = currentCoord;
          lastMoveSentRef.current = performance.now();
          onMoveRef.current(currentCoord);
        }
      }

      // --- draw ---
      const s = scale();
      const cssHeight = width * (FLOOR_HEIGHT / FLOOR_WIDTH);
      const { me, users, group } = usePresenceStore.getState();
      // Draw in CSS pixels; scale the backing store for crisp HiDPI rendering.
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      if (isCampus) {
        drawCampusGrass(ctx, width, cssHeight, s);
        drawCampusWalkways(ctx, s);
        drawCampusOutdoorGardens(ctx, s);
        drawCampusFountainsAndPlaza(ctx, s, now);
      } else {
        // floor backdrop + corridor walkways
        ctx.fillStyle = '#f1f4f9';
        ctx.fillRect(0, 0, width, cssHeight);

        drawCorridorWalkways(ctx, s);

        ctx.strokeStyle = 'rgba(61,67,86,0.04)';
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
      }

      // rooms + furniture with architectural walls & textures
      for (const z of zones) drawZone(ctx, z, s, lockedZoneIdsRef.current, isCampus);

      if (isCampus) {
        drawCampusTrees(ctx, s);
        drawCampusStreetLamps(ctx, s);
      }

      // Auto-path waypoint visualization
      if (pathWaypoints.current.length > 0) {
        ctx.save();
        ctx.setLineDash([6 * s, 6 * s]);
        ctx.strokeStyle = 'rgba(99, 102, 241, 0.45)';
        ctx.lineWidth = 2.5 * s;
        ctx.beginPath();
        ctx.moveTo(pos.current.x * s, pos.current.y * s);
        for (const pt of pathWaypoints.current) {
          ctx.lineTo(pt.x * s, pt.y * s);
        }
        ctx.stroke();

        const dest = pathWaypoints.current[pathWaypoints.current.length - 1]!;
        const pulse = Math.sin(now / 150) * 2.5 * s;
        ctx.beginPath();
        ctx.arc(dest.x * s, dest.y * s, 8 * s + pulse, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(99, 102, 241, 0.22)';
        ctx.fill();
        ctx.strokeStyle = '#6366f1';
        ctx.lineWidth = 1.5 * s;
        ctx.stroke();
        ctx.restore();
      }

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
          isSelected: selectedUser?.userId === u.userId,
        });
      }

      raf = requestAnimationFrame(step);
    };

    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [width, zones, onMove, selectedUser]);

  const height = width * (FLOOR_HEIGHT / FLOOR_WIDTH);
  const dpr = typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1;

  function handleCanvasClick(e: React.MouseEvent<HTMLCanvasElement>) {
    const rect = e.currentTarget.getBoundingClientRect();
    const s = width / FLOOR_WIDTH;
    const clickX = (e.clientX - rect.left) / s;
    const clickY = (e.clientY - rect.top) / s;

    // Check if clicked on a coworker avatar
    const { me, users } = usePresenceStore.getState();
    let clickedPeer: PresenceState | null = null;
    for (const u of Object.values(users)) {
      if (u.userId === me) continue;
      const dist = Math.hypot(clickX - u.position.x, clickY - u.position.y);
      if (dist < 28) {
        clickedPeer = u;
        break;
      }
    }

    if (clickedPeer) {
      setSelectedUser(clickedPeer);
      return;
    }

    setSelectedUser(null);

    // Obstacle-avoiding A* path to the destination without walking through walls or grass
    const path = findPath(pos.current, { x: clickX, y: clickY }, zones, lockedZoneIdsRef.current, isCampus);
    pathWaypoints.current = path;
  }

  function handleWalkToTeammate(targetUser: PresenceState) {
    const path = findPath(pos.current, targetUser.position, zones, lockedZoneIdsRef.current, isCampus);
    pathWaypoints.current = path;
    setSelectedUser(null);
  }

  function handleSendWave(targetUser: PresenceState) {
    setWaveToast(`👋 You waved at ${targetUser.displayName}!`);
    setTimeout(() => setWaveToast(null), 3000);
    setSelectedUser(null);
  }

  return (
    <div ref={containerRef} className="relative h-full w-full overflow-hidden rounded-2xl border border-surface-3 bg-surface-1">
      <canvas
        ref={canvasRef}
        width={Math.round(width * dpr)}
        height={Math.round(height * dpr)}
        style={{ width, height }}
        className="cursor-pointer"
        role="application"
        aria-label="Virtual office floor. Click anywhere to walk without hitting walls, or click an avatar to chat."
        tabIndex={0}
        onClick={handleCanvasClick}
      />

      {/* Wave notification toast */}
      {waveToast && (
        <div className="pointer-events-none absolute top-4 left-1/2 -translate-x-1/2 z-30 flex items-center gap-2 rounded-full bg-surface-0/95 px-4 py-2 text-sm font-semibold text-brand-700 shadow-xl border border-brand-200 backdrop-blur animate-in fade-in slide-in-from-top-2">
          {waveToast}
        </div>
      )}

      {/* Coworker interaction card */}
      {selectedUser && (
        <div className="absolute top-4 left-4 z-20 w-72 rounded-2xl border border-surface-3 bg-surface-0/95 p-4 shadow-2xl backdrop-blur animate-in fade-in zoom-in-95">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-3">
              <Avatar name={selectedUser.displayName} src={selectedUser.avatarUrl} size={40} />
              <div>
                <h3 className="text-sm font-semibold text-ink-900">{selectedUser.displayName}</h3>
                <p className="text-xs text-ink-500 capitalize">{selectedUser.status}</p>
              </div>
            </div>
            <button
              onClick={() => setSelectedUser(null)}
              className="rounded-lg p-1 text-ink-400 hover:bg-surface-2"
            >
              ✕
            </button>
          </div>

          <div className="mt-3 flex flex-col gap-2">
            {onStartDm && (
              <button
                onClick={() => {
                  onStartDm(selectedUser.userId, selectedUser.displayName);
                  setSelectedUser(null);
                }}
                className="flex items-center justify-center gap-1.5 rounded-xl bg-brand-600 px-3 py-2 text-xs font-semibold text-white shadow transition hover:bg-brand-700"
              >
                💬 Direct Message
              </button>
            )}
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => handleWalkToTeammate(selectedUser)}
                className="flex items-center justify-center gap-1 rounded-xl bg-surface-2 px-3 py-2 text-xs font-semibold text-ink-700 transition hover:bg-surface-3"
              >
                🚶 Walk Over
              </button>
              <button
                onClick={() => handleSendWave(selectedUser)}
                className="flex items-center justify-center gap-1 rounded-xl bg-surface-2 px-3 py-2 text-xs font-semibold text-ink-700 transition hover:bg-surface-3"
              >
                👋 Wave
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function drawCorridorWalkways(ctx: CanvasRenderingContext2D, s: number): void {
  ctx.save();
  ctx.fillStyle = 'rgba(226, 232, 240, 0.55)';
  // Main horizontal corridor
  ctx.fillRect(80 * s, 420 * s, 1440 * s, 120 * s);
  // Vertical branch corridors
  ctx.fillRect(400 * s, 100 * s, 110 * s, 760 * s);
  ctx.fillRect(1000 * s, 100 * s, 110 * s, 760 * s);
  ctx.restore();
}

export function roundRect(
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
  isSelected?: boolean;
}

/** Draws a sleek, premier modern executive token avatar with status jewels, audio ripples, and directional indicators. */
function drawCharacter(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  s: number,
  o: CharOpts,
): void {
  const bob = o.moving ? Math.sin(o.phase) * 2.5 * s : 0;
  const cy = y + bob;

  // 1. Multilayer Ground Shadow
  ctx.beginPath();
  ctx.ellipse(x, y + 18 * s, 16 * s, 6 * s, 0, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(15, 23, 42, 0.18)';
  ctx.fill();

  // 2. Speaking Audio Halo Waves
  if (o.talking) {
    const pulsePhase = (o.t / 140) % 1;
    const r1 = (20 + pulsePhase * 14) * s;
    const a1 = (1 - pulsePhase) * 0.5;
    ctx.beginPath();
    ctx.arc(x, cy, r1, 0, Math.PI * 2);
    ctx.strokeStyle = `rgba(99, 102, 241, ${a1})`;
    ctx.lineWidth = 2 * s;
    ctx.stroke();

    const pulsePhase2 = (o.t / 140 + 0.5) % 1;
    const r2 = (20 + pulsePhase2 * 14) * s;
    const a2 = (1 - pulsePhase2) * 0.4;
    ctx.beginPath();
    ctx.arc(x, cy, r2, 0, Math.PI * 2);
    ctx.strokeStyle = `rgba(56, 189, 248, ${a2})`;
    ctx.lineWidth = 1.5 * s;
    ctx.stroke();
  }

  // 3. Selection Glow
  if (o.isSelected) {
    ctx.beginPath();
    ctx.arc(x, cy, 26 * s, 0, Math.PI * 2);
    ctx.strokeStyle = '#38bdf8';
    ctx.lineWidth = 2.5 * s;
    ctx.stroke();
  }

  // 4. Directional Heading Indicator (when walking)
  if (o.moving) {
    const arrowX = x + o.facing * 20 * s;
    ctx.beginPath();
    ctx.moveTo(arrowX + o.facing * 3 * s, cy);
    ctx.lineTo(arrowX - o.facing * 4 * s, cy - 5 * s);
    ctx.lineTo(arrowX - o.facing * 4 * s, cy + 5 * s);
    ctx.closePath();
    ctx.fillStyle = o.isSelf ? '#38bdf8' : '#e2e8f0';
    ctx.fill();
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 1 * s;
    ctx.stroke();
  }

  // 5. Premier Executive Token Disc (Radius 18s)
  // Outer Bezel Gradient
  const bezelGrad = ctx.createLinearGradient(x - 18 * s, cy - 18 * s, x + 18 * s, cy + 18 * s);
  if (o.isSelf) {
    bezelGrad.addColorStop(0, '#38bdf8');
    bezelGrad.addColorStop(0.5, '#6366f1');
    bezelGrad.addColorStop(1, '#4f46e5');
  } else {
    bezelGrad.addColorStop(0, '#94a3b8');
    bezelGrad.addColorStop(0.5, '#475569');
    bezelGrad.addColorStop(1, '#1e293b');
  }
  ctx.beginPath();
  ctx.arc(x, cy, 18 * s, 0, Math.PI * 2);
  ctx.fillStyle = bezelGrad;
  ctx.fill();

  // Inner Core Disc
  const innerGrad = ctx.createRadialGradient(x, cy - 4 * s, 2 * s, x, cy, 16 * s);
  if (o.isSelf) {
    innerGrad.addColorStop(0, '#312e81');
    innerGrad.addColorStop(1, '#0f172a');
  } else {
    innerGrad.addColorStop(0, '#1e293b');
    innerGrad.addColorStop(1, '#020617');
  }
  ctx.beginPath();
  ctx.arc(x, cy, 15.5 * s, 0, Math.PI * 2);
  ctx.fillStyle = innerGrad;
  ctx.fill();

  // Specular rim reflection
  ctx.beginPath();
  ctx.arc(x, cy - 1 * s, 14.5 * s, Math.PI * 1.15, Math.PI * 1.85);
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.35)';
  ctx.lineWidth = 1.4 * s;
  ctx.stroke();

  // 6. Monogram Initials
  const cleanName = o.name.replace(' (you)', '').trim();
  const parts = cleanName.split(/\s+/).filter(Boolean);
  const initials = parts.length > 1
    ? (parts[0]![0]! + parts[1]![0]!).toUpperCase()
    : (cleanName.slice(0, 2) || 'U').toUpperCase();

  ctx.font = `bold ${12 * s}px Inter, -apple-system, sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = '#ffffff';
  ctx.fillText(initials, x, cy);

  // 7. Status Jewel Badge (concentric emerald / ruby / amber / violet jewel)
  const dotX = x + 12 * s;
  const dotY = cy + 12 * s;
  // White bezel
  ctx.beginPath();
  ctx.arc(dotX, dotY, 4.5 * s, 0, Math.PI * 2);
  ctx.fillStyle = '#ffffff';
  ctx.fill();
  // Glowing status center
  ctx.beginPath();
  ctx.arc(dotX, dotY, 3.2 * s, 0, Math.PI * 2);
  ctx.fillStyle = o.statusColor;
  ctx.fill();

  // 8. Floating Executive Name Badge
  ctx.font = `600 ${11 * s}px Inter, sans-serif`;
  const tw = ctx.measureText(o.name).width;
  const padX = 8 * s;
  const pillH = 18 * s;
  const pillW = tw + padX * 2;
  const px = x - pillW / 2;
  const py = cy - 24 * s - pillH;

  roundRect(ctx, px, py, pillW, pillH, 9 * s);
  ctx.fillStyle = o.isSelf ? '#4338ca' : 'rgba(15, 23, 42, 0.92)';
  ctx.fill();
  ctx.strokeStyle = o.isSelf ? '#6366f1' : 'rgba(255, 255, 255, 0.18)';
  ctx.lineWidth = 1;
  ctx.stroke();

  ctx.fillStyle = '#ffffff';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(o.name, x, py + pillH / 2);
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
}

function drawZone(
  ctx: CanvasRenderingContext2D,
  z: Zone,
  s: number,
  lockedZoneIds: Set<string> = new Set(),
  isCampus: boolean = false,
): void {
  // If campus layout and it's the Grand Fountain Plaza, the open courtyard is already rendered
  if (isCampus && z.name.toLowerCase().includes('fountain')) {
    return;
  }

  const g = z.geometry;
  const X = g.x * s;
  const Y = g.y * s;
  const W = g.w * s;
  const H = g.h * s;
  const style = ZONE_STYLE[z.type] ?? ZONE_STYLE.open!;
  const isEnclosed = isCampus ? true : (z.type !== 'lounge' && z.type !== 'open');
  const isLocked = lockedZoneIds.has(z.id);

  // 1. Floor Textures
  roundRect(ctx, X, Y, W, H, 14 * s);
  ctx.save();
  ctx.clip();

  if (isCampus || style.floorType === 'wood') {
    drawWoodParquet(ctx, X, Y, W, H, s);
  } else if (style.floorType === 'tile') {
    drawCeramicTiles(ctx, X, Y, W, H, s);
  } else {
    // Carpet base
    ctx.fillStyle = style.fill;
    ctx.fillRect(X, Y, W, H);
  }
  ctx.restore();

  // 2. Architectural Walls & Doorways
  if (isEnclosed) {
    const door = getDoorwayForZone(z);
    const dX = door.x * s;
    const dY = door.y * s;
    const dW = Math.max(door.w * s, 12 * s);
    const dH = Math.max(door.h * s, 12 * s);

    // Door mat / threshold
    ctx.fillStyle = isLocked ? 'rgba(239, 68, 68, 0.28)' : 'rgba(0, 0, 0, 0.08)';
    if (door.side === 'bottom') {
      ctx.fillRect(dX, Y + H - 5 * s, dW, 8 * s);
    } else if (door.side === 'top') {
      ctx.fillRect(dX, Y - 3 * s, dW, 8 * s);
    } else {
      ctx.fillRect(dX - (door.side === 'left' ? 3 * s : 5 * s), dY, 8 * s, dH);
    }

    // Outer wall
    ctx.lineWidth = 4 * s;
    ctx.strokeStyle = isCampus ? '#e2e8f0' : '#334155';
    ctx.lineCap = 'round';
    ctx.beginPath();

    // Top wall
    if (door.side === 'top' && !isLocked) {
      ctx.moveTo(X, Y);
      ctx.lineTo(dX, Y);
      ctx.moveTo(dX + dW, Y);
      ctx.lineTo(X + W, Y);
    } else {
      ctx.moveTo(X, Y);
      ctx.lineTo(X + W, Y);
    }

    // Right wall
    if (door.side === 'right' && !isLocked) {
      ctx.lineTo(X + W, dY);
      ctx.moveTo(X + W, dY + dH);
      ctx.lineTo(X + W, Y + H);
    } else {
      ctx.lineTo(X + W, Y + H);
    }

    // Bottom wall
    if (door.side === 'bottom' && !isLocked) {
      ctx.lineTo(dX + dW, Y + H);
      ctx.moveTo(dX, Y + H);
      ctx.lineTo(X, Y + H);
    } else {
      ctx.lineTo(X, Y + H);
    }

    // Left wall
    if (door.side === 'left' && !isLocked) {
      ctx.lineTo(X, dY + dH);
      ctx.moveTo(X, dY);
      ctx.lineTo(X, Y);
    } else {
      ctx.lineTo(X, Y);
    }
    ctx.stroke();

    // Outer shadow border
    ctx.lineWidth = 1 * s;
    ctx.strokeStyle = isCampus ? '#94a3b8' : '#1e293b';
    ctx.strokeRect(X - 2 * s, Y - 2 * s, W + 4 * s, H + 4 * s);

    // If locked, draw the closed door barrier across the doorway
    if (isLocked) {
      ctx.beginPath();
      ctx.lineWidth = 5 * s;
      ctx.strokeStyle = '#ef4444'; // Red locked barrier
      if (door.side === 'top' || door.side === 'bottom') {
        ctx.moveTo(dX, dY);
        ctx.lineTo(dX + dW, dY);
      } else {
        ctx.moveTo(dX, dY);
        ctx.lineTo(dX, dY + dH);
      }
      ctx.stroke();
    }
  } else {
    // Open lounge zones
    ctx.lineWidth = 1.5 * s;
    ctx.strokeStyle = style.border;
    ctx.stroke();
  }

  // 3. Furniture & Props
  if (isCampus) {
    drawCampusFurniture(ctx, z.name, z.type, X, Y, W, H, s);
  } else {
    drawFurniture(ctx, z.type, X, Y, W, H, s);
  }

  // 4. Header pill (icon + name)
  if (isCampus) {
    ctx.font = `bold ${11 * s}px Inter, sans-serif`;
    const label = isLocked ? `🔒 ${z.name} (LOCKED)` : `🔊  ${z.name}`;
    const tw = ctx.measureText(label).width;
    roundRect(ctx, X + 10 * s, Y + 10 * s, tw + 18 * s, 22 * s, 6 * s);
    ctx.fillStyle = isLocked ? 'rgba(239, 68, 68, 0.9)' : 'rgba(30, 41, 59, 0.88)';
    ctx.fill();
    ctx.strokeStyle = isLocked ? '#ef4444' : 'rgba(255, 255, 255, 0.2)';
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.fillStyle = '#ffffff';
    ctx.textBaseline = 'middle';
    ctx.fillText(label, X + 19 * s, Y + 21 * s);
    ctx.textBaseline = 'alphabetic';
  } else {
    ctx.font = `600 ${13 * s}px Inter, sans-serif`;
    const label = isLocked ? `🔒 ${z.name} (LOCKED)` : `${style.icon}  ${z.name}`;
    const tw = ctx.measureText(label).width;
    roundRect(ctx, X + 12 * s, Y + 12 * s, tw + 18 * s, 26 * s, 13 * s);
    ctx.fillStyle = isLocked ? '#fef2f2' : 'rgba(255,255,255,0.94)';
    ctx.fill();
    ctx.strokeStyle = isLocked ? '#ef4444' : style.border;
    ctx.lineWidth = isLocked ? 1.5 : 1;
    ctx.stroke();
    ctx.fillStyle = isLocked ? '#b91c1c' : '#1e293b';
    ctx.textBaseline = 'middle';
    ctx.fillText(label, X + 21 * s, Y + 25 * s);
    ctx.textBaseline = 'alphabetic';
  }
}

function drawWoodParquet(ctx: CanvasRenderingContext2D, X: number, Y: number, W: number, H: number, s: number): void {
  ctx.fillStyle = '#e8dcc8';
  ctx.fillRect(X, Y, W, H);
  const plankH = 22 * s;
  ctx.strokeStyle = 'rgba(180, 150, 120, 0.28)';
  ctx.lineWidth = 1;
  const rows = Math.ceil(H / plankH);
  for (let r = 0; r < rows; r++) {
    const py = Y + r * plankH;
    ctx.beginPath();
    ctx.moveTo(X, py);
    ctx.lineTo(X + W, py);
    ctx.stroke();
    const offset = (r % 2) * 45 * s;
    for (let px = X + offset; px < X + W; px += 90 * s) {
      ctx.beginPath();
      ctx.moveTo(px, py);
      ctx.lineTo(px, py + plankH);
      ctx.stroke();
    }
  }
}

function drawCeramicTiles(ctx: CanvasRenderingContext2D, X: number, Y: number, W: number, H: number, s: number): void {
  ctx.fillStyle = '#f8fafc';
  ctx.fillRect(X, Y, W, H);
  const tileSize = 24 * s;
  ctx.strokeStyle = 'rgba(203, 213, 225, 0.4)';
  ctx.lineWidth = 1;
  for (let x = X; x <= X + W; x += tileSize) {
    ctx.beginPath();
    ctx.moveTo(x, Y);
    ctx.lineTo(x, Y + H);
    ctx.stroke();
  }
  for (let y = Y; y <= Y + H; y += tileSize) {
    ctx.beginPath();
    ctx.moveTo(X, y);
    ctx.lineTo(X + W, y);
    ctx.stroke();
  }
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
  const wood = '#d4be9f';
  const woodDark = '#b89f7a';
  const chairCol = '#334155';
  const cx = X + W / 2;
  const cy = Y + H / 2;

  if (type === 'meeting') {
    // 1. Woven Area Rug under table
    const rw = Math.min(W * 0.72, 280 * s);
    const rh = Math.min(H * 0.58, 200 * s);
    roundRect(ctx, cx - rw / 2, cy - rh / 2 + 10 * s, rw, rh, 16 * s);
    ctx.fillStyle = 'rgba(51, 65, 85, 0.12)';
    ctx.fill();
    ctx.strokeStyle = 'rgba(51, 65, 85, 0.22)';
    ctx.lineWidth = 1.5 * s;
    ctx.stroke();

    // 2. Wall-mounted presentation screen / display
    roundRect(ctx, cx - 44 * s, Y + 5 * s, 88 * s, 14 * s, 3 * s);
    ctx.fillStyle = '#0f172a';
    ctx.fill();
    ctx.strokeStyle = '#475569';
    ctx.stroke();
    // Power LED
    ctx.fillStyle = '#22c55e';
    ctx.beginPath();
    ctx.arc(cx + 38 * s, Y + 12 * s, 1.5 * s, 0, Math.PI * 2);
    ctx.fill();

    // 3. Conference Table with center cable trough
    const tw = Math.min(W, H) * 0.52;
    const th = Math.min(W, H) * 0.32;
    ctx.beginPath();
    ctx.ellipse(cx, cy + 10 * s, tw / 2, th / 2, 0, 0, Math.PI * 2);
    ctx.fillStyle = wood;
    ctx.fill();
    ctx.strokeStyle = woodDark;
    ctx.lineWidth = 2 * s;
    ctx.stroke();

    // Table center speakerphone puck
    ctx.beginPath();
    ctx.arc(cx, cy + 10 * s, 7 * s, 0, Math.PI * 2);
    ctx.fillStyle = '#1e293b';
    ctx.fill();

    // 4. Executive conference chairs around table
    const rx = tw / 2 + 14 * s;
    const ry = th / 2 + 12 * s;
    const chairCount = W > 400 ? 8 : 6;
    for (let i = 0; i < chairCount; i++) {
      const a = (i / chairCount) * Math.PI * 2;
      const chX = cx + Math.cos(a) * rx;
      const chY = cy + 10 * s + Math.sin(a) * ry;
      roundRect(ctx, chX - 5 * s, chY - 5 * s, 10 * s, 10 * s, 3 * s);
      ctx.fillStyle = chairCol;
      ctx.fill();
    }
  } else if (type === 'focus') {
    // Focus Pod: Dual-monitor desks + warm desk lamp
    const dw = Math.min(W * 0.42, 110 * s);
    const dh = 38 * s;

    const drawFocusDesk = (dx: number, dy: number) => {
      roundRect(ctx, dx, dy, dw, dh, 4 * s);
      ctx.fillStyle = wood;
      ctx.fill();
      ctx.strokeStyle = woodDark;
      ctx.lineWidth = 1.5 * s;
      ctx.stroke();

      // Dual monitors
      roundRect(ctx, dx + dw * 0.18, dy + 3 * s, dw * 0.28, 7 * s, 1.5 * s);
      ctx.fillStyle = '#0f172a';
      ctx.fill();
      roundRect(ctx, dx + dw * 0.52, dy + 3 * s, dw * 0.28, 7 * s, 1.5 * s);
      ctx.fillStyle = '#0f172a';
      ctx.fill();

      // Desk lamp with ambient warm glow
      ctx.beginPath();
      ctx.arc(dx + dw * 0.9, dy + 8 * s, 18 * s, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(251, 191, 36, 0.18)';
      ctx.fill();

      ctx.beginPath();
      ctx.arc(dx + dw * 0.9, dy + 8 * s, 4 * s, 0, Math.PI * 2);
      ctx.fillStyle = '#f59e0b';
      ctx.fill();

      // Ergonomic task chair
      roundRect(ctx, dx + dw * 0.35, dy + dh + 4 * s, 18 * s, 16 * s, 4 * s);
      ctx.fillStyle = '#334155';
      ctx.fill();
    };

    drawFocusDesk(X + W * 0.12, cy - dh / 2);
    if (W > 320) {
      drawFocusDesk(X + W * 0.56, cy - dh / 2);
    }
  } else if (type === 'lounge') {
    // Lounge: Sectional sofa, round coffee table & indoor plant
    const sw = W * 0.42;
    const sh = H * 0.22;

    // Plush Sofa
    roundRect(ctx, cx - sw / 2, cy - 8 * s, sw, 10 * s, 5 * s);
    ctx.fillStyle = '#475569';
    ctx.fill();
    roundRect(ctx, cx - sw / 2, cy, sw, sh, 8 * s);
    ctx.fillStyle = '#64748b';
    ctx.fill();

    // Round coffee table with glass top
    ctx.beginPath();
    ctx.ellipse(cx, cy + sh + 16 * s, sw * 0.28, 12 * s, 0, 0, Math.PI * 2);
    ctx.fillStyle = '#cbd5e1';
    ctx.fill();
    ctx.strokeStyle = '#94a3b8';
    ctx.lineWidth = 1.5 * s;
    ctx.stroke();

    // Potted indoor palm
    drawPlant(ctx, X + W * 0.84, Y + H * 0.68, s);
    drawPlant(ctx, X + W * 0.14, Y + H * 0.68, s);
  } else if (type === 'private') {
    // Private Office: Executive desk, chair, laptop & plant
    roundRect(ctx, cx - W * 0.22, cy - H * 0.12, W * 0.44, H * 0.24, 6 * s);
    ctx.fillStyle = wood;
    ctx.fill();
    ctx.strokeStyle = woodDark;
    ctx.lineWidth = 2 * s;
    ctx.stroke();

    // Executive Chair
    roundRect(ctx, cx - 12 * s, cy - H * 0.12 - 18 * s, 24 * s, 16 * s, 5 * s);
    ctx.fillStyle = '#1e293b';
    ctx.fill();

    // Laptop on desk
    roundRect(ctx, cx - 10 * s, cy - 4 * s, 20 * s, 12 * s, 2 * s);
    ctx.fillStyle = '#94a3b8';
    ctx.fill();

    drawPlant(ctx, X + W * 0.82, Y + H * 0.78, s);
  } else {
    // Breakout Cafe / Kitchen: Marble counter, espresso bar, water cooler
    const cw = Math.min(W * 0.65, 260 * s);
    const ch = 28 * s;

    // Marble cafe counter
    roundRect(ctx, cx - cw / 2, cy - ch / 2, cw, ch, 6 * s);
    ctx.fillStyle = '#ffffff';
    ctx.fill();
    ctx.strokeStyle = '#cbd5e1';
    ctx.lineWidth = 1.5 * s;
    ctx.stroke();

    // Espresso machine
    roundRect(ctx, cx - cw / 2 + 10 * s, cy - ch / 2 + 4 * s, 22 * s, 20 * s, 3 * s);
    ctx.fillStyle = '#64748b';
    ctx.fill();

    // Water cooler
    ctx.beginPath();
    ctx.arc(cx + cw / 2 - 16 * s, cy - ch / 2 + 14 * s, 7 * s, 0, Math.PI * 2);
    ctx.fillStyle = '#38bdf8'; // Blue jug
    ctx.fill();

    // Barstools along counter
    for (let i = 0; i < 4; i++) {
      const sx = cx - cw / 2 + 45 * s + i * 42 * s;
      ctx.beginPath();
      ctx.arc(sx, cy + ch / 2 + 10 * s, 6 * s, 0, Math.PI * 2);
      ctx.fillStyle = '#475569';
      ctx.fill();
    }

    drawPlant(ctx, X + W * 0.88, Y + H * 0.75, s);
  }
}

function drawPlant(ctx: CanvasRenderingContext2D, x: number, y: number, s: number): void {
  // Pot
  roundRect(ctx, x - 7 * s, y, 14 * s, 14 * s, 2 * s);
  ctx.fillStyle = '#b45309'; // Terracotta
  ctx.fill();

  // Foliage
  ctx.fillStyle = '#15803d'; // Rich green
  ctx.beginPath();
  ctx.arc(x, y - 5 * s, 11 * s, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(x - 7 * s, y - 2 * s, 7 * s, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(x + 7 * s, y - 2 * s, 7 * s, 0, Math.PI * 2);
  ctx.fill();
}
