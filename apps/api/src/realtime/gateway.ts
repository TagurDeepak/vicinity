import { UserStatus } from '@vicinity/shared';
import { logger } from '../lib/logger';
import { prisma } from '../lib/prisma';
import * as chatService from '../modules/chat/chat.service';
import { channelRoom, workspaceRoom, type VicinityServer } from './broadcast';
import { ProximityEngine, userRoom } from './proximity.engine';
import type { SocketUser } from './socket-auth';
import * as presence from './redis-state.service';
import { registerSignaling } from './signaling';

interface LockedRoom {
  zoneId: string;
  lockedBy: string;
  lockedByName: string;
}

const lockedRooms = new Map<string, Map<string, LockedRoom>>();

/**
 * Wires all realtime behaviour onto the Socket.IO server: presence lifecycle,
 * avatar movement, zone transitions, chat fast-path, and WebRTC signaling.
 */
export function registerGateway(io: VicinityServer, proximity: ProximityEngine): void {
  io.on('connection', (socket) => {
    const user = socket.data.user as SocketUser;
    // Personal room → lets signaling / proximity target this user directly.
    void socket.join(userRoom(user.id));
    logger.debug({ userId: user.id, socketId: socket.id }, 'socket connected');

    socket.on('presence:join', async ({ workspaceId }) => {
      // Authorize: the user must be a member of the workspace.
      const membership = await prisma.membership.findUnique({
        where: { workspaceId_userId: { workspaceId, userId: user.id } },
      });
      if (!membership) {
        socket.emit('error', { code: 'FORBIDDEN', message: 'Not a member of this workspace' });
        return;
      }

      socket.data.user = { ...user, workspaceId } satisfies SocketUser;
      await socket.join(workspaceRoom(workspaceId));

      const state = {
        userId: user.id,
        displayName: user.displayName,
        avatarUrl: user.avatarUrl,
        status: UserStatus.Available,
        position: { x: 200, y: 200 },
        zoneId: null,
      };
      await presence.setPresence(workspaceId, state);
      proximity.trackWorkspace(workspaceId);

      // Send the newcomer the full snapshot; tell everyone else about the newcomer.
      const snapshot = await presence.getWorkspacePresence(workspaceId);
      socket.emit('presence:snapshot', { users: snapshot });
      socket.to(workspaceRoom(workspaceId)).emit('presence:joined', state);

      // Send current locked rooms
      const locks = lockedRooms.get(workspaceId);
      if (locks) {
        socket.emit('room:locked-list', Array.from(locks.values()));
      }
    });

    socket.on('presence:move', async ({ position }) => {
      const workspaceId = (socket.data.user as SocketUser).workspaceId;
      if (!workspaceId) return;
      await presence.updatePosition(workspaceId, user.id, position);
      socket.to(workspaceRoom(workspaceId)).emit('presence:moved', { userId: user.id, position });
    });

    socket.on('presence:status', async ({ status }) => {
      const workspaceId = (socket.data.user as SocketUser).workspaceId;
      if (!workspaceId) return;
      await presence.updateStatus(workspaceId, user.id, status);
      io.to(workspaceRoom(workspaceId)).emit('presence:status', { userId: user.id, status });
    });

    const checkAutoUnlock = async (workspaceId: string, zoneId: string | null) => {
      if (!zoneId) return;
      const locks = lockedRooms.get(workspaceId);
      if (locks?.has(zoneId)) {
        const presences = await presence.getWorkspacePresence(workspaceId);
        const occupants = presences.filter((p) => p.zoneId === zoneId);
        if (occupants.length === 0) {
          locks.delete(zoneId);
          io.to(workspaceRoom(workspaceId)).emit('room:lock-state', { zoneId, locked: false });
        }
      }
    };

    socket.on('zone:enter', async ({ zoneId }) => {
      const workspaceId = (socket.data.user as SocketUser).workspaceId;
      if (!workspaceId) return;
      await presence.updateZone(workspaceId, user.id, zoneId);
      io.to(workspaceRoom(workspaceId)).emit('presence:zone', { userId: user.id, zoneId });
    });

    socket.on('zone:leave', async () => {
      const workspaceId = (socket.data.user as SocketUser).workspaceId;
      if (!workspaceId) return;
      const current = await presence.getPresence(workspaceId, user.id);
      const prevZoneId = current?.zoneId ?? null;
      await presence.updateZone(workspaceId, user.id, null);
      io.to(workspaceRoom(workspaceId)).emit('presence:zone', { userId: user.id, zoneId: null });
      await checkAutoUnlock(workspaceId, prevZoneId);
    });

    // ---- Focus Room Locking & Knocking ----
    socket.on('room:lock', ({ zoneId }: { zoneId: string }) => {
      const workspaceId = (socket.data.user as SocketUser).workspaceId;
      if (!workspaceId) return;
      if (!lockedRooms.has(workspaceId)) lockedRooms.set(workspaceId, new Map());
      const info: LockedRoom = { zoneId, lockedBy: user.id, lockedByName: user.displayName };
      lockedRooms.get(workspaceId)!.set(zoneId, info);
      io.to(workspaceRoom(workspaceId)).emit('room:lock-state', {
        zoneId,
        locked: true,
        lockedBy: user.id,
        lockedByName: user.displayName,
      });
    });

    socket.on('room:unlock', ({ zoneId }: { zoneId: string }) => {
      const workspaceId = (socket.data.user as SocketUser).workspaceId;
      if (!workspaceId) return;
      lockedRooms.get(workspaceId)?.delete(zoneId);
      io.to(workspaceRoom(workspaceId)).emit('room:lock-state', { zoneId, locked: false });
    });

    socket.on('room:knock', async ({ zoneId }: { zoneId: string }) => {
      const workspaceId = (socket.data.user as SocketUser).workspaceId;
      if (!workspaceId) return;
      const presences = await presence.getWorkspacePresence(workspaceId);
      const occupants = presences.filter((p) => p.zoneId === zoneId && p.userId !== user.id);
      for (const occupant of occupants) {
        io.to(userRoom(occupant.userId)).emit('room:knocked', {
          fromUserId: user.id,
          fromName: user.displayName,
          zoneId,
        });
      }
    });

    socket.on('room:let-in', ({ zoneId, targetUserId }: { zoneId: string; targetUserId: string }) => {
      const workspaceId = (socket.data.user as SocketUser).workspaceId;
      if (!workspaceId) return;
      // Unlock the room and alert the target user
      lockedRooms.get(workspaceId)?.delete(zoneId);
      io.to(workspaceRoom(workspaceId)).emit('room:lock-state', { zoneId, locked: false });
      io.to(userRoom(targetUserId)).emit('room:let-in-granted', {
        zoneId,
        grantedBy: user.displayName,
      });
    });

    // Chat: join a channel room to receive its live messages (access checked).
    socket.on('chat:subscribe', async ({ channelId }) => {
      try {
        await chatService.assertChannelAccess(user.id, channelId);
        await socket.join(channelRoom(channelId));
      } catch (err) {
        socket.emit('error', { code: 'CHAT_SUBSCRIBE_FAILED', message: (err as Error).message });
      }
    });

    // Chat fast-path: subscribe to a channel room, then send.
    socket.on('chat:send', async ({ channelId, body }) => {
      try {
        const message = await chatService.postMessage(user.id, channelId, body);
        await socket.join(channelRoom(channelId));
        io.to(channelRoom(channelId)).emit('chat:message', {
          channelId,
          message: {
            id: message.id,
            channelId: message.channelId,
            senderId: message.senderId,
            body: message.body,
            createdAt: message.createdAt.toISOString(),
            metadata: (message.metadata as Record<string, unknown>) ?? {},
          },
        });
      } catch (err) {
        socket.emit('error', { code: 'CHAT_SEND_FAILED', message: (err as Error).message });
      }
    });

    // WebRTC signaling relay.
    registerSignaling(io, socket);

    socket.on('disconnect', async () => {
      const workspaceId = (socket.data.user as SocketUser).workspaceId;
      if (workspaceId) {
        const current = await presence.getPresence(workspaceId, user.id);
        const prevZoneId = current?.zoneId ?? null;
        await presence.removePresence(workspaceId, user.id);
        socket.to(workspaceRoom(workspaceId)).emit('presence:left', { userId: user.id });
        await checkAutoUnlock(workspaceId, prevZoneId);
      }
      logger.debug({ userId: user.id, socketId: socket.id }, 'socket disconnected');
    });
  });
}
