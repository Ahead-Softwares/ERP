import { prisma, withPlatform } from '../../kernel/db';
import { transition } from './stateMachine';

// LLD §11.4 — hourly: move expired trials to the Free plan (paid modules → read_only).
export async function runTrialExpiry(now = new Date()) {
  let moved = 0;
  for (;;) {
    const batch = await prisma.subscription.findMany({
      where: { status: 'trialing', trialEndsAt: { lte: now } },
      select: { tenantId: true },
      take: 100,
    });
    if (!batch.length) break;
    for (const { tenantId } of batch) {
      try {
        await withPlatform(() => transition(tenantId, 'trial_expired', { now }));
        moved++;
      } catch (e) {
        console.error(`[trial-expiry] tenant ${tenantId}:`, e);
        return moved; // avoid hot-looping on a persistent failure
      }
    }
  }
  if (moved) console.log(`[trial-expiry] moved ${moved} tenant(s) to Free`);
  return moved;
}
