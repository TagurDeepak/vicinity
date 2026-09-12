'use client';

import { useCallback, useEffect, useRef } from 'react';
import { MOVE_EMIT_HZ, UserStatus, type Vec2 } from '@vicinity/shared';
import { getSocket } from '@/lib/ws';
import { useAuthStore } from '@/stores/auth';
import { usePresenceStore } from '@/stores/presence';

/**
 * Owns the realtime lifecycle for an office floor: connects the socket, joins
 * presence, maps server events into the presence store, and exposes throttled
 * emitters for movement / status / chat.
 */
export function useOffice(workspaceId: string) {
  const token = useAuthStore((s) => s.accessToken);
  const meId = useAuthStore((s) => s.user?.id ?? null);
  const store = usePresenceStore();
  const lastEmit = useRef(0);

  useEffect(() => {
    if (!token || !meId) return;
    const socket = getSocket(token);
    store.setMe(meId);

    const onSnapshot = (p: { users: Parameters<typeof store.setSnapshot>[0] }) =>
      store.setSnapshot(p.users);
    const onJoined = store.upsert;
    const onMoved = (p: { userId: string; position: Vec2 }) =>
      store.setPosition(p.userId, p.position);
    const onStatus = (p: { userId: string; status: UserStatus }) =>
      store.setStatus(p.userId, p.status);
    const onLeft = (p: { userId: string }) => store.remove(p.userId);
    const onGroup = store.setGroup;
    const onZone = (p: { userId: string; zoneId: string | null }) =>
      store.setZone(p.userId, p.zoneId);

    socket.on('presence:snapshot', onSnapshot);
    socket.on('presence:joined', onJoined);
    socket.on('presence:moved', onMoved);
    socket.on('presence:status', onStatus);
    socket.on('presence:zone', onZone);
    socket.on('presence:left', onLeft);
    socket.on('proximity:group', onGroup);

    socket.emit('presence:join', { workspaceId });

    return () => {
      socket.off('presence:snapshot', onSnapshot);
      socket.off('presence:joined', onJoined);
      socket.off('presence:moved', onMoved);
      socket.off('presence:status', onStatus);
      socket.off('presence:zone', onZone);
      socket.off('presence:left', onLeft);
      socket.off('proximity:group', onGroup);
      store.reset();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, meId, workspaceId]);

  const move = useCallback(
    (position: Vec2) => {
      if (!meId || !token) return;
      // Optimistic local update for a responsive feel.
      store.setPosition(meId, position);
      const now = performance.now();
      if (now - lastEmit.current < 1000 / MOVE_EMIT_HZ) return;
      lastEmit.current = now;
      getSocket(token).emit('presence:move', { position });
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [meId, token],
  );

  const enterZone = useCallback(
    (zoneId: string) => {
      if (!token) return;
      if (meId) store.setZone(meId, zoneId);
      getSocket(token).emit('zone:enter', { zoneId });
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [meId, token],
  );

  const leaveZone = useCallback(
    (zoneId?: string) => {
      if (!token) return;
      if (meId) store.setZone(meId, null);
      getSocket(token).emit('zone:leave', { zoneId: zoneId ?? '' });
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [meId, token],
  );

  const setStatus = useCallback(
    (status: UserStatus) => {
      if (!token) return;
      getSocket(token).emit('presence:status', { status });
    },
    [token],
  );

  const sendChat = useCallback(
    (channelId: string, body: string) => {
      if (!token) return;
      getSocket(token).emit('chat:send', { channelId, body });
    },
    [token],
  );

  return { move, setStatus, sendChat, enterZone, leaveZone };
}
