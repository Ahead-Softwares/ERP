import type { PermissionScope, Prisma } from '@prisma/client';
import { prisma } from '../../kernel/db';
import { cache } from '../../kernel/cache';
import type { ConsoleCtx } from '../../kernel/context';
import { PERMISSIONS } from '../../contracts/permissions';
import { getRolePermissions } from '../access/service';

// R3-lite: the AHEAD team's Console. Lookups read with platform privileges and a short cache
// (60 s) so a deactivated Console user loses access quickly.

const TTL_MS = 60_000;

export interface PlatformMemberSnapshot {
  id: string;
  userId: string;
  roleId: string;
  reportsTo: string | null;
  status: 'invited' | 'active' | 'deactivated';
}

export function getPlatformMember(userId: string): Promise<PlatformMemberSnapshot | null> {
  return cache.getOrSet(`pmember:${userId}`, () =>
    prisma.platformMember.findUnique({ where: { userId }, select: { id: true, userId: true, roleId: true, reportsTo: true, status: true } }),
  TTL_MS);
}

export const invalidatePlatformMember = (userId: string) => {
  cache.del(`pmember:${userId}`);
  cache.del('pmember:tree');
};

/** Pure: the user and everyone below them in the reporting tree. */
export function teamOf(userId: string, edges: { userId: string; reportsTo: string | null }[]) {
  const team = new Set([userId]);
  for (let grew = true; grew; ) {
    grew = false;
    for (const e of edges) {
      if (e.reportsTo && team.has(e.reportsTo) && !team.has(e.userId)) {
        team.add(e.userId);
        grew = true;
      }
    }
  }
  return [...team];
}

async function reportingTree() {
  return cache.getOrSet('pmember:tree', () =>
    prisma.platformMember.findMany({ where: { status: 'active' }, select: { userId: true, reportsTo: true } }),
  TTL_MS);
}

/** Pure: the Prisma filter on tenants for a Console scope (all / team / own). */
export function tenantScopeFilter(scope: PermissionScope, userIds: string[]): Prisma.TenantWhereInput {
  if (scope === 'all') return {};
  return { acquisition: { acquiredByUserId: { in: userIds } } };
}

/** Which clients this Console user may see for the permission checked on the request. */
export async function scopedTenantFilter(ctx: ConsoleCtx): Promise<Prisma.TenantWhereInput> {
  const scope = ctx.scope ?? 'own';
  if (scope === 'all') return {};
  const ids = scope === 'team' ? teamOf(ctx.userId, await reportingTree()) : [ctx.userId];
  return tenantScopeFilter(scope, ids);
}

/** Console permission keys for a role, as { key: scope }. */
export async function consolePermissions(roleId: string) {
  const perms = await getRolePermissions(roleId);
  const out: Record<string, PermissionScope> = {};
  for (const p of PERMISSIONS) {
    const scope = perms.get(p.key);
    if (scope && p.moduleKey === 'platform') out[p.key] = scope;
  }
  return out;
}

/** What /me reports about the Console for this user (null when they are not on the AHEAD team). */
export async function consoleAccess(userId: string) {
  const member = await getPlatformMember(userId);
  if (!member || member.status !== 'active') return null;
  const [role, permissions] = await Promise.all([
    prisma.role.findUniqueOrThrow({ where: { id: member.roleId }, select: { key: true, name: true } }),
    consolePermissions(member.roleId),
  ]);
  return { memberId: member.id, role, permissions };
}

const DAY = 86_400_000;

/** GET /console/dashboard — client counts within the caller's scope. */
export async function dashboard(ctx: ConsoleCtx, now = new Date()) {
  const where = await scopedTenantFilter(ctx);
  const [byStatus, trialsEndingSoon, newThisWeek, pendingApprovals] = await Promise.all([
    prisma.tenant.groupBy({ by: ['status'], where: { ...where, isInternal: false }, _count: true }),
    prisma.tenant.count({ where: { ...where, isInternal: false, subscription: { status: 'trialing', trialEndsAt: { gte: now, lte: new Date(now.getTime() + 7 * DAY) } } } }),
    prisma.tenant.count({ where: { ...where, isInternal: false, createdAt: { gte: new Date(now.getTime() - 7 * DAY) } } }),
    prisma.platformOrder.count({ where: { status: 'pending_approval', ...(Object.keys(where).length ? { tenantId: { in: (await prisma.tenant.findMany({ where, select: { id: true } })).map((t) => t.id) } } : {}) } }),
  ]);
  const counts = Object.fromEntries(byStatus.map((r) => [r.status, r._count])) as Record<string, number>;
  return {
    scope: ctx.scope ?? 'own',
    clients: {
      total: byStatus.reduce((n, r) => n + r._count, 0),
      trialing: counts.trialing ?? 0,
      active: counts.active ?? 0,
      pastDue: counts.past_due ?? 0,
      free: counts.free ?? 0,
      closed: counts.closed ?? 0,
      awaitingPayment: counts.incomplete ?? 0,
    },
    pendingApprovals,
    trialsEndingIn7Days: trialsEndingSoon,
    newLast7Days: newThisWeek,
  };
}
