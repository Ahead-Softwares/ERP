import { PrismaClient } from '@prisma/client';
import { PrismaNeon } from '@prisma/adapter-neon';
import { neonConfig } from '@neondatabase/serverless';
import ws from 'ws';

/**
 * Build the Prisma client. For Neon we use the serverless driver, which speaks the
 * Postgres protocol over WebSockets on port 443 — many office/ISP networks block 5432.
 * Set DB_TRANSPORT=tcp to use Prisma's native TCP engine instead (e.g. local Postgres).
 */
export function createPrismaClient(log: ('warn' | 'error' | 'info' | 'query')[] = ['warn', 'error']) {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error('DATABASE_URL is not set');

  const useNeon = process.env.DB_TRANSPORT !== 'tcp' && /\.neon\.tech/.test(url);
  if (!useNeon) return new PrismaClient({ log });

  neonConfig.webSocketConstructor = ws;
  const adapter = new PrismaNeon({ connectionString: url, max: 10, connectionTimeoutMillis: 15_000 });
  return new PrismaClient({ adapter, log });
}
