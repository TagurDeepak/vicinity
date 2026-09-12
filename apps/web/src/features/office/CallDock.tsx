'use client';

import { useEffect, useRef, useState } from 'react';
import { PROXIMITY_RADIUS } from '@vicinity/shared';
import { Avatar } from '@vicinity/ui';
import { useMediaStore } from '@/stores/media';
import { usePresenceStore } from '@/stores/presence';

/**
 * Floating dock of video/audio tiles for the active conversation. Remote audio
 * volume scales with avatar distance to reproduce "walk closer = louder".
 */
export function CallDock() {
  const remote = useMediaStore((s) => s.remote);
  const localStream = useMediaStore((s) => s.localStream);
  const camOn = useMediaStore((s) => s.camOn);
  const sharing = useMediaStore((s) => s.sharing);
  const users = usePresenceStore((s) => s.users);

  const [staged, setStaged] = useState<{ id: string; name: string; stream: MediaStream } | null>(
    null,
  );

  const micOn = useMediaStore((s) => s.micOn);
  const [collapsed, setCollapsed] = useState(false);

  const localRef = useRef<HTMLVideoElement>(null);
  const stageRef = useRef<HTMLVideoElement>(null);
  const remoteVideoEls = useRef<Map<string, HTMLVideoElement>>(new Map());
  const remoteAudioEls = useRef<Map<string, HTMLAudioElement>>(new Map());

  const remoteEntries = Object.entries(remote);
  const localHasVideo = (localStream?.getVideoTracks().length ?? 0) > 0 || camOn || sharing;
  const totalParticipants = 1 + remoteEntries.length;

  // Attach the local preview stream.
  useEffect(() => {
    if (localRef.current) {
      if (localStream && (localHasVideo || camOn)) {
        if (localRef.current.srcObject !== localStream) {
          localRef.current.srcObject = localStream;
        }
        localRef.current.muted = true;
        localRef.current.play().catch(() => {});
      } else {
        localRef.current.srcObject = null;
      }
    }
  }, [localStream, localHasVideo, camOn]);

  // Attach staged stream.
  useEffect(() => {
    if (stageRef.current && staged?.stream) {
      stageRef.current.srcObject = staged.stream;
      stageRef.current.play().catch(() => {});
    }
  }, [staged]);

  // Clear staged if peer disconnects.
  useEffect(() => {
    if (staged && staged.id !== 'self' && !remote[staged.id]) {
      setStaged(null);
    }
  }, [staged, remote]);

  // Attach remote streams to their elements.
  useEffect(() => {
    for (const [userId, stream] of Object.entries(remote)) {
      const vEl = remoteVideoEls.current.get(userId);
      if (vEl && vEl.srcObject !== stream) {
        vEl.srcObject = stream;
        vEl.play().catch(() => {});
      }
      const aEl = remoteAudioEls.current.get(userId);
      if (aEl && aEl.srcObject !== stream) {
        aEl.srcObject = stream;
        aEl.play().catch(() => {});
      }
    }
  }, [remote]);

  // Browser Autoplay Policy listener: user interaction resumes any paused audio.
  useEffect(() => {
    const resumeAudio = () => {
      for (const aEl of remoteAudioEls.current.values()) {
        if (aEl.paused) {
          aEl.play().catch(() => {});
        }
      }
    };
    window.addEventListener('click', resumeAudio);
    window.addEventListener('keydown', resumeAudio);
    return () => {
      window.removeEventListener('click', resumeAudio);
      window.removeEventListener('keydown', resumeAudio);
    };
  }, []);

  // Distance-based volume loop on remote audio elements.
  useEffect(() => {
    let raf = 0;
    const tick = () => {
      const state = usePresenceStore.getState();
      const me = state.me ? state.users[state.me] : null;
      if (me) {
        for (const [userId, el] of remoteAudioEls.current.entries()) {
          const peer = state.users[userId];
          if (!peer) continue;
          const sameRoom = me.zoneId != null && me.zoneId === peer.zoneId;
          if (sameRoom) {
            // Inside a room, everyone hears each other at full volume regardless of distance
            el.volume = 1.0;
          } else {
            const dist = Math.hypot(
              me.position.x - peer.position.x,
              me.position.y - peer.position.y,
            );
            // 1.0 when adjacent, fading to a low floor at the edge of the radius.
            el.volume = Math.max(0.05, Math.min(1, 1 - dist / (PROXIMITY_RADIUS * 1.2)));
          }
        }
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);

  const hasRemotes = remoteEntries.length > 0;
  const showDock = hasRemotes || localHasVideo || camOn || staged !== null;

  if (!showDock) return null;

  return (
    <>
      {/* Full-size Stage View for Presentations & Screens */}
      {staged && (
        <div className="fixed inset-4 z-50 flex flex-col overflow-hidden rounded-2xl border border-white/20 bg-black/95 p-4 shadow-2xl backdrop-blur-lg animate-in fade-in zoom-in-95">
          <div className="mb-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="inline-block h-2.5 w-2.5 rounded-full bg-danger-500 animate-pulse" />
              <span className="text-sm font-semibold text-white">Presenting: {staged.name}</span>
            </div>
            <button
              onClick={() => setStaged(null)}
              className="flex items-center gap-1.5 rounded-lg bg-white/10 px-3 py-1.5 text-xs font-medium text-white transition hover:bg-white/20"
              aria-label="Minimize stage view"
            >
              <span>Minimize</span> ✕
            </button>
          </div>
          <div className="relative flex-1 overflow-hidden rounded-xl bg-black">
            <video
              ref={stageRef}
              autoPlay
              playsInline
              muted={staged.id === 'self'}
              className="h-full w-full object-contain"
            />
          </div>
        </div>
      )}

      {/* Floating Picture-in-Picture in Top-Right Corner */}
      {collapsed ? (
        <div className="pointer-events-auto absolute top-3 right-3 z-30 flex items-center gap-2 rounded-full border border-white/15 bg-slate-950/85 px-3 py-1.5 shadow-xl backdrop-blur-md animate-in fade-in">
          <span className="inline-block h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
          <span className="text-xs font-semibold text-slate-200">
            📹 Video ({totalParticipants})
          </span>
          <button
            onClick={() => setCollapsed(false)}
            className="rounded-lg bg-white/10 px-2 py-0.5 text-xs font-semibold text-white hover:bg-white/20 transition"
            title="Expand video preview"
          >
            ▲ Show
          </button>
        </div>
      ) : (
        <div className="pointer-events-auto absolute top-3 right-3 z-30 flex flex-col items-end gap-1.5 animate-in fade-in zoom-in-95">
          <div className="flex flex-col rounded-2xl border border-white/15 bg-slate-950/85 p-2 shadow-2xl backdrop-blur-md">
            {/* Header bar */}
            <div className="mb-1.5 flex items-center justify-between px-1 text-xs">
              <div className="flex items-center gap-2">
                <span className="inline-block h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
                <span className="font-semibold text-slate-200">
                  Active Video ({totalParticipants})
                </span>
              </div>
              <button
                onClick={() => setCollapsed(true)}
                className="flex h-5 w-5 items-center justify-center rounded-lg text-slate-400 hover:bg-white/10 hover:text-white transition"
                title="Minimize video window"
                aria-label="Minimize"
              >
                ✕
              </button>
            </div>

            {/* Video Tiles List: Clean row of 16:9 fixed tiles */}
            <div className="flex gap-2.5 overflow-x-auto max-w-[80vw]">
              {/* Local self-view */}
              <Tile
                label="You"
                muted={!micOn}
                hasVideo={localHasVideo}
                onExpand={
                  localHasVideo && localStream
                    ? () => setStaged({ id: 'self', name: 'Your camera/screen', stream: localStream })
                    : undefined
                }
              >
                <video
                  ref={localRef}
                  autoPlay
                  playsInline
                  muted
                  className={localHasVideo ? 'h-full w-full object-cover' : 'hidden'}
                />
                {!localHasVideo && (
                  <div className="flex h-full w-full items-center justify-center bg-slate-900">
                    <Avatar name="You" size={42} />
                  </div>
                )}
              </Tile>

              {/* Remote peers */}
              {remoteEntries.map(([userId, stream]) => {
                const name = users[userId]?.displayName ?? 'Guest';
                const hasVideo = stream.getVideoTracks().length > 0;
                return (
                  <Tile
                    key={userId}
                    label={name}
                    muted={false}
                    hasVideo={hasVideo}
                    onExpand={hasVideo ? () => setStaged({ id: userId, name, stream }) : undefined}
                  >
                    <audio
                      ref={(el) => {
                        if (el) {
                          remoteAudioEls.current.set(userId, el);
                          if (el.srcObject !== stream) el.srcObject = stream;
                          el.play().catch(() => {});
                        } else {
                          remoteAudioEls.current.delete(userId);
                        }
                      }}
                      autoPlay
                      playsInline
                    />
                    <video
                      ref={(el) => {
                        if (el) {
                          remoteVideoEls.current.set(userId, el);
                          if (el.srcObject !== stream) el.srcObject = stream;
                          el.play().catch(() => {});
                        } else {
                          remoteVideoEls.current.delete(userId);
                        }
                      }}
                      autoPlay
                      playsInline
                      muted
                      className={hasVideo ? 'h-full w-full object-cover' : 'hidden'}
                    />
                    {!hasVideo && (
                      <div className="flex h-full w-full items-center justify-center bg-slate-900">
                        <Avatar name={name} size={42} />
                      </div>
                    )}
                  </Tile>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function Tile({
  label,
  muted,
  hasVideo,
  onExpand,
  children,
}: {
  label: string;
  muted?: boolean;
  hasVideo?: boolean;
  onExpand?: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="group pointer-events-auto relative aspect-video w-48 sm:w-52 shrink-0 place-items-center overflow-hidden rounded-xl border border-white/10 bg-slate-900 shadow-md">
      {children}
      <div className="absolute bottom-1.5 left-2 flex items-center gap-1.5 rounded-md bg-black/75 px-1.5 py-0.5 text-[11px] font-medium text-white backdrop-blur">
        <span className="truncate max-w-[85px]">{label}</span>
        <span title={muted ? 'Microphone muted' : 'Microphone active'}>
          {muted ? '🔇' : '🎙️'}
        </span>
      </div>
      {hasVideo && onExpand && (
        <button
          onClick={onExpand}
          className="absolute right-1.5 top-1.5 rounded-lg bg-black/70 px-1.5 py-0.5 text-[11px] text-white opacity-0 transition group-hover:opacity-100 hover:bg-black/90"
          title="Expand to presentation stage"
          aria-label="Expand video"
        >
          ⤢ Stage
        </button>
      )}
    </div>
  );
}
