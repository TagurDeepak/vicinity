import { create } from 'zustand';
import type { PresenceState, ProximityGroup, UserStatus, Vec2 } from '@vicinity/shared';

interface PresenceStore {
  me: string | null;
  users: Record<string, PresenceState>;
  group: ProximityGroup | null;

  setMe: (userId: string) => void;
  setSnapshot: (users: PresenceState[]) => void;
  upsert: (user: PresenceState) => void;
  remove: (userId: string) => void;
  setPosition: (userId: string, position: Vec2) => void;
  setStatus: (userId: string, status: UserStatus) => void;
  setZone: (userId: string, zoneId: string | null) => void;
  setGroup: (group: ProximityGroup | null) => void;
  reset: () => void;
}

/** Live presence for the current workspace floor. Updated by socket events. */
export const usePresenceStore = create<PresenceStore>((set) => ({
  me: null,
  users: {},
  group: null,

  setMe: (userId) => set({ me: userId }),
  setSnapshot: (users) =>
    set({ users: Object.fromEntries(users.map((u) => [u.userId, u])) }),
  upsert: (user) => set((s) => ({ users: { ...s.users, [user.userId]: user } })),
  remove: (userId) =>
    set((s) => {
      const next = { ...s.users };
      delete next[userId];
      return { users: next };
    }),
  setPosition: (userId, position) =>
    set((s) => {
      const u = s.users[userId];
      if (!u) return s;
      return { users: { ...s.users, [userId]: { ...u, position } } };
    }),
  setStatus: (userId, status) =>
    set((s) => {
      const u = s.users[userId];
      if (!u) return s;
      return { users: { ...s.users, [userId]: { ...u, status } } };
    }),
  setZone: (userId, zoneId) =>
    set((s) => {
      const u = s.users[userId];
      if (!u) return s;
      return { users: { ...s.users, [userId]: { ...u, zoneId } } };
    }),
  setGroup: (group) => set({ group: group && group.members.length > 1 ? group : null }),
  reset: () => set({ users: {}, group: null }),
}));
