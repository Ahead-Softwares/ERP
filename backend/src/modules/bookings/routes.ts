import { Router } from 'express';
import { z } from 'zod';
import { Prisma } from '@prisma/client';
import { db } from '../../kernel/db';
import { AppError, notFound } from '../../kernel/errors';
import { IdParam, assertVersion, inScope, scopeWhere } from '../../kernel/query';
import { validate } from '../../middleware/request';
import { requirePermission, tenantAuth, tx } from '../../middleware/auth';
import { notify } from '../notifications/service';
import { createDocument } from '../billing/service';

// Team calendar, appointments linked to customer/service/staff, no double-booking,
// and one-click conversion of a completed appointment into an invoice (BKG-01, BKG-02, BKG-08).

const router = Router();
router.use(tenantAuth);
const SCOPE = { owner: ['createdBy', 'staffId'], branch: 'branchId' };

const AppointmentInput = z.object({
  kind: z.enum(['appointment', 'event']).default('appointment'),
  title: z.string().trim().max(200).optional(),
  contactId: z.string().uuid().optional().nullable(),
  itemId: z.string().uuid().optional().nullable(),
  staffId: z.string().uuid().optional().nullable(),
  startAt: z.string().datetime({ offset: true }),
  endAt: z.string().datetime({ offset: true }).optional(),
  status: z.enum(['scheduled', 'confirmed', 'completed', 'cancelled', 'no_show']).optional(),
  notes: z.string().trim().max(2000).optional().nullable(),
  branchId: z.string().uuid().optional().nullable(),
});

const perm = (kind: 'appointment' | 'event', action: string) => `bookings.${kind}.${action}`;

async function resolve(input: Partial<z.infer<typeof AppointmentInput>>, existing?: { startAt: Date; endAt: Date }) {
  const [contact, item] = await Promise.all([
    input.contactId ? db().contact.findUnique({ where: { id: input.contactId }, select: { id: true, name: true } }) : null,
    input.itemId ? db().item.findUnique({ where: { id: input.itemId }, select: { id: true, name: true, durationMin: true } }) : null,
  ]);
  if (input.contactId && !contact) throw new AppError('VALIDATION_FAILED', 'Unknown customer.', { fields: { contactId: 'Unknown' } });
  if (input.itemId && !item) throw new AppError('VALIDATION_FAILED', 'Unknown service.', { fields: { itemId: 'Unknown' } });
  if (input.staffId && !(await db().tenantMember.findFirst({ where: { userId: input.staffId, status: 'active' } }))) {
    throw new AppError('VALIDATION_FAILED', 'Staff must be an active user.', { fields: { staffId: 'Not an active user' } });
  }
  const startAt = input.startAt ? new Date(input.startAt) : existing!.startAt;
  // Default duration: the service's duration, else 30 minutes
  const endAt = input.endAt ? new Date(input.endAt) : input.startAt ? new Date(startAt.getTime() + (item?.durationMin ?? 30) * 60_000) : existing!.endAt;
  if (endAt <= startAt) throw new AppError('VALIDATION_FAILED', 'End time must be after the start.', { fields: { endAt: 'Must be after start' } });
  const title = input.title || [item?.name, contact?.name].filter(Boolean).join(' · ') || undefined;
  return { startAt, endAt, title };
}

/** Friendly pre-check; the database exclusion constraint is the real guarantee. */
async function assertFree(staffId: string | null | undefined, startAt: Date, endAt: Date, excludeId?: string) {
  if (!staffId) return;
  const clash = await db().appointment.findFirst({
    where: { staffId, id: excludeId ? { not: excludeId } : undefined, status: { notIn: ['cancelled', 'no_show'] }, startAt: { lt: endAt }, endAt: { gt: startAt } },
    select: { title: true, startAt: true },
  });
  if (clash) throw new AppError('CONFLICT', 'This staff member is already booked at that time.', { clash });
}

const isDoubleBooking = (e: unknown) => e instanceof Prisma.PrismaClientKnownRequestError ? String(e.meta?.message ?? e.message).includes('appointments_no_double_booking') : e instanceof Error && e.message.includes('appointments_no_double_booking');

async function withNames<T extends { contactId: string | null; staffId: string | null; itemId: string | null }>(rows: T[]) {
  const contactIds = [...new Set(rows.map((r) => r.contactId).filter(Boolean))] as string[];
  const staffIds = [...new Set(rows.map((r) => r.staffId).filter(Boolean))] as string[];
  const itemIds = [...new Set(rows.map((r) => r.itemId).filter(Boolean))] as string[];
  const [contacts, staff, items] = await Promise.all([
    contactIds.length ? db().contact.findMany({ where: { id: { in: contactIds } }, select: { id: true, name: true, phone: true } }) : [],
    staffIds.length ? db().user.findMany({ where: { id: { in: staffIds } }, select: { id: true, name: true } }) : [],
    itemIds.length ? db().item.findMany({ where: { id: { in: itemIds } }, select: { id: true, name: true, pricePaise: true } }) : [],
  ]);
  const c = Object.fromEntries(contacts.map((x) => [x.id, x]));
  const s = Object.fromEntries(staff.map((x) => [x.id, x]));
  const i = Object.fromEntries(items.map((x) => [x.id, x]));
  return rows.map((r) => ({ ...r, contact: r.contactId ? (c[r.contactId] ?? null) : null, staff: r.staffId ? (s[r.staffId] ?? null) : null, item: r.itemId ? (i[r.itemId] ?? null) : null }));
}

router.get(
  '/appointments',
  requirePermission('bookings.appointment.view'),
  validate(z.object({ from: z.string().datetime({ offset: true }), to: z.string().datetime({ offset: true }), staffId: z.string().uuid().optional() }), 'query'),
  tx(async (req, res) => {
    const q = req.query as unknown as { from: string; to: string; staffId?: string };
    const from = new Date(q.from);
    const to = new Date(q.to);
    if (to.getTime() - from.getTime() > 62 * 86_400_000) throw new AppError('VALIDATION_FAILED', 'Choose a range of at most two months.');
    const rows = await db().appointment.findMany({
      where: { AND: [scopeWhere(req.ctx!, SCOPE), { startAt: { lt: to }, endAt: { gt: from } }, q.staffId ? { staffId: q.staffId } : {}] },
      orderBy: { startAt: 'asc' },
      take: 1000,
    });
    res.json({ data: await withNames(rows) });
  }),
);

router.post('/appointments', validate(AppointmentInput), async (req, res, next) => {
  // The permission depends on the kind (appointment vs calendar event)
  await requirePermission(perm(req.body.kind, 'create'))(req, res, next);
}, tx(async (req, res) => {
  const ctx = req.ctx!;
  const b = req.body as z.infer<typeof AppointmentInput>;
  const { startAt, endAt, title } = await resolve(b);
  if (!title) throw new AppError('VALIDATION_FAILED', 'Add a title or choose a customer/service.', { fields: { title: 'Required' } });
  const staffId = b.staffId === undefined ? (b.kind === 'event' ? ctx.userId : null) : b.staffId;
  await assertFree(staffId, startAt, endAt);
  try {
    const a = await db().appointment.create({
      data: { kind: b.kind, title, contactId: b.contactId, itemId: b.itemId, staffId, startAt, endAt, status: b.status ?? 'scheduled', notes: b.notes, tenantId: ctx.tenantId, createdBy: ctx.userId, branchId: b.branchId ?? ctx.branchIds[0] ?? null },
    });
    if (staffId && staffId !== ctx.userId) await notify(staffId, `New ${b.kind}: ${title}`, startAt.toISOString(), '/app/m/bookings');
    res.status(201).json((await withNames([a]))[0]);
  } catch (e) {
    if (isDoubleBooking(e)) throw new AppError('CONFLICT', 'This staff member is already booked at that time.');
    throw e;
  }
}));

router.patch('/appointments/:id', requirePermission('bookings.appointment.edit'), validate(IdParam, 'params'), validate(AppointmentInput.partial().extend({ version: z.number().int().optional() })), tx(async (req, res) => {
  const ctx = req.ctx!;
  const a = await db().appointment.findUnique({ where: { id: String(req.params.id) } });
  if (!a || !inScope(ctx, a, SCOPE)) throw notFound('Appointment');
  const { version, kind: _k, ...b } = req.body as Partial<z.infer<typeof AppointmentInput>> & { version?: number };
  assertVersion(a.version, version, 'appointment');
  const { startAt, endAt, title } = await resolve(b, a);
  const staffId = b.staffId === undefined ? a.staffId : b.staffId;
  const status = b.status ?? a.status;
  if (!['cancelled', 'no_show'].includes(status)) await assertFree(staffId, startAt, endAt, a.id);
  try {
    const updated = await db().appointment.update({
      where: { id: a.id },
      data: { ...b, title: b.title || (b.contactId || b.itemId ? title : undefined), staffId, startAt, endAt, version: { increment: 1 } },
    });
    res.json((await withNames([updated]))[0]);
  } catch (e) {
    if (isDoubleBooking(e)) throw new AppError('CONFLICT', 'This staff member is already booked at that time.');
    throw e;
  }
}));

router.delete('/appointments/:id', requirePermission('bookings.appointment.delete'), validate(IdParam, 'params'), tx(async (req, res) => {
  const a = await db().appointment.findUnique({ where: { id: String(req.params.id) } });
  if (!a || !inScope(req.ctx!, a, SCOPE)) throw notFound('Appointment');
  if (a.invoiceId) throw new AppError('CONFLICT', 'This appointment has an invoice. Cancel it instead.');
  await db().appointment.delete({ where: { id: a.id } });
  res.status(204).end();
}));

// BKG-08: completed appointment → draft invoice in one click
router.post('/appointments/:id/invoice', requirePermission('billing.invoice.create'), validate(IdParam, 'params'), tx(async (req, res) => {
  const ctx = req.ctx!;
  const a = await db().appointment.findUnique({ where: { id: String(req.params.id) } });
  if (!a || !inScope(ctx, a, SCOPE)) throw notFound('Appointment');
  if (a.invoiceId) throw new AppError('CONFLICT', 'An invoice already exists for this appointment.', { invoiceId: a.invoiceId });
  if (!a.contactId || !a.itemId) throw new AppError('VALIDATION_FAILED', 'The appointment needs a customer and a service to invoice.');
  const item = await db().item.findUniqueOrThrow({ where: { id: a.itemId } });
  const invoice = await createDocument(
    ctx,
    'invoice',
    { contactId: a.contactId, branchId: a.branchId, lines: [{ itemId: item.id, quantity: 1, unitPricePaise: Number(item.pricePaise), discountPaise: 0, gstRateBp: item.gstRateBp }] },
    { sourceType: 'appointment', sourceId: a.id },
  );
  await db().appointment.update({ where: { id: a.id }, data: { invoiceId: invoice.id, status: 'completed', version: { increment: 1 } } });
  res.status(201).json(invoice);
}));

/** Active staff for booking pickers (anyone who can view the calendar may list them). */
router.get('/staff', requirePermission('bookings.appointment.view'), tx(async (_req, res) => {
  const members = await db().tenantMember.findMany({ where: { status: 'active' }, include: { user: { select: { id: true, name: true } }, role: { select: { key: true, name: true } } } });
  res.json({ data: members.map((m) => ({ id: m.user.id, name: m.user.name, role: m.role.name, isServiceProvider: m.role.key === 'service_provider' })) });
}));

export default router;
