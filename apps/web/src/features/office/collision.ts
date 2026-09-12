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

  // Middle-left rooms facing right vertical corridor
  if (g.x < 350 && g.y >= 300 && g.y < 750) {
    return {
      zoneId: z.id,
      side: 'right',
      x: g.x + g.w,
      y: g.y + g.h / 2 - DOOR_WIDTH / 2,
      w: 0,
      h: DOOR_WIDTH,
    };
  }

  // Middle-right rooms facing left vertical corridor
  if (g.x >= 1050 && g.y >= 300 && g.y < 750) {
    return {
      zoneId: z.id,
      side: 'left',
      x: g.x,
      y: g.y + g.h / 2 - DOOR_WIDTH / 2,
      w: 0,
      h: DOOR_WIDTH,
    };
  }

  // Bottom edge rooms facing top corridor
  const isBottomEdge = g.y + g.h >= 750;
  if (isBottomEdge) {
    return {
      zoneId: z.id,
      side: 'top',
      x: g.x + g.w / 2 - DOOR_WIDTH / 2,
      y: g.y,
      w: DOOR_WIDTH,
      h: 0,
    };
  }

  // Boardroom or right edge in standard office
  const isRightEdge = g.x + g.w >= 1500;
  if (isRightEdge && g.w < 350) {
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

const GRID_SIZE = 24;
const COLS = Math.ceil(FLOOR_WIDTH / GRID_SIZE); // 67
const ROWS = Math.ceil(FLOOR_HEIGHT / GRID_SIZE); // 40

/**
 * Checks if a line segment between p1 and p2 has direct clear line of sight
 * without intersecting any walls or world bounds.
 */
export function hasLineOfSight(
  p1: Vec2,
  p2: Vec2,
  walls: WallSegment[],
  buffer = AVATAR_RADIUS + 2,
): boolean {
  const dist = Math.hypot(p2.x - p1.x, p2.y - p1.y);
  const steps = Math.max(2, Math.ceil(dist / 10));
  for (let i = 1; i < steps; i++) {
    const t = i / steps;
    const x = p1.x + (p2.x - p1.x) * t;
    const y = p1.y + (p2.y - p1.y) * t;
    if (collidesWithWalls(x, y, walls, buffer)) {
      return false;
    }
  }
  return true;
}

/**
 * Finds an obstacle-avoiding waypoint path from `start` to `goal` using A*.
 * Returns an array of waypoints to follow, or [goal] if direct line of sight exists.
 */
export function findPath(
  start: Vec2,
  goal: Vec2,
  zones: Zone[],
  lockedZoneIds: Set<string> = new Set(),
): Vec2[] {
  const { walls } = getWallSegments(zones, lockedZoneIds);

  const clampedGoal: Vec2 = {
    x: Math.max(20, Math.min(FLOOR_WIDTH - 20, goal.x)),
    y: Math.max(20, Math.min(FLOOR_HEIGHT - 20, goal.y)),
  };

  // If there's already direct clear line of sight, head straight to goal!
  if (hasLineOfSight(start, clampedGoal, walls)) {
    return [clampedGoal];
  }

  const cellX = (c: number) => c * GRID_SIZE + GRID_SIZE / 2;
  const cellY = (r: number) => r * GRID_SIZE + GRID_SIZE / 2;

  const startCol = Math.max(0, Math.min(COLS - 1, Math.floor(start.x / GRID_SIZE)));
  const startRow = Math.max(0, Math.min(ROWS - 1, Math.floor(start.y / GRID_SIZE)));
  let goalCol = Math.max(0, Math.min(COLS - 1, Math.floor(clampedGoal.x / GRID_SIZE)));
  let goalRow = Math.max(0, Math.min(ROWS - 1, Math.floor(clampedGoal.y / GRID_SIZE)));

  // If goal cell is colliding with a wall, search nearby unblocked cells
  if (collidesWithWalls(cellX(goalCol), cellY(goalRow), walls, AVATAR_RADIUS + 2)) {
    let bestDist = Infinity;
    let foundCol = goalCol;
    let foundRow = goalRow;
    for (let r = Math.max(0, goalRow - 4); r <= Math.min(ROWS - 1, goalRow + 4); r++) {
      for (let c = Math.max(0, goalCol - 4); c <= Math.min(COLS - 1, goalCol + 4); c++) {
        const cx = cellX(c);
        const cy = cellY(r);
        if (!collidesWithWalls(cx, cy, walls, AVATAR_RADIUS + 2)) {
          const d = Math.hypot(cx - clampedGoal.x, cy - clampedGoal.y);
          if (d < bestDist) {
            bestDist = d;
            foundCol = c;
            foundRow = r;
          }
        }
      }
    }
    goalCol = foundCol;
    goalRow = foundRow;
  }

  const toKey = (c: number, r: number) => r * COLS + c;
  const startKey = toKey(startCol, startRow);
  const goalKey = toKey(goalCol, goalRow);

  if (startKey === goalKey) {
    return [clampedGoal];
  }

  const openSet = new Set<number>([startKey]);
  const cameFrom = new Map<number, number>();
  const gScore = new Map<number, number>([[startKey, 0]]);
  const fScore = new Map<number, number>([
    [startKey, Math.hypot(startCol - goalCol, startRow - goalRow)],
  ]);

  const directions = [
    { dc: 1, dr: 0, cost: 1 },
    { dc: -1, dr: 0, cost: 1 },
    { dc: 0, dr: 1, cost: 1 },
    { dc: 0, dr: -1, cost: 1 },
    { dc: 1, dr: 1, cost: 1.414 },
    { dc: 1, dr: -1, cost: 1.414 },
    { dc: -1, dr: 1, cost: 1.414 },
    { dc: -1, dr: -1, cost: 1.414 },
  ];

  let iterations = 0;
  const maxIterations = 3000;

  while (openSet.size > 0 && iterations++ < maxIterations) {
    let currentKey = -1;
    let lowestF = Infinity;
    for (const k of openSet) {
      const f = fScore.get(k) ?? Infinity;
      if (f < lowestF) {
        lowestF = f;
        currentKey = k;
      }
    }

    if (currentKey === goalKey) {
      // Reconstruct path
      const rawWaypoints: Vec2[] = [];
      let curr: number | undefined = goalKey;
      while (curr !== undefined) {
        const c = curr % COLS;
        const r = Math.floor(curr / COLS);
        rawWaypoints.unshift({ x: cellX(c), y: cellY(r) });
        curr = cameFrom.get(curr);
      }

      if (rawWaypoints.length > 0) {
        rawWaypoints[rawWaypoints.length - 1] = clampedGoal;
      }

      return smoothPath(start, rawWaypoints, walls);
    }

    openSet.delete(currentKey);
    const currC = currentKey % COLS;
    const currR = Math.floor(currentKey / COLS);
    const currentG = gScore.get(currentKey) ?? Infinity;

    for (const { dc, dr, cost } of directions) {
      const nc = currC + dc;
      const nr = currR + dr;
      if (nc < 0 || nc >= COLS || nr < 0 || nr >= ROWS) continue;

      const neighborKey = toKey(nc, nr);
      const nx = cellX(nc);
      const ny = cellY(nr);

      // Check collision
      if (collidesWithWalls(nx, ny, walls, AVATAR_RADIUS + 2)) continue;

      // Prevent cutting diagonal corners across walls
      if (dc !== 0 && dr !== 0) {
        if (
          collidesWithWalls(cellX(currC + dc), cellY(currR), walls, AVATAR_RADIUS) ||
          collidesWithWalls(cellX(currC), cellY(currR + dr), walls, AVATAR_RADIUS)
        ) {
          continue;
        }
      }

      const tentativeG = currentG + cost;
      if (tentativeG < (gScore.get(neighborKey) ?? Infinity)) {
        cameFrom.set(neighborKey, currentKey);
        gScore.set(neighborKey, tentativeG);
        const h = Math.hypot(nc - goalCol, nr - goalRow);
        fScore.set(neighborKey, tentativeG + h);
        openSet.add(neighborKey);
      }
    }
  }

  return [clampedGoal];
}

/**
 * Removes unnecessary intermediate waypoints if direct line of sight is clear.
 */
function smoothPath(start: Vec2, waypoints: Vec2[], walls: WallSegment[]): Vec2[] {
  if (waypoints.length <= 1) return waypoints;

  const smoothed: Vec2[] = [];
  let currentOrigin = start;
  let i = 0;

  while (i < waypoints.length) {
    let furthest = i;
    for (let j = waypoints.length - 1; j >= i; j--) {
      if (hasLineOfSight(currentOrigin, waypoints[j]!, walls)) {
        furthest = j;
        break;
      }
    }
    smoothed.push(waypoints[furthest]!);
    currentOrigin = waypoints[furthest]!;
    i = furthest + 1;
  }

  return smoothed;
}
