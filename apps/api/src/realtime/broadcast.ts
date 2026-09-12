import type { Server } from 'socket.io';
import type {
  ChatMessage,
  ClientToServerEvents,
  ServerToClientEvents,
} from '@vicinity/shared';

export type VicinityServer = Server<ClientToServerEvents, ServerToClientEvents>;

let io: VicinityServer | null = null;

/** Called once during bootstrap so services can broadcast without importing main. */
export function setIo(server: VicinityServer): void {
  io = server;
}

/** Broadcasts a persisted chat message to everyone subscribed to the channel room. */
export function broadcastChatMessage(channelId: string, message: ChatMessage): void {
  io?.to(channelRoom(channelId)).emit('chat:message', { channelId, message });
}

/** Broadcasts that a channel's messages were cleared. */
export function broadcastChatCleared(channelId: string): void {
  io?.to(channelRoom(channelId)).emit('chat:cleared', { channelId });
}

export function channelRoom(channelId: string): string {
  return `channel:${channelId}`;
}

export function workspaceRoom(workspaceId: string): string {
  return `workspace:${workspaceId}`;
}
