import type { EntitlementStatus, TenantStatus } from '@prisma/client';
import { prisma, db } from '../../kernel/db';
import { cache } from '../../kernel/cache';
import { MODULES, MODULE_KEYS, type ModuleKey, type ModuleTier } from '../../contracts/modules';
import { PLANS, TRIAL_LIMITS, type PlanLimits } from '../../contracts/plans';

// SUB-04: the entitlement table is the single source the app reads to unlock modules.

export interface ModuleEntitlement {
  status: EntitlementStatus;
  tier: ModuleTier;
}

export interface EntitlementSnapshot {
  tenantId: string;
  status: TenantStatus;
  planKey: string;
  trialEndsAt: Date | null;
  currentPeriodEnd: Date | null;
  limits: PlanLimits;
  modules: Record<ModuleKey, ModuleEntitlement>;
}

const FREE_LIMITS = PLANS.find((p) => p.key === 'free')!.limits;
const PAID_STATES: TenantStatus[] = ['active', 'past_due'];

export function resolveEntitlements(
  status: TenantStatus,
  fullModules: Set<string>,
  everUsed: Set<string>,
): Record<ModuleKey, ModuleEntitlement> {
  const out = {} as Record<ModuleKey, ModuleEntitlement>;
  for (const m of MODULES) {
    let e: ModuleEntitlement;
    if (status === 'trialing') e = { status: 'active', tier: 'full' };
    else if (status === 'closed' || status === 'purged') e = { status: everUsed.has(m.key) ? 'read_only' : 'inactive', tier: 'basic' };
    else if (PAID_STATES.includes(status) && fullModules.has(m.key)) e = { status: 'active', tier: 'full' };
    else if (m.freeTier) e = { status: 'active', tier: 'basic' };
    else e = { status: everUsed.has(m.key) ? 'read_only' : 'inactive', tier: 'basic' };
    out[m.key] = e;
  }
  return out;
}

export function resolveLimits(status: TenantStatus, planLimits: PlanLimits): PlanLimits {
  if (status === 'trialing') return TRIAL_LIMITS;
  if (PAID_STATES.includes(status)) return planLimits;
  return FREE_LIMITS;
}

async function loadSubscription(tenantId: string, client: Pick<typeof prisma, 'subscription'>) {
  return client.subscription.findUniqueOrThrow({
    where: { tenantId },
    include: { items: true },
  });
}

/** Recompute and store tenant_entitlements. Call inside a platform transaction. */
export async function persistEntitlements(tenantId: string) {
  const tx = db();
  const sub = await loadSubscription(tenantId, tx);
  const plan = await tx.plan.findUniqueOrThrow({ where: { id: sub.planId }, include: { modules: true } });
  const full = new Set(plan.modules.map((m) => m.moduleKey));
  if (sub.items.length) {
    const prices = await tx.price.findMany({ where: { id: { in: sub.items.map((i) => i.priceId) }, itemType: 'addon_module' } });
    prices.forEach((p) => full.add(p.itemRef));
  }
  const rows = await tx.tenantEntitlement.findMany({ where: { tenantId } });
  const everUsed = new Set(rows.filter((r) => r.activatedAt).map((r) => r.moduleKey));
  const resolved = resolveEntitlements(sub.status, full, everUsed);
  const limits = resolveLimits(sub.status, plan.limits as unknown as PlanLimits);
  const now = new Date();

  for (const key of MODULE_KEYS) {
    const e = resolved[key];
    const prev = rows.find((r) => r.moduleKey === key);
    const data = { status: e.status, limits: { tier: e.tier }, activatedAt: prev?.activatedAt ?? (e.status === 'active' ? now : null) };
    await tx.tenantEntitlement.upsert({
      where: { tenantId_moduleKey: { tenantId, moduleKey: key } },
      create: { tenantId, moduleKey: key, ...data },
      update: data,
    });
  }
  cache.del(`ent:tenant:${tenantId}`);
  return { modules: resolved, limits, planKey: plan.key };
}

/** Cached snapshot used by middleware and /me (reads with platform privileges). */
export function getEntitlements(tenantId: string): Promise<EntitlementSnapshot> {
  return cache.getOrSet(`ent:tenant:${tenantId}`, async () => {
    const sub = await loadSubscription(tenantId, prisma);
    const plan = await prisma.plan.findUniqueOrThrow({ where: { id: sub.planId } });
    const rows = await prisma.tenantEntitlement.findMany({ where: { tenantId } });
    const modules = {} as Record<ModuleKey, ModuleEntitlement>;
    for (const key of MODULE_KEYS) {
      const r = rows.find((x) => x.moduleKey === key);
      modules[key] = { status: r?.status ?? 'inactive', tier: ((r?.limits as { tier?: ModuleTier } | null)?.tier ?? 'basic') };
    }
    return {
      tenantId,
      status: sub.status,
      planKey: plan.key,
      trialEndsAt: sub.trialEndsAt,
      currentPeriodEnd: sub.currentPeriodEnd,
      limits: resolveLimits(sub.status, plan.limits as unknown as PlanLimits),
      modules,
    };
  });
}

/** Module keys active at full tier — used for module-role visibility (Roles doc). */
export const fullModules = (snap: EntitlementSnapshot) =>
  MODULE_KEYS.filter((k) => snap.modules[k].status === 'active' && snap.modules[k].tier === 'full');
