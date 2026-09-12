import { MESH_MAX_PARTICIPANTS, PROXIMITY_RADIUS, type PresenceState } from '@vicinity/shared';

export interface ConversationGroup {
  groupId: string;
  members: string[];
  mode: 'mesh' | 'sfu';
  roomName?: string;
}

function distance(a: PresenceState, b: PresenceState): number {
  const dx = a.position.x - b.position.x;
  const dy = a.position.y - b.position.y;
  return Math.hypot(dx, dy);
}

/**
 * Whether two users share an audio channel.
 *  - If either is inside an audio-isolated zone, they must be in the *same* zone.
 *  - Otherwise, they connect when within PROXIMITY_RADIUS.
 */
function canHear(a: PresenceState, b: PresenceState, isolatedZones: Set<string>): boolean {
  const aIso = a.zoneId != null && isolatedZones.has(a.zoneId);
  const bIso = b.zoneId != null && isolatedZones.has(b.zoneId);
  if (aIso || bIso) {
    return a.zoneId != null && a.zoneId === b.zoneId;
  }
  // Anyone inside the same room can hear each other irrespective of radius
  if (a.zoneId != null && b.zoneId != null && a.zoneId === b.zoneId) {
    return true;
  }
  return distance(a, b) <= PROXIMITY_RADIUS;
}

/**
 * Groups users into conversations using connected components (union-find).
 * Pure and deterministic → unit-testable in isolation.
 */
export function computeGroups(
  presences: PresenceState[],
  isolatedZones: Set<string> = new Set(),
): ConversationGroup[] {
  const parent = new Map<string, string>();
  presences.forEach((p) => parent.set(p.userId, p.userId));

  const find = (x: string): string => {
    let root = x;
    while (parent.get(root) !== root) root = parent.get(root)!;
    // Path compression.
    let cur = x;
    while (parent.get(cur) !== root) {
      const next = parent.get(cur)!;
      parent.set(cur, root);
      cur = next;
    }
    return root;
  };
  const union = (a: string, b: string): void => {
    parent.set(find(a), find(b));
  };

  for (let i = 0; i < presences.length; i++) {
    for (let j = i + 1; j < presences.length; j++) {
      if (canHear(presences[i]!, presences[j]!, isolatedZones)) {
        union(presences[i]!.userId, presences[j]!.userId);
      }
    }
  }

  const clusters = new Map<string, string[]>();
  presences.forEach((p) => {
    const root = find(p.userId);
    const list = clusters.get(root) ?? [];
    list.push(p.userId);
    clusters.set(root, list);
  });

  const groups: ConversationGroup[] = [];
  for (const members of clusters.values()) {
    if (members.length < 2) continue; // a lone user is not a conversation
    const sorted = [...members].sort();
    const groupId = `grp_${sorted.join('_')}`;
    const mode = sorted.length > MESH_MAX_PARTICIPANTS ? 'sfu' : 'mesh';
    groups.push({
      groupId,
      members: sorted,
      mode,
      ...(mode === 'sfu' ? { roomName: groupId } : {}),
    });
  }
  return groups;
}
