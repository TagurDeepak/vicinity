import type { PresenceState, UserStatus, Vec2 } from '@vicinity/shared';
import { redis } from '../lib/redis';

/**
 * Ephemeral presence store backed by Redis.
 *
 * Layout:
 *   presence:{workspaceId}  -> HASH  field=userId  value=JSON(PresenceState)
 *
 * This data is intentionally NOT in PostgreSQL: it is high-frequency, disposable,
 * and lost on disconnect. A short TTL guards against orphaned entries if a node
 * dies without cleanup.
 */
const PRESENCE_TTL_SECONDS = 60 * 60; // safety net

function key(workspaceId: string): string {
  return `presence:${workspaceId}`;
}

export async function setPresence(workspaceId: string, state: PresenceState): Promise<void> {
  await redis.hset(key(workspaceId), state.userId, JSON.stringify(state));
  await redis.expire(key(workspaceId), PRESENCE_TTL_SECONDS);
}

export async function updatePosition(
  workspaceId: string,
  userId: string,
  position: Vec2,
): Promise<void> {
  const current = await getPresence(workspaceId, userId);
  if (!current) return;
  await setPresence(workspaceId, { ...current, position });
}

export async function updateStatus(
  workspaceId: string,
  userId: string,
  status: UserStatus,
): Promise<void> {
  const current = await getPresence(workspaceId, userId);
  if (!current) return;
  await setPresence(workspaceId, { ...current, status });
}

export async function updateZone(
  workspaceId: string,
  userId: string,
  zoneId: string | null,
): Promise<void> {
  const current = await getPresence(workspaceId, userId);
  if (!current) return;
  await setPresence(workspaceId, { ...current, zoneId });
}

export async function removePresence(workspaceId: string, userId: string): Promise<void> {
  await redis.hdel(key(workspaceId), userId);
}

export async function getPresence(
  workspaceId: string,
  userId: string,
): Promise<PresenceState | null> {
  const raw = await redis.hget(key(workspaceId), userId);
  return raw ? (JSON.parse(raw) as PresenceState) : null;
}

export async function getWorkspacePresence(workspaceId: string): Promise<PresenceState[]> {
  const all = await redis.hgetall(key(workspaceId));
  return Object.values(all).map((raw) => JSON.parse(raw as string) as PresenceState);
}
