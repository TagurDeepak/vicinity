/**
 * Shared configuration constants for spatial logic. Kept in one place so the
 * proximity engine (backend) and the renderer (frontend) never drift apart.
 */

/** Distance (world units) within which two users can hear/see each other. */
export const PROXIMITY_RADIUS = 150;

/** Max participants in a peer-to-peer mesh before promoting to an SFU room. */
export const MESH_MAX_PARTICIPANTS = 4;

/** Avatar movement emit rate (Hz) — client throttles position updates. */
export const MOVE_EMIT_HZ = 15;

/** Server proximity recompute tick (ms). */
export const PROXIMITY_TICK_MS = 100;

/** Logical floor size in world units. */
export const FLOOR_WIDTH = 1600;
export const FLOOR_HEIGHT = 1000;
