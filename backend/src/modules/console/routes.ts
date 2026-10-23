import { Router } from 'express';
import { z } from 'zod';
import { db } from '../../kernel/db';
import { IdParam, ListQuery } from '../../kernel/query';
import { validate } from '../../middleware/request';
import { consoleAuth, consoleTx, requirePlatformPermission } from '../../middleware/auth';
import { SETTINGS, SETTING_KEYS, type SettingKey } from '../../contracts/settings';
import { listSettings, resetSetting, setSetting } from '../settings/service';
import { changeAcquisition } from '../tenancy/acquisition';
import { consoleAccess, dashboard } from './service';
import { assertClientInScope, clientDetail, extendClient, listClients } from './clients';
import { catalogAdmin, createCoupon, endCoupon, setPrice, updatePlan } from './catalogAdmin';
import { addMember, consoleRoles, listMembers, updateMember } from './members';

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
  status: z.enum(['trialing', 'active', 'past_due', 'free', 'closed', 'purged']).optional(),
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

export default router;
