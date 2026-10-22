import { Router } from 'express';
import { prisma } from '../kernel/db';
import identityRoutes, { meHandler } from '../modules/identity/routes';
import tenancyRoutes from '../modules/tenancy/routes';

const router = Router();

// Health check endpoint (includes a DB round-trip)
router.get('/health', async (_req, res) => {
  const started = Date.now();
  try {
    await prisma.$queryRaw`SELECT 1`;
    res.json({ status: 'ok', database: 'up', uptime: process.uptime(), dbLatencyMs: Date.now() - started, timestamp: new Date().toISOString() });
  } catch (e) {
    res.status(503).json({ status: 'degraded', database: 'down', reason: e instanceof Error ? e.message.trim().split('\n').pop() : String(e), timestamp: new Date().toISOString() });
  }
});

router.use('/auth', identityRoutes);
router.use('/me', meHandler);
router.use('/', tenancyRoutes);

export default router;
