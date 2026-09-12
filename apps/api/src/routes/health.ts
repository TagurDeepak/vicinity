import { Router } from 'express';
import { prisma } from '../lib/prisma';
import { redis } from '../lib/redis';

export const healthRouter = Router();

/** Liveness — process is up. */
healthRouter.get('/healthz', (_req, res) => {
  res.json({ status: 'ok', uptime: process.uptime() });
});

/** Readiness — dependencies reachable. Used by orchestrators before routing traffic. */
healthRouter.get('/readyz', async (_req, res) => {
  const checks = { database: false, redis: false };
  try {
    await prisma.$queryRaw`SELECT 1`;
    checks.database = true;
  } catch {
    /* remains false */
  }
  try {
    await redis.ping();
    checks.redis = true;
  } catch {
    /* remains false */
  }
  const ready = checks.database && checks.redis;
  res.status(ready ? 200 : 503).json({ status: ready ? 'ready' : 'not-ready', checks });
});
