import { Redis } from 'ioredis';
import RedisMock from 'ioredis-mock';
import { env } from '../config/env';
import { logger } from './logger';

/**
 * Redis clients.
 *  - `redis`     : general commands (presence state, rate limiting).
 *  - `pubClient` / `subClient` : dedicated connections for the Socket.IO
 *    Redis adapter so realtime events fan out across multiple API nodes.
 *
 * A subscriber connection cannot issue normal commands, hence the split.
 *
 * Local dev: set `REDIS_URL=memory` to use an in-process mock (no Redis server
 * required). In this mode the Socket.IO Redis adapter is skipped (single node).
 */
export const redisInMemory = env.REDIS_URL === 'memory';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const RedisCtor: any = redisInMemory ? RedisMock : Redis;
const args: unknown[] = redisInMemory ? [] : [env.REDIS_URL, { maxRetriesPerRequest: null }];

export const redis = new RedisCtor(...args);
export const pubClient = new RedisCtor(...args);
export const subClient = pubClient.duplicate();

// Attach error listeners so a missing/unavailable Redis logs instead of
// crashing the process via an unhandled 'error' event.
for (const [name, client] of [
  ['redis', redis],
  ['pub', pubClient],
  ['sub', subClient],
] as const) {
  client.on('error', (err: Error) => logger.debug({ err, client: name }, 'redis connection error'));
}

export async function disconnectRedis(): Promise<void> {
  await Promise.allSettled([redis.quit(), pubClient.quit(), subClient.quit()]);
}
