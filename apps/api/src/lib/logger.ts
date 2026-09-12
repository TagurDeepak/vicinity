import pino from 'pino';
import { env } from '../config/env';

/**
 * Central structured logger. In development we pretty-print; in production we
 * emit JSON for log aggregators (Loki, Azure Monitor, etc.).
 */
export const logger = pino({
  level: env.LOG_LEVEL,
  transport:
    env.NODE_ENV === 'development'
      ? { target: 'pino-pretty', options: { colorize: true, translateTime: 'SYS:standard' } }
      : undefined,
  redact: {
    // Never log secrets or credentials.
    paths: ['req.headers.authorization', 'password', 'passwordHash', 'token'],
    remove: true,
  },
});
