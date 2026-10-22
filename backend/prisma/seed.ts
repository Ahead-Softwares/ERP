// Syncs code-defined reference data to the database. Safe to run on every deploy.
import 'dotenv/config';
import { createPrismaClient } from '../src/kernel/prismaClient';
import { MODULES } from '../src/contracts/modules';
import { PERMISSIONS } from '../src/contracts/permissions';
import { ADDON_MONTHLY_PAISE, EXTRA_USER_MONTHLY_PAISE, PLANS } from '../src/contracts/plans';
import { ROLES, expandGrants } from '../src/contracts/roles';
import { TEMPLATES } from '../src/contracts/templates';

const prisma = createPrismaClient();

async function seedModules() {
  for (const [i, m] of MODULES.entries()) {
    const data = { name: m.name, description: m.description, category: m.category, dependsOn: m.dependsOn, isFreeTier: m.freeTier, isUsageBased: !!m.usageBased, sort: i };
    await prisma.module.upsert({ where: { key: m.key }, create: { key: m.key, ...data }, update: data });
  }
}

async function seedPlans() {
  for (const [i, p] of PLANS.entries()) {
    const plan = await prisma.plan.upsert({
      where: { key: p.key },
      create: { key: p.key, name: p.name, tagline: p.tagline, limits: { ...p.limits }, isPublic: p.isPublic, sort: i },
      update: { name: p.name, tagline: p.tagline, limits: { ...p.limits }, isPublic: p.isPublic, sort: i },
    });
    await prisma.planModule.deleteMany({ where: { planId: plan.id } });
    await prisma.planModule.createMany({ data: p.fullModules.map((moduleKey) => ({ planId: plan.id, moduleKey })) });
  }

  // Prices are versioned: only insert a new row when the amount changed (SUB-06)
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

  for (const w of wanted) {
    const current = await prisma.price.findFirst({ where: { itemType: w.itemType, itemRef: w.itemRef, cycle: w.cycle, activeTo: null } });
    if (current && current.amountPaise === BigInt(w.amount)) continue;
    const now = new Date();
    if (current) await prisma.price.update({ where: { id: current.id }, data: { activeTo: now } });
    await prisma.price.create({ data: { itemType: w.itemType, itemRef: w.itemRef, cycle: w.cycle, amountPaise: BigInt(w.amount), activeFrom: now } });
  }
}

async function seedPermissions() {
  for (const p of PERMISSIONS) {
    const data = { moduleKey: p.moduleKey, resource: p.resource, action: p.action, description: p.description };
    await prisma.permission.upsert({ where: { key: p.key }, create: { key: p.key, ...data }, update: data });
  }
  await prisma.permission.deleteMany({ where: { key: { notIn: PERMISSIONS.map((p) => p.key) } } });
}

async function seedRoles() {
  for (const [i, def] of ROLES.entries()) {
    const grants = expandGrants(def);
    const base = { name: def.name, description: def.description, layer: def.layer, roleType: def.roleType, requiredModules: def.requiredModules, isSystem: !!def.isSystem, isPredefined: true, sort: i };
    let role = await prisma.role.findFirst({ where: { tenantId: null, key: def.key }, include: { permissions: true } });
    if (!role) {
      role = await prisma.role.create({ data: { key: def.key, ...base }, include: { permissions: true } });
    }
    const existing = new Map(role.permissions.map((rp) => [rp.permissionKey, rp.scope]));
    const changed = existing.size !== grants.size || [...grants].some(([k, s]) => existing.get(k) !== s);
    await prisma.role.update({ where: { id: role.id }, data: { ...base, version: changed ? { increment: 1 } : undefined } });
    if (changed) {
      await prisma.rolePermission.deleteMany({ where: { roleId: role.id } });
      await prisma.rolePermission.createMany({ data: [...grants].map(([permissionKey, scope]) => ({ roleId: role!.id, permissionKey, scope })) });
    }
    await prisma.roleFieldAccess.deleteMany({ where: { roleId: role.id } });
    if (def.fieldAccess?.length) {
      await prisma.roleFieldAccess.createMany({ data: def.fieldAccess.map((f) => ({ roleId: role!.id, ...f })) });
    }
  }
}

async function seedTemplates() {
  for (const t of TEMPLATES) {
    const definition = JSON.parse(JSON.stringify(t));
    await prisma.industryTemplate.upsert({
      where: { key_version: { key: t.key, version: t.version } },
      create: { key: t.key, version: t.version, name: t.name, description: t.description, definition },
      update: { name: t.name, description: t.description, definition },
    });
  }
}

async function main() {
  await seedModules();
  await seedPlans();
  await seedPermissions();
  await seedRoles();
  await seedTemplates();
  const counts = {
    modules: await prisma.module.count(),
    plans: await prisma.plan.count(),
    permissions: await prisma.permission.count(),
    roles: await prisma.role.count({ where: { tenantId: null } }),
    templates: await prisma.industryTemplate.count(),
  };
  console.log('Seed complete', counts);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
