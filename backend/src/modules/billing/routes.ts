import { Router } from 'express';
import { z } from 'zod';
import type { Prisma, SalesDocKind } from '@prisma/client';
import { db, withPlatform } from '../../kernel/db';
import { AppError } from '../../kernel/errors';
import { randomToken } from '../../kernel/crypto';
import { DateStr, IdParam, ListQuery, page, pageArgs, scopeWhere } from '../../kernel/query';
import { validate } from '../../middleware/request';
import { publicRoute, requirePermission, tenantAuth, tx } from '../../middleware/auth';
import { publicLimiter } from '../../middleware/rateLimit';
import { audit } from '../audit/service';
import { todayIST } from '../../kernel/gst';
import * as billing from './service';

// Quotations (sales module) and GST invoices + receipts (billing module).

export const publicBilling = Router();
publicBilling.get('/public/documents/:token', publicRoute, publicLimiter, async (req, res) => {
  res.json(await withPlatform(() => billing.publicDocument(String(req.params.token))));
});

const router = Router();
router.use(tenantAuth);

const DocList = ListQuery.extend({
  status: z.string().max(20).optional(),
  contactId: z.string().uuid().optional(),
  from: DateStr.optional(),
  to: DateStr.optional(),
  unpaid: z.enum(['true', 'false']).optional(),
  overdue: z.enum(['true', 'false']).optional(),
  /** Include the number of matching rows ("Showing 1–25 of 64") */
  withTotal: z.enum(['1']).optional(),
});

const OPEN: Prisma.SalesDocumentWhereInput = { status: { in: ['issued', 'partially_paid'] } };
const overdueWhere = (): Prisma.SalesDocumentWhereInput => ({ ...OPEN, dueDate: { lt: new Date(`${todayIST()}T00:00:00Z`) } });

const SUMMARY_SELECT = {
  id: true, kind: true, status: true, number: true, contactId: true, buyer: true, issueDate: true, dueDate: true,
  totalPaise: true, paidPaise: true, createdAt: true, createdBy: true, branchId: true,
} satisfies Prisma.SalesDocumentSelect;

function registerDocRoutes(kind: SalesDocKind, base: string, module: 'sales.quotation' | 'billing.invoice') {
  router.get(base, requirePermission(`${module}.view`), validate(DocList, 'query'), tx(async (req, res) => {
    const q = req.query as unknown as z.infer<typeof DocList>;
    const where: Prisma.SalesDocumentWhereInput = {
      AND: [
        { kind },
        scopeWhere(req.ctx!, billing.SCOPE_FIELDS),
        q.status ? { status: q.status as Prisma.EnumSalesDocStatusFilter['equals'] } : {},
        q.unpaid === 'true' ? OPEN : {},
        q.overdue === 'true' ? overdueWhere() : {},
        q.contactId ? { contactId: q.contactId } : {},
        q.from || q.to ? { issueDate: { gte: q.from ? new Date(q.from) : undefined, lte: q.to ? new Date(q.to) : undefined } } : {},
        q.q
          ? {
              OR: [
                { number: { contains: q.q, mode: 'insensitive' } },
                { buyer: { path: ['name'], string_contains: q.q } },
                { buyer: { path: ['phone'], string_contains: q.q.replace(/\s/g, '') } },
                { buyer: { path: ['gstin'], string_contains: q.q.toUpperCase() } },
              ],
            }
          : {},
      ],
    };
    const [rows, total] = await Promise.all([
      db().salesDocument.findMany({ where, select: SUMMARY_SELECT, ...pageArgs(q) }),
      q.withTotal ? db().salesDocument.count({ where }) : Promise.resolve(undefined),
    ]);
    res.json({ ...page(rows, q.limit), ...(total !== undefined ? { total } : {}) });
  }));

  // Tab counts on the list page (All · 64, Overdue · 18 …), within the user's scope
  router.get(`${base}/counts`, requirePermission(`${module}.view`), tx(async (req, res) => {
    const scope = scopeWhere(req.ctx!, billing.SCOPE_FIELDS);
    const [byStatus, overdue] = await Promise.all([
      db().salesDocument.groupBy({ by: ['status'], where: { AND: [{ kind }, scope] }, _count: { _all: true } }),
      kind === 'invoice' ? db().salesDocument.count({ where: { AND: [{ kind }, scope, overdueWhere()] } }) : Promise.resolve(0),
    ]);
    const counts: Record<string, number> = { all: 0, unpaid: 0, overdue };
    for (const g of byStatus) {
      counts[g.status] = g._count._all;
      counts.all += g._count._all;
      if (g.status === 'issued' || g.status === 'partially_paid') counts.unpaid += g._count._all;
    }
    res.json(counts);
  }));

  router.get(`${base}/:id`, requirePermission(`${module}.view`), validate(IdParam, 'params'), tx(async (req, res) => {
    res.json(await billing.getDocument(req.ctx!, String(req.params.id), kind));
  }));

  router.post(base, requirePermission(`${module}.create`), validate(billing.DocInput.extend({ issue: z.boolean().default(false) })), tx(async (req, res) => {
    const { issue, ...input } = req.body as billing.DocInput & { issue: boolean };
    res.status(201).json(await billing.createDocument(req.ctx!, kind, input, { issue }));
  }));

  router.put(`${base}/:id`, requirePermission(`${module}.edit`), validate(IdParam, 'params'), validate(billing.DocInput.extend({ version: z.number().int() })), tx(async (req, res) => {
    const { version, ...input } = req.body as billing.DocInput & { version: number };
    res.json(await billing.updateDocument(req.ctx!, String(req.params.id), kind, input, version));
  }));

  // Drafts can be discarded; issued invoices never are (BIL-02/BIL-04)
  router.delete(`${base}/:id`, requirePermission(`${module}.edit`), validate(IdParam, 'params'), tx(async (req, res) => {
    const doc = await billing.getDocument(req.ctx!, String(req.params.id), kind);
    if (doc.status !== 'draft') throw new AppError('CONFLICT', 'Only drafts can be deleted.');
    await db().salesDocument.delete({ where: { id: doc.id } });
    await audit({ action: `${module}.delete_draft`, entity: kind, entityId: doc.id, before: { number: doc.number } });
    res.status(204).end();
  }));
}

registerDocRoutes('quotation', '/quotations', 'sales.quotation');
registerDocRoutes('invoice', '/invoices', 'billing.invoice');

// ── Quotation lifecycle ──
router.post(
  '/quotations/:id/status',
  requirePermission('sales.quotation.edit'),
  validate(IdParam, 'params'),
  validate(z.object({ status: z.enum(['sent', 'accepted', 'declined']) })),
  tx(async (req, res) => {
    const q = await billing.getDocument(req.ctx!, String(req.params.id), 'quotation');
    if (q.status === 'converted') throw new AppError('CONFLICT', 'This quotation is already converted.');
    await db().salesDocument.update({
      where: { id: q.id },
      data: { status: req.body.status, shareToken: q.shareToken ?? randomToken(18), version: { increment: 1 } },
    });
    res.json(await billing.getDocument(req.ctx!, q.id, 'quotation'));
  }),
);

router.post('/quotations/:id/convert', requirePermission('billing.invoice.create'), validate(IdParam, 'params'), tx(async (req, res) => {
  res.status(201).json(await billing.convertQuotation(req.ctx!, String(req.params.id)));
}));

// ── Invoice lifecycle ──
router.post('/invoices/:id/issue', requirePermission('billing.invoice.create'), validate(IdParam, 'params'), tx(async (req, res) => {
  res.json(await billing.issueInvoice(req.ctx!, String(req.params.id)));
}));

router.post(
  '/invoices/:id/cancel',
  requirePermission('billing.invoice.approve'),
  validate(IdParam, 'params'),
  validate(z.object({ reason: z.string().trim().min(3).max(300) })),
  tx(async (req, res) => {
    res.json(await billing.cancelInvoice(req.ctx!, String(req.params.id), req.body.reason));
  }),
);

router.post('/invoices/:id/payments', requirePermission('billing.payment.create'), validate(IdParam, 'params'), validate(billing.PaymentInput), tx(async (req, res) => {
  res.status(201).json(await billing.recordPayment(req.ctx!, String(req.params.id), req.body));
}));

router.get(
  '/payments',
  requirePermission('billing.payment.view'),
  validate(ListQuery.extend({ from: DateStr.optional(), to: DateStr.optional() }), 'query'),
  tx(async (req, res) => {
    const q = req.query as unknown as z.infer<typeof ListQuery> & { from?: string; to?: string };
    const rows = await db().payment.findMany({
      where: { AND: [scopeWhere(req.ctx!, { owner: ['createdBy'] }), q.from || q.to ? { paidOn: { gte: q.from ? new Date(q.from) : undefined, lte: q.to ? new Date(q.to) : undefined } } : {}] },
      include: { document: { select: { id: true, number: true, buyer: true } } },
      ...pageArgs(q),
    });
    res.json(page(rows, q.limit));
  }),
);

export default router;
