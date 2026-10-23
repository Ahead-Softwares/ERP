import type { Prisma } from '@prisma/client';
import { prisma } from '../../kernel/db';
import { cache } from '../../kernel/cache';
import { MODULES } from '../../contracts/modules';
import { ADDON_MONTHLY_PAISE, EXTRA_USER_MONTHLY_PAISE, PLANS, type PlanLimits } from '../../contracts/plans';

// R4: plans, prices and free-tier flags are commercial data owned by the database (edited from
// the Console). contracts/plans.ts only provides the first-install defaults.

const CACHE_KEY = 'catalog:commercial';
const TTL_MS = 60_000;

export interface CommercialCatalog {
  freeTierModules: Set<string>;
  freeLimits: PlanLimits;
  plans: { key: string; name: string; tagline: string | null; limits: PlanLimits; isPublic: boolean; fullModules: string[]; monthlyPaise: number | null; yearlyPaise: number | null }[];
  modules: { key: string; name: string; category: string; description: string | null; freeTier: boolean; dependsOn: string[]; addonMonthlyPaise: number | null }[];
  extraUserMonthlyPaise: number | null;
}

export function getCatalog(): Promise<CommercialCatalog> {
  return cache.getOrSet(CACHE_KEY, async () => {
    const [modules, plans, prices] = await Promise.all([
      prisma.module.findMany({ orderBy: { sort: 'asc' } }),
      prisma.plan.findMany({ orderBy: { sort: 'asc' }, include: { modules: true } }),
      prisma.price.findMany({ where: { activeTo: null } }),
    ]);
    const price = (itemType: string, itemRef: string, cycle: string) => {
      const p = prices.find((x) => x.itemType === itemType && x.itemRef === itemRef && x.cycle === cycle);
      return p ? Number(p.amountPaise) : null;
    };
    const free = plans.find((p) => p.key === 'free');
    if (!free) throw new Error('The free plan is missing; run the seed.');
    return {
      freeTierModules: new Set(modules.filter((m) => m.isFreeTier).map((m) => m.key)),
      freeLimits: free.limits as unknown as PlanLimits,
      plans: plans.map((p) => ({
        key: p.key, name: p.name, tagline: p.tagline, limits: p.limits as unknown as PlanLimits, isPublic: p.isPublic,
        fullModules: p.modules.map((m) => m.moduleKey),
        monthlyPaise: price('plan', p.key, 'monthly'), yearlyPaise: price('plan', p.key, 'yearly'),
      })),
      modules: modules.map((m) => ({
        key: m.key, name: m.name, category: m.category, description: m.description, freeTier: m.isFreeTier, dependsOn: m.dependsOn,
        addonMonthlyPaise: price('addon_module', m.key, 'monthly'),
      })),
      extraUserMonthlyPaise: price('extra_user', 'user', 'monthly'),
    };
  }, TTL_MS);
}

export const invalidateCatalog = () => cache.del(CACHE_KEY);

type Client = Prisma.TransactionClient;

/**
 * Seeds the commercial catalogue. Rows that already exist are left alone, so prices and plans
 * edited in the Console survive every deploy. `resetCommercials` restores the code defaults
 * (development only: `npm run db:seed -- --reset-commercials`).
 */
export async function syncCatalog(client: Client, opts: { resetCommercials?: boolean } = {}) {
  const reset = !!opts.resetCommercials;

  // Modules: name, category and dependencies are code facts; the free-tier flag is commercial
  for (const [i, m] of MODULES.entries()) {
    const facts = { name: m.name, description: m.description, category: m.category, dependsOn: m.dependsOn, isUsageBased: !!m.usageBased, sort: i };
    await client.module.upsert({
      where: { key: m.key },
      create: { key: m.key, ...facts, isFreeTier: m.freeTier },
      update: reset ? { ...facts, isFreeTier: m.freeTier } : facts,
    });
  }

  for (const [i, p] of PLANS.entries()) {
    const existing = await client.plan.findUnique({ where: { key: p.key } });
    if (existing && !reset) continue;
    const data = { name: p.name, tagline: p.tagline, limits: { ...p.limits }, isPublic: p.isPublic, sort: i };
    const plan = existing
      ? await client.plan.update({ where: { id: existing.id }, data })
      : await client.plan.create({ data: { key: p.key, ...data } });
    await client.planModule.deleteMany({ where: { planId: plan.id } });
    await client.planModule.createMany({ data: p.fullModules.map((moduleKey) => ({ planId: plan.id, moduleKey })) });
  }

  const wanted: { itemType: 'plan' | 'addon_module' | 'extra_user'; itemRef: string; cycle: 'monthly' | 'yearly'; amount: number }[] = [];
  for (const p of PLANS) {
    if (p.monthlyPaise !== null) wanted.push({ itemType: 'plan', itemRef: p.key, cycle: 'monthly', amount: p.monthlyPaise });
    if (p.yearlyPaise !== null) wanted.push({ itemType: 'plan', itemRef: p.key, cycle: 'yearly', amount: p.yearlyPaise });
  }
  for (const [moduleKey, amount] of Object.entries(ADDON_MONTHLY_PAISE)) {
    wanted.push({ itemType: 'addon_module', itemRef: moduleKey, cycle: 'monthly', amount: amount! });
    wanted.push({ itemType: 'addon_module', itemRef: moduleKey, cycle: 'yearly', amount: amount! * 10 });
  }
  wanted.push({ itemType: 'extra_user', itemRef: 'user', cycle: 'monthly', amount: EXTRA_USER_MONTHLY_PAISE });
  wanted.push({ itemType: 'extra_user', itemRef: 'user', cycle: 'yearly', amount: EXTRA_USER_MONTHLY_PAISE * 10 });

  // Prices are versioned (SUB-06): a change closes the active row and opens a new one
  for (const w of wanted) {
    const current = await client.price.findFirst({ where: { itemType: w.itemType, itemRef: w.itemRef, cycle: w.cycle, activeTo: null } });
    if (current && (!reset || current.amountPaise === BigInt(w.amount))) continue;
    const now = new Date();
    if (current) await client.price.update({ where: { id: current.id }, data: { activeTo: now } });
    await client.price.create({ data: { itemType: w.itemType, itemRef: w.itemRef, cycle: w.cycle, amountPaise: BigInt(w.amount), activeFrom: now } });
  }
}
