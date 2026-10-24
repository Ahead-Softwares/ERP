import { z } from 'zod';
import type { Prisma, SalesDocKind, SalesDocument } from '@prisma/client';
import { db } from '../../kernel/db';
import { AppError, notFound } from '../../kernel/errors';
import type { TenantCtx } from '../../kernel/context';
import { randomToken } from '../../kernel/crypto';
import { GST_RATES_BP, computeDocument, dateOnly, todayIST } from '../../kernel/gst';
import { allocateNumber } from '../../kernel/sequences';
import { DateStr, Paise, consumeMonthly, inScope, markOnboarding } from '../../kernel/query';
import { getEntitlements } from '../subscription/entitlements';
import { validateCustom } from '../config/service';
import { audit } from '../audit/service';
import { optionalText, zEmail, zGstin, zHsnOrSac, zPhone, zStateCode } from '../../kernel/zodRules';
import { gstinStateMismatch } from '../../contracts/validation';
import { withDefaults, type WorkspaceProfile } from '../../contracts/workspace';

// Sales documents: quotations (SAL-01) and GST tax invoices (BIL-01..04) share one engine.

export const SCOPE_FIELDS = { owner: ['createdBy'], branch: 'branchId' };

export const LineInput = z.object({
  itemId: z.string().uuid().optional().nullable(),
  description: z.string().trim().max(300).optional(),
  hsnSac: optionalText(zHsnOrSac),
  unit: z.string().trim().max(20).optional(),
  quantity: z.number().positive('Quantity must be more than 0').max(1e7),
  unitPricePaise: Paise,
  discountPaise: Paise.default(0),
  gstRateBp: z.number().int().refine((v) => (GST_RATES_BP as readonly number[]).includes(v), 'Choose a valid GST rate'),
}).superRefine((l, c) => {
  if (l.discountPaise > Math.round(l.quantity * l.unitPricePaise)) c.addIssue({ code: z.ZodIssueCode.custom, path: ['discountPaise'], message: "Discount can't be more than the line amount" });
});

export const BuyerInput = z.object({
  name: z.string().trim().min(1, 'Customer name is required').max(160),
  gstin: optionalText(zGstin),
  phone: optionalText(zPhone),
  email: optionalText(zEmail),
  stateCode: zStateCode.optional().nullable(),
  address: z.record(z.string()).optional().nullable(),
}).superRefine((b, c) => {
  const mismatch = gstinStateMismatch(b.gstin, b.stateCode);
  if (mismatch) c.addIssue({ code: z.ZodIssueCode.custom, path: ['gstin'], message: mismatch });
});

export const DocInput = z.object({
  contactId: z.string().uuid().optional().nullable(),
  buyer: BuyerInput.optional(),
  branchId: z.string().uuid().optional().nullable(),
  issueDate: DateStr.optional(),
  dueDate: DateStr.optional().nullable(),
  notes: z.string().max(2000).optional().nullable(),
  terms: z.string().max(2000).optional().nullable(),
  lines: z.array(LineInput).min(1, 'Add at least one line').max(200),
  custom: z.record(z.unknown()).optional(),
});
export type DocInput = z.infer<typeof DocInput>;

interface Buyer {
  name: string;
  gstin?: string | null;
  phone?: string | null;
  email?: string | null;
  stateCode?: string | null;
  address?: Record<string, string> | null;
}

async function resolveBuyer(input: DocInput): Promise<{ contactId: string | null; buyer: Buyer }> {
  if (input.contactId) {
    const c = await db().contact.findUnique({ where: { id: input.contactId } });
    if (!c) throw new AppError('VALIDATION_FAILED', 'Unknown customer.', { fields: { contactId: 'Unknown customer' } });
    // Explicit buyer fields (e.g. edited GSTIN on this invoice) override the contact's
    return {
      contactId: c.id,
      buyer: {
        name: c.companyName || c.name, gstin: c.gstin, phone: c.phone, email: c.email,
        stateCode: c.stateCode ?? (c.gstin ? c.gstin.slice(0, 2) : null), address: (c.address as Record<string, string>) ?? null,
        ...Object.fromEntries(Object.entries(input.buyer ?? {}).filter(([, v]) => v !== undefined)),
      },
    };
  }
  if (!input.buyer) throw new AppError('VALIDATION_FAILED', 'Choose a customer or enter buyer details.', { fields: { contactId: 'Required' } });
  return { contactId: null, buyer: { ...input.buyer, stateCode: input.buyer.stateCode ?? (input.buyer.gstin ? input.buyer.gstin.slice(0, 2) : null) } };
}

async function resolveLines(lines: DocInput['lines']) {
  const ids = [...new Set(lines.map((l) => l.itemId).filter(Boolean))] as string[];
  const items = ids.length ? await db().item.findMany({ where: { id: { in: ids } } }) : [];
  const byId = new Map(items.map((i) => [i.id, i]));
  return lines.map((l, i) => {
    const item = l.itemId ? byId.get(l.itemId) : undefined;
    if (l.itemId && !item) throw new AppError('VALIDATION_FAILED', 'Unknown item.', { fields: { [`lines.${i}.itemId`]: 'Unknown item' } });
    const description = l.description || item?.name;
    if (!description) throw new AppError('VALIDATION_FAILED', 'Each line needs a description.', { fields: { [`lines.${i}.description`]: 'Required' } });
    if (l.discountPaise > Math.round(l.unitPricePaise * l.quantity)) {
      throw new AppError('VALIDATION_FAILED', 'Discount cannot exceed the line amount.', { fields: { [`lines.${i}.discountPaise`]: 'Too large' } });
    }
    return { ...l, itemId: item?.id ?? null, description, hsnSac: l.hsnSac ?? item?.hsnSac ?? null, unit: l.unit || item?.unit || 'pcs' };
  });
}

/** Compute snapshot, place of supply and GST split; returns data for create/update. */
async function prepare(ctx: TenantCtx, input: DocInput, existing?: SalesDocument) {
  const tenant = await db().tenant.findUniqueOrThrow({ where: { id: ctx.tenantId } });
  const { contactId, buyer } = await resolveBuyer(input);
  const lines = await resolveLines(input.lines);
  const placeOfSupply = buyer.stateCode ?? tenant.billingStateCode ?? null;
  const intraState = !tenant.billingStateCode || !placeOfSupply || placeOfSupply === tenant.billingStateCode;
  const { lines: computed, totals } = computeDocument(lines, intraState);
  const custom = await validateCustom(ctx.tenantId, 'invoice', input.custom, (existing?.custom as Record<string, unknown>) ?? {});
  if (input.branchId && !(await db().branch.findUnique({ where: { id: input.branchId } }))) {
    throw new AppError('VALIDATION_FAILED', 'Unknown branch.', { fields: { branchId: 'Unknown branch' } });
  }
  return {
    tenant,
    doc: {
      contactId,
      buyer: buyer as unknown as Prisma.InputJsonValue,
      placeOfSupply,
      branchId: input.branchId ?? existing?.branchId ?? ctx.branchIds[0] ?? null,
      issueDate: dateOnly(input.issueDate ?? todayIST()),
      dueDate: input.dueDate ? dateOnly(input.dueDate) : null,
      notes: input.notes ?? null,
      terms: input.terms ?? null,
      custom: custom as Prisma.InputJsonValue,
      ...totals,
    },
    lines: computed.map((l, position) => ({
      tenantId: ctx.tenantId, itemId: l.itemId, description: l.description, hsnSac: l.hsnSac, unit: l.unit,
      quantity: (Number(l.quantityMilli) / 1000).toFixed(3), unitPricePaise: BigInt(l.unitPricePaise), discountPaise: BigInt(l.discountPaise ?? 0),
      taxablePaise: l.taxablePaise, gstRateBp: l.gstRateBp, cgstPaise: l.cgstPaise, sgstPaise: l.sgstPaise, igstPaise: l.igstPaise, totalPaise: l.totalPaise, position,
    })),
  };
}

export async function getDocument(ctx: TenantCtx, id: string, kind: SalesDocKind) {
  const doc = await db().salesDocument.findUnique({
    where: { id },
    include: { lines: { orderBy: { position: 'asc' } }, payments: { orderBy: { createdAt: 'asc' } } },
  });
  if (!doc || doc.kind !== kind || !inScope(ctx, doc, SCOPE_FIELDS)) throw notFound(kind === 'invoice' ? 'Invoice' : 'Quotation');
  return doc;
}

export async function createDocument(ctx: TenantCtx, kind: SalesDocKind, input: DocInput, opts: { issue?: boolean; sourceType?: string; sourceId?: string } = {}) {
  const { tenant, doc, lines } = await prepare(ctx, input);
  // Default terms from Settings › Documents when the document has none
  if (!doc.terms) doc.terms = withDefaults(tenant.preferences).documents.terms || null;
  // Quotations are numbered when created; invoices only when issued (never burn numbers on drafts)
  const numbered = kind === 'quotation' ? await allocateNumber(ctx.tenantId, 'quotation', tenant.fyStartMonth) : null;
  const created = await db().salesDocument.create({
    data: {
      ...doc, tenantId: ctx.tenantId, kind, status: 'draft', number: numbered?.number, fy: numbered?.fy,
      createdBy: ctx.userId, sourceType: opts.sourceType, sourceId: opts.sourceId,
      lines: { create: lines.map(({ tenantId: _t, ...l }) => ({ ...l, tenantId: ctx.tenantId })) },
    },
  });
  if (kind === 'invoice' && opts.issue) return issueInvoice(ctx, created.id);
  return getDocument(ctx, created.id, kind);
}

export async function updateDocument(ctx: TenantCtx, id: string, kind: SalesDocKind, input: DocInput, version: number) {
  const existing = await getDocument(ctx, id, kind);
  const editable = kind === 'invoice' ? existing.status === 'draft' : ['draft', 'sent'].includes(existing.status);
  // BIL-04: issued invoices are immutable; corrections go through credit/debit notes
  if (!editable) throw new AppError('CONFLICT', kind === 'invoice' ? 'Issued invoices cannot be edited. Cancel it or issue a credit note.' : 'This quotation can no longer be edited.');
  if (existing.version !== version) throw new AppError('VERSION_CONFLICT', 'This document was changed by someone else. Reload and try again.');
  const { doc, lines } = await prepare(ctx, input, existing);
  await db().salesDocumentLine.deleteMany({ where: { documentId: id } });
  await db().salesDocument.update({
    where: { id },
    data: { ...doc, version: { increment: 1 }, lines: { create: lines.map(({ tenantId: _t, ...l }) => ({ ...l, tenantId: ctx.tenantId })) } },
  });
  return getDocument(ctx, id, kind);
}

/** Issue a draft invoice: allocate the FY number, freeze seller details, count against the plan. */
export async function issueInvoice(ctx: TenantCtx, id: string) {
  const doc = await getDocument(ctx, id, 'invoice');
  if (doc.status !== 'draft') throw new AppError('CONFLICT', 'Only draft invoices can be issued.');
  const tenant = await db().tenant.findUniqueOrThrow({ where: { id: ctx.tenantId } });
  if (!tenant.billingStateCode) {
    throw new AppError('VALIDATION_FAILED', 'Add your business state and address in Settings before issuing invoices.', { fields: { billingStateCode: 'Required to calculate GST' } });
  }
  // Recompute with the tenant's current state so the CGST/SGST vs IGST split is right
  const input: DocInput = {
    contactId: doc.contactId,
    buyer: doc.contactId ? undefined : (doc.buyer as unknown as DocInput['buyer']),
    branchId: doc.branchId,
    issueDate: doc.issueDate.toISOString().slice(0, 10),
    dueDate: doc.dueDate?.toISOString().slice(0, 10) ?? null,
    notes: doc.notes,
    terms: doc.terms,
    lines: doc.lines.map((l) => ({ itemId: l.itemId, description: l.description, hsnSac: l.hsnSac, unit: l.unit, quantity: Number(l.quantity), unitPricePaise: Number(l.unitPricePaise), discountPaise: Number(l.discountPaise), gstRateBp: l.gstRateBp })),
  };
  const { doc: fresh, lines } = await prepare(ctx, input, doc);

  const ent = await getEntitlements(ctx.tenantId);
  await consumeMonthly(ctx, 'invoices', ent.limits.invoicesPerMonth, 'invoices');
  const { number, fy } = await allocateNumber(ctx.tenantId, 'invoice', tenant.fyStartMonth, doc.issueDate);
  const branch = doc.branchId ? await db().branch.findUnique({ where: { id: doc.branchId } }) : null;
  const prefs = withDefaults(tenant.preferences);
  const profile = (tenant.profile ?? {}) as WorkspaceProfile;
  const pay = prefs.payments;
  const seller = {
    name: tenant.name, legalName: tenant.legalName, gstin: branch?.gstin ?? tenant.gstin,
    stateCode: branch?.stateCode ?? tenant.billingStateCode, address: branch?.address ?? tenant.address, logoUrl: tenant.logoUrl,
    phone: profile.phone ?? null, email: profile.email ?? null, brandColor: prefs.branding.brandColor,
    // Frozen with the invoice, so later bank changes never alter an issued invoice
    bank: pay.bankAccount ? { holder: pay.bankHolder, account: pay.bankAccount, ifsc: pay.ifsc } : null,
    upiId: pay.upiId || null, showUpiQr: pay.showUpiQr && !!pay.upiId,
  };
  await db().salesDocumentLine.deleteMany({ where: { documentId: id } });
  await db().salesDocument.update({
    where: { id },
    data: {
      ...fresh, status: 'issued', number, fy, seller: seller as Prisma.InputJsonValue, issuedAt: new Date(),
      shareToken: randomToken(18), version: { increment: 1 },
      lines: { create: lines.map(({ tenantId: _t, ...l }) => ({ ...l, tenantId: ctx.tenantId })) },
    },
  });
  await markOnboarding(ctx, 'firstInvoice');
  await audit({ action: 'billing.invoice.issue', entity: 'invoice', entityId: id, after: { number, totalPaise: fresh.totalPaise } });
  return getDocument(ctx, id, 'invoice');
}

export async function cancelInvoice(ctx: TenantCtx, id: string, reason: string) {
  const doc = await getDocument(ctx, id, 'invoice');
  if (doc.status === 'draft') throw new AppError('CONFLICT', 'Delete the draft instead of cancelling it.');
  if (doc.status === 'cancelled') throw new AppError('CONFLICT', 'This invoice is already cancelled.');
  if (doc.paidPaise > 0n) throw new AppError('CONFLICT', 'This invoice has payments recorded. Issue a credit note instead (paid plans).');
  await db().salesDocument.update({ where: { id }, data: { status: 'cancelled', cancelledAt: new Date(), cancelReason: reason, version: { increment: 1 } } });
  await audit({ action: 'billing.invoice.cancel', entity: 'invoice', entityId: id, before: { status: doc.status }, after: { reason } });
  return getDocument(ctx, id, 'invoice');
}

export const PaymentInput = z.object({
  amountPaise: z.number().int().positive(),
  method: z.enum(['cash', 'upi', 'card', 'bank', 'cheque', 'other']),
  reference: z.string().trim().max(100).optional().nullable(),
  paidOn: DateStr.optional(),
  notes: z.string().trim().max(500).optional().nullable(),
});

/** BIL-03: record a receipt against an issued invoice; status moves to partially paid / paid. */
export async function recordPayment(ctx: TenantCtx, id: string, input: z.infer<typeof PaymentInput>) {
  const doc = await getDocument(ctx, id, 'invoice');
  if (!['issued', 'partially_paid'].includes(doc.status)) throw new AppError('CONFLICT', 'Payments can only be recorded on issued, unpaid invoices.');
  const balance = doc.totalPaise - doc.paidPaise;
  if (BigInt(input.amountPaise) > balance) {
    throw new AppError('VALIDATION_FAILED', `Amount is more than the balance due (₹${(Number(balance) / 100).toFixed(2)}).`, { fields: { amountPaise: 'More than balance due' } });
  }
  const tenant = await db().tenant.findUniqueOrThrow({ where: { id: ctx.tenantId }, select: { fyStartMonth: true } });
  const { number } = await allocateNumber(ctx.tenantId, 'receipt', tenant.fyStartMonth);
  const payment = await db().payment.create({
    data: { ...input, paidOn: dateOnly(input.paidOn ?? todayIST()), amountPaise: BigInt(input.amountPaise), tenantId: ctx.tenantId, documentId: id, contactId: doc.contactId, number, createdBy: ctx.userId },
  });
  const paid = doc.paidPaise + BigInt(input.amountPaise);
  await db().salesDocument.update({ where: { id }, data: { paidPaise: paid, status: paid >= doc.totalPaise ? 'paid' : 'partially_paid', version: { increment: 1 } } });
  await audit({ action: 'billing.payment.record', entity: 'payment', entityId: payment.id, after: { invoice: doc.number, amountPaise: input.amountPaise, method: input.method } });
  return getDocument(ctx, id, 'invoice');
}

/** Copy a quotation into a new draft invoice and mark the quotation converted (SAL-01). */
export async function convertQuotation(ctx: TenantCtx, id: string) {
  const q = await getDocument(ctx, id, 'quotation');
  if (q.status === 'converted') throw new AppError('CONFLICT', 'This quotation is already converted.');
  if (q.status === 'declined') throw new AppError('CONFLICT', 'Declined quotations cannot be converted.');
  const invoice = await createDocument(
    ctx,
    'invoice',
    {
      contactId: q.contactId,
      buyer: q.contactId ? undefined : (q.buyer as unknown as DocInput['buyer']),
      branchId: q.branchId,
      notes: q.notes,
      terms: q.terms,
      lines: q.lines.map((l) => ({ itemId: l.itemId, description: l.description, hsnSac: l.hsnSac, unit: l.unit, quantity: Number(l.quantity), unitPricePaise: Number(l.unitPricePaise), discountPaise: Number(l.discountPaise), gstRateBp: l.gstRateBp })),
    },
    { sourceType: 'quotation', sourceId: q.id },
  );
  await db().salesDocument.update({ where: { id: q.id }, data: { status: 'converted', version: { increment: 1 } } });
  return invoice;
}

/** Public view for share links: only what the buyer needs, no internal ids. */
export async function publicDocument(token: string) {
  const doc = await db().salesDocument.findUnique({ where: { shareToken: token }, include: { lines: { orderBy: { position: 'asc' } } } });
  if (!doc || doc.status === 'draft') throw notFound('Document');
  return {
    kind: doc.kind, number: doc.number, status: doc.status, issueDate: doc.issueDate, dueDate: doc.dueDate, buyer: doc.buyer, seller: doc.seller,
    placeOfSupply: doc.placeOfSupply, subtotalPaise: doc.subtotalPaise, discountPaise: doc.discountPaise, taxablePaise: doc.taxablePaise,
    cgstPaise: doc.cgstPaise, sgstPaise: doc.sgstPaise, igstPaise: doc.igstPaise, totalPaise: doc.totalPaise, paidPaise: doc.paidPaise,
    notes: doc.notes, terms: doc.terms,
    lines: doc.lines.map((l) => ({ description: l.description, hsnSac: l.hsnSac, unit: l.unit, quantity: l.quantity, unitPricePaise: l.unitPricePaise, discountPaise: l.discountPaise, taxablePaise: l.taxablePaise, gstRateBp: l.gstRateBp, cgstPaise: l.cgstPaise, sgstPaise: l.sgstPaise, igstPaise: l.igstPaise, totalPaise: l.totalPaise })),
  };
}
