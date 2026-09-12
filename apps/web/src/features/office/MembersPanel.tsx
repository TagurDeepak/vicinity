'use client';

import type { Zone } from '@vicinity/shared';
import { Avatar, type StatusKind } from '@vicinity/ui';
import { UserStatus } from '@vicinity/shared';
import { usePresenceStore } from '@/stores/presence';

const STATUS_TO_KIND: Record<UserStatus, StatusKind> = {
  [UserStatus.Available]: 'available',
  [UserStatus.Busy]: 'busy',
  [UserStatus.InMeeting]: 'in-meeting',
  [UserStatus.Away]: 'away',
};

export function MembersPanel({
  zones = [],
  onStartDm,
}: {
  zones?: Zone[];
  onStartDm?: (userId: string, displayName: string) => void;
}) {
  const users = usePresenceStore((s) => s.users);
  const me = usePresenceStore((s) => s.me);
  const group = usePresenceStore((s) => s.group);
  const groupSet = new Set(group?.members ?? []);
  const zoneMap = new Map(zones.map((z) => [z.id, z]));
  const list = Object.values(users).sort((a, b) => a.displayName.localeCompare(b.displayName));

  return (
    <div className="flex h-full flex-col">
      <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-ink-400">
        On the floor · {list.length}
      </h2>
      <ul className="flex flex-col gap-1 overflow-y-auto">
        {list.map((u) => {
          const zone = u.zoneId ? zoneMap.get(u.zoneId) : null;
          return (
            <li
              key={u.userId}
              className="group flex items-center gap-3 rounded-xl px-2 py-1.5 hover:bg-surface-2"
            >
              <Avatar
                name={u.displayName}
                src={u.avatarUrl}
                size={32}
                status={STATUS_TO_KIND[u.status]}
              />
              <div className="flex flex-1 flex-col overflow-hidden leading-tight">
                <span className="truncate text-sm text-ink-900">
                  {u.displayName}
                  {u.userId === me && <span className="ml-1 text-ink-400">(you)</span>}
                </span>
                {zone && (
                  <span className="truncate text-[11px] text-ink-400">
                    📍 {zone.name}
                  </span>
                )}
              </div>
              {groupSet.has(u.userId) && (
                <span className="rounded-full bg-brand-50 px-2 py-0.5 text-[11px] font-medium text-brand-700">
                  talking
                </span>
              )}
              {onStartDm && u.userId !== me && (
                <button
                  onClick={() => onStartDm(u.userId, u.displayName)}
                  className="rounded-lg p-1 text-xs text-ink-400 opacity-0 transition group-hover:opacity-100 hover:bg-brand-50 hover:text-brand-600"
                  title={`Direct message ${u.displayName}`}
                  aria-label={`Direct message ${u.displayName}`}
                >
                  💬
                </button>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
