import { PrismaClient } from '@prisma/client';
import { isProd, isTest } from './env';

/**
 * Cliente Prisma unico (singleton).
 *
 * Em dev, o hot-reload do tsx recria o modulo a cada alteracao; sem guardar a
 * instancia no globalThis cada reload abriria um novo pool de conexoes e o
 * Postgres estouraria `too many clients`.
 */
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: isProd ? ['error'] : ['warn', 'error'],
  });

if (!isProd && !isTest) {
  globalForPrisma.prisma = prisma;
}
