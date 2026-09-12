import type { RequestHandler } from 'express';
import { redis } from '../lib/redis';
import { AppError } from '../lib/app-error';

interface RateLimitOptions {
  /** Unique bucket name (e.g. 'auth'). */
  name: string;
  /** Max requests per window. */
  max: number;
  /** Window length in seconds. */
  windowSeconds: number;
}

/**
 * Fixed-window rate limiter backed by Redis (works across multiple API nodes).
 * Keyed by client IP + bucket name. Fails open if Redis is unavailable so an
 * outage in the limiter never takes down the API.
 */
export function rateLimit(options: RateLimitOptions): RequestHandler {
  return async (req, res, next) => {
    const ip = req.ip ?? 'unknown';
    const key = `ratelimit:${options.name}:${ip}`;
    try {
      const count = await redis.incr(key);
      if (count === 1) await redis.expire(key, options.windowSeconds);
      res.setHeader('X-RateLimit-Limit', options.max);
      res.setHeader('X-RateLimit-Remaining', Math.max(0, options.max - count));
      if (count > options.max) {
        next(new AppError(429, 'RATE_LIMITED', 'Too many requests, please slow down'));
        return;
      }
      next();
    } catch {
      next(); // fail open
    }
  };
}
