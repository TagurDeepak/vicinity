import { UserStatus } from '@vicinity/shared';
import { logger } from '../lib/logger';
import { prisma } from '../lib/prisma';
import * as chatService from '../modules/chat/chat.service';
import { channelRoom, workspaceRoom, type VicinityServer } from './broadcast';
import { ProximityEngine, userRoom } from './proximity.engine';
import type { SocketUser } from './socket-auth';
import * as presence from './redis-state.service';
import { registerSignaling } from './signaling';

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

    socket.on('zone:enter', async ({ zoneId }) => {
      const workspaceId = (socket.data.user as SocketUser).workspaceId;
      if (!workspaceId) return;
      await presence.updateZone(workspaceId, user.id, zoneId);
      io.to(workspaceRoom(workspaceId)).emit('presence:zone', { userId: user.id, zoneId });
    });

    socket.on('zone:leave', async () => {
      const workspaceId = (socket.data.user as SocketUser).workspaceId;
      if (!workspaceId) return;
      await presence.updateZone(workspaceId, user.id, null);
      io.to(workspaceRoom(workspaceId)).emit('presence:zone', { userId: user.id, zoneId: null });
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
        await presence.removePresence(workspaceId, user.id);
        socket.to(workspaceRoom(workspaceId)).emit('presence:left', { userId: user.id });
      }
      logger.debug({ userId: user.id, socketId: socket.id }, 'socket disconnected');
    });
  });
}
