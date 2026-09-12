import { PrismaClient } from '@prisma/client';
import { env } from '../config/env';

/**
 * Single shared Prisma client. Reused across the process to avoid exhausting
 * database connections (each `new PrismaClient()` opens its own pool).
 */
export const prisma = new PrismaClient({
  log: env.NODE_ENV === 'development' ? ['warn', 'error'] : ['error'],
});

export async function disconnectPrisma(): Promise<void> {
  await prisma.$disconnect();
}
