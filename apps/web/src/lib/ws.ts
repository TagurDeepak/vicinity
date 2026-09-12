import { io, type Socket } from 'socket.io-client';
import type { ClientToServerEvents, ServerToClientEvents } from '@vicinity/shared';
import { config } from './config';

export type VicinitySocket = Socket<ServerToClientEvents, ClientToServerEvents>;

let socket: VicinitySocket | null = null;

/**
 * Lazily creates a single shared socket connection authenticated with the
 * user's access token. Reconnects are handled by socket.io automatically.
 */
export function getSocket(token: string): VicinitySocket {
  if (socket) return socket;
  socket = io(config.wsUrl, {
    auth: { token },
    transports: ['websocket'],
    autoConnect: true,
  });
  return socket;
}

export function disconnectSocket(): void {
  socket?.disconnect();
  socket = null;
}
