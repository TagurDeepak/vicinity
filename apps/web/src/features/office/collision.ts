import { FLOOR_HEIGHT, FLOOR_WIDTH, type Vec2, type Zone } from '@vicinity/shared';

export interface WallSegment {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  zoneId: string;
}

export interface Doorway {
  zoneId: string;
  x: number;
  y: number;
  w: number;
  h: number;
  side: 'top' | 'bottom' | 'left' | 'right';
}

const AVATAR_RADIUS = 14;
const DOOR_WIDTH = 76;

/**
 * Determines which side the doorway should be placed on for a given room.
 * Ensures the door faces the primary walking corridors.
 */
export function getDoorwayForZone(z: Zone): Doorway {
  const g = z.geometry;
  const isBottomEdge = g.y + g.h >= 900;
  const isRightEdge = g.x + g.w >= 1500;

  if (isBottomEdge) {
    // Top doorway facing interior corridor
    return {
      zoneId: z.id,
      side: 'top',
      x: g.x + g.w / 2 - DOOR_WIDTH / 2,
      y: g.y,
      w: DOOR_WIDTH,
      h: 0,
    };
  }

  if (isRightEdge && g.w < 350) {
    // Left doorway
    return {
      zoneId: z.id,
      side: 'left',
      x: g.x,
      y: g.y + g.h / 2 - DOOR_WIDTH / 2,
      w: 0,
      h: DOOR_WIDTH,
    };
  }

  // Default: bottom doorway facing corridor
  return {
    zoneId: z.id,
    side: 'bottom',
    x: g.x + g.w / 2 - DOOR_WIDTH / 2,
    y: g.y + g.h,
    w: DOOR_WIDTH,
    h: 0,
  };
}

/**
 * Returns solid wall segments for all enclosed zones (meeting, focus, private).
 * If a room is locked, its doorway is also solid.
 */
export function getWallSegments(
  zones: Zone[],
  lockedZoneIds: Set<string> = new Set(),
): { walls: WallSegment[]; doorways: Doorway[] } {
  const walls: WallSegment[] = [];
  const doorways: Doorway[] = [];

  for (const z of zones) {
    // Open lounges and open terraces do not have blocking walls
    if (z.type === 'lounge' || z.type === 'open') continue;

    const g = z.geometry;
    const door = getDoorwayForZone(z);
    doorways.push(door);
    const isLocked = lockedZoneIds.has(z.id);

    // Top wall
    if (door.side === 'top' && !isLocked) {
      walls.push({ x1: g.x, y1: g.y, x2: door.x, y2: g.y, zoneId: z.id });
      walls.push({ x1: door.x + door.w, y1: g.y, x2: g.x + g.w, y2: g.y, zoneId: z.id });
    } else {
      walls.push({ x1: g.x, y1: g.y, x2: g.x + g.w, y2: g.y, zoneId: z.id });
    }

    // Bottom wall
    if (door.side === 'bottom' && !isLocked) {
      walls.push({ x1: g.x, y1: g.y + g.h, x2: door.x, y2: g.y + g.h, zoneId: z.id });
      walls.push({ x1: door.x + door.w, y1: g.y + g.h, x2: g.x + g.w, y2: g.y + g.h, zoneId: z.id });
    } else {
      walls.push({ x1: g.x, y1: g.y + g.h, x2: g.x + g.w, y2: g.y + g.h, zoneId: z.id });
    }

    // Left wall
    if (door.side === 'left' && !isLocked) {
      walls.push({ x1: g.x, y1: g.y, x2: g.x, y2: door.y, zoneId: z.id });
      walls.push({ x1: g.x, y1: door.y + door.h, x2: g.x, y2: g.y + g.h, zoneId: z.id });
    } else {
      walls.push({ x1: g.x, y1: g.y, x2: g.x, y2: g.y + g.h, zoneId: z.id });
    }

    // Right wall
    if (door.side === 'right' && !isLocked) {
      walls.push({ x1: g.x + g.w, y1: g.y, x2: g.x + g.w, y2: door.y, zoneId: z.id });
      walls.push({ x1: g.x + g.w, y1: door.y + door.h, x2: g.x + g.w, y2: g.y + g.h, zoneId: z.id });
    } else {
      walls.push({ x1: g.x + g.w, y1: g.y, x2: g.x + g.w, y2: g.y + g.h, zoneId: z.id });
    }
  }

  return { walls, doorways };
}

/** Distance from point (px, py) to line segment (x1, y1) -> (x2, y2). */
function distToSegmentSquared(
  px: number,
  py: number,
  x1: number,
  y1: number,
  x2: number,
  y2: number,
): number {
  const l2 = (x2 - x1) ** 2 + (y2 - y1) ** 2;
  if (l2 === 0) return (px - x1) ** 2 + (py - y1) ** 2;
  let t = ((px - x1) * (x2 - x1) + (py - y1) * (y2 - y1)) / l2;
  t = Math.max(0, Math.min(1, t));
  return (px - (x1 + t * (x2 - x1))) ** 2 + (py - (y1 + t * (y2 - y1))) ** 2;
}

/** Check if circle at (px, py) overlaps any wall segment. */
function collidesWithWalls(px: number, py: number, walls: WallSegment[], radius: number): boolean {
  const r2 = radius ** 2;
  for (const w of walls) {
    if (distToSegmentSquared(px, py, w.x1, w.y1, w.x2, w.y2) < r2) {
      return true;
    }
  }
  return false;
}

/**
 * Resolves avatar movement with wall collision and axis-separated sliding physics.
 */
export function resolveMovement(
  current: Vec2,
  target: Vec2,
  zones: Zone[],
  lockedZoneIds: Set<string> = new Set(),
): Vec2 {
  const { walls } = getWallSegments(zones, lockedZoneIds);

  // Clamp to canvas borders first
  const desiredX = Math.max(16, Math.min(FLOOR_WIDTH - 16, target.x));
  const desiredY = Math.max(16, Math.min(FLOOR_HEIGHT - 16, target.y));

  // If proposed position doesn't collide, accept full movement
  if (!collidesWithWalls(desiredX, desiredY, walls, AVATAR_RADIUS)) {
    return { x: desiredX, y: desiredY };
  }

  // Axis-separated sliding: try moving along X alone
  let resolvedX = current.x;
  if (!collidesWithWalls(desiredX, current.y, walls, AVATAR_RADIUS)) {
    resolvedX = desiredX;
  }

  // Then try moving along Y alone
  let resolvedY = current.y;
  if (!collidesWithWalls(resolvedX, desiredY, walls, AVATAR_RADIUS)) {
    resolvedY = desiredY;
  }

  return { x: resolvedX, y: resolvedY };
}
