'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { Button } from '@vicinity/ui';
import type { Zone } from '@vicinity/shared';
import { useRequireAuth } from '@/hooks/useRequireAuth';
import { CallDock } from '@/features/office/CallDock';
import { ChatPanel } from '@/features/office/ChatPanel';
import { InviteModal } from '@/features/office/InviteModal';
import { MediaControls } from '@/features/office/MediaControls';
import { MembersPanel } from '@/features/office/MembersPanel';
import { OfficeCanvas } from '@/features/office/OfficeCanvas';
import { useOffice } from '@/features/office/useOffice';
import { useWebRtc } from '@/features/office/useWebRtc';
import { getOrCreateDm, getWorkspace, listChannels, listZones } from '@/lib/workspaces';
import { usePresenceStore } from '@/stores/presence';

export default function OfficePage({ params }: { params: { workspaceId: string } }) {
  const { workspaceId } = params;
  const { ready } = useRequireAuth();
  const [currentZone, setCurrentZone] = useState<Zone | null>(null);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [activeDm, setActiveDm] = useState<{ id: string; targetName: string } | null>(null);
  const { move, setStatus, sendChat, enterZone, leaveZone } = useOffice(workspaceId);
  const { toggleMic, toggleCam, toggleShare } = useWebRtc();

  async function handleStartDm(userId: string, displayName: string) {
    try {
      const channel = await getOrCreateDm(workspaceId, userId);
      setActiveDm({ id: channel.id, targetName: displayName });
    } catch {
      // Degrade gracefully
    }
  }
  const onlineCount = usePresenceStore((s) => Object.keys(s.users).length);

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
        <div className="flex items-center gap-3">
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
            onMove={move}
            onZoneEnter={enterZone}
            onZoneLeave={leaveZone}
            onZoneChange={setCurrentZone}
          />
          <CallDock />
          {/* Movement hint & Zone badge */}
          <div className="pointer-events-none absolute left-3 top-3 flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-2 rounded-full border border-surface-3 bg-surface-0/90 px-3 py-1.5 text-xs text-ink-500 shadow-sm backdrop-blur">
              <kbd className="rounded bg-surface-2 px-1.5 py-0.5 font-mono text-[10px]">WASD</kbd>
              or click to move · walk close to talk
            </div>
            {currentZone && (
              <div className="flex items-center gap-1.5 rounded-full border border-surface-3 bg-surface-0/95 px-3 py-1.5 text-xs font-medium text-ink-800 shadow-sm backdrop-blur">
                <span className="inline-block h-2 w-2 rounded-full bg-brand-500" />
                <span>Room: <strong>{currentZone.name}</strong></span>
                {currentZone.audioIsolated && (
                  <span className="rounded-full bg-danger-50 px-2 py-0.5 text-[10px] font-semibold text-danger-700">
                    🔒 Audio Isolated
                  </span>
                )}
              </div>
            )}
          </div>
        </main>

        <aside className="hidden w-72 shrink-0 rounded-2xl border border-surface-3 bg-surface-0 p-4 shadow-sm shadow-black/5 lg:block">
          {activeDm ? (
            <ChatPanel
              channelId={activeDm.id}
              dmTargetName={activeDm.targetName}
              onSend={sendChat}
              onCloseDm={() => setActiveDm(null)}
            />
          ) : workspaceChannel ? (
            <ChatPanel
              channelId={workspaceChannel.id}
              channelName="general"
              onSend={sendChat}
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
    </div>
  );
}
