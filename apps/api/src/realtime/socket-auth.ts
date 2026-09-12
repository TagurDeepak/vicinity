import type { Socket } from 'socket.io';
import { verifyAccessToken } from '../modules/auth/tokens';
import { prisma } from '../lib/prisma';

export interface SocketUser {
  id: string;
  displayName: string;
  avatarUrl: string | null;
  workspaceId?: string;
}

/**
 * Socket.IO handshake auth. The client sends its access token via
 * `auth: { token }`. We verify it and hydrate `socket.data.user`.
 */
export async function authenticateSocket(
  socket: Socket,
  next: (err?: Error) => void,
): Promise<void> {
  try {
    const token = socket.handshake.auth?.token as string | undefined;
    if (!token) throw new Error('Missing token');

    const payload = verifyAccessToken(token);
    const user = await prisma.user.findUnique({
      where: { id: payload.sub },
      select: { id: true, displayName: true, avatarUrl: true },
    });
    if (!user) throw new Error('User not found');

    socket.data.user = { ...user } satisfies SocketUser;
    next();
  } catch {
    next(new Error('UNAUTHORIZED'));
  }
}
