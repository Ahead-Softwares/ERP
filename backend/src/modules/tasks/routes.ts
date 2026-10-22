import { Router } from 'express';
import { z } from 'zod';
import type { Prisma, Task } from '@prisma/client';
import { db } from '../../kernel/db';
import { AppError, notFound } from '../../kernel/errors';
import type { TenantCtx } from '../../kernel/context';
import { IdParam, ListQuery, assertVersion, inScope, page, pageArgs, scopeWhere } from '../../kernel/query';
import { validate } from '../../middleware/request';
import { requirePermission, tenantAuth, tx } from '../../middleware/auth';
import { notify } from '../notifications/service';

// Tasks & subtasks with assignee, due date, priority, status, comments and history (TSK-01, TSK-02).

const router = Router();
router.use(tenantAuth);
const SCOPE = { owner: ['createdBy', 'assigneeId'] };

const TaskInput = z.object({
  title: z.string().trim().min(1).max(200),
  description: z.string().trim().max(5000).optional().nullable(),
  status: z.enum(['todo', 'in_progress', 'done', 'cancelled']).optional(),
  priority: z.enum(['low', 'medium', 'high', 'urgent']).optional(),
  dueAt: z.string().datetime({ offset: true }).optional().nullable(),
  assigneeId: z.string().uuid().optional().nullable(),
  contactId: z.string().uuid().optional().nullable(),
  parentId: z.string().uuid().optional().nullable(),
});

const TaskList = ListQuery.extend({
  status: z.enum(['todo', 'in_progress', 'done', 'cancelled', 'open']).default('open'),
  mine: z.enum(['true', 'false']).optional(),
  contactId: z.string().uuid().optional(),
  due: z.enum(['overdue', 'today', 'week']).optional(),
});

async function checkAssignee(id?: string | null) {
  if (!id) return;
  if (!(await db().tenantMember.findFirst({ where: { userId: id, status: 'active' } }))) {
    throw new AppError('VALIDATION_FAILED', 'Assignee must be an active user.', { fields: { assigneeId: 'Not an active user' } });
  }
}

const event = (ctx: TenantCtx, taskId: string, type: string, body?: string, data?: Prisma.InputJsonValue) =>
  db().taskEvent.create({ data: { tenantId: ctx.tenantId, taskId, actorId: ctx.userId, type, body, data } });

async function withNames<T extends Pick<Task, 'assigneeId' | 'createdBy'>>(rows: T[]) {
  const ids = [...new Set(rows.flatMap((r) => [r.assigneeId, r.createdBy]).filter(Boolean))] as string[];
  const users = ids.length ? await db().user.findMany({ where: { id: { in: ids } }, select: { id: true, name: true } }) : [];
  const names = Object.fromEntries(users.map((u) => [u.id, u.name]));
  return rows.map((r) => ({ ...r, assigneeName: r.assigneeId ? (names[r.assigneeId] ?? null) : null, createdByName: r.createdBy ? (names[r.createdBy] ?? null) : null }));
}

function dueFilter(due?: string): Prisma.TaskWhereInput {
  if (!due) return {};
  const now = new Date();
  const ist = new Date(now.getTime() + 330 * 60_000);
  const endOfDay = new Date(Date.UTC(ist.getUTCFullYear(), ist.getUTCMonth(), ist.getUTCDate(), 23, 59, 59) - 330 * 60_000);
  if (due === 'overdue') return { dueAt: { lt: now } };
  if (due === 'today') return { dueAt: { lte: endOfDay } };
  return { dueAt: { lte: new Date(endOfDay.getTime() + 6 * 86_400_000) } };
}

router.get('/tasks', requirePermission('tasks.task.view'), validate(TaskList, 'query'), tx(async (req, res) => {
  const q = req.query as unknown as z.infer<typeof TaskList>;
  const where: Prisma.TaskWhereInput = {
    AND: [
      { parentId: q.contactId ? undefined : null },
      scopeWhere(req.ctx!, SCOPE),
      q.status === 'open' ? { status: { in: ['todo', 'in_progress'] } } : { status: q.status },
      q.mine === 'true' ? { assigneeId: req.ctx!.userId } : {},
      q.contactId ? { contactId: q.contactId } : {},
      dueFilter(q.due),
      q.q ? { title: { contains: q.q, mode: 'insensitive' } } : {},
    ],
  };
  const rows = await db().task.findMany({ where, ...pageArgs(q) });
  const p = page(rows, q.limit);
  const counts = await db().task.groupBy({ by: ['parentId'], where: { parentId: { in: p.data.map((t) => t.id) } }, _count: true });
  const subCount = Object.fromEntries(counts.map((c) => [c.parentId, c._count]));
  res.json({ ...p, data: (await withNames(p.data)).map((t) => ({ ...t, subtaskCount: subCount[t.id] ?? 0 })) });
}));

router.get('/tasks/:id', requirePermission('tasks.task.view'), validate(IdParam, 'params'), tx(async (req, res) => {
  const t = await db().task.findUnique({ where: { id: String(req.params.id) } });
  if (!t || !inScope(req.ctx!, t, SCOPE)) throw notFound('Task');
  const [subtasks, events, contact] = await Promise.all([
    db().task.findMany({ where: { parentId: t.id }, orderBy: { createdAt: 'asc' } }),
    db().taskEvent.findMany({ where: { taskId: t.id }, orderBy: { at: 'asc' } }),
    t.contactId ? db().contact.findUnique({ where: { id: t.contactId }, select: { id: true, name: true } }) : null,
  ]);
  const actorIds = [...new Set(events.map((e) => e.actorId).filter(Boolean))] as string[];
  const actors = await db().user.findMany({ where: { id: { in: actorIds } }, select: { id: true, name: true } });
  const names = Object.fromEntries(actors.map((a) => [a.id, a.name]));
  res.json({
    ...(await withNames([t]))[0],
    contact,
    subtasks: await withNames(subtasks),
    events: events.map((e) => ({ ...e, actorName: e.actorId ? names[e.actorId] : null })),
  });
}));

router.post('/tasks', requirePermission('tasks.task.create'), validate(TaskInput), tx(async (req, res) => {
  const ctx = req.ctx!;
  const b = req.body as z.infer<typeof TaskInput>;
  await checkAssignee(b.assigneeId);
  if (b.parentId) {
    const parent = await db().task.findUnique({ where: { id: b.parentId } });
    if (!parent || parent.parentId) throw new AppError('VALIDATION_FAILED', 'Subtasks can only be one level deep.', { fields: { parentId: 'Invalid parent' } });
  }
  const t = await db().task.create({
    data: { ...b, dueAt: b.dueAt ? new Date(b.dueAt) : null, tenantId: ctx.tenantId, createdBy: ctx.userId, assigneeId: b.assigneeId ?? ctx.userId, completedAt: b.status === 'done' ? new Date() : null },
  });
  await event(ctx, t.id, 'created');
  if (t.assigneeId && t.assigneeId !== ctx.userId) await notify(t.assigneeId, `New task: ${t.title}`, undefined, `/app/m/tasks/${t.id}`);
  res.status(201).json((await withNames([t]))[0]);
}));

router.patch('/tasks/:id', requirePermission('tasks.task.edit'), validate(IdParam, 'params'), validate(TaskInput.partial().extend({ version: z.number().int().optional() })), tx(async (req, res) => {
  const ctx = req.ctx!;
  const t = await db().task.findUnique({ where: { id: String(req.params.id) } });
  if (!t || !inScope(ctx, t, SCOPE)) throw notFound('Task');
  const { version, parentId: _p, ...b } = req.body as Partial<z.infer<typeof TaskInput>> & { version?: number };
  assertVersion(t.version, version, 'task');
  await checkAssignee(b.assigneeId);
  const updated = await db().task.update({
    where: { id: t.id },
    data: {
      ...b,
      dueAt: b.dueAt === undefined ? undefined : b.dueAt ? new Date(b.dueAt) : null,
      completedAt: b.status === undefined ? undefined : b.status === 'done' ? (t.completedAt ?? new Date()) : null,
      version: { increment: 1 },
    },
  });
  if (b.status && b.status !== t.status) await event(ctx, t.id, 'status', undefined, { from: t.status, to: b.status });
  if (b.assigneeId !== undefined && b.assigneeId !== t.assigneeId) {
    await event(ctx, t.id, 'assigned', undefined, { to: b.assigneeId });
    if (b.assigneeId && b.assigneeId !== ctx.userId) await notify(b.assigneeId, `Task assigned to you: ${t.title}`, undefined, `/app/m/tasks/${t.id}`);
  }
  const edited = (['title', 'description', 'priority', 'dueAt'] as const).filter((k) => b[k] !== undefined);
  if (edited.length) await event(ctx, t.id, 'edited', undefined, { fields: edited });
  if (b.status === 'done' && t.status !== 'done' && t.createdBy && t.createdBy !== ctx.userId) await notify(t.createdBy, `Task completed: ${t.title}`, undefined, `/app/m/tasks/${t.id}`);
  res.json((await withNames([updated]))[0]);
}));

router.post('/tasks/:id/comments', requirePermission('tasks.task.view'), validate(IdParam, 'params'), validate(z.object({ body: z.string().trim().min(1).max(4000) })), tx(async (req, res) => {
  const ctx = req.ctx!;
  const t = await db().task.findUnique({ where: { id: String(req.params.id) } });
  if (!t || !inScope(ctx, t, SCOPE)) throw notFound('Task');
  const e = await event(ctx, t.id, 'comment', req.body.body);
  for (const uid of new Set([t.assigneeId, t.createdBy])) {
    if (uid && uid !== ctx.userId) await notify(uid, `New comment on: ${t.title}`, req.body.body.slice(0, 120), `/app/m/tasks/${t.id}`);
  }
  res.status(201).json(e);
}));

router.delete('/tasks/:id', requirePermission('tasks.task.delete'), validate(IdParam, 'params'), tx(async (req, res) => {
  const t = await db().task.findUnique({ where: { id: String(req.params.id) } });
  if (!t || !inScope(req.ctx!, t, SCOPE)) throw notFound('Task');
  // History rows are append-only for tenants, so tasks are cancelled rather than deleted
  await db().task.updateMany({ where: { OR: [{ id: t.id }, { parentId: t.id }] }, data: { status: 'cancelled', version: { increment: 1 } } });
  await event(req.ctx!, t.id, 'status', undefined, { from: t.status, to: 'cancelled' });
  res.status(204).end();
}));

export default router;
