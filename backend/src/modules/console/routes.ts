import { Router } from 'express';
import { z } from 'zod';
import { db } from '../../kernel/db';
import { IdParam, ListQuery } from '../../kernel/query';
import { optionalText, zEmail, zGstin, zMobileIN, zPersonName, zStateCode } from '../../kernel/zodRules';
import { gstinStateMismatch } from '../../contracts/validation';
import { validate } from '../../middleware/request';
import { consoleAuth, consoleTx, requirePlatformPermission } from '../../middleware/auth';
import { SETTINGS, SETTING_KEYS, type SettingKey } from '../../contracts/settings';
import { listSettings, resetSetting, setSetting } from '../settings/service';
import { changeAcquisition } from '../tenancy/acquisition';
import { consoleAccess, dashboard } from './service';
import { assertClientInScope, clientDetail, extendClient, listClients } from './clients';
import { catalogAdmin, createCoupon, endCoupon, setPrice, updatePlan } from './catalogAdmin';
import { addMember, consoleRoles, listMembers, updateMember } from './members';
import { approveOrder, cancelOrder, capturePayment, createPaidClient, quote } from '../platformBilling/service';
import { invoiceDetail, listOrders, orderDetail } from '../platformBilling/orders';
import { issueCreditNote, sendPaymentLink } from '../platformBilling/online';

// Console API (design v2). Every route: Console token + one platform.* permission.

const router = Router();
router.use(consoleAuth);
const ctx = (req: { console?: unknown }) => req.console as NonNullable<Express.Request['console']>;

router.get('/me', async (req, res) => {
  res.json(await consoleAccess(ctx(req).userId));
});

router.get('/dashboard', requirePlatformPermission('platform.dashboard.view'), consoleTx(async (req, res) => {
  res.json(await dashboard(ctx(req)));
}));

// ── Clients ──
const ClientQuery = ListQuery.extend({
  search: z.string().trim().max(80).optional(),
  status: z.enum(['incomplete', 'trialing', 'active', 'past_due', 'free', 'closed', 'purged']).optional(),
});

router.get('/tenants', requirePlatformPermission('platform.tenant.view'), validate(ClientQuery, 'query'), consoleTx(async (req, res) => {
  res.json(await listClients(ctx(req), req.query as unknown as z.infer<typeof ClientQuery>));
}));

router.get('/tenants/:id', requirePlatformPermission('platform.tenant.view'), validate(IdParam, 'params'), consoleTx(async (req, res) => {
  res.json(await clientDetail(ctx(req), String(req.params.id)));
}));

const AcquisitionBody = z.object({
  byType: z.enum(['self', 'vendor', 'sales_user', 'partner_user']),
  byUserId: z.string().uuid().nullish(),
  method: z.enum(['signup', 'referral_link', 'referral_code', 'manual']),
  referralCode: z.string().trim().max(40).nullish(),
  couponCode: z.string().trim().max(20).nullish(),
  reason: z.string().trim().min(5, 'At least 5 characters').max(300),
});

router.patch('/tenants/:id/acquisition', requirePlatformPermission('platform.tenant.edit'), validate(IdParam, 'params'), validate(AcquisitionBody), consoleTx(async (req, res) => {
  const id = String(req.params.id);
  await assertClientInScope(ctx(req), id);
  const b = req.body as z.infer<typeof AcquisitionBody>;
  res.json(await changeAcquisition(id, { byType: b.byType, byUserId: b.byUserId ?? undefined, method: b.method, referralCode: b.referralCode ?? undefined, couponCode: b.couponCode ?? undefined }, ctx(req).userId, b.reason));
}));

const ExtendBody = z.object({ days: z.number().int().min(1).max(30), reason: z.string().trim().min(5, 'At least 5 characters').max(300) });

router.post('/tenants/:id/extend', requirePlatformPermission('platform.grace.create'), validate(IdParam, 'params'), validate(ExtendBody), consoleTx(async (req, res) => {
  res.status(201).json(await extendClient(ctx(req), String(req.params.id), req.body));
}));

// ── Plans, prices, coupons ──
router.get('/catalog', requirePlatformPermission('platform.plan.view'), consoleTx(async (_req, res) => {
  res.json(await catalogAdmin());
}));

const Limits = SETTINGS['trial.limits'].schema;
const PlanBody = z.object({
  name: z.string().trim().min(2).max(40).optional(),
  tagline: z.string().trim().max(120).nullish(),
  limits: Limits.optional(),
  isPublic: z.boolean().optional(),
  fullModules: z.array(z.string()).max(20).optional(),
});

router.patch('/plans/:key', requirePlatformPermission('platform.plan.edit'), validate(z.object({ key: z.string().max(40) }), 'params'), validate(PlanBody), consoleTx(async (req, res) => {
  res.json(await updatePlan(String(req.params.key), req.body));
}));

const PriceBody = z.object({
  itemType: z.enum(['plan', 'addon_module', 'extra_user']),
  itemRef: z.string().max(40),
  cycle: z.enum(['monthly', 'yearly']),
  amountPaise: z.number().int().min(0).max(1e10),
});

router.put('/prices', requirePlatformPermission('platform.plan.edit'), validate(PriceBody), consoleTx(async (req, res) => {
  res.json(await setPrice(req.body));
}));

const CouponBody = z.object({
  code: z.string().trim().regex(/^[A-Za-z0-9_-]{3,20}$/, '3–20 letters, digits, - or _'),
  type: z.enum(['percent', 'flat']),
  value: z.number().int().positive(),
  appliesTo: z.string().trim().max(40).default('all'),
  validFrom: z.string().datetime().nullish(),
  validTo: z.string().datetime().nullish(),
  maxRedemptions: z.number().int().positive().nullish(),
});

router.post('/coupons', requirePlatformPermission('platform.plan.edit'), validate(CouponBody), consoleTx(async (req, res) => {
  res.status(201).json(await createCoupon(req.body));
}));

router.post('/coupons/:code/end', requirePlatformPermission('platform.plan.edit'), validate(z.object({ code: z.string().max(20) }), 'params'), consoleTx(async (req, res) => {
  res.json(await endCoupon(String(req.params.code)));
}));

// ── Settings ──
router.get('/settings', requirePlatformPermission('platform.setting.view'), async (_req, res) => {
  res.json({ data: await listSettings() });
});

const SettingParam = z.object({ key: z.enum(SETTING_KEYS as [SettingKey, ...SettingKey[]]) });

router.put('/settings/:key', requirePlatformPermission('platform.setting.edit'), validate(SettingParam, 'params'), validate(z.object({ value: z.unknown() })), consoleTx(async (req, res) => {
  res.json(await setSetting(req.params.key as SettingKey, req.body.value, ctx(req).userId));
}));

router.delete('/settings/:key', requirePlatformPermission('platform.setting.edit'), validate(SettingParam, 'params'), consoleTx(async (req, res) => {
  await resetSetting(req.params.key as SettingKey, ctx(req).userId);
  res.status(204).end();
}));

// ── Console users ──
router.get('/roles', requirePlatformPermission('platform.member.view'), consoleTx(async (_req, res) => {
  res.json({ data: await consoleRoles() });
}));

router.get('/members', requirePlatformPermission('platform.member.view'), consoleTx(async (req, res) => {
  res.json({ data: await listMembers(ctx(req)) });
}));

const MemberBody = z.object({
  email: z.string().trim().email(),
  name: z.string().trim().min(2).max(100).optional(),
  mobile: z.string().trim().min(8).max(20).optional(),
  roleKey: z.string().max(40),
  reportsTo: z.string().uuid().nullish(),
});

router.post('/members', requirePlatformPermission('platform.member.create'), validate(MemberBody), consoleTx(async (req, res) => {
  res.status(201).json(await addMember(ctx(req), req.body));
}));

const MemberPatch = z.object({
  roleKey: z.string().max(40).optional(),
  reportsTo: z.string().uuid().nullable().optional(),
  status: z.enum(['active', 'deactivated']).optional(),
});

router.patch('/members/:id', requirePlatformPermission('platform.member.edit'), validate(IdParam, 'params'), validate(MemberPatch), consoleTx(async (req, res) => {
  res.json(await updateMember(ctx(req), String(req.params.id), req.body));
}));

// ── Platform audit log (actions taken in the Console and by the platform, not inside a client's business) ──
const AuditQuery = ListQuery.extend({ action: z.string().trim().max(60).optional() });

router.get('/audit', requirePlatformPermission('platform.audit.view'), validate(AuditQuery, 'query'), consoleTx(async (req, res) => {
  const q = req.query as unknown as z.infer<typeof AuditQuery>;
  const rows = await db().auditLog.findMany({
    where: { tenantId: null, ...(q.action ? { action: { startsWith: q.action } } : {}) },
    orderBy: { id: 'desc' },
    take: q.limit + 1,
    ...(q.cursor ? { cursor: { id: q.cursor }, skip: 1 } : {}),
  });
  const pageRows = rows.slice(0, q.limit);
  const actors = await db().user.findMany({ where: { id: { in: [...new Set(pageRows.map((r) => r.actorId).filter(Boolean) as string[])] } }, select: { id: true, name: true } });
  const names = new Map(actors.map((a) => [a.id, a.name]));
  res.json({
    data: pageRows.map((r) => ({ id: r.id, action: r.action, entity: r.entity, entityId: r.entityId, before: r.before, after: r.after, at: r.at, actorName: r.actorId ? names.get(r.actorId) ?? null : 'System' })),
    nextCursor: rows.length > q.limit ? pageRows[pageRows.length - 1].id : null,
  });
}));

// ── New paid client (design v2 §4B) ──
const GstState = zStateCode;
const OrderInput = z.object({
  planKey: z.string().max(40),
  cycle: z.enum(['monthly', 'yearly']),
  addOns: z.array(z.string().max(40)).max(20).default([]),
  extraUsers: z.number().int().min(0).max(500).default(0),
  discountPercent: z.number().min(0).max(100).default(0),
  couponCode: z.string().trim().max(20).nullish(),
});

const QuoteBody = OrderInput.extend({ stateCode: GstState });

router.post('/quote', requirePlatformPermission('platform.tenant.create'), validate(QuoteBody), consoleTx(async (req, res) => {
  const b = req.body as z.infer<typeof QuoteBody>;
  const role = await db().role.findUniqueOrThrow({ where: { id: ctx(req).roleId }, select: { key: true } });
  res.json(await quote({ ...b, billTo: { name: '', stateCode: b.stateCode } }, { actorRoleKey: role.key }));
}));

const NewClientBody = z.object({
  business: z.object({
    name: z.string().trim().min(2).max(120),
    industryKey: z.string().max(40),
    gstin: optionalText(zGstin),
    stateCode: GstState,
    address: z.string().trim().max(300).nullish(),
  }),
  owner: z.object({ name: zPersonName, email: zEmail, mobile: zMobileIN }),
  order: OrderInput,
}).superRefine((b, c) => {
  const mismatch = gstinStateMismatch(b.business.gstin, b.business.stateCode);
  if (mismatch) c.addIssue({ code: z.ZodIssueCode.custom, path: ['business', 'gstin'], message: mismatch });
});

router.post('/clients', requirePlatformPermission('platform.tenant.create'), validate(NewClientBody), consoleTx(async (req, res) => {
  res.status(201).json(await createPaidClient(ctx(req), req.body));
}));

// ── Orders, payments and AHEAD invoices ──
const OrderQuery = ListQuery.extend({
  status: z.enum(['pending_approval', 'awaiting_payment', 'paid', 'cancelled']).optional(),
  tenantId: z.string().uuid().optional(),
});

router.get('/orders', requirePlatformPermission('platform.payment.view'), validate(OrderQuery, 'query'), consoleTx(async (req, res) => {
  res.json(await listOrders(ctx(req), req.query as unknown as z.infer<typeof OrderQuery>));
}));

router.get('/orders/:id', requirePlatformPermission('platform.payment.view'), validate(IdParam, 'params'), consoleTx(async (req, res) => {
  res.json(await orderDetail(ctx(req), String(req.params.id)));
}));

router.post('/orders/:id/approve', requirePlatformPermission('platform.discount.approve'), validate(IdParam, 'params'), consoleTx(async (req, res) => {
  await approveOrder(ctx(req), String(req.params.id));
  res.json(await orderDetail(ctx(req), String(req.params.id)));
}));

router.post('/orders/:id/cancel', requirePlatformPermission('platform.payment.approve'), validate(IdParam, 'params'), validate(z.object({ reason: z.string().trim().min(5).max(300) })), consoleTx(async (req, res) => {
  await cancelOrder(String(req.params.id), req.body.reason);
  res.json(await orderDetail(ctx(req), String(req.params.id)));
}));

const OfflinePayment = z.object({
  method: z.enum(['bank_transfer', 'upi', 'cheque', 'cash']),
  amountPaise: z.number().int().positive(),
  reference: z.string().trim().min(3, 'UTR, cheque or receipt number').max(80),
  receivedOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Use YYYY-MM-DD'),
});

router.post('/orders/:id/payments', requirePlatformPermission('platform.payment.create'), validate(IdParam, 'params'), validate(OfflinePayment), consoleTx(async (req, res) => {
  const b = req.body as z.infer<typeof OfflinePayment>;
  const out = await capturePayment(String(req.params.id), { method: b.method, amountPaise: b.amountPaise, reference: b.reference, receivedAt: new Date(`${b.receivedOn}T12:00:00+05:30`), recordedBy: ctx(req).userId });
  res.status(201).json({ invoiceId: out.invoice.id, invoiceNumber: out.invoice.number });
}));

router.get('/invoices/:id', requirePlatformPermission('platform.payment.view'), validate(IdParam, 'params'), consoleTx(async (req, res) => {
  const invoice = await invoiceDetail(ctx(req), String(req.params.id));
  const creditNote = await db().platformCreditNote.findUnique({ where: { invoiceId: invoice.id } });
  res.json({ ...invoice, creditNote: creditNote && { id: creditNote.id, number: creditNote.number, reason: creditNote.reason, totalPaise: Number(creditNote.totalPaise), issuedAt: creditNote.issuedAt } });
}));

// ── Step 4b: payment links and refunds ──
router.post('/orders/:id/payment-link', requirePlatformPermission('platform.payment.view'), validate(IdParam, 'params'), validate(z.object({ resend: z.boolean().default(false) })), consoleTx(async (req, res) => {
  await orderDetail(ctx(req), String(req.params.id)); // scope check
  res.json(await sendPaymentLink(String(req.params.id), { resend: req.body.resend }));
}));

const CreditNoteBody = z.object({ reason: z.string().trim().min(5).max(300), endSubscription: z.boolean().default(false) });

router.post('/invoices/:id/credit-note', requirePlatformPermission('platform.payment.approve'), validate(IdParam, 'params'), validate(CreditNoteBody), consoleTx(async (req, res) => {
  await invoiceDetail(ctx(req), String(req.params.id)); // scope check
  const note = await issueCreditNote(ctx(req), String(req.params.id), req.body);
  res.status(201).json({ id: note.id, number: note.number });
}));

export default router;
