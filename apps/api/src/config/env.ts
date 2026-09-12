import { config as loadDotenv } from 'dotenv';
import path from 'node:path';
import { z } from 'zod';

// Load the root .env (monorepo-wide) so all services share one config file.
loadDotenv({ path: path.resolve(process.cwd(), '../../.env') });
loadDotenv(); // also allow an app-local .env to override

/**
 * Environment schema. The process exits early with a clear message if any
 * required variable is missing — no silent misconfiguration in production.
 */
const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),

  API_PORT: z.coerce.number().default(process.env.PORT ? Number(process.env.PORT) : 4000),
  API_HOST: z.string().default('0.0.0.0'),
  CORS_ORIGINS: z
    .string()
    .default('http://localhost:3000')
    .transform((v) => v.split(',').map((s) => s.trim())),

  DATABASE_URL: z.string().url(),
  // Either a redis:// URL or the literal 'memory' for the in-process dev mock.
  REDIS_URL: z.string().min(1),

  JWT_SECRET: z.string().min(16, 'JWT_SECRET must be at least 16 characters'),
  JWT_ACCESS_TTL: z.coerce.number().default(900),
  JWT_REFRESH_TTL: z.coerce.number().default(1_209_600),
  AUTH_MODE: z.enum(['local', 'entra']).default('local'),

  STUN_URLS: z
    .string()
    .default('stun:stun.l.google.com:19302')
    .transform((v) => v.split(',').map((s) => s.trim())),
  TURN_URL: z.string().optional(),
  TURN_USERNAME: z.string().optional(),
  TURN_CREDENTIAL: z.string().optional(),

  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace']).default('info'),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  // eslint-disable-next-line no-console
  console.error('❌ Invalid environment configuration:');
  // eslint-disable-next-line no-console
  console.error(parsed.error.flatten().fieldErrors);
  process.exit(1);
}

export const env = parsed.data;
export type Env = typeof env;
