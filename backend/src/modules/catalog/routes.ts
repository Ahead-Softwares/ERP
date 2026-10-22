import { Router } from 'express';
import { z } from 'zod';
import type { Prisma } from '@prisma/client';
import { db } from '../../kernel/db';
import { AppError, notFound } from '../../kernel/errors';
import type { TenantCtx } from '../../kernel/context';
import { GST_RATES_BP } from '../../kernel/gst';
import { IdParam, ListQuery, Paise, assertRecordLimit, assertVersion, canWriteField, markOnboarding, page, pageArgs, stripHidden } from '../../kernel/query';
import { validate } from '../../middleware/request';
import { requirePermission, tenantAuth, tx } from '../../middleware/auth';
import { validateCustom } from '../config/service';
import { consumer } from '../events/outbox';
import { audit } from '../audit/service';
import { templateByKey } from '../../contracts/templates';

// Product & Service Catalogue (CAT-01, CAT-02) — master data shared by billing, CRM, bookings.

const router = Router();
router.use(tenantAuth);

const HIDDEN = { cost_price: 'costPricePaise' };

const ItemInput = z.object({
  type: z.enum(['product', 'service']).default('product'),
  name: z.string().trim().min(1).max(160),
  sku: z.string().trim().max(40).optional().nullable(),
  categoryId: z.string().uuid().optional().nullable(),
  unit: z.string().trim().min(1).max(20).default('pcs'),
  pricePaise: Paise,
  costPricePaise: Paise.optional().nullable(),
  gstRateBp: z.number().int().refine((v) => (GST_RATES_BP as readonly number[]).includes(v), 'Choose a valid GST rate'),
  hsnSac: z.string().trim().regex(/^\d{4,8}$/, 'HSN/SAC is 4–8 digits').optional().nullable().or(z.literal('').transform(() => null)),
  durationMin: z.number().int().min(5).max(24 * 60).optional().nullable(),
  skill: z.string().trim().max(80).optional().nullable(),
  description: z.string().trim().max(2000).optional().nullable(),
  imageUrl: z.string().url().max(500).optional().nullable().or(z.literal('').transform(() => null)),
  isActive: z.boolean().optional(),
  custom: z.record(z.unknown()).optional(),
});

const ItemPatch = ItemInput.partial().extend({ version: z.number().int() });

const ItemList = ListQuery.extend({
  type: z.enum(['product', 'service']).optional(),
  categoryId: z.string().uuid().optional(),
  active: z.enum(['true', 'false', 'all']).default('true'),
});

async function serialize(ctx: TenantCtx, rows: Record<string, unknown>[]) {
  return stripHidden(ctx, 'item', rows, HIDDEN);
}

async function checkCategory(categoryId?: string | null) {
  if (categoryId && !(await db().itemCategory.findUnique({ where: { id: categoryId } }))) {
    throw new AppError('VALIDATION_FAILED', 'Unknown category.', { fields: { categoryId: 'Unknown category' } });
  }
}

router.get('/items', requirePermission('catalog.item.view'), validate(ItemList, 'query'), tx(async (req, res) => {
  const q = req.query as unknown as z.infer<typeof ItemList>;
  const where: Prisma.ItemWhereInput = {
    type: q.type,
    categoryId: q.categoryId,
    isActive: q.active === 'all' ? undefined : q.active === 'true',
    ...(q.q ? { OR: [{ name: { contains: q.q, mode: 'insensitive' } }, { sku: { contains: q.q, mode: 'insensitive' } }, { hsnSac: { startsWith: q.q } }] } : {}),
  };
  const rows = await db().item.findMany({ where, ...pageArgs(q) });
  const p = page(rows, q.limit);
  res.json({ ...p, data: await serialize(req.ctx!, p.data) });
}));

router.get('/items/:id', requirePermission('catalog.item.view'), validate(IdParam, 'params'), tx(async (req, res) => {
  const item = await db().item.findUnique({ where: { id: String(req.params.id) } });
  if (!item) throw notFound('Item');
  res.json((await serialize(req.ctx!, [item]))[0]);
}));

router.post('/items', requirePermission('catalog.item.create'), validate(ItemInput), tx(async (req, res) => {
  const ctx = req.ctx!;
  const body = req.body as z.infer<typeof ItemInput>;
  await assertRecordLimit(ctx, 'items', () => db().item.count(), 'products and services');
  await checkCategory(body.categoryId);
  if (body.costPricePaise != null && !(await canWriteField(ctx, 'item', 'cost_price'))) delete body.costPricePaise;
  const custom = await validateCustom(ctx.tenantId, 'item', body.custom);
  const item = await db().item.create({
    data: { ...body, tenantId: ctx.tenantId, createdBy: ctx.userId, pricePaise: BigInt(body.pricePaise), costPricePaise: body.costPricePaise != null ? BigInt(body.costPricePaise) : null, custom: custom as Prisma.InputJsonValue },
  });
  await markOnboarding(ctx, 'firstItem');
  res.status(201).json((await serialize(ctx, [item]))[0]);
}));

router.patch('/items/:id', requirePermission('catalog.item.edit'), validate(IdParam, 'params'), validate(ItemPatch), tx(async (req, res) => {
  const ctx = req.ctx!;
  const { version, ...body } = req.body as z.infer<typeof ItemPatch>;
  const item = await db().item.findUnique({ where: { id: String(req.params.id) } });
  if (!item) throw notFound('Item');
  assertVersion(item.version, version, 'item');
  await checkCategory(body.categoryId);
  if (body.costPricePaise !== undefined && !(await canWriteField(ctx, 'item', 'cost_price'))) delete body.costPricePaise;
  const custom = body.custom ? await validateCustom(ctx.tenantId, 'item', body.custom, item.custom as Record<string, unknown>) : undefined;
  const updated = await db().item.update({
    where: { id: item.id },
    data: {
      ...body,
      pricePaise: body.pricePaise !== undefined ? BigInt(body.pricePaise) : undefined,
      costPricePaise: body.costPricePaise === undefined ? undefined : body.costPricePaise === null ? null : BigInt(body.costPricePaise),
      custom: custom as Prisma.InputJsonValue | undefined,
      version: { increment: 1 },
    },
  });
  res.json((await serialize(ctx, [updated]))[0]);
}));

/** Items used on documents are never hard-deleted: they are archived. */
router.delete('/items/:id', requirePermission('catalog.item.delete'), validate(IdParam, 'params'), tx(async (req, res) => {
  const item = await db().item.findUnique({ where: { id: String(req.params.id) } });
  if (!item) throw notFound('Item');
  const used = await db().salesDocumentLine.count({ where: { itemId: item.id } });
  if (used) await db().item.update({ where: { id: item.id }, data: { isActive: false, version: { increment: 1 } } });
  else await db().item.delete({ where: { id: item.id } });
  await audit({ action: used ? 'catalog.item.archive' : 'catalog.item.delete', entity: 'item', entityId: item.id, before: { name: item.name } });
  res.status(204).end();
}));

// ── Categories ──

router.get('/item-categories', requirePermission('catalog.category.view'), tx(async (_req, res) => {
  res.json({ data: await db().itemCategory.findMany({ orderBy: { name: 'asc' } }) });
}));

router.post('/item-categories', requirePermission('catalog.category.create'), validate(z.object({ name: z.string().trim().min(1).max(80) })), tx(async (req, res) => {
  res.status(201).json(await db().itemCategory.create({ data: { tenantId: req.ctx!.tenantId, name: req.body.name } }));
}));

router.delete('/item-categories/:id', requirePermission('catalog.category.delete'), validate(IdParam, 'params'), tx(async (req, res) => {
  await db().item.updateMany({ where: { categoryId: String(req.params.id) }, data: { categoryId: null } });
  await db().itemCategory.delete({ where: { id: String(req.params.id) } });
  res.status(204).end();
}));

// Seed the industry template's starter catalogue for a new tenant (CFG-01); runs alongside template application
consumer('catalog.seed-template', 'tenant.created', async (evt) => {
  const template = templateByKey(String(evt.payload.industryKey));
  if (!template?.catalogSeed.length) return;
  if (await db().item.count({ where: { source: 'template' } })) return;
  await db().item.createMany({
    data: template.catalogSeed.map((s) => ({
      tenantId: evt.tenantId!, type: s.type, name: s.name, pricePaise: BigInt(s.pricePaise), gstRateBp: s.gstRateBp,
      hsnSac: s.hsnSac, durationMin: s.durationMin, unit: s.type === 'service' ? 'service' : 'pcs', source: 'template' as const,
    })),
  });
});

export default router;
