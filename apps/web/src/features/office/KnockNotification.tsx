'use client';

import { useState } from 'react';
import { Button } from '@vicinity/ui';
import type { Zone } from '@vicinity/shared';

export interface KnockEvent {
  fromUserId: string;
  fromName: string;
  zoneId: string;
}

export interface LockedRoomInfo {
  zoneId: string;
  lockedBy: string;
  lockedByName: string;
}

interface KnockNotificationProps {
  knocks: KnockEvent[];
  onLetIn: (zoneId: string, targetUserId: string) => void;
  onDismissKnock: (index: number) => void;
  nearbyLockedRoom: { zone: Zone; lock: LockedRoomInfo } | null;
  onKnock: (zoneId: string) => void;
  letInMessage: string | null;
}

export function KnockNotification({
  knocks,
  onLetIn,
  onDismissKnock,
  nearbyLockedRoom,
  onKnock,
  letInMessage,
}: KnockNotificationProps) {
  const [knockingSent, setKnockingSent] = useState<string | null>(null);

  return (
    <>
      {/* 1. Occupant Inside: Knock incoming alert */}
      {knocks.length > 0 && (
        <div className="pointer-events-auto fixed right-4 top-16 z-50 flex flex-col gap-2 max-w-sm">
          {knocks.map((k, idx) => (
            <div
              key={`${k.fromUserId}-${idx}`}
              className="flex items-center justify-between gap-3 rounded-2xl border border-brand-200 bg-surface-0 p-3.5 shadow-2xl shadow-brand-900/10 animate-in slide-in-from-top-3"
            >
              <div className="flex items-center gap-2.5">
                <span className="text-xl">🔔</span>
                <div>
                  <div className="text-xs font-semibold text-ink-900">
                    {k.fromName} is knocking!
                  </div>
                  <div className="text-[11px] text-ink-400">Requesting to enter your room</div>
                </div>
              </div>
              <div className="flex items-center gap-1.5">
                <Button
                  size="sm"
                  variant="primary"
                  onClick={() => {
                    onLetIn(k.zoneId, k.fromUserId);
                    onDismissKnock(idx);
                  }}
                >
                  Let in
                </Button>
                <Button size="sm" variant="ghost" onClick={() => onDismissKnock(idx)}>
                  ✕
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* 2. Outside User: Standing near a locked door */}
      {nearbyLockedRoom && (
        <div className="pointer-events-auto fixed bottom-20 left-1/2 -translate-x-1/2 z-40 animate-in fade-in zoom-in-95">
          <div className="flex items-center gap-3 rounded-2xl border border-danger-200 bg-surface-0 px-4 py-2.5 shadow-xl shadow-danger-900/10">
            <span className="text-lg">🔒</span>
            <div className="text-xs">
              <span className="font-semibold text-ink-900">{nearbyLockedRoom.zone.name}</span>
              <span className="text-ink-500"> is locked by </span>
              <span className="font-medium text-ink-800">
                {nearbyLockedRoom.lock.lockedByName}
              </span>
            </div>
            <Button
              size="sm"
              variant="secondary"
              disabled={knockingSent === nearbyLockedRoom.zone.id}
              onClick={() => {
                onKnock(nearbyLockedRoom.zone.id);
                setKnockingSent(nearbyLockedRoom.zone.id);
                setTimeout(() => setKnockingSent(null), 5000);
              }}
            >
              {knockingSent === nearbyLockedRoom.zone.id ? 'Knocked…' : '🔔 Knock on Door'}
            </Button>
          </div>
        </div>
      )}

      {/* 3. Knock Granted Toast */}
      {letInMessage && (
        <div className="pointer-events-auto fixed top-16 left-1/2 -translate-x-1/2 z-50 animate-in fade-in slide-in-from-top-2">
          <div className="flex items-center gap-2 rounded-2xl border border-success-200 bg-success-50 px-4 py-2 text-xs font-semibold text-success-900 shadow-xl">
            <span>🎉</span>
            <span>{letInMessage}</span>
          </div>
        </div>
      )}
    </>
  );
}
