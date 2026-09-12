import { createServer } from 'node:http';
import { createAdapter } from '@socket.io/redis-adapter';
import { Server } from 'socket.io';
import type { ClientToServerEvents, ServerToClientEvents } from '@vicinity/shared';
import { createApp } from './app';
import { env } from './config/env';
import { logger } from './lib/logger';
import { disconnectPrisma } from './lib/prisma';
import { disconnectRedis, pubClient, redisInMemory, subClient } from './lib/redis';
import { setIo } from './realtime/broadcast';
import { registerGateway } from './realtime/gateway';
import { ProximityEngine } from './realtime/proximity.engine';
import { authenticateSocket } from './realtime/socket-auth';

async function bootstrap(): Promise<void> {
  const app = createApp();
  const httpServer = createServer(app);

  // Socket.IO with a Redis adapter so realtime scales across multiple nodes.
  const corsOrigin = env.CORS_ORIGINS.includes('*') ? true : env.CORS_ORIGINS;
  const io = new Server<ClientToServerEvents, ServerToClientEvents>(httpServer, {
    cors: { origin: corsOrigin, credentials: true },
  });
  // In multi-node deployments, fan out events via Redis. Skipped for the
  // in-memory dev mock (single node).
  if (!redisInMemory) {
    io.adapter(createAdapter(pubClient, subClient));
  }
  io.use((socket, next) => {
    void authenticateSocket(socket, next);
  });

  setIo(io);
  const proximity = new ProximityEngine(io);
  registerGateway(io, proximity);

  httpServer.listen(env.API_PORT, env.API_HOST, () => {
    logger.info(`🚀 API listening on http://${env.API_HOST}:${env.API_PORT}`);
  });

  // --- Graceful shutdown ---
  const shutdown = async (signal: string): Promise<void> => {
    logger.info({ signal }, 'shutting down');
    io.close();
    httpServer.close();
    await Promise.allSettled([disconnectPrisma(), disconnectRedis()]);
    process.exit(0);
  };
  process.on('SIGTERM', () => void shutdown('SIGTERM'));
  process.on('SIGINT', () => void shutdown('SIGINT'));
}

bootstrap().catch((err) => {
  logger.error({ err }, 'failed to start API');
  process.exit(1);
});
