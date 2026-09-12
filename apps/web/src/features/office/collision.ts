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
 * Checks if a zone is an enclosed room with solid architectural walls.
 * In campus layout, all Coworking rooms and Focus Pods have solid walls.
 * Grand Fountain Plaza and open cafes do not.
 */
export function isZoneEnclosed(z: Zone): boolean {
  const name = z.name.toLowerCase();
  if (name.includes('fountain') || name.includes('grand fountain plaza')) return false;
  if (name.includes('coworking')) return true;
  return z.type !== 'lounge' && z.type !== 'open';
}

/**
 * Determines which side the doorway should be placed on for a given room.
 * Ensures the door faces the primary walking corridors.
 */
export function getDoorwayForZone(z: Zone): Doorway {
  const g = z.geometry;
  const name = z.name.toLowerCase();

  // Campus Coworking NW (x: 140, y: 40, w: 380, h: 260)
  if (name.includes('coworking north-west')) {
    return {
      zoneId: z.id,
      side: 'bottom',
      x: 340,
      y: g.y + g.h,
      w: DOOR_WIDTH,
      h: 0,
    };
  }
  // Campus Coworking NE (x: 1080, y: 40, w: 380, h: 260)
  if (name.includes('coworking north-east')) {
    return {
      zoneId: z.id,
      side: 'bottom',
      x: 1200,
      y: g.y + g.h,
      w: DOOR_WIDTH,
      h: 0,
    };
  }
  // Campus Coworking SW (x: 140, y: 800, w: 380, h: 260)
  if (name.includes('coworking south-west')) {
    return {
      zoneId: z.id,
      side: 'top',
      x: 340,
      y: g.y,
      w: DOOR_WIDTH,
      h: 0,
    };
  }
  // Campus Coworking SE (x: 1080, y: 800, w: 380, h: 260)
  if (name.includes('coworking south-east')) {
    return {
      zoneId: z.id,
      side: 'top',
      x: 1200,
      y: g.y,
      w: DOOR_WIDTH,
      h: 0,
    };
  }
  // Focus Pods in Campus
  if (name.includes('focus pod nw') || name.includes('focus pod ne')) {
    return {
      zoneId: z.id,
      side: 'bottom',
      x: g.x + g.w / 2 - DOOR_WIDTH / 2,
      y: g.y + g.h,
      w: DOOR_WIDTH,
      h: 0,
    };
  }
  if (name.includes('focus pod sw') || name.includes('focus pod se')) {
    return {
      zoneId: z.id,
      side: 'top',
      x: g.x + g.w / 2 - DOOR_WIDTH / 2,
      y: g.y,
      w: DOOR_WIDTH,
      h: 0,
    };
  }

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
 * Returns solid wall segments for all enclosed zones (meeting, focus, private, and coworking).
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
    if (!isZoneEnclosed(z)) continue;

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

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** Paved concrete road segments and outdoor patio bounds for Garden Campus */
export const CAMPUS_PAVED_WALKWAYS: Rect[] = [
  // Outer perimeter loop
  { x: 275, y: 286, w: 1050, h: 52 }, // Top perimeter horizontal (reaches Coworking NW/NE doors)
  { x: 275, y: 762, w: 1050, h: 52 }, // Bottom perimeter horizontal (reaches Coworking SW/SE doors)
  { x: 476, y: 286, w: 52, h: 528 },  // Left perimeter vertical
  { x: 1072, y: 286, w: 52, h: 528 }, // Right perimeter vertical

  // Connectors to Meeting Rooms (Alpha, Gamma, Beta, Delta)
  { x: 395, y: 390, w: 90, h: 54 },   // Alpha
  { x: 395, y: 630, w: 90, h: 54 },   // Gamma
  { x: 1114, y: 390, w: 90, h: 54 },  // Beta
  { x: 1114, y: 630, w: 90, h: 54 },  // Delta

  // Connectors to Focus Pods
  { x: 560, y: 255, w: 90, h: 40 },   // Focus Pod NW
  { x: 950, y: 255, w: 90, h: 40 },   // Focus Pod NE
  { x: 560, y: 805, w: 90, h: 40 },   // Focus Pod SW
  { x: 950, y: 805, w: 90, h: 40 },   // Focus Pod SE

  // Entrances into Grand Fountain Plaza
  { x: 770, y: 330, w: 60, h: 52 },   // North entrance
  { x: 770, y: 720, w: 60, h: 52 },   // South entrance
  { x: 520, y: 520, w: 75, h: 60 },   // West entrance
  { x: 1005, y: 520, w: 75, h: 60 },  // East entrance

  // Outdoor dining patio areas & connector paths
  { x: 175, y: 525, w: 310, h: 80 },  // West picnic table & patio connector
  { x: 1115, y: 525, w: 300, h: 80 }, // East picnic table & patio connector
  { x: 780, y: 20, w: 48, h: 275 },   // North patio path
  { x: 740, y: 15, w: 120, h: 75 },   // North patio seating area
  { x: 780, y: 805, w: 48, h: 275 },  // South patio path
  { x: 740, y: 1005, w: 120, h: 75 }, // South patio seating area
];

export function isPointInRect(p: Vec2, r: Rect): boolean {
  return p.x >= r.x && p.x <= r.x + r.w && p.y >= r.y && p.y <= r.y + r.h;
}

export function isCampusLayout(zones: Zone[]): boolean {
  return zones.some(
    (z) =>
      z.name.toLowerCase().includes('fountain') ||
      z.name.toLowerCase().includes('coworking'),
  );
}

/**
 * Checks if a point is on a paved walkway, inside an enclosed room, or in the plaza.
 * Disallows walking freely on grass or trees in the campus garden layout.
 */
export function isCampusWalkable(p: Vec2, zones: Zone[]): boolean {
  for (const z of zones) {
    const g = z.geometry;
    if (p.x >= g.x && p.x <= g.x + g.w && p.y >= g.y && p.y <= g.y + g.h) {
      return true;
    }
  }
  for (const walkway of CAMPUS_PAVED_WALKWAYS) {
    if (isPointInRect(p, walkway)) return true;
  }
  return false;
}

/**
 * Resolves avatar movement with wall collision and axis-separated sliding physics.
 * In campus layout, avatars are constrained to paved roads, central plaza, and rooms.
 */
export function resolveMovement(
  current: Vec2,
  target: Vec2,
  zones: Zone[],
  lockedZoneIds: Set<string> = new Set(),
  isCampus: boolean = isCampusLayout(zones),
): Vec2 {
  const { walls } = getWallSegments(zones, lockedZoneIds);

  // Clamp to canvas borders first
  const desiredX = Math.max(16, Math.min(FLOOR_WIDTH - 16, target.x));
  const desiredY = Math.max(16, Math.min(FLOOR_HEIGHT - 16, target.y));

  const isWalkable = (pos: Vec2) => {
    if (collidesWithWalls(pos.x, pos.y, walls, AVATAR_RADIUS)) return false;
    if (isCampus && !isCampusWalkable(pos, zones)) return false;
    return true;
  };

  // If proposed position doesn't collide and is walkable, accept full movement
  if (isWalkable({ x: desiredX, y: desiredY })) {
    return { x: desiredX, y: desiredY };
  }

  // Axis-separated sliding: try moving along X alone
  let resolvedX = current.x;
  if (isWalkable({ x: desiredX, y: current.y })) {
    resolvedX = desiredX;
  }

  // Then try moving along Y alone
  let resolvedY = current.y;
  if (isWalkable({ x: resolvedX, y: desiredY })) {
    resolvedY = desiredY;
  }

  return { x: resolvedX, y: resolvedY };
}

const GRID_SIZE = 24;
const COLS = Math.ceil(FLOOR_WIDTH / GRID_SIZE); // 67
const ROWS = Math.ceil(FLOOR_HEIGHT / GRID_SIZE); // 40

/**
 * Checks if a line segment between p1 and p2 has direct clear line of sight
 * without intersecting any walls, world bounds, or unpaved campus grass.
 */
export function hasLineOfSight(
  p1: Vec2,
  p2: Vec2,
  walls: WallSegment[],
  buffer = AVATAR_RADIUS + 2,
  isCampus = false,
  zones: Zone[] = [],
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
    if (isCampus && !isCampusWalkable({ x, y }, zones)) {
      return false;
    }
  }
  return true;
}

/**
 * Finds an obstacle-avoiding waypoint path from `start` to `goal` using A*.
 * In campus layout, constrains path to paved roads, central plaza, and doorways.
 */
export function findPath(
  start: Vec2,
  goal: Vec2,
  zones: Zone[],
  lockedZoneIds: Set<string> = new Set(),
  isCampus: boolean = isCampusLayout(zones),
): Vec2[] {
  const { walls } = getWallSegments(zones, lockedZoneIds);

  const cellX = (c: number) => c * GRID_SIZE + GRID_SIZE / 2;
  const cellY = (r: number) => r * GRID_SIZE + GRID_SIZE / 2;

  let clampedGoal: Vec2 = {
    x: Math.max(20, Math.min(FLOOR_WIDTH - 20, goal.x)),
    y: Math.max(20, Math.min(FLOOR_HEIGHT - 20, goal.y)),
  };

  // If campus layout and target is on grass, find the nearest walkable road or room point
  if (isCampus && !isCampusWalkable(clampedGoal, zones)) {
    let bestDist = Infinity;
    let nearestPoint: Vec2 = clampedGoal;
    for (let c = 0; c < COLS; c++) {
      for (let r = 0; r < ROWS; r++) {
        const pt = { x: cellX(c), y: cellY(r) };
        if (isCampusWalkable(pt, zones) && !collidesWithWalls(pt.x, pt.y, walls, AVATAR_RADIUS + 2)) {
          const d = Math.hypot(pt.x - clampedGoal.x, pt.y - clampedGoal.y);
          if (d < bestDist) {
            bestDist = d;
            nearestPoint = pt;
          }
        }
      }
    }
    clampedGoal = nearestPoint;
  }

  // If there's already direct clear line of sight, head straight to goal!
  if (hasLineOfSight(start, clampedGoal, walls, AVATAR_RADIUS + 2, isCampus, zones)) {
    return [clampedGoal];
  }

  const startCol = Math.max(0, Math.min(COLS - 1, Math.floor(start.x / GRID_SIZE)));
  const startRow = Math.max(0, Math.min(ROWS - 1, Math.floor(start.y / GRID_SIZE)));
  let goalCol = Math.max(0, Math.min(COLS - 1, Math.floor(clampedGoal.x / GRID_SIZE)));
  let goalRow = Math.max(0, Math.min(ROWS - 1, Math.floor(clampedGoal.y / GRID_SIZE)));

  const isBlocked = (x: number, y: number) => {
    if (collidesWithWalls(x, y, walls, AVATAR_RADIUS + 2)) return true;
    if (isCampus && !isCampusWalkable({ x, y }, zones)) return true;
    return false;
  };

  // If goal cell is blocked, search nearby unblocked cells
  if (isBlocked(cellX(goalCol), cellY(goalRow))) {
    let bestDist = Infinity;
    let foundCol = goalCol;
    let foundRow = goalRow;
    for (let r = Math.max(0, goalRow - 4); r <= Math.min(ROWS - 1, goalRow + 4); r++) {
      for (let c = Math.max(0, goalCol - 4); c <= Math.min(COLS - 1, goalCol + 4); c++) {
        const cx = cellX(c);
        const cy = cellY(r);
        if (!isBlocked(cx, cy)) {
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

      return smoothPath(start, rawWaypoints, walls, isCampus, zones);
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
      if (isBlocked(nx, ny)) continue;

      // Prevent cutting diagonal corners across walls or off-road
      if (dc !== 0 && dr !== 0) {
        if (
          isBlocked(cellX(currC + dc), cellY(currR)) ||
          isBlocked(cellX(currC), cellY(currR + dr))
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
function smoothPath(
  start: Vec2,
  waypoints: Vec2[],
  walls: WallSegment[],
  isCampus = false,
  zones: Zone[] = [],
): Vec2[] {
  if (waypoints.length <= 1) return waypoints;

  const smoothed: Vec2[] = [];
  let currentOrigin = start;
  let i = 0;

  while (i < waypoints.length) {
    let furthest = i;
    for (let j = waypoints.length - 1; j >= i; j--) {
      if (hasLineOfSight(currentOrigin, waypoints[j]!, walls, AVATAR_RADIUS + 2, isCampus, zones)) {
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
