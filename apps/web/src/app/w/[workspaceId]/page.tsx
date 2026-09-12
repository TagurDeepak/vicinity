'use client';

import { useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { Button } from '@vicinity/ui';
import type { Vec2, Zone } from '@vicinity/shared';
import { useRequireAuth } from '@/hooks/useRequireAuth';
import { CallDock } from '@/features/office/CallDock';
import { ChatPanel } from '@/features/office/ChatPanel';
import { InviteModal } from '@/features/office/InviteModal';
import { KnockNotification, type KnockEvent, type LockedRoomInfo } from '@/features/office/KnockNotification';
import { MediaControls } from '@/features/office/MediaControls';
import { MembersPanel } from '@/features/office/MembersPanel';
import { OfficeCanvas } from '@/features/office/OfficeCanvas';
import { RoomsModal } from '@/features/office/RoomsModal';
import { getDoorwayForZone } from '@/features/office/collision';
import { useOffice } from '@/features/office/useOffice';
import { useWebRtc } from '@/features/office/useWebRtc';
import { getOrCreateDm, getWorkspace, listChannels, listZones } from '@/lib/workspaces';
import { getSocket } from '@/lib/ws';
import { useAuthStore } from '@/stores/auth';
import { usePresenceStore } from '@/stores/presence';

export default function WorkspacePage({ params }: { params: { workspaceId: string } }) {
  const { workspaceId } = params;
  const { ready } = useRequireAuth();
  const token = useAuthStore((s) => s.accessToken);
  const [currentZone, setCurrentZone] = useState<Zone | null>(null);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [roomsOpen, setRoomsOpen] = useState(false);
  const [lockedRooms, setLockedRooms] = useState<Map<string, LockedRoomInfo>>(new Map());
  const [knocks, setKnocks] = useState<KnockEvent[]>([]);
  const [letInMessage, setLetInMessage] = useState<string | null>(null);
  const [activeDm, setActiveDm] = useState<{ id: string; targetName: string } | null>(null);
  const [walkToTarget, setWalkToTarget] = useState<Vec2 | null>(null);
  const { move, setStatus, sendChat, enterZone, leaveZone } = useOffice(workspaceId);
  const { toggleMic, toggleCam, toggleShare } = useWebRtc();

  // Socket listeners for locked rooms and door knocking
  useEffect(() => {
    if (!token) return;
    const socket = getSocket(token);

    const onLockedList = (list: LockedRoomInfo[]) => {
      const map = new Map<string, LockedRoomInfo>();
      for (const item of list) map.set(item.zoneId, item);
      setLockedRooms(map);
    };

    const onLockState = (payload: {
      zoneId: string;
      locked: boolean;
      lockedBy?: string;
      lockedByName?: string;
    }) => {
      setLockedRooms((prev) => {
        const next = new Map(prev);
        if (payload.locked) {
          next.set(payload.zoneId, {
            zoneId: payload.zoneId,
            lockedBy: payload.lockedBy!,
            lockedByName: payload.lockedByName!,
          });
        } else {
          next.delete(payload.zoneId);
        }
        return next;
      });
    };

    const onKnocked = (payload: KnockEvent) => {
      setKnocks((prev) => [...prev, payload]);
    };

    const onLetInGranted = (payload: { zoneId: string; grantedBy: string }) => {
      setLetInMessage(`You've been let into the room by ${payload.grantedBy}!`);
      setTimeout(() => setLetInMessage(null), 5000);
    };

    socket.on('room:locked-list', onLockedList);
    socket.on('room:lock-state', onLockState);
    socket.on('room:knocked', onKnocked);
    socket.on('room:let-in-granted', onLetInGranted);

    return () => {
      socket.off('room:locked-list', onLockedList);
      socket.off('room:lock-state', onLockState);
      socket.off('room:knocked', onKnocked);
      socket.off('room:let-in-granted', onLetInGranted);
    };
  }, [token]);

  const handleToggleLock = (zoneId: string) => {
    if (!token) return;
    const socket = getSocket(token);
    if (lockedRooms.has(zoneId)) {
      socket.emit('room:unlock', { zoneId });
    } else {
      socket.emit('room:lock', { zoneId });
    }
  };

  const handleKnock = (zoneId: string) => {
    if (!token) return;
    const socket = getSocket(token);
    socket.emit('room:knock', { zoneId });
  };

  const handleLetIn = (zoneId: string, targetUserId: string) => {
    if (!token) return;
    const socket = getSocket(token);
    socket.emit('room:let-in', { zoneId, targetUserId });
  };

  async function handleStartDm(userId: string, displayName: string) {
    try {
      const channel = await getOrCreateDm(workspaceId, userId);
      setActiveDm({ id: channel.id, targetName: displayName });
    } catch {
      // Degrade gracefully
    }
  }
  const workspace = useQuery({
    queryKey: ['workspace', workspaceId],
    queryFn: () => getWorkspace(workspaceId),
    enabled: ready,
  });
  const zones = useQuery({
    queryKey: ['zones', workspaceId],
    queryFn: () => listZones(workspaceId),
    enabled: ready,
  });
  const channels = useQuery({
    queryKey: ['channels', workspaceId],
    queryFn: () => listChannels(workspaceId),
    enabled: ready,
  });

  const onlineCount = usePresenceStore((s) => Object.keys(s.users).length);

  const myPos = usePresenceStore((s) => (s.me && s.users[s.me] ? s.users[s.me]!.position : null));
  const lockedZoneIds = useMemo(() => new Set(lockedRooms.keys()), [lockedRooms]);

  const nearbyLockedRoom = useMemo(() => {
    if (!myPos || !zones.data || currentZone != null) return null;
    for (const z of zones.data) {
      const lock = lockedRooms.get(z.id);
      if (lock) {
        const door = getDoorwayForZone(z);
        const doorCenter = { x: door.x + door.w / 2, y: door.y + door.h / 2 };
        const dist = Math.hypot(myPos.x - doorCenter.x, myPos.y - doorCenter.y);
        if (dist < 80) {
          return { zone: z, lock };
        }
      }
    }
    return null;
  }, [myPos, zones.data, lockedRooms, currentZone]);

  if (!ready) return null;

  const workspaceChannel = channels.data?.find((c) => c.scope === 'workspace');

  return (
    <div className="flex h-screen flex-col bg-surface-2">
      {/* Top bar */}
      <header className="z-10 flex items-center justify-between border-b border-surface-3 bg-surface-0/80 px-4 py-2.5 backdrop-blur">
        <div className="flex items-center gap-3">
          <Link href="/lobby">
            <Button variant="ghost" size="sm">
              ← Lobby
            </Button>
          </Link>
          <div className="h-6 w-px bg-surface-3" aria-hidden />
          <div className="flex items-center gap-2.5">
            <span className="grid h-8 w-8 place-items-center rounded-lg bg-brand-600 font-semibold text-white">
              {(workspace.data?.name ?? 'V').charAt(0).toUpperCase()}
            </span>
            <div className="leading-tight">
              <div className="text-sm font-semibold text-ink-900">
                {workspace.data?.name ?? 'Office floor'}
              </div>
              <div className="flex items-center gap-1.5 text-xs text-ink-400">
                <span className="inline-block h-1.5 w-1.5 rounded-full bg-success-500" />
                {onlineCount} online
              </div>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {zones.data && zones.data.length > 0 && (
            <select
              defaultValue=""
              onChange={(e) => {
                const zId = e.target.value;
                if (!zId) return;
                const targetZ = zones.data?.find((z) => z.id === zId);
                if (targetZ) {
                  setWalkToTarget({
                    x: targetZ.geometry.x + targetZ.geometry.w / 2,
                    y: targetZ.geometry.y + targetZ.geometry.h / 2,
                  });
                }
                e.target.value = '';
              }}
              className="rounded-xl border border-surface-3 bg-surface-0 px-2.5 py-1.5 text-xs font-semibold text-ink-700 shadow-sm transition hover:border-brand-300 focus:outline-none focus:ring-2 focus:ring-brand-400 cursor-pointer"
              title="Quickly navigate your avatar into any room"
            >
              <option value="" disabled>🚶 Navigate to Room…</option>
              {zones.data.map((z) => (
                <option key={z.id} value={z.id}>
                  {z.name}
                </option>
              ))}
            </select>
          )}
          <Button variant="secondary" size="sm" onClick={() => setRoomsOpen(true)}>
            🏢 Rooms
          </Button>
          <Button variant="secondary" size="sm" onClick={() => setInviteOpen(true)}>
            + Invite
          </Button>
          <MediaControls
            onToggleMic={toggleMic}
            onToggleCam={toggleCam}
            onToggleShare={toggleShare}
            onStatusChange={setStatus}
          />
        </div>
      </header>

      {/* Body */}
      <div className="flex flex-1 gap-3 overflow-hidden p-3">
        <aside className="hidden w-60 shrink-0 rounded-2xl border border-surface-3 bg-surface-0 p-4 shadow-sm shadow-black/5 md:block">
          <MembersPanel zones={zones.data ?? []} onStartDm={handleStartDm} />
        </aside>

        <main className="relative flex-1 overflow-hidden rounded-2xl shadow-sm shadow-black/5">
          <OfficeCanvas
            zones={zones.data ?? []}
            lockedZoneIds={lockedZoneIds}
            walkToTarget={walkToTarget}
            onMove={move}
            onZoneEnter={enterZone}
            onZoneLeave={leaveZone}
            onZoneChange={setCurrentZone}
            onStartDm={handleStartDm}
          />
          <CallDock />
          {/* Movement hint & Zone badge */}
          <div className="pointer-events-none absolute left-3 top-3 flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-2 rounded-full border border-surface-3 bg-surface-0/90 px-3 py-1.5 text-xs text-ink-500 shadow-sm backdrop-blur">
              <kbd className="rounded bg-surface-2 px-1.5 py-0.5 font-mono text-[10px]">WASD</kbd>
              or click to move · walk close to talk
            </div>
            {currentZone && (
              <div className="flex items-center gap-2 rounded-full border border-surface-3 bg-surface-0/95 px-3 py-1.5 text-xs font-medium text-ink-800 shadow-sm backdrop-blur">
                <span className="inline-block h-2 w-2 rounded-full bg-brand-500" />
                <span>Room: <strong>{currentZone.name}</strong></span>
                {currentZone.audioIsolated && (
                  <span className="rounded-full bg-brand-50 px-2 py-0.5 text-[10px] font-semibold text-brand-700">
                    🔒 Audio Isolated
                  </span>
                )}
                {(currentZone.type === 'focus' ||
                  currentZone.type === 'private' ||
                  currentZone.type === 'meeting') && (
                  <button
                    onClick={() => handleToggleLock(currentZone.id)}
                    className={`pointer-events-auto rounded-full px-2 py-0.5 text-[10px] font-bold transition ${
                      lockedRooms.has(currentZone.id)
                        ? 'bg-danger-100 text-danger-800 hover:bg-danger-200'
                        : 'bg-surface-2 text-ink-600 hover:bg-surface-3'
                    }`}
                    title={
                      lockedRooms.has(currentZone.id)
                        ? 'Click to unlock door'
                        : 'Click to lock door'
                    }
                  >
                    {lockedRooms.has(currentZone.id) ? '🔒 Locked (Unlock)' : '🔓 Lock Door'}
                  </button>
                )}
              </div>
            )}
          </div>

          {/* 1-Room upgrade suggestion */}
          {zones.data && zones.data.length === 1 && (
            <div className="pointer-events-auto absolute bottom-3 left-3 z-10 flex items-center gap-2 rounded-xl border border-brand-200 bg-surface-0/95 px-3.5 py-2 text-xs text-ink-700 shadow-lg backdrop-blur animate-in fade-in">
              <span>💡 Only 1 common room on floor.</span>
              <button
                onClick={() => setRoomsOpen(true)}
                className="font-semibold text-brand-700 underline hover:text-brand-900"
              >
                Apply full 8-room office layout →
              </button>
            </div>
          )}
        </main>

        <aside className="hidden w-80 shrink-0 rounded-2xl border border-surface-3 bg-surface-0 p-4 shadow-sm shadow-black/5 lg:block">
          {activeDm ? (
            <ChatPanel
              channelId={activeDm.id}
              dmTargetName={activeDm.targetName}
              onSend={sendChat}
              onCloseDm={() => setActiveDm(null)}
              onStartDm={handleStartDm}
            />
          ) : workspaceChannel ? (
            <ChatPanel
              channelId={workspaceChannel.id}
              channelName="general"
              onSend={sendChat}
              onStartDm={handleStartDm}
            />
          ) : (
            <p className="text-sm text-ink-400">Loading chat…</p>
          )}
        </aside>
      </div>

      <InviteModal
        workspaceId={workspaceId}
        isOpen={inviteOpen}
        onClose={() => setInviteOpen(false)}
      />

      <RoomsModal
        workspaceId={workspaceId}
        isOpen={roomsOpen}
        onClose={() => setRoomsOpen(false)}
        zones={zones.data ?? []}
        onZonesUpdated={() => void zones.refetch()}
      />

      <KnockNotification
        knocks={knocks}
        onLetIn={handleLetIn}
        onDismissKnock={(idx) => setKnocks((prev) => prev.filter((_, i) => i !== idx))}
        nearbyLockedRoom={nearbyLockedRoom}
        onKnock={handleKnock}
        letInMessage={letInMessage}
      />
    </div>
  );
}
