import type { TenantStatus } from '@prisma/client';
import { env } from '../../config/env';
import { db } from '../../kernel/db';
import { appError } from '../../kernel/errors';
import { audit } from '../audit/service';
import { publish } from '../events/outbox';
import { persistEntitlements } from './entitlements';

// LLD §6.2 — allowed (from, event) pairs; anything else throws INVALID_TRANSITION.

export type SubscriptionEvent =
  | 'payment_captured'
  | 'trial_expired'
  | 'renewal_succeeded'
  | 'renewal_failed'
  | 'grace_expired'
  | 'period_end_cancel'
  | 'owner_closed'
  | 'owner_restored'
  | 'purge';

const TRANSITIONS: Record<string, TenantStatus> = {
  'trialing:payment_captured': 'active',
  'trialing:trial_expired': 'free',
  'active:renewal_succeeded': 'active',
  'active:renewal_failed': 'past_due',
  'past_due:payment_captured': 'active',
  'past_due:grace_expired': 'free',
  'active:period_end_cancel': 'free',
  'free:payment_captured': 'active',
  'trialing:owner_closed': 'closed',
  'active:owner_closed': 'closed',
  'past_due:owner_closed': 'closed',
  'free:owner_closed': 'closed',
  'closed:owner_restored': 'free',
  'closed:purge': 'purged',
};

const DAY = 24 * 60 * 60 * 1000;

export function nextStatus(from: TenantStatus, event: SubscriptionEvent): TenantStatus {
  const to = TRANSITIONS[`${from}:${event}`];
  if (!to) throw appError('INVALID_TRANSITION', `Cannot apply ${event} to a ${from} subscription.`, { from, event });
  return to;
}

/** Apply a transition. Must run inside a platform transaction. */
export async function transition(tenantId: string, event: SubscriptionEvent, opts: { planId?: string; now?: Date } = {}) {
  const tx = db();
  const now = opts.now ?? new Date();
  const sub = await tx.subscription.findUniqueOrThrow({ where: { tenantId } });
  const to = nextStatus(sub.status, event);
  const data: Record<string, unknown> = { status: to, version: { increment: 1 } };

  switch (event) {
    case 'payment_captured':
    case 'renewal_succeeded': {
      if (opts.planId) data.planId = opts.planId;
      const yearly = sub.cycle === 'yearly';
      const start = event === 'renewal_succeeded' && sub.currentPeriodEnd ? sub.currentPeriodEnd : now;
      const end = new Date(start);
      if (yearly) end.setFullYear(end.getFullYear() + 1);
      else end.setMonth(end.getMonth() + 1);
      Object.assign(data, { currentPeriodStart: start, currentPeriodEnd: end, graceEndsAt: null, trialEndsAt: sub.status === 'trialing' ? now : sub.trialEndsAt });
      break;
    }
    case 'renewal_failed': {
      const days = sub.cycle === 'yearly' ? env.GRACE_DAYS_YEARLY : env.GRACE_DAYS_MONTHLY;
      data.graceEndsAt = new Date(now.getTime() + days * DAY);
      break;
    }
    case 'trial_expired':
    case 'grace_expired':
    case 'period_end_cancel': {
      const free = await tx.plan.findUniqueOrThrow({ where: { key: 'free' } });
      Object.assign(data, { planId: free.id, graceEndsAt: null, cancelAtPeriodEnd: false });
      break;
    }
    case 'owner_closed':
      data.purgeAt = new Date(now.getTime() + 30 * DAY);
      break;
    case 'owner_restored':
      data.purgeAt = null;
      break;
  }

  await tx.subscription.update({ where: { id: sub.id }, data });
  await tx.tenant.update({ where: { id: tenantId }, data: { status: to, closedAt: to === 'closed' ? now : to === 'free' && sub.status === 'closed' ? null : undefined } });
  const ent = await persistEntitlements(tenantId);

  // Over the user limit after a downgrade: owner chooses who stays active (TRL-04)
  if (to === 'free') {
    const active = await tx.tenantMember.count({ where: { tenantId, status: 'active' } });
    if (active > ent.limits.users) await tx.tenant.update({ where: { id: tenantId }, data: { needsSeatChoice: true } });
  }

  await publish('subscription.changed', { subscriptionId: sub.id, from: sub.status, to, event, planKey: ent.planKey }, { tenantId });
  await audit({ tenantId, action: 'subscription.transition', entity: 'subscription', entityId: sub.id, before: { status: sub.status }, after: { status: to, event } });
  return to;
}
