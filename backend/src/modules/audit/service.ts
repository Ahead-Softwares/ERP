import type { Prisma } from '@prisma/client';
import { currentCtx, db } from '../../kernel/db';

// PLT-09: logins, role changes, plan changes, deletes, exports and financial actions.

export interface AuditEntry {
  action: string;
  entity?: string;
  entityId?: string;
  before?: unknown;
  after?: unknown;
  tenantId?: string | null;
  actorId?: string | null;
  ip?: string;
  requestId?: string;
}

const json = (v: unknown) => (v === undefined ? undefined : (JSON.parse(JSON.stringify(v, (_k, x) => (typeof x === 'bigint' ? Number(x) : x))) as Prisma.InputJsonValue));

export async function audit(entry: AuditEntry) {
  const ctx = currentCtx();
  await db().auditLog.create({
    data: {
      tenantId: entry.tenantId !== undefined ? entry.tenantId : (ctx?.tenantId ?? null),
      actorKind: ctx?.kind === 'tenant' ? 'user' : (ctx?.kind ?? 'system'),
      actorId: entry.actorId !== undefined ? entry.actorId : (ctx?.userId ?? null),
      action: entry.action,
      entity: entry.entity,
      entityId: entry.entityId,
      before: json(entry.before),
      after: json(entry.after),
      ip: entry.ip ?? (ctx?.kind === 'tenant' ? ctx.ip : undefined),
      requestId: entry.requestId ?? (ctx?.kind === 'tenant' ? ctx.requestId : undefined),
    },
  });
}

export async function listAudit(opts: { limit: number; cursor?: string; action?: string }) {
  const rows = await db().auditLog.findMany({
    where: { action: opts.action ? { startsWith: opts.action } : undefined },
    orderBy: { id: 'desc' }, // UUID v7 ids sort by time
    take: opts.limit + 1,
    ...(opts.cursor ? { cursor: { id: opts.cursor }, skip: 1 } : {}),
  });
  const actorIds = [...new Set(rows.map((r) => r.actorId).filter(Boolean))] as string[];
  const actors = await db().user.findMany({ where: { id: { in: actorIds } }, select: { id: true, name: true } });
  const names = new Map(actors.map((a) => [a.id, a.name]));
  const page = rows.slice(0, opts.limit).map((r) => ({ ...r, actorName: r.actorId ? names.get(r.actorId) ?? null : null }));
  return { data: page, nextCursor: rows.length > opts.limit ? page[page.length - 1].id : null };
}
