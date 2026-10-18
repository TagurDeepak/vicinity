'use client';

import { useEffect, useRef, useState } from 'react';
import {
  FLOOR_HEIGHT,
  FLOOR_WIDTH,
  PROXIMITY_RADIUS,
  UserStatus,
  type PresenceState,
  type Vec2,
  type Zone,
} from '@vicinity/shared';
import { Avatar } from '@vicinity/ui';
import { useAuthStore } from '@/stores/auth';
import { usePresenceStore } from '@/stores/presence';
import { findPath, getDoorwayForZone, resolveMovement, type Doorway } from './collision';
import {
  drawCampusGrass,
  drawCampusWalkways,
  drawCampusFountainsAndPlaza,
  drawCampusOutdoorGardens,
  drawCampusTrees,
  drawCampusStreetLamps,
  drawCampusFurniture,
  drawCampus3DBackdrop,
  drawCampusFountainRipples,
} from './campus-render';
import dynamic from 'next/dynamic';

const SkyCampus3D = dynamic(
  () => import('./SkyCampus3D').then((mod) => mod.SkyCampus3D),
  { ssr: false },
);

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

export function getCameraTransform(
  container: { width: number; height: number },
  currentPos: Vec2,
  currentZoom: number | null,
  offset: Vec2,
  isCampusTheme: boolean,
) {
  const fw = FLOOR_WIDTH;
  const fh = isCampusTheme ? 1080 : FLOOR_HEIGHT;
  const fitScale = Math.min(container.width / fw, container.height / fh);

  if (currentZoom === null) {
    // Fit Screen mode: 100% of all rooms are guaranteed visible without cropping
    const s = fitScale;
    const panX = (container.width - fw * s) / 2 + offset.x;
    const panY = (container.height - fh * s) / 2 + offset.y;
    return { s, panX, panY, isFit: true, fitScale };
  } else {
    // Zoomed in: camera follows the avatar with drag offset
    const s = Math.max(fitScale * 0.75, Math.min(fitScale * 3.5, currentZoom));
    const panX = container.width / 2 - currentPos.x * s + offset.x;
    const panY = container.height / 2 - currentPos.y * s + offset.y;
    return { s, panX, panY, isFit: false, fitScale };
  }
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
  layoutTheme?: 'standard' | 'campus-garden' | 'campus-3d' | 'sky-campus-3d';
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
    layoutTheme === 'campus-3d' ||
    layoutTheme === 'sky-campus-3d' ||
    zones.some(
      (z) =>
        z.name.toLowerCase().includes('fountain') ||
        z.name.toLowerCase().includes('coworking') ||
        z.name.toLowerCase().includes('penthouse') ||
        z.name.toLowerCase().includes('terrace'),
    );

  // User can toggle between 3D Sky-Tower, 3D aesthetic campus, and original 2D garden view on demand
  const [campusViewMode, setCampusViewMode] = useState<'sky-3d' | '3d' | '2d'>(
    layoutTheme === 'sky-campus-3d'
      ? 'sky-3d'
      : layoutTheme === 'campus-garden'
        ? '2d'
        : '3d',
  );
  const campusViewModeRef = useRef(campusViewMode);
  campusViewModeRef.current = campusViewMode;

  useEffect(() => {
    if (layoutTheme === 'sky-campus-3d') {
      setCampusViewMode('sky-3d');
    } else if (layoutTheme === 'campus-garden') {
      setCampusViewMode('2d');
    } else if (layoutTheme === 'campus-3d') {
      setCampusViewMode('3d');
    }
  }, [layoutTheme]);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [containerSize, setContainerSize] = useState<{ width: number; height: number }>({
    width: FLOOR_WIDTH,
    height: isCampus ? 1080 : FLOOR_HEIGHT,
  });
  const [zoom, setZoom] = useState<number | null>(null); // null = auto "Fit Screen"
  const [cameraOffset, setCameraOffset] = useState<Vec2>({ x: 0, y: 0 });

  const zoomRef = useRef<number | null>(zoom);
  zoomRef.current = zoom;
  const cameraOffsetRef = useRef<Vec2>(cameraOffset);
  cameraOffsetRef.current = cameraOffset;
  const containerSizeRef = useRef(containerSize);
  containerSizeRef.current = containerSize;

  const isPointerDown = useRef(false);
  const pointerStart = useRef<Vec2>({ x: 0, y: 0 });
  const lastPointer = useRef<Vec2>({ x: 0, y: 0 });
  const hasDragged = useRef(false);

  const keys = useRef<Set<string>>(new Set());
  const pathWaypoints = useRef<Vec2[]>([]);
  const stuckFrames = useRef<number>(0);
  const pos = useRef<Vec2>({ x: 200, y: 200 });
  const currentZoneRef = useRef<Zone | null>(null);
  // Animated door open/close angle progress (0.0 = closed/horizontal, 1.0 = open/vertical)
  const doorProgressRef = useRef<Map<string, number>>(new Map());

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

  // Track container width AND height so camera always fits the entire floor without cutting off southern rooms.
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => {
      if (entry && entry.contentRect.width > 0 && entry.contentRect.height > 0) {
        setContainerSize({
          width: entry.contentRect.width,
          height: entry.contentRect.height,
        });
      }
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
      let actuallyMoved = false;
      if (moved) {
        const resolved = resolveMovement(
          pos.current,
          { x: targetX, y: targetY },
          zones,
          lockedZoneIdsRef.current,
          isCampus,
        );
        const actualStep = Math.hypot(resolved.x - pos.current.x, resolved.y - pos.current.y);
        if (actualStep > 0.001) {
          actuallyMoved = true;
          stuckFrames.current = 0;
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
        } else if (pathWaypoints.current.length > 0) {
          // Blocked against an obstacle while following a path
          stuckFrames.current += 1;
          if (stuckFrames.current > 4) {
            pathWaypoints.current = [];
            stuckFrames.current = 0;
          }
        }
      }
      if (!actuallyMoved) {
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
      const { s, panX, panY } = getCameraTransform(
        containerSizeRef.current,
        pos.current,
        zoomRef.current,
        cameraOffsetRef.current,
        isCampus,
      );
      const floorW = FLOOR_WIDTH;
      const floorH = isCampus ? 1080 : FLOOR_HEIGHT;
      const { me, users, group } = usePresenceStore.getState();

      // Clear full canvas in CSS pixels; backing store is multiplied by dpr
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.fillStyle = '#0a0d14';
      ctx.fillRect(0, 0, containerSizeRef.current.width, containerSizeRef.current.height);

      // Apply camera viewport translation
      ctx.save();
      ctx.translate(panX, panY);

      let rendered3D = false;
      if (isCampus) {
        if (campusViewModeRef.current === '3d') {
          rendered3D = drawCampus3DBackdrop(ctx, s, floorH);
        }
        if (!rendered3D) {
          // Render the full original 2D lush green campus with lawns, trees, cherry blossoms, and lamps
          drawCampusGrass(ctx, floorW * s, floorH * s, s);
          drawCampusWalkways(ctx, s);
          drawCampusOutdoorGardens(ctx, s);
          drawCampusTrees(ctx, s);
          drawCampusStreetLamps(ctx, s);
        }
        if (rendered3D) {
          drawCampusFountainRipples(ctx, s, now);
        } else {
          drawCampusFountainsAndPlaza(ctx, s, now);
        }
      } else {
        // Floor backdrop + corridor walkways for standard office
        ctx.fillStyle = '#f1f4f9';
        ctx.fillRect(0, 0, floorW * s, floorH * s);

        drawCorridorWalkways(ctx, s);

        ctx.strokeStyle = 'rgba(61,67,86,0.04)';
        ctx.lineWidth = 1;
        for (let gx = 0; gx <= FLOOR_WIDTH; gx += 80) {
          ctx.beginPath();
          ctx.moveTo(gx * s, 0);
          ctx.lineTo(gx * s, floorH * s);
          ctx.stroke();
        }
        for (let gy = 0; gy <= FLOOR_HEIGHT; gy += 80) {
          ctx.beginPath();
          ctx.moveTo(0, gy * s);
          ctx.lineTo(floorW * s, gy * s);
          ctx.stroke();
        }
      }

      // Animate door open/close angle progress (0.0 = closed/horizontal, 1.0 = open/vertical)
      for (const z of zones) {
        const isLocked = lockedZoneIdsRef.current.has(z.id);
        let target = isLocked ? 0.0 : 1.0;
        if (!isLocked) {
          const door = getDoorwayForZone(z);
          const doorCenter = { x: door.x + door.w / 2, y: door.y + door.h / 2 };
          const distToDoor = Math.hypot(pos.current.x - doorCenter.x, pos.current.y - doorCenter.y);
          if (distToDoor < 45) {
            target = 1.15; // Swings wide open when avatar passes through
          }
        }
        const current = doorProgressRef.current.get(z.id) ?? target;
        const diff = target - current;
        if (Math.abs(diff) > 0.002) {
          const next = current + diff * Math.min(1, dt * 8);
          doorProgressRef.current.set(z.id, next);
        } else {
          doorProgressRef.current.set(z.id, target);
        }
      }

      // Rooms + furniture with architectural walls, animated doors & textures
      for (const z of zones) {
        drawZone(
          ctx,
          z,
          s,
          lockedZoneIdsRef.current,
          isCampus,
          rendered3D,
          doorProgressRef.current,
          now,
        );
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

      // Ensure local player avatar is ALWAYS present and rendered at 60fps from pos.current
      const authUser = useAuthStore.getState().user;
      const localUserId = me || authUser?.id || 'local-user';
      const localDisplayName =
        (me && users[me]?.displayName) ||
        authUser?.displayName ||
        'You';
      const localStatus = (me && users[me]?.status) || UserStatus.Available;

      const allUsersMap: Record<string, PresenceState> = { ...users };
      if (!allUsersMap[localUserId]) {
        allUsersMap[localUserId] = {
          userId: localUserId,
          displayName: localDisplayName,
          avatarUrl: authUser?.avatarUrl ?? null,
          position: { x: pos.current.x, y: pos.current.y },
          status: localStatus,
          zoneId: currentZoneRef.current?.id ?? null,
        };
      }

      const roster = Object.values(allUsersMap).map((u) => {
        if (u.userId === localUserId) {
          return { ...u, position: { x: pos.current.x, y: pos.current.y } };
        }
        return u;
      }).sort((a, b) => a.position.y - b.position.y);

      // Proximity ring around me (uses real-time pos.current)
      {
        const cx = pos.current.x * s;
        const cy = pos.current.y * s;
        ctx.beginPath();
        ctx.arc(cx, cy, PROXIMITY_RADIUS * s, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(95,92,240,0.06)';
        ctx.fill();
        ctx.setLineDash([6 * s, 6 * s]);
        ctx.strokeStyle = 'rgba(95,92,240,0.40)';
        ctx.lineWidth = 1.5 * s;
        ctx.stroke();
        ctx.setLineDash([]);
      }

      // Avatars — painter's order by y so nearer ones overlap correctly
      for (const u of roster) {
        const isSelf = u.userId === localUserId;
        const worldX = isSelf ? pos.current.x : u.position.x;
        const worldY = isSelf ? pos.current.y : u.position.y;
        const x = worldX * s;
        const y = worldY * s;

        const prev = anim.current.get(u.userId);
        const dxu = prev ? worldX - prev.x : 0;
        const dyu = prev ? worldY - prev.y : 0;
        const distMoved = Math.hypot(dxu, dyu);

        // Self is moving only when actually displacing in world coordinates
        const isSelfMoving =
          isSelf &&
          distMoved > 0.08 &&
          (keys.current.size > 0 || pathWaypoints.current.length > 0 || distMoved > 0.15);
        const moving = isSelf ? isSelfMoving : distMoved > 0.4;
        const facing = dxu > 0.15 ? 1 : dxu < -0.15 ? -1 : (prev?.facing ?? 1);
        const phase = moving ? (prev?.phase ?? 0) + dt * 10 : 0;
        anim.current.set(u.userId, { x: worldX, y: worldY, facing, phase });

        const safeName = u.displayName || 'You';
        drawCharacter(ctx, x, y, s, {
          color: shirtFor(safeName),
          hair: hairFor(safeName),
          skin: skinFor(safeName),
          name: safeName + (isSelf ? ' (you)' : ''),
          facing,
          moving,
          phase,
          talking: groupSet.has(u.userId),
          isSelf,
          statusColor: STATUS_COLOR[u.status] ?? '#8b93a7',
          t: now,
          isSelected: selectedUser?.userId === u.userId,
        });
      }

      ctx.restore();

      raf = requestAnimationFrame(step);
    };

    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [containerSize, zones, onMove, selectedUser, zoom, cameraOffset, campusViewMode]);

  const dpr = typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1;

  // Camera Zoom & Pan Controls
  const floorW = FLOOR_WIDTH;
  const floorH = isCampus ? 1080 : FLOOR_HEIGHT;

  function handleZoomIn() {
    const fitScale = Math.min(containerSize.width / floorW, containerSize.height / floorH);
    const curZoom = zoom ?? fitScale;
    const nextZoom = Math.min(fitScale * 3.5, curZoom * 1.25);
    setZoom(nextZoom);
  }

  function handleZoomOut() {
    const fitScale = Math.min(containerSize.width / floorW, containerSize.height / floorH);
    const curZoom = zoom ?? fitScale;
    const nextZoom = curZoom * 0.8;
    if (nextZoom <= fitScale * 1.05) {
      setZoom(null);
      setCameraOffset({ x: 0, y: 0 });
    } else {
      setZoom(nextZoom);
    }
  }

  function handleResetFit() {
    setZoom(null);
    setCameraOffset({ x: 0, y: 0 });
  }

  function handleWheel(e: React.WheelEvent<HTMLCanvasElement>) {
    e.preventDefault();
    const fitScale = Math.min(containerSize.width / floorW, containerSize.height / floorH);
    const curZoom = zoom ?? fitScale;
    const factor = e.deltaY < 0 ? 1.12 : 0.89;
    const nextZoom = curZoom * factor;
    if (nextZoom <= fitScale * 1.02) {
      setZoom(null);
      setCameraOffset({ x: 0, y: 0 });
    } else {
      setZoom(Math.min(fitScale * 3.5, nextZoom));
    }
  }

  function handlePointerDown(e: React.PointerEvent<HTMLCanvasElement>) {
    if (e.button !== 0) return;
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    isPointerDown.current = true;
    pointerStart.current = { x: e.clientX, y: e.clientY };
    lastPointer.current = { x: e.clientX, y: e.clientY };
    hasDragged.current = false;
  }

  function handlePointerMove(e: React.PointerEvent<HTMLCanvasElement>) {
    if (!isPointerDown.current) return;
    const dx = e.clientX - lastPointer.current.x;
    const dy = e.clientY - lastPointer.current.y;
    const totalDist = Math.hypot(e.clientX - pointerStart.current.x, e.clientY - pointerStart.current.y);
    if (totalDist > 5) {
      hasDragged.current = true;
      if (zoomRef.current === null) {
        const fitScale = Math.min(containerSize.width / floorW, containerSize.height / floorH);
        setZoom(fitScale);
      }
      setCameraOffset((prev) => ({ x: prev.x + dx, y: prev.y + dy }));
    }
    lastPointer.current = { x: e.clientX, y: e.clientY };
  }

  function handlePointerUp(e: React.PointerEvent<HTMLCanvasElement>) {
    if (!isPointerDown.current) return;
    isPointerDown.current = false;
    try {
      (e.target as HTMLElement).releasePointerCapture(e.pointerId);
    } catch {}

    if (hasDragged.current) return;

    // Was a click!
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    const { s, panX, panY } = getCameraTransform(
      containerSizeRef.current,
      pos.current,
      zoomRef.current,
      cameraOffsetRef.current,
      isCampus,
    );

    const clickX = (mouseX - panX) / s;
    const clickY = (mouseY - panY) / s;

    // Check if clicked on coworker avatar
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

  if (campusViewMode === 'sky-3d') {
    return (
      <div
        ref={containerRef}
        className="relative h-full w-full overflow-hidden rounded-2xl border border-surface-3 bg-slate-950 select-none"
      >
        <SkyCampus3D
          zones={zones}
          onMove={onMove}
          onZoneEnter={onZoneEnter}
          onZoneLeave={onZoneLeave}
          onZoneChange={onZoneChange}
          onStartDm={onStartDm}
        />

        {/* Floating View Switcher HUD */}
        <div className="absolute bottom-4 right-4 z-20 flex items-center gap-1 rounded-2xl border border-white/10 bg-slate-900/90 p-1.5 shadow-2xl backdrop-blur">
          <div className="flex items-center rounded-xl bg-slate-800/80 p-0.5 border border-white/10">
            <button
              onClick={() => setCampusViewMode('sky-3d')}
              className="flex items-center gap-1 rounded-lg px-2.5 py-1 text-xs font-semibold bg-indigo-600 text-white shadow-sm"
              title="3D Sky-Tower & Penthouse Terrace"
            >
              <span>🌌 Sky-Tower</span>
            </button>
            <button
              onClick={() => setCampusViewMode('3d')}
              className="flex items-center gap-1 rounded-lg px-2.5 py-1 text-xs font-semibold text-slate-300 hover:text-white transition"
              title="Switch to 3D Isometric View"
            >
              <span>🖼️ 3D</span>
            </button>
            <button
              onClick={() => setCampusViewMode('2d')}
              className="flex items-center gap-1 rounded-lg px-2.5 py-1 text-xs font-semibold text-slate-300 hover:text-white transition"
              title="Switch to 2D Garden View"
            >
              <span>🌿 2D</span>
            </button>
          </div>
        </div>

        {/* Wave notification toast */}
        {waveToast && (
          <div className="pointer-events-none absolute top-4 left-1/2 -translate-x-1/2 z-30 flex items-center gap-2 rounded-full bg-surface-0/95 px-4 py-2 text-sm font-semibold text-brand-700 shadow-xl border border-brand-200 backdrop-blur animate-in fade-in slide-in-from-top-2">
            {waveToast}
          </div>
        )}
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className="relative h-full w-full overflow-hidden rounded-2xl border border-surface-3 bg-slate-950 select-none"
    >
      <canvas
        ref={canvasRef}
        width={Math.round(containerSize.width * dpr)}
        height={Math.round(containerSize.height * dpr)}
        style={{ width: '100%', height: '100%' }}
        className="cursor-grab active:cursor-grabbing"
        role="application"
        aria-label="Virtual office floor. Click to walk, or drag to pan around."
        tabIndex={0}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onWheel={handleWheel}
      />

      {/* Floating Camera Controls HUD */}
      <div className="absolute bottom-4 right-4 z-20 flex items-center gap-1 rounded-2xl border border-white/10 bg-slate-900/90 p-1.5 shadow-2xl backdrop-blur">
        <button
          onClick={handleZoomOut}
          className="flex h-7 w-7 items-center justify-center rounded-xl text-sm font-bold text-slate-200 transition hover:bg-white/10 active:scale-95"
          title="Zoom Out"
          aria-label="Zoom Out"
        >
          −
        </button>
        <button
          onClick={handleResetFit}
          className={`flex items-center gap-1.5 rounded-xl px-2.5 py-1 text-xs font-semibold transition active:scale-95 ${
            zoom === null
              ? 'bg-brand-500/20 text-brand-300 border border-brand-500/30'
              : 'text-slate-300 hover:bg-white/10'
          }`}
          title="Fit Entire Floor to Screen"
          aria-label="Fit Screen"
        >
          <span>⤢</span>
          <span>Fit Screen</span>
        </button>
        <button
          onClick={handleZoomIn}
          className="flex h-7 w-7 items-center justify-center rounded-xl text-sm font-bold text-slate-200 transition hover:bg-white/10 active:scale-95"
          title="Zoom In"
          aria-label="Zoom In"
        >
          +
        </button>

        {isCampus && (
          <div className="ml-1 flex items-center rounded-xl bg-slate-800/80 p-0.5 border border-white/10">
            <button
              onClick={() => setCampusViewMode('sky-3d')}
              className="flex items-center gap-1 rounded-lg px-2.5 py-1 text-xs font-semibold text-slate-300 hover:text-white transition"
              title="Switch to 3D Sky-Tower & Penthouse Terrace"
            >
              <span>🌌 Sky-Tower</span>
            </button>
            <button
              onClick={() => setCampusViewMode('3d')}
              className={`flex items-center gap-1 rounded-lg px-2.5 py-1 text-xs font-semibold transition ${
                campusViewMode === '3d'
                  ? 'bg-sky-500 text-white shadow-sm'
                  : 'text-slate-300 hover:text-white'
              }`}
              title="Switch to 3D Isometric View"
            >
              <span>🖼️ 3D</span>
            </button>
            <button
              onClick={() => setCampusViewMode('2d')}
              className={`flex items-center gap-1 rounded-lg px-2.5 py-1 text-xs font-semibold transition ${
                campusViewMode === '2d'
                  ? 'bg-emerald-600 text-white shadow-sm'
                  : 'text-slate-300 hover:text-white'
              }`}
              title="Switch to 2D Garden View"
            >
              <span>🌿 2D</span>
            </button>
          </div>
        )}
      </div>

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

/** Draws a premier, top-down 3D styled walking human character with animated stepping legs, swinging arms, tailored suit blazer, volumetric hair, and interactive indicators. */
function drawCharacter(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  s: number,
  o: CharOpts,
): void {
  ctx.save();

  // Vertical bobbing when walking
  const bob = o.moving ? Math.abs(Math.sin(o.phase * 1.3)) * 3 * s : 0;
  const cy = y - bob;

  // 1. Ground Locator Halo Ring for Local User (Guarantees user immediately spots their character)
  if (o.isSelf) {
    ctx.save();
    // Inner bright electric-cyan ground ring
    ctx.beginPath();
    ctx.ellipse(x, y + 15 * s, 22 * s, 8.5 * s, 0, 0, Math.PI * 2);
    ctx.strokeStyle = '#38bdf8';
    ctx.lineWidth = 2.5 * s;
    ctx.shadowColor = '#00f0ff';
    ctx.shadowBlur = 10 * s;
    ctx.stroke();

    // Outer pulsating radar wave ring
    const waveProgress = (o.t / 950) % 1;
    ctx.beginPath();
    ctx.ellipse(
      x,
      y + 15 * s,
      (22 + waveProgress * 18) * s,
      (8.5 + waveProgress * 7) * s,
      0,
      0,
      Math.PI * 2,
    );
    ctx.strokeStyle = `rgba(56, 189, 248, ${0.75 * (1 - waveProgress)})`;
    ctx.lineWidth = 1.8 * s;
    ctx.shadowBlur = 0;
    ctx.stroke();
    ctx.restore();
  }

  // 2. Multilayer Ground Ambient Shadow (Soft contact shadow under character)
  ctx.beginPath();
  const shadowW = (22 + (o.moving ? Math.sin(o.phase) * 2 : 0)) * s;
  ctx.ellipse(x, y + 15 * s, shadowW, 7.5 * s, 0, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(15, 23, 42, 0.32)';
  ctx.fill();

  // 3. Speaking Audio Halo Waves
  if (o.talking) {
    const pulsePhase = (o.t / 140) % 1;
    const r1 = (28 + pulsePhase * 20) * s;
    const a1 = (1 - pulsePhase) * 0.6;
    ctx.beginPath();
    ctx.arc(x, cy, r1, 0, Math.PI * 2);
    ctx.strokeStyle = `rgba(99, 102, 241, ${a1})`;
    ctx.lineWidth = 2.5 * s;
    ctx.stroke();

    const pulsePhase2 = (o.t / 140 + 0.5) % 1;
    const r2 = (28 + pulsePhase2 * 20) * s;
    const a2 = (1 - pulsePhase2) * 0.5;
    ctx.beginPath();
    ctx.arc(x, cy, r2, 0, Math.PI * 2);
    ctx.strokeStyle = `rgba(56, 189, 248, ${a2})`;
    ctx.lineWidth = 1.8 * s;
    ctx.stroke();
  }

  // 4. Selection Highlight Ring
  if (o.isSelected) {
    ctx.beginPath();
    ctx.arc(x, cy, 28 * s, 0, Math.PI * 2);
    ctx.strokeStyle = '#38bdf8';
    ctx.lineWidth = 2.5 * s;
    ctx.stroke();
  }

  // 5. Stepping Legs & Shoes (Walking animation)
  const legStride = o.moving ? Math.sin(o.phase) * 8 * s : 0;
  const footSpacing = 6 * s;

  // Left Leg & Shoe
  const leftFootX = x - footSpacing;
  const leftFootY = cy + 12 * s + legStride;
  // Left trouser leg
  ctx.fillStyle = '#1e293b';
  roundRect(ctx, leftFootX - 3.2 * s, cy + 4 * s + legStride * 0.4, 6.4 * s, 12 * s, 2.5 * s);
  ctx.fill();
  // Left shoe body
  ctx.fillStyle = '#0f172a';
  roundRect(ctx, leftFootX - 3.6 * s, leftFootY + 2 * s, 7.2 * s, 10 * s, 3 * s);
  ctx.fill();
  // Left shoe sole trim (crisp white sneaker / dress shoe rim)
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(leftFootX - 3.6 * s, leftFootY + 9 * s, 7.2 * s, 2.5 * s);

  // Right Leg & Shoe
  const rightFootX = x + footSpacing;
  const rightFootY = cy + 12 * s - legStride;
  // Right trouser leg
  ctx.fillStyle = '#1e293b';
  roundRect(ctx, rightFootX - 3.2 * s, cy + 4 * s - legStride * 0.4, 6.4 * s, 12 * s, 2.5 * s);
  ctx.fill();
  // Right shoe body
  ctx.fillStyle = '#0f172a';
  roundRect(ctx, rightFootX - 3.6 * s, rightFootY + 2 * s, 7.2 * s, 10 * s, 3 * s);
  ctx.fill();
  // Right shoe sole trim
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(rightFootX - 3.6 * s, rightFootY + 9 * s, 7.2 * s, 2.5 * s);

  // 6. Arms & Hands (swinging opposite to leg stride)
  const armSwing = -legStride * 0.75;

  // Left Arm
  ctx.fillStyle = o.color;
  roundRect(ctx, x - 17.5 * s, cy - 4 * s + armSwing, 5.5 * s, 14 * s, 2.6 * s);
  ctx.fill();
  // Left hand
  ctx.fillStyle = o.skin;
  ctx.beginPath();
  ctx.arc(x - 14.8 * s, cy + 12 * s + armSwing, 2.8 * s, 0, Math.PI * 2);
  ctx.fill();

  // Right Arm
  ctx.fillStyle = o.color;
  roundRect(ctx, x + 12 * s, cy - 4 * s - armSwing, 5.5 * s, 14 * s, 2.6 * s);
  ctx.fill();
  // Right hand
  ctx.fillStyle = o.skin;
  ctx.beginPath();
  ctx.arc(x + 14.8 * s, cy + 12 * s - armSwing, 2.8 * s, 0, Math.PI * 2);
  ctx.fill();

  // 7. Main Torso / Tailored Suit Blazer
  const torsoW = 24 * s;
  const torsoH = 17 * s;
  roundRect(ctx, x - torsoW / 2, cy - 5 * s, torsoW, torsoH, 6 * s);
  ctx.fillStyle = o.color;
  ctx.fill();

  // 3D Torso lighting gradient
  const torsoShade = ctx.createLinearGradient(x - torsoW / 2, cy - 5 * s, x + torsoW / 2, cy + torsoH);
  torsoShade.addColorStop(0, 'rgba(255, 255, 255, 0.24)');
  torsoShade.addColorStop(0.5, 'rgba(0, 0, 0, 0)');
  torsoShade.addColorStop(1, 'rgba(0, 0, 0, 0.32)');
  ctx.fillStyle = torsoShade;
  roundRect(ctx, x - torsoW / 2, cy - 5 * s, torsoW, torsoH, 6 * s);
  ctx.fill();

  // Crisp White Collar / Shirt V-Neck
  ctx.beginPath();
  ctx.moveTo(x - 5 * s, cy - 5 * s);
  ctx.lineTo(x, cy + 4 * s);
  ctx.lineTo(x + 5 * s, cy - 5 * s);
  ctx.closePath();
  ctx.fillStyle = '#ffffff';
  ctx.fill();

  // Tie / Lapel Center
  ctx.beginPath();
  ctx.moveTo(x - 1.5 * s, cy - 2 * s);
  ctx.lineTo(x + 1.5 * s, cy - 2 * s);
  ctx.lineTo(x + 1 * s, cy + 6 * s);
  ctx.lineTo(x, cy + 8 * s);
  ctx.lineTo(x - 1 * s, cy + 6 * s);
  ctx.closePath();
  ctx.fillStyle = o.isSelf ? '#38bdf8' : '#e11d48';
  ctx.fill();

  // 8. Head, Neck & 3D Volumetric Styled Hair
  const headY = cy - 14 * s;

  // Neck
  ctx.fillStyle = o.skin;
  ctx.fillRect(x - 3.5 * s, headY + 5 * s, 7 * s, 6 * s);

  // Head / Cranium
  ctx.beginPath();
  ctx.arc(x, headY, 11 * s, 0, Math.PI * 2);
  ctx.fillStyle = o.skin;
  ctx.fill();

  // 3D Head shading
  const headGrad = ctx.createRadialGradient(x - 3 * s, headY - 4 * s, 1.5 * s, x, headY, 11.5 * s);
  headGrad.addColorStop(0, 'rgba(255, 255, 255, 0.28)');
  headGrad.addColorStop(0.75, 'rgba(0, 0, 0, 0)');
  headGrad.addColorStop(1, 'rgba(0, 0, 0, 0.22)');
  ctx.fillStyle = headGrad;
  ctx.beginPath();
  ctx.arc(x, headY, 11 * s, 0, Math.PI * 2);
  ctx.fill();

  // Facial Profile / Brow in direction of facing
  const faceOffset = o.facing * 3 * s;
  ctx.fillStyle = 'rgba(15, 23, 42, 0.75)';
  ctx.beginPath();
  ctx.arc(x + faceOffset - 3 * s, headY + 1 * s, 1.5 * s, 0, Math.PI * 2);
  ctx.arc(x + faceOffset + 3 * s, headY + 1 * s, 1.5 * s, 0, Math.PI * 2);
  ctx.fill();

  // 3D Volumetric Hair Cap & Tufts
  ctx.fillStyle = o.hair;
  ctx.beginPath();
  // Hair base
  ctx.arc(x, headY - 2 * s, 11.5 * s, Math.PI * 0.82, Math.PI * 2.18);
  ctx.fill();

  // Volumetric hair side parts & front swoop
  ctx.beginPath();
  ctx.arc(x - 4 * s + faceOffset * 0.6, headY - 5 * s, 7 * s, 0, Math.PI * 2);
  ctx.arc(x + 3 * s + faceOffset * 0.6, headY - 5.5 * s, 6.5 * s, 0, Math.PI * 2);
  ctx.fill();

  // Hair Specular Highlight
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.32)';
  ctx.lineWidth = 1.8 * s;
  ctx.beginPath();
  ctx.arc(x, headY - 4.5 * s, 8.5 * s, Math.PI * 1.15, Math.PI * 1.75);
  ctx.stroke();

  // 9. Directional Heading Indicator (when walking)
  if (o.moving) {
    const arrowX = x + o.facing * 22 * s;
    ctx.beginPath();
    ctx.moveTo(arrowX + o.facing * 4 * s, cy);
    ctx.lineTo(arrowX - o.facing * 4.5 * s, cy - 5 * s);
    ctx.lineTo(arrowX - o.facing * 4.5 * s, cy + 5 * s);
    ctx.closePath();
    ctx.fillStyle = o.isSelf ? '#38bdf8' : '#94a3b8';
    ctx.fill();
  }

  // 10. Status Jewel Badge (concentric emerald / ruby / amber / violet jewel)
  const dotX = x + 13 * s;
  const dotY = cy + 12 * s;
  ctx.beginPath();
  ctx.arc(dotX, dotY, 5 * s, 0, Math.PI * 2);
  ctx.fillStyle = '#ffffff';
  ctx.fill();
  ctx.beginPath();
  ctx.arc(dotX, dotY, 3.6 * s, 0, Math.PI * 2);
  ctx.fillStyle = o.statusColor;
  ctx.fill();

  // 11. Floating Glassmorphic Name Badge
  ctx.font = `600 ${11 * s}px Inter, sans-serif`;
  const tw = ctx.measureText(o.name).width;
  const padX = 9 * s;
  const pillH = 20 * s;
  const pillW = tw + padX * 2;
  const px = x - pillW / 2;
  const py = headY - 16 * s - pillH;

  roundRect(ctx, px, py, pillW, pillH, 10 * s);
  ctx.fillStyle = o.isSelf ? '#1e1b4b' : 'rgba(15, 23, 42, 0.90)';
  ctx.fill();
  ctx.strokeStyle = o.isSelf ? '#38bdf8' : 'rgba(255, 255, 255, 0.20)';
  ctx.lineWidth = o.isSelf ? 1.5 : 1;
  ctx.stroke();

  ctx.fillStyle = '#ffffff';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(o.name, x, py + pillH / 2);
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';

  ctx.restore();
}

/**
 * Draws an architectural top-down CAD-style hinged door with realistic wood leaf,
 * brass lever handle, hinge pivot pin, dotted swing arc, and fluid opening/closing animation.
 *
 * Usually (unlocked): The door is OPEN (stays VERTICAL into the room, leaving the corridor opening clear).
 * When locked: The door animates to CLOSED (HORIZONTAL across the doorway, sealing the entrance with a red lock status LED).
 */
function drawArchitecturalDoor(
  ctx: CanvasRenderingContext2D,
  door: Doorway,
  openProgress: number, // 0.0 = horizontal/closed, 1.0 = vertical/open
  isLocked: boolean,
  s: number,
): void {
  const dX = door.x * s;
  const dY = door.y * s;
  const dW = Math.max(door.w * s, 16 * s);
  const dH = Math.max(door.h * s, 16 * s);
  const isBottom = door.side === 'bottom';
  const isTop = door.side === 'top';
  const isRight = door.side === 'right';

  // Hinge point and door leaf dimensions
  const hx = dX;
  const hy = dY;
  const doorLen = isBottom || isTop ? dW : dH;

  // Calculate leaf angle based on orientation and openProgress
  // Closed (0.0): lies flush with wall (horizontal for top/bottom, vertical for left/right)
  // Open (1.0): swings 90 degrees into the room (vertical for top/bottom, horizontal for left/right)
  let angle = 0;
  if (isBottom) {
    // Wall is horizontal at bottom (y = dY). Closed = 0 rad (horizontal). Open swings -90° (upward into room).
    angle = -openProgress * (Math.PI / 2);
  } else if (isTop) {
    // Wall is horizontal at top (y = dY). Closed = 0 rad (horizontal). Open swings +90° (downward into room).
    angle = openProgress * (Math.PI / 2);
  } else if (isRight) {
    // Wall is vertical at right (x = dX). Closed = Math.PI / 2 (vertical). Open swings +90° (leftward into room).
    angle = Math.PI / 2 + openProgress * (Math.PI / 2);
  } else {
    // Left side: Closed = Math.PI / 2 (vertical). Open swings -90° (rightward into room).
    angle = Math.PI / 2 - openProgress * (Math.PI / 2);
  }

  const tipX = hx + Math.cos(angle) * doorLen;
  const tipY = hy + Math.sin(angle) * doorLen;

  ctx.save();

  // 1. Threshold Flooring & Door Jambs
  ctx.fillStyle = isLocked ? 'rgba(239, 68, 68, 0.14)' : 'rgba(226, 232, 240, 0.75)';
  if (isBottom || isTop) {
    ctx.fillRect(dX, hy - 2.5 * s, dW, 5 * s);
  } else {
    ctx.fillRect(hx - 2.5 * s, dY, 5 * s, dH);
  }

  // Steel Door Jamb Caps on both sides of opening
  ctx.fillStyle = '#0f172a';
  if (isBottom || isTop) {
    roundRect(ctx, dX - 2.5 * s, hy - 4 * s, 5 * s, 8 * s, 1.5 * s);
    ctx.fill();
    roundRect(ctx, dX + dW - 2.5 * s, hy - 4 * s, 5 * s, 8 * s, 1.5 * s);
    ctx.fill();
  } else {
    roundRect(ctx, hx - 4 * s, dY - 2.5 * s, 8 * s, 5 * s, 1.5 * s);
    ctx.fill();
    roundRect(ctx, hx - 4 * s, dY + dH - 2.5 * s, 8 * s, 5 * s, 1.5 * s);
    ctx.fill();
  }

  // 2. Realistic Door Leaf Body with drop shadow
  ctx.lineCap = 'round';

  // Drop shadow
  ctx.beginPath();
  ctx.moveTo(hx, hy);
  ctx.lineTo(tipX, tipY);
  ctx.lineWidth = 6.5 * s;
  ctx.strokeStyle = 'rgba(15, 23, 42, 0.16)';
  ctx.stroke();

  // Solid wood door slab
  ctx.beginPath();
  ctx.moveTo(hx, hy);
  ctx.lineTo(tipX, tipY);
  ctx.lineWidth = 4.4 * s;
  ctx.strokeStyle = isLocked ? '#991b1b' : '#b4783c';
  ctx.stroke();

  // Wood grain / trim highlight
  ctx.beginPath();
  ctx.moveTo(hx, hy);
  ctx.lineTo(tipX, tipY);
  ctx.lineWidth = 1.8 * s;
  ctx.strokeStyle = isLocked ? '#ef4444' : '#e2ab6f';
  ctx.stroke();

  // 4. Brass Lever Handle (placed at 80% along leaf length)
  const handleFrac = 0.8;
  const hxH = hx + Math.cos(angle) * (doorLen * handleFrac);
  const hyH = hy + Math.sin(angle) * (doorLen * handleFrac);
  const normA = angle + Math.PI / 2;
  const handleW = 4.5 * s;

  ctx.beginPath();
  ctx.moveTo(hxH - Math.cos(normA) * handleW, hyH - Math.sin(normA) * handleW);
  ctx.lineTo(hxH + Math.cos(normA) * handleW, hyH + Math.sin(normA) * handleW);
  ctx.lineWidth = 2.4 * s;
  ctx.strokeStyle = isLocked ? '#fca5a5' : '#f59e0b';
  ctx.stroke();

  // Glowing red lock indicator LED on handle when locked
  if (isLocked) {
    ctx.beginPath();
    ctx.arc(hxH, hyH, 3.2 * s, 0, Math.PI * 2);
    ctx.fillStyle = '#ef4444';
    ctx.fill();
    ctx.shadowColor = '#ef4444';
    ctx.shadowBlur = 6 * s;
    ctx.stroke();
    ctx.shadowBlur = 0;
  }

  // 5. Heavy-duty Steel & Brass Hinge Pivot at door frame
  ctx.beginPath();
  ctx.arc(hx, hy, 3.8 * s, 0, Math.PI * 2);
  ctx.fillStyle = '#0f172a';
  ctx.fill();
  ctx.beginPath();
  ctx.arc(hx, hy, 1.8 * s, 0, Math.PI * 2);
  ctx.fillStyle = '#f59e0b';
  ctx.fill();

  ctx.restore();
}

/**
 * Draws a modern architectural sliding pocket/track door.
 *
 * Usually (unlocked): The frosted glass door leaf is SLID OPEN into the wall pocket,
 * leaving the doorway 100% clear with zero intrusion into tables or furniture.
 * When locked: The door leaf glides closed across the doorway opening, sealed with a radiant red lock status LED.
 */
function drawSlidingDoor(
  ctx: CanvasRenderingContext2D,
  door: Doorway,
  openProgress: number, // 0.0 = closed/locked across doorway, 1.0 = slid open into wall pocket
  isLocked: boolean,
  s: number,
): void {
  const dX = door.x * s;
  const dY = door.y * s;
  const dW = Math.max(door.w * s, 16 * s);
  const dH = Math.max(door.h * s, 16 * s);
  const isHorizontal = door.side === 'bottom' || door.side === 'top';

  ctx.save();

  // 1. Sleek guide track along wall and doorway opening
  ctx.strokeStyle = isLocked ? 'rgba(239, 68, 68, 0.45)' : 'rgba(148, 163, 184, 0.5)';
  ctx.lineWidth = 1.8 * s;
  ctx.beginPath();
  if (isHorizontal) {
    // Track spans the doorway and pocket along the horizontal wall
    ctx.moveTo(dX - 2 * s, dY);
    ctx.lineTo(dX + dW * 1.95, dY);
  } else {
    // Track spans the doorway and pocket along the vertical wall
    ctx.moveTo(dX, dY - 2 * s);
    ctx.lineTo(dX, dY + dH * 1.95);
  }
  ctx.stroke();

  // 2. Door threshold floor plate under the opening
  ctx.fillStyle = isLocked ? 'rgba(239, 68, 68, 0.16)' : 'rgba(226, 232, 240, 0.85)';
  if (isHorizontal) {
    ctx.fillRect(dX, dY - 2.5 * s, dW, 5 * s);
  } else {
    ctx.fillRect(dX - 2.5 * s, dY, 5 * s, dH);
  }

  // 3. Wall Pocket / Track End Stoppers (sleek dark anodized steel)
  ctx.fillStyle = '#0f172a';
  if (isHorizontal) {
    roundRect(ctx, dX - 3 * s, dY - 4 * s, 4 * s, 8 * s, 1.5 * s);
    ctx.fill();
    roundRect(ctx, dX + dW * 1.95 - 2 * s, dY - 4 * s, 4 * s, 8 * s, 1.5 * s);
    ctx.fill();
  } else {
    roundRect(ctx, dX - 4 * s, dY - 3 * s, 8 * s, 4 * s, 1.5 * s);
    ctx.fill();
    roundRect(ctx, dX - 4 * s, dY + dH * 1.95 - 2 * s, 8 * s, 4 * s, 1.5 * s);
    ctx.fill();
  }

  // 4. Sliding Glass Panel
  // When closed (openProgress = 0): leaf is at [dX, dX + dW] covering opening
  // When open (openProgress = 1): leaf is slid into pocket at [dX + dW * 0.95, ...]
  const slideOffset = openProgress * (dW * 0.95);
  const slideOffsetY = openProgress * (dH * 0.95);

  const panelX = isHorizontal ? dX + slideOffset : dX - 2.5 * s;
  const panelY = isHorizontal ? dY - 2.5 * s : dY + slideOffsetY;
  const panelW = isHorizontal ? dW : 5 * s;
  const panelH = isHorizontal ? 5 * s : dH;

  // Drop shadow
  ctx.fillStyle = 'rgba(15, 23, 42, 0.20)';
  roundRect(ctx, panelX + 1 * s, panelY + 1.5 * s, panelW, panelH, 2 * s);
  ctx.fill();

  // Panel slab: Frosted architectural glass with satin metal frame
  ctx.fillStyle = isLocked
    ? 'rgba(239, 68, 68, 0.45)'
    : 'rgba(241, 245, 249, 0.92)';
  roundRect(ctx, panelX, panelY, panelW, panelH, 2 * s);
  ctx.fill();

  // Perimeter metallic frame
  ctx.strokeStyle = isLocked ? '#dc2626' : '#64748b';
  ctx.lineWidth = 1.6 * s;
  ctx.stroke();

  // Glass refraction highlight streak along center
  ctx.strokeStyle = isLocked ? 'rgba(254, 202, 202, 0.6)' : 'rgba(255, 255, 255, 0.85)';
  ctx.lineWidth = 1 * s;
  ctx.beginPath();
  if (isHorizontal) {
    ctx.moveTo(panelX + 4 * s, panelY + panelH / 2);
    ctx.lineTo(panelX + panelW - 4 * s, panelY + panelH / 2);
  } else {
    ctx.moveTo(panelX + panelW / 2, panelY + 4 * s);
    ctx.lineTo(panelX + panelW / 2, panelY + panelH - 4 * s);
  }
  ctx.stroke();

  // 5. Sleek Flush-Pull Handle (stainless steel bar in the door leaf)
  const handleFrac = 0.5;
  const hx = isHorizontal ? panelX + panelW * handleFrac : panelX + panelW / 2;
  const hy = isHorizontal ? panelY + panelH / 2 : panelY + panelH * handleFrac;

  ctx.fillStyle = isLocked ? '#ef4444' : '#0f172a';
  ctx.beginPath();
  if (isHorizontal) {
    roundRect(ctx, hx - 5 * s, hy - 1.2 * s, 10 * s, 2.4 * s, 1 * s);
  } else {
    roundRect(ctx, hx - 1.2 * s, hy - 5 * s, 2.4 * s, 10 * s, 1 * s);
  }
  ctx.fill();

  // 6. Modern Electronic Lock Status LED on handle
  ctx.beginPath();
  ctx.arc(hx, hy, 2.4 * s, 0, Math.PI * 2);
  ctx.fillStyle = isLocked ? '#ef4444' : '#10b981';
  ctx.fill();
  if (isLocked) {
    ctx.shadowColor = '#ef4444';
    ctx.shadowBlur = 6 * s;
    ctx.stroke();
    ctx.shadowBlur = 0;
  }

  ctx.restore();
}

function drawZone(
  ctx: CanvasRenderingContext2D,
  z: Zone,
  s: number,
  lockedZoneIds: Set<string> = new Set(),
  isCampus: boolean = false,
  rendered3D: boolean = false,
  doorProgressMap?: Map<string, number>,
  _now: number = 0,
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

  // If 3D campus backdrop is active, avoid drawing opaque floors over the 3D map!
  if (isCampus && rendered3D) {
    const door = getDoorwayForZone(z);
    const dX = door.x * s;
    const dY = door.y * s;
    const dW = Math.max(door.w * s, 12 * s);
    const dH = Math.max(door.h * s, 12 * s);

    if (isLocked) {
      // Semi-transparent red privacy lock overlay
      roundRect(ctx, X, Y, W, H, 10 * s);
      ctx.fillStyle = 'rgba(239, 68, 68, 0.15)';
      ctx.fill();
      ctx.strokeStyle = 'rgba(239, 68, 68, 0.45)';
      ctx.lineWidth = 1.5 * s;
      ctx.stroke();

      // Glowing red locked laser barrier across doorway
      ctx.save();
      ctx.beginPath();
      ctx.lineWidth = 5 * s;
      ctx.strokeStyle = '#ef4444';
      if (door.side === 'top' || door.side === 'bottom') {
        ctx.moveTo(dX, dY);
        ctx.lineTo(dX + dW, dY);
      } else {
        ctx.moveTo(dX, dY);
        ctx.lineTo(dX, dY + dH);
      }
      ctx.stroke();

      // Laser glow
      ctx.lineWidth = 10 * s;
      ctx.strokeStyle = 'rgba(239, 68, 68, 0.35)';
      ctx.stroke();
      ctx.restore();
    } else {
      // Welcoming soft threshold light at doorway
      ctx.fillStyle = 'rgba(255, 255, 255, 0.15)';
      if (door.side === 'bottom') {
        ctx.fillRect(dX, Y + H - 4 * s, dW, 6 * s);
      } else if (door.side === 'top') {
        ctx.fillRect(dX, Y - 2 * s, dW, 6 * s);
      } else {
        ctx.fillRect(dX - (door.side === 'left' ? 2 * s : 4 * s), dY, 6 * s, dH);
      }
    }

    // Room title pill badge
    ctx.font = `bold ${11 * s}px Inter, sans-serif`;
    const label = isLocked ? `🔒 ${z.name} (LOCKED)` : `🔊 ${z.name}`;
    const tw = ctx.measureText(label).width;
    roundRect(ctx, X + 8 * s, Y + 8 * s, tw + 16 * s, 22 * s, 6 * s);
    ctx.fillStyle = isLocked ? 'rgba(220, 38, 38, 0.92)' : 'rgba(15, 23, 42, 0.82)';
    ctx.fill();
    ctx.strokeStyle = isLocked ? '#ef4444' : 'rgba(255, 255, 255, 0.22)';
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.fillStyle = '#ffffff';
    ctx.textBaseline = 'middle';
    ctx.fillText(label, X + 16 * s, Y + 19 * s);
    ctx.textBaseline = 'alphabetic';
    return;
  }

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
    const dW = Math.max(door.w * s, 16 * s);
    const dH = Math.max(door.h * s, 16 * s);
    const openProgress = doorProgressMap?.get(z.id) ?? (isLocked ? 0.0 : 1.0);

    // Outer architectural wall with open doorway gap
    ctx.lineWidth = 4 * s;
    ctx.strokeStyle = isCampus ? '#e2e8f0' : '#334155';
    ctx.lineCap = 'round';
    ctx.beginPath();

    // Top wall
    if (door.side === 'top') {
      ctx.moveTo(X, Y);
      ctx.lineTo(dX, Y);
      ctx.moveTo(dX + dW, Y);
      ctx.lineTo(X + W, Y);
    } else {
      ctx.moveTo(X, Y);
      ctx.lineTo(X + W, Y);
    }

    // Right wall
    if (door.side === 'right') {
      ctx.lineTo(X + W, dY);
      ctx.moveTo(X + W, dY + dH);
      ctx.lineTo(X + W, Y + H);
    } else {
      ctx.lineTo(X + W, Y + H);
    }

    // Bottom wall
    if (door.side === 'bottom') {
      ctx.lineTo(dX + dW, Y + H);
      ctx.moveTo(dX, Y + H);
      ctx.lineTo(X, Y + H);
    } else {
      ctx.lineTo(X, Y + H);
    }

    // Left wall
    if (door.side === 'left') {
      ctx.lineTo(X, dY + dH);
      ctx.moveTo(X, dY);
      ctx.lineTo(X, Y);
    } else {
      ctx.lineTo(X, Y);
    }
    ctx.stroke();

    // In Campus Garden or rooms where tables sit near the entrance, render modern architectural
    // sliding pocket doors so the door never merges into tables or furniture.
    if (isCampus) {
      drawSlidingDoor(ctx, door, openProgress, isLocked, s);
    } else {
      drawArchitecturalDoor(ctx, door, openProgress, isLocked, s);
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

    // 2. Conference Table with center cable trough
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
