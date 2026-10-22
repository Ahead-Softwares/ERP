import { Router } from 'express';
import type { PermissionScope } from '@prisma/client';
import { db } from '../../kernel/db';
import type { TenantCtx } from '../../kernel/context';
import { scopeWhere } from '../../kernel/query';
import { dateOnly, todayIST } from '../../kernel/gst';
import { requirePermission, tenantAuth, tx } from '../../middleware/auth';
import { getRolePermissions } from '../access/service';
import { getEntitlements } from '../subscription/entitlements';

// Home dashboard (RPT-01): one call, widgets only for modules the role can see,
// every figure filtered by that module's data scope. Totals are computed here, never in the UI.

const router = Router();
router.use(tenantAuth);

const DAY = 86_400_000;

router.get('/dashboard/summary', requirePermission('reports.dashboard.view'), tx(async (req, res) => {
  const ctx = req.ctx!;
  const [perms, ent] = await Promise.all([getRolePermissions(ctx.roleId), getEntitlements(ctx.tenantId)]);
  const scoped = (key: string): TenantCtx | null => {
    const scope = perms.get(key) as PermissionScope | undefined;
    const module = key.split('.')[0] as keyof typeof ent.modules;
    if (!scope || ent.modules[module]?.status === 'inactive') return null;
    return { ...ctx, scope };
  };

  const today = todayIST();
  const monthStart = `${today.slice(0, 8)}01`;
  const weekAgo = new Date(dateOnly(today).getTime() - 6 * DAY);
  const now = new Date();
  const istMidnight = new Date(dateOnly(today).getTime() - 330 * 60_000);
  const out: Record<string, unknown> = { today };

  const inv = scoped('billing.invoice.view');
  if (inv) {
    const scope = scopeWhere(inv, { owner: ['createdBy'], branch: 'branchId' });
    const live = { kind: 'invoice' as const, status: { in: ['issued' as const, 'partially_paid' as const, 'paid' as const] } };
    const [todaySum, monthSum, dues, overdue, recent, week] = await Promise.all([
      db().salesDocument.aggregate({ where: { AND: [scope, live, { issueDate: dateOnly(today) }] }, _sum: { totalPaise: true }, _count: true }),
      db().salesDocument.aggregate({ where: { AND: [scope, live, { issueDate: { gte: dateOnly(monthStart) } }] }, _sum: { totalPaise: true }, _count: true }),
      db().salesDocument.aggregate({ where: { AND: [scope, { kind: 'invoice', status: { in: ['issued', 'partially_paid'] } }] }, _sum: { totalPaise: true, paidPaise: true }, _count: true }),
      db().salesDocument.count({ where: { AND: [scope, { kind: 'invoice', status: { in: ['issued', 'partially_paid'] }, dueDate: { lt: dateOnly(today) } }] } }),
      db().salesDocument.findMany({
        where: { AND: [scope, { kind: 'invoice', status: { not: 'draft' } }] },
        orderBy: { issuedAt: 'desc' },
        take: 5,
        select: { id: true, number: true, buyer: true, totalPaise: true, paidPaise: true, status: true, issueDate: true },
      }),
      db().salesDocument.groupBy({ by: ['issueDate'], where: { AND: [scope, live, { issueDate: { gte: weekAgo } }] }, _sum: { totalPaise: true } }),
    ]);
    const byDay = Object.fromEntries(week.map((w) => [w.issueDate.toISOString().slice(0, 10), Number(w._sum.totalPaise ?? 0)]));
    out.sales = {
      todayPaise: todaySum._sum.totalPaise ?? 0n,
      todayCount: todaySum._count,
      monthPaise: monthSum._sum.totalPaise ?? 0n,
      monthCount: monthSum._count,
      duesPaise: (dues._sum.totalPaise ?? 0n) - (dues._sum.paidPaise ?? 0n),
      duesCount: dues._count,
      overdueCount: overdue,
      last7Days: Array.from({ length: 7 }, (_, i) => {
        const d = new Date(weekAgo.getTime() + i * DAY).toISOString().slice(0, 10);
        return { date: d, totalPaise: byDay[d] ?? 0 };
      }),
      recent,
    };
  }

  const pay = scoped('billing.payment.view');
  if (pay) {
    const scope = scopeWhere(pay, { owner: ['createdBy'] });
    const [t, m] = await Promise.all([
      db().payment.aggregate({ where: { AND: [scope, { paidOn: dateOnly(today) }] }, _sum: { amountPaise: true } }),
      db().payment.aggregate({ where: { AND: [scope, { paidOn: { gte: dateOnly(monthStart) } }] }, _sum: { amountPaise: true } }),
    ]);
    out.collections = { todayPaise: t._sum.amountPaise ?? 0n, monthPaise: m._sum.amountPaise ?? 0n };
  }

  const exp = scoped('finance.expense.view');
  if (exp) {
    const scope = scopeWhere(exp, { owner: ['createdBy'], branch: 'branchId' });
    const [t, m] = await Promise.all([
      db().expense.aggregate({ where: { AND: [scope, { paidOn: dateOnly(today) }] }, _sum: { amountPaise: true } }),
      db().expense.aggregate({ where: { AND: [scope, { paidOn: { gte: dateOnly(monthStart) } }] }, _sum: { amountPaise: true } }),
    ]);
    out.expenses = { todayPaise: t._sum.amountPaise ?? 0n, monthPaise: m._sum.amountPaise ?? 0n };
  }

  const task = scoped('tasks.task.view');
  if (task) {
    const mine = { assigneeId: ctx.userId, status: { in: ['todo' as const, 'in_progress' as const] } };
    const [open, overdue, next] = await Promise.all([
      db().task.count({ where: mine }),
      db().task.count({ where: { ...mine, dueAt: { lt: now } } }),
      db().task.findMany({ where: mine, orderBy: [{ dueAt: { sort: 'asc', nulls: 'last' } }], take: 5, select: { id: true, title: true, dueAt: true, priority: true, status: true } }),
    ]);
    out.tasks = { open, overdue, next };
  }

  const appt = scoped('bookings.appointment.view');
  if (appt) {
    const rows = await db().appointment.findMany({
      where: { AND: [scopeWhere(appt, { owner: ['createdBy', 'staffId'], branch: 'branchId' }), { startAt: { gte: istMidnight, lt: new Date(istMidnight.getTime() + DAY) }, status: { notIn: ['cancelled'] } }] },
      orderBy: { startAt: 'asc' },
      take: 20,
      select: { id: true, title: true, startAt: true, endAt: true, status: true, kind: true },
    });
    out.bookings = { today: rows };
  }

  const fu = scoped('crm.activity.view');
  if (fu) {
    out.followUps = {
      due: await db().activity.count({ where: { AND: [scopeWhere(fu, { owner: ['assigneeId', 'createdBy'] }), { type: 'follow_up', completedAt: null, dueAt: { lt: new Date(istMidnight.getTime() + DAY) } }] } }),
    };
  }

  const cust = scoped('crm.contact.view');
  if (cust) {
    const [customers, leads] = await Promise.all([
      db().contact.count({ where: { type: 'customer', isActive: true } }),
      db().contact.count({ where: { type: 'lead', leadStatus: { notIn: ['converted', 'lost'] } } }),
    ]);
    out.crm = { customers, openLeads: leads };
  }

  res.json(out);
}));

export default router;
