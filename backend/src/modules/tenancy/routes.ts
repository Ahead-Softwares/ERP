import { Router } from 'express';
import { z } from 'zod';
import { db } from '../../kernel/db';
import { notFound } from '../../kernel/errors';
import { validate } from '../../middleware/request';
import { publicRoute, requirePermission, tenantAuth, tx } from '../../middleware/auth';
import { publicLimiter } from '../../middleware/rateLimit';
import { PERMISSIONS } from '../../contracts/permissions';
import { TEMPLATES } from '../../contracts/templates';
import { getEntitlements } from '../subscription/entitlements';
import { getCatalog } from '../subscription/catalog';
import { visibleRoles } from '../access/service';
import { listAudit } from '../audit/service';
import { listNotifications, markRead } from '../notifications/service';
import { FieldInput, FieldPatch, createField, getTerms, listFields, putTerms, updateField } from '../config/service';
import * as tenancy from './service';

// Platform routes for the signed-in tenant (LLD §10.2, §10.3) plus a few public lookups.

const router = Router();
const id = z.object({ id: z.string().uuid() });

// ── Public lookups ──
router.get('/public/industries', publicRoute, publicLimiter, (_req, res) => {
  res.json({ data: TEMPLATES.map((t) => ({ key: t.key, name: t.name, description: t.description })) });
});

router.get('/billing/plans', publicRoute, publicLimiter, async (_req, res) => {
  const catalog = await getCatalog();
  res.json({
    plans: catalog.plans.filter((p) => p.isPublic).map(({ isPublic: _, ...p }) => p),
    modules: catalog.modules,
    extraUserMonthlyPaise: catalog.extraUserMonthlyPaise,
    currency: 'INR',
  });
});

router.get('/invitations/:token', publicRoute, publicLimiter, async (req, res) => {
  res.json(await tenancy.invitationPreview(String(req.params.token)));
});

router.post('/invitations/:token/accept', publicRoute, publicLimiter, validate(tenancy.AcceptInput), async (req, res) => {
  res.json(await tenancy.acceptInvitation(String(req.params.token), req.body));
});

// Everything below needs a signed-in member of the tenant
router.use(tenantAuth);

// ── Directory: names of active users for assignee/owner pickers (any member) ──
router.get('/directory/users', tx(async (_req, res) => {
  const members = await db().tenantMember.findMany({ where: { status: 'active' }, include: { user: { select: { id: true, name: true } }, role: { select: { key: true, name: true } } } });
  res.json({ data: members.map((m) => ({ id: m.user.id, name: m.user.name, roleKey: m.role.key, roleName: m.role.name })).sort((a, b) => a.name.localeCompare(b.name)) });
}));

// Active custom field definitions for data-entry forms (definitions are not sensitive; values are)
router.get('/forms/fields', validate(z.object({ entity: z.string().max(40) }), 'query'), tx(async (req, res) => {
  const rows = await listFields((req.query as { entity: string }).entity);
  res.json({ data: rows.filter((f) => !f.archivedAt) });
}));

// ── Tenant profile ──
router.get('/tenant', requirePermission('tenant.settings.view'), tx(async (req, res) => {
  res.json(await tenancy.getTenant(req.ctx!.tenantId));
}));
router.patch('/tenant', requirePermission('tenant.settings.edit'), validate(tenancy.TenantPatch), tx(async (req, res) => {
  res.json(await tenancy.updateTenant(req.ctx!.tenantId, req.body));
}));
router.get('/tenant/onboarding', requirePermission('tenant.settings.view'), tx(async (req, res) => {
  res.json(await tenancy.onboardingStatus(req.ctx!.tenantId));
}));

// ── Branches ──
router.get('/branches', requirePermission('tenant.branch.view'), tx(async (_req, res) => {
  res.json({ data: await tenancy.listBranches() });
}));
router.post('/branches', requirePermission('tenant.branch.create'), validate(tenancy.BranchInput), tx(async (req, res) => {
  res.status(201).json(await tenancy.createBranch(req.ctx!.tenantId, req.body));
}));
router.patch('/branches/:id', requirePermission('tenant.branch.edit'), validate(id, 'params'), validate(tenancy.BranchInput.partial()), tx(async (req, res) => {
  res.json(await tenancy.updateBranch(String(req.params.id), req.body));
}));

// ── Members & invitations ──
router.get('/members', requirePermission('tenant.member.view'), tx(async (_req, res) => {
  res.json(await tenancy.listMembers());
}));
router.post('/invitations', requirePermission('tenant.member.create'), validate(tenancy.InviteInput), tx(async (req, res) => {
  res.status(201).json(await tenancy.invite(req.ctx!, req.body));
}));
router.delete('/invitations/:id', requirePermission('tenant.member.create'), validate(id, 'params'), tx(async (req, res) => {
  await tenancy.revokeInvitation(String(req.params.id));
  res.status(204).end();
}));
router.patch('/members/:id', requirePermission('tenant.member.edit'), validate(id, 'params'), validate(tenancy.MemberPatch), tx(async (req, res) => {
  res.json(await tenancy.updateMember(req.ctx!, String(req.params.id), req.body));
}));

// ── Roles & permissions (ROL-01, ROL-02) ──
router.get('/roles', requirePermission('tenant.role.view'), tx(async (req, res) => {
  res.json({ data: await visibleRoles(req.ctx!.tenantId) });
}));
router.get('/roles/:id', requirePermission('tenant.role.view'), validate(id, 'params'), tx(async (req, res) => {
  const visible = await visibleRoles(req.ctx!.tenantId);
  if (!visible.some((r) => r.id === req.params.id)) throw notFound('Role');
  const role = await db().role.findUniqueOrThrow({ where: { id: String(req.params.id) }, include: { permissions: true } });
  res.json({ ...visible.find((r) => r.id === role.id), permissions: Object.fromEntries(role.permissions.map((p) => [p.permissionKey, p.scope])) });
}));
router.get('/permissions', requirePermission('tenant.role.view'), async (req, res) => {
  const ent = await getEntitlements(req.ctx!.tenantId);
  // Only modules the tenant has (hidden, not greyed out — Roles doc)
  const data = PERMISSIONS.filter((p) => p.moduleKey === 'tenant' || (p.moduleKey !== 'platform' && ent.modules[p.moduleKey].status !== 'inactive'));
  res.json({ data });
});

// ── Configuration ──
router.get('/config/terms', requirePermission('tenant.config.view'), tx(async (req, res) => {
  res.json({ terms: await getTerms(req.ctx!.tenantId) });
}));
router.put('/config/terms', requirePermission('tenant.config.edit'), validate(z.object({ terms: z.record(z.string().trim().min(1).max(40)) })), tx(async (req, res) => {
  res.json({ terms: await putTerms(req.ctx!.tenantId, req.body.terms) });
}));
router.get('/config/fields', requirePermission('tenant.config.view'), validate(z.object({ entity: z.string().optional() }), 'query'), tx(async (req, res) => {
  res.json({ data: await listFields((req.query as { entity?: string }).entity) });
}));
router.post('/config/fields', requirePermission('tenant.config.edit'), validate(FieldInput), tx(async (req, res) => {
  res.status(201).json(await createField(req.ctx!.tenantId, req.body));
}));
router.patch('/config/fields/:id', requirePermission('tenant.config.edit'), validate(id, 'params'), validate(FieldPatch), tx(async (req, res) => {
  res.json(await updateField(req.ctx!.tenantId, String(req.params.id), req.body));
}));

// ── Audit log ──
router.get(
  '/audit-log',
  requirePermission('tenant.audit.view'),
  validate(z.object({ limit: z.coerce.number().int().min(1).max(100).default(50), cursor: z.string().uuid().optional(), action: z.string().max(60).optional() }), 'query'),
  tx(async (req, res) => {
    res.json(await listAudit(req.query as unknown as { limit: number; cursor?: string; action?: string }));
  }),
);

// ── Subscription (read side; checkout arrives with billing-platform) ──
router.get('/billing/subscription', requirePermission('tenant.billing.view'), tx(async (req, res) => {
  const ent = await getEntitlements(req.ctx!.tenantId);
  const [activeUsers, branches] = await Promise.all([db().tenantMember.count({ where: { status: 'active' } }), db().branch.count()]);
  res.json({ status: ent.status, planKey: ent.planKey, trialEndsAt: ent.trialEndsAt, currentPeriodEnd: ent.currentPeriodEnd, limits: ent.limits, modules: ent.modules, usage: { users: activeUsers, branches } });
}));

// ── In-app notifications (no permission: every member sees their own) ──
router.get('/notifications', tx(async (req, res) => {
  res.json(await listNotifications(req.ctx!.userId));
}));
router.post('/notifications/read', validate(z.object({ id: z.string().uuid().optional() })), tx(async (req, res) => {
  await markRead(req.ctx!.userId, req.body.id);
  res.status(204).end();
}));

export default router;
