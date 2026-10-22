import { Router } from 'express';
import { z } from 'zod';
import type { Prisma } from '@prisma/client';
import { db } from '../../kernel/db';
import { notFound } from '../../kernel/errors';
import { DateStr, IdParam, ListQuery, assertVersion, inScope, page, pageArgs, scopeWhere } from '../../kernel/query';
import { dateOnly, todayIST } from '../../kernel/gst';
import { validate } from '../../middleware/request';
import { requirePermission, tenantAuth, tx } from '../../middleware/auth';
import { audit } from '../audit/service';

// Expenses (FIN-01, free tier): category, amount, payment mode, receipt link. Feeds the dashboard.

export const EXPENSE_CATEGORIES = [
  'Rent', 'Salaries & wages', 'Electricity & utilities', 'Internet & phone', 'Supplies', 'Stock purchase',
  'Repairs & maintenance', 'Marketing', 'Travel & fuel', 'Professional fees', 'Bank charges', 'Taxes & licences', 'Other',
];

const router = Router();
router.use(tenantAuth);
const SCOPE = { owner: ['createdBy'], branch: 'branchId' };

const ExpenseInput = z.object({
  category: z.string().trim().min(1).max(60),
  amountPaise: z.number().int().positive().max(1e13),
  paidOn: DateStr.optional(),
  method: z.enum(['cash', 'upi', 'card', 'bank', 'cheque', 'other']).default('cash'),
  payee: z.string().trim().max(160).optional().nullable(),
  notes: z.string().trim().max(1000).optional().nullable(),
  receiptUrl: z.string().url().max(500).optional().nullable().or(z.literal('').transform(() => null)),
  branchId: z.string().uuid().optional().nullable(),
});

router.get('/expense-categories', requirePermission('finance.expense.view'), (_req, res) => {
  res.json({ data: EXPENSE_CATEGORIES });
});

router.get(
  '/expenses',
  requirePermission('finance.expense.view'),
  validate(ListQuery.extend({ from: DateStr.optional(), to: DateStr.optional(), category: z.string().max(60).optional() }), 'query'),
  tx(async (req, res) => {
    const q = req.query as unknown as z.infer<typeof ListQuery> & { from?: string; to?: string; category?: string };
    const where: Prisma.ExpenseWhereInput = {
      AND: [
        scopeWhere(req.ctx!, SCOPE),
        q.category ? { category: q.category } : {},
        q.from || q.to ? { paidOn: { gte: q.from ? dateOnly(q.from) : undefined, lte: q.to ? dateOnly(q.to) : undefined } } : {},
        q.q ? { OR: [{ payee: { contains: q.q, mode: 'insensitive' } }, { notes: { contains: q.q, mode: 'insensitive' } }] } : {},
      ],
    };
    const [rows, sum] = await Promise.all([
      db().expense.findMany({ where, ...pageArgs(q) }),
      db().expense.aggregate({ where, _sum: { amountPaise: true } }),
    ]);
    res.json({ ...page(rows, q.limit), totalPaise: sum._sum.amountPaise ?? 0n });
  }),
);

router.post('/expenses', requirePermission('finance.expense.create'), validate(ExpenseInput), tx(async (req, res) => {
  const ctx = req.ctx!;
  const b = req.body as z.infer<typeof ExpenseInput>;
  const e = await db().expense.create({
    data: { ...b, amountPaise: BigInt(b.amountPaise), paidOn: dateOnly(b.paidOn ?? todayIST()), tenantId: ctx.tenantId, createdBy: ctx.userId, branchId: b.branchId ?? ctx.branchIds[0] ?? null },
  });
  res.status(201).json(e);
}));

router.patch('/expenses/:id', requirePermission('finance.expense.edit'), validate(IdParam, 'params'), validate(ExpenseInput.partial().extend({ version: z.number().int() })), tx(async (req, res) => {
  const e = await db().expense.findUnique({ where: { id: String(req.params.id) } });
  if (!e || !inScope(req.ctx!, e, SCOPE)) throw notFound('Expense');
  const { version, ...b } = req.body as Partial<z.infer<typeof ExpenseInput>> & { version: number };
  assertVersion(e.version, version, 'expense');
  res.json(await db().expense.update({
    where: { id: e.id },
    data: { ...b, amountPaise: b.amountPaise !== undefined ? BigInt(b.amountPaise) : undefined, paidOn: b.paidOn ? dateOnly(b.paidOn) : undefined, version: { increment: 1 } },
  }));
}));

router.delete('/expenses/:id', requirePermission('finance.expense.delete'), validate(IdParam, 'params'), tx(async (req, res) => {
  const e = await db().expense.findUnique({ where: { id: String(req.params.id) } });
  if (!e || !inScope(req.ctx!, e, SCOPE)) throw notFound('Expense');
  await db().expense.delete({ where: { id: e.id } });
  await audit({ action: 'finance.expense.delete', entity: 'expense', entityId: e.id, before: { category: e.category, amountPaise: e.amountPaise } });
  res.status(204).end();
}));

export default router;
