import { env } from './config/env';
import app from './app';
import { prisma } from './kernel/db';
import { startWorker, stopWorker } from './worker';

const server = app.listen(env.PORT, () => {
  console.log(`🚀 Server running on http://localhost:${env.PORT}`);
  console.log(`📡 Health check: http://localhost:${env.PORT}/api/v1/health`);
  if (env.RUN_WORKER) startWorker();
});

async function shutdown() {
  stopWorker();
  server.close();
  await prisma.$disconnect();
  process.exit(0);
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
