'use client';

import { useEffect, useRef } from 'react';
import { getIceServers } from '@/lib/api';
import { getSocket } from '@/lib/ws';
import { useAuthStore } from '@/stores/auth';
import { useMediaStore } from '@/stores/media';
import { usePresenceStore } from '@/stores/presence';
import { MeshManager } from './webrtc/MeshManager';
import { useCallbackRef } from './useCallbackRef';

/**
 * Orchestrates proximity-driven WebRTC media:
 *  - builds a MeshManager once we have a socket + identity + ICE config,
 *  - acquires the mic on first conversation,
 *  - reconciles peers whenever the proximity group changes,
 *  - routes signaling events to the manager,
 *  - exposes mic/camera/screen-share controls wired to real tracks.
 */
export function useWebRtc() {
  const token = useAuthStore((s) => s.accessToken);
  const selfId = useAuthStore((s) => s.user?.id ?? null);
  const group = usePresenceStore((s) => s.group);

  const managerRef = useRef<MeshManager | null>(null);
  const localRef = useRef<MediaStream | null>(null);

  // Build the manager and subscribe to signaling once ready.
  useEffect(() => {
    if (!token || !selfId) return;
    let cancelled = false;
    const socket = getSocket(token);

    const fallbackIceServers: RTCIceServer[] = [
      {
        urls: [
          'stun:stun.l.google.com:19302',
          'stun:stun1.l.google.com:19302',
          'stun:stun2.l.google.com:19302',
        ],
      },
    ];

    const initManager = (iceServers: RTCIceServer[]) => {
      if (cancelled) return;
      const manager = new MeshManager(socket, selfId, iceServers, {
        onRemoteStream: (userId, stream) => useMediaStore.getState().addRemote(userId, stream),
        onRemoteLeft: (userId) => useMediaStore.getState().removeRemote(userId),
      });
      managerRef.current = manager;

      socket.on('rtc:offer', (p) => void manager.handleOffer(p.fromUserId, p.sdp));
      socket.on('rtc:answer', (p) => void manager.handleAnswer(p.fromUserId, p.sdp));
      socket.on('rtc:ice-candidate', (p) => void manager.handleIce(p.fromUserId, p.candidate));

      if (localRef.current) {
        manager.setLocalStream(localRef.current);
      }
    };

    getIceServers()
      .then(({ iceServers }) => {
        initManager(iceServers && iceServers.length > 0 ? iceServers : fallbackIceServers);
      })
      .catch(() => {
        initManager(fallbackIceServers);
      });

    return () => {
      cancelled = true;
      socket.off('rtc:offer');
      socket.off('rtc:answer');
      socket.off('rtc:ice-candidate');
      managerRef.current?.close();
      managerRef.current = null;
      localRef.current?.getTracks().forEach((t) => t.stop());
      localRef.current = null;
      useMediaStore.getState().clearRemotes();
      useMediaStore.getState().setLocalStream(null);
    };
  }, [token, selfId]);

  const ensureLocalStream = async (): Promise<MediaStream | null> => {
    if (localRef.current) return localRef.current;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
      stream.getAudioTracks().forEach((t) => (t.enabled = useMediaStore.getState().micOn));
      localRef.current = stream;
      useMediaStore.getState().setLocalStream(stream);
      managerRef.current?.setLocalStream(stream);
      return stream;
    } catch {
      return null; // permission denied — degrade gracefully
    }
  };

  // React to proximity group changes.
  useEffect(() => {
    const manager = managerRef.current;
    if (!manager) return;
    if (group && group.members.length > 1) {
      useMediaStore.getState().setConnecting(true);
      void ensureLocalStream().then(() => {
        // If camera is currently active, ensure the video track is verified and attached
        const camActive = useMediaStore.getState().camOn;
        if (camActive && localRef.current) {
          const videoTrack = localRef.current.getVideoTracks().find((t) => t.readyState === 'live');
          if (videoTrack) {
            void manager.setVideoTrack(videoTrack);
          }
        }
        manager.syncGroup(group.members);
        useMediaStore.getState().setConnecting(false);
      });
    } else {
      manager.syncGroup([]);
      useMediaStore.getState().clearRemotes();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [group]);

  const toggleMic = useCallbackRef(async () => {
    const stream = await ensureLocalStream();
    if (!stream) return;
    const next = !useMediaStore.getState().micOn;
    stream.getAudioTracks().forEach((t) => (t.enabled = next));
    useMediaStore.getState().setMic(next);
  });

  const toggleCam = useCallbackRef(async () => {
    const on = useMediaStore.getState().camOn;
    const manager = managerRef.current;
    if (on) {
      localRef.current?.getVideoTracks().forEach((t) => {
        t.stop();
        localRef.current?.removeTrack(t);
      });
      await manager?.setVideoTrack(null);
      const remaining = localRef.current?.getTracks() ?? [];
      const updatedStream = remaining.length > 0 ? new MediaStream(remaining) : null;
      localRef.current = updatedStream;
      useMediaStore.getState().setLocalStream(updatedStream);
      manager?.setLocalStream(updatedStream);
      useMediaStore.getState().setCam(false);
    } else {
      try {
        const cam = await navigator.mediaDevices.getUserMedia({ video: true });
        const track = cam.getVideoTracks()[0];
        if (!track) return;
        const local = (await ensureLocalStream()) ?? new MediaStream();
        local.getVideoTracks().forEach((t) => local.removeTrack(t));
        local.addTrack(track);
        const updatedStream = new MediaStream(local.getTracks());
        localRef.current = updatedStream;
        useMediaStore.getState().setLocalStream(updatedStream);
        manager?.setLocalStream(updatedStream);
        await manager?.setVideoTrack(track);
        useMediaStore.getState().setCam(true);
      } catch {
        /* denied */
      }
    }
  });

  const toggleShare = useCallbackRef(async () => {
    const sharing = useMediaStore.getState().sharing;
    const manager = managerRef.current;
    if (sharing) {
      await manager?.setVideoTrack(null);
      useMediaStore.getState().setSharing(false);
      if (group) getSocket(token!).emit('rtc:screen-share-stop', { groupId: group.groupId });
    } else {
      try {
        const display = await navigator.mediaDevices.getDisplayMedia({ video: true });
        const track = display.getVideoTracks()[0];
        if (!track) return;
        await manager?.setVideoTrack(track);
        useMediaStore.getState().setSharing(true);
        if (group) getSocket(token!).emit('rtc:screen-share-start', { groupId: group.groupId });
        // Revert automatically when the user stops sharing from the browser UI.
        track.onended = () => {
          void manager?.setVideoTrack(null);
          useMediaStore.getState().setSharing(false);
        };
      } catch {
        /* cancelled */
      }
    }
  });

  return { toggleMic, toggleCam, toggleShare };
}
