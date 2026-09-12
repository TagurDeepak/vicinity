import { PROXIMITY_TICK_MS } from '@vicinity/shared';
import { prisma } from '../lib/prisma';
import { logger } from '../lib/logger';
import { computeGroups, type ConversationGroup } from './proximity';
import { getWorkspacePresence } from './redis-state.service';
import { workspaceRoom, type VicinityServer } from './broadcast';

interface IsolatedZoneCache {
  zones: Set<string>;
  fetchedAt: number;
}

/**
 * Runs a periodic proximity recompute per *active* workspace and notifies users
 * when their conversation group changes. A workspace's timer is created when the
 * first user joins and torn down when the floor empties.
 */
export class ProximityEngine {
  private readonly timers = new Map<string, NodeJS.Timeout>();
  /** userId -> current groupId, per workspace, for change detection. */
  private readonly userGroups = new Map<string, Map<string, string>>();
  private readonly isolatedZoneCache = new Map<string, IsolatedZoneCache>();

  constructor(private readonly io: VicinityServer) {}

  trackWorkspace(workspaceId: string): void {
    if (this.timers.has(workspaceId)) return;
    this.userGroups.set(workspaceId, new Map());
    const timer = setInterval(() => {
      void this.tick(workspaceId);
    }, PROXIMITY_TICK_MS);
    this.timers.set(workspaceId, timer);
    logger.debug({ workspaceId }, 'proximity: started tracking workspace');
  }

  stopWorkspace(workspaceId: string): void {
    const timer = this.timers.get(workspaceId);
    if (timer) clearInterval(timer);
    this.timers.delete(workspaceId);
    this.userGroups.delete(workspaceId);
    logger.debug({ workspaceId }, 'proximity: stopped tracking workspace');
  }

  private async tick(workspaceId: string): Promise<void> {
    try {
      const presences = await getWorkspacePresence(workspaceId);
      if (presences.length === 0) {
        this.stopWorkspace(workspaceId);
        return;
      }

      const isolatedZones = await this.getIsolatedZones(workspaceId);
      const groups = computeGroups(presences, isolatedZones);
      this.emitChanges(workspaceId, presences.map((p) => p.userId), groups);
    } catch (err) {
      logger.error({ err, workspaceId }, 'proximity tick failed');
    }
  }

  private emitChanges(workspaceId: string, allUserIds: string[], groups: ConversationGroup[]): void {
    const previous = this.userGroups.get(workspaceId) ?? new Map<string, string>();
    const next = new Map<string, string>();

    // Users currently in a multi-person group.
    for (const group of groups) {
      for (const userId of group.members) {
        next.set(userId, group.groupId);
        if (previous.get(userId) !== group.groupId) {
          this.io.to(userRoom(userId)).emit('proximity:group', group);
        }
      }
    }

    // Users who just became solo → tell them to tear down media.
    for (const userId of allUserIds) {
      if (!next.has(userId) && previous.has(userId)) {
        this.io.to(userRoom(userId)).emit('proximity:group', {
          groupId: 'solo',
          members: [userId],
          mode: 'mesh',
        });
      }
    }

    this.userGroups.set(workspaceId, next);
    // Keep the workspace room warm for future broadcasts.
    void workspaceRoom(workspaceId);
  }

  private async getIsolatedZones(workspaceId: string): Promise<Set<string>> {
    const cached = this.isolatedZoneCache.get(workspaceId);
    if (cached && Date.now() - cached.fetchedAt < 10_000) return cached.zones;

    const zones = await prisma.zone.findMany({
      where: { workspaceId, audioIsolated: true },
      select: { id: true },
    });
    const set = new Set(zones.map((z) => z.id));
    this.isolatedZoneCache.set(workspaceId, { zones: set, fetchedAt: Date.now() });
    return set;
  }
}

/** Socket.IO room that targets a single user across all their devices/tabs. */
export function userRoom(userId: string): string {
  return `user:${userId}`;
}
