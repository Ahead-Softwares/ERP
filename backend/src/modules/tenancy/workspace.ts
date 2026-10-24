import { z } from 'zod';
import type { Prisma } from '@prisma/client';
import { db, withPlatform } from '../../kernel/db';
import { AppError } from '../../kernel/errors';
import { GST_RATES_BP, financialYear } from '../../kernel/gst';
import * as rules from '../../contracts/validation';
import {
  BRANCH_BANDS,
  GOALS,
  SETUP_STEPS,
  TEAM_SIZES,
  brandColorError,
  industryByKey,
  prefixError,
  withDefaults,
  type ProvisioningStatus,
  type SetupState,
  type SetupStepKey,
  type WorkspacePreferences,
  type WorkspaceProfile,
} from '../../contracts/workspace';
import { audit } from '../audit/service';
import { getTenant } from './service';
import { optionalText, zGstin, zStateCode } from '../../kernel/zodRules';

// Phase 1: workspace profile (signup answers), preferences (documents, payments, taxes,
// branding), setup-wizard progress and the provisioning status behind the loading screen.

const fromRule = (rule: rules.Rule) => (v: string, c: z.RefinementCtx) => {
  const message = rule(v);
  if (message) c.addIssue({ code: z.ZodIssueCode.custom, message });
};
const BUSINESS_TYPES = rules.BUSINESS_TYPES.map((b) => b.key) as [rules.BusinessType, ...rules.BusinessType[]];
const MODULE_KEY = z.string().regex(/^[a-z]{2,20}$/);

export const ProfileInput = z.object({
  businessType: z.enum(BUSINESS_TYPES).optional(),
  gstRegistered: z.boolean().optional(),
  pan: z.union([z.literal('').transform(() => null), z.string().transform(rules.upperNoSpaces).superRefine(fromRule(rules.pan))]).nullish(),
  teamSize: z.enum(TEAM_SIZES).optional(),
  branches: z.enum(BRANCH_BANDS).optional(),
  subIndustry: z.string().trim().max(60).nullish(),
  industryRequested: z.string().trim().max(80).nullish(),
  goals: z.array(z.enum(GOALS.map((g) => g.key) as [string, ...string[]])).max(GOALS.length).optional(),
  modules: z.array(MODULE_KEY).max(20).optional(),
  heardFrom: z.string().trim().max(60).nullish(),
  phone: z.union([z.literal('').transform(() => null), z.string().superRefine(fromRule(rules.phone)).transform(rules.storedPhone)]).nullish(),
  email: z.union([z.literal('').transform(() => null), z.string().trim().toLowerCase().superRefine(fromRule(rules.email))]).nullish(),
});

/** Signup steps 2–4 (also "Add another business" for a signed-in user). */
export const BusinessSignup = z
  .object({
    businessName: z.string().trim().min(2, 'Use at least 2 characters').max(100, 'Keep it under 100 characters'),
    businessType: z.enum(BUSINESS_TYPES, { errorMap: () => ({ message: 'Choose your business type' }) }),
    gstRegistered: z.boolean(),
    gstin: optionalText(zGstin),
    composition: z.boolean().default(false),
    legalName: optionalText(z.string().trim().max(160)),
    stateCode: zStateCode,
    teamSize: z.enum(TEAM_SIZES, { errorMap: () => ({ message: 'Choose your team size' }) }),
    branches: z.enum(BRANCH_BANDS, { errorMap: () => ({ message: 'Choose how many locations you have' }) }),
    industryKey: z.string().refine((k) => !!industryByKey(k), 'Choose your industry'),
    subIndustry: optionalText(z.string().trim().max(60)),
    industryRequested: optionalText(z.string().trim().max(80)),
    goals: z.array(z.enum(GOALS.map((g) => g.key) as [string, ...string[]])).min(1, 'Pick at least one').max(GOALS.length),
    modules: z.array(MODULE_KEY).max(20).default([]),
    heardFrom: optionalText(z.string().trim().max(60)),
    couponCode: optionalText(z.string().trim().toUpperCase().max(20)),
    termsAccepted: z.literal(true, { errorMap: () => ({ message: 'Please accept the Terms and Privacy Policy' }) }),
  })
  .superRefine((b, c) => {
    if (b.gstRegistered && !b.gstin) c.addIssue({ code: z.ZodIssueCode.custom, path: ['gstin'], message: 'Enter your GSTIN' });
    const mismatch = rules.gstinStateMismatch(b.gstin, b.stateCode) ?? (b.gstin ? rules.panTypeMismatch(b.gstin.slice(2, 12), b.businessType) : null);
    if (mismatch) c.addIssue({ code: z.ZodIssueCode.custom, path: ['gstin'], message: mismatch });
    if (b.industryKey === 'other' && (b.industryRequested ?? '').length < 3) c.addIssue({ code: z.ZodIssueCode.custom, path: ['industryRequested'], message: 'Tell us what your business does' });
  });
export type BusinessSignup = z.infer<typeof BusinessSignup>;

/** Map the signup answers onto createTenant() input. */
export function signupToTenant(b: BusinessSignup) {
  const industry = industryByKey(b.industryKey)!;
  const profile: WorkspaceProfile = {
    businessType: b.businessType,
    gstRegistered: b.gstRegistered,
    pan: b.gstin ? b.gstin.slice(2, 12) : null,
    teamSize: b.teamSize,
    branches: b.branches,
    subIndustry: b.subIndustry ?? null,
    industryRequested: industry.ready && b.industryKey !== 'other' ? null : (b.industryRequested ?? industry.name),
    goals: b.goals as WorkspaceProfile['goals'],
    modules: b.modules,
    heardFrom: b.heardFrom ?? null,
  };
  return {
    businessName: b.businessName,
    industryKey: industry.template,
    gstin: b.gstRegistered ? (b.gstin ?? undefined) : undefined,
    billingStateCode: b.stateCode,
    legalName: b.legalName ?? null,
    profile: { ...profile, industry: b.industryKey, composition: b.composition },
  };
}

const Prefix = z.string().trim().superRefine((v, c) => {
  const message = prefixError(v);
  if (message) c.addIssue({ code: z.ZodIssueCode.custom, message });
});

export const PREFERENCE_SCHEMAS = {
  documents: z.object({
    invoicePrefix: Prefix,
    quotationPrefix: Prefix,
    receiptPrefix: Prefix,
    template: z.enum(['classic', 'modern', 'compact']),
    paper: z.enum(['a4', '80mm']),
    terms: z.string().trim().max(2000, 'Keep terms under 2,000 characters'),
  }),
  payments: z
    .object({
      bankHolder: z.string().trim().max(120),
      bankAccount: z.string().transform((v) => v.replace(/\s/g, '')),
      ifsc: z.string().transform(rules.upperNoSpaces),
      upiId: z.string().trim(),
      showUpiQr: z.boolean(),
    })
    .superRefine((p, c) => {
      const any = p.bankHolder || p.bankAccount || p.ifsc;
      if (any) {
        if (!p.bankHolder) c.addIssue({ code: z.ZodIssueCode.custom, path: ['bankHolder'], message: 'Add the account holder name' });
        const acc = rules.bankAccount(p.bankAccount);
        if (acc) c.addIssue({ code: z.ZodIssueCode.custom, path: ['bankAccount'], message: acc });
        const ifsc = rules.ifsc(p.ifsc);
        if (ifsc) c.addIssue({ code: z.ZodIssueCode.custom, path: ['ifsc'], message: ifsc });
      }
      if (p.upiId) {
        const upi = rules.upiId(p.upiId);
        if (upi) c.addIssue({ code: z.ZodIssueCode.custom, path: ['upiId'], message: upi });
      }
      if (p.showUpiQr && !p.upiId) c.addIssue({ code: z.ZodIssueCode.custom, path: ['upiId'], message: 'Add a UPI ID to print the QR code' });
    }),
  taxes: z
    .object({
      composition: z.boolean(),
      compositionRateBp: z.union([z.literal(100), z.literal(500), z.literal(600)]).nullable(),
      pricesIncludeTax: z.boolean(),
      defaultGstRateBp: z.number().int().refine((v) => (GST_RATES_BP as readonly number[]).includes(v), 'Choose a valid GST rate'),
      hsnDigits: z.union([z.literal(4), z.literal(6)]),
      reverseCharge: z.boolean(),
    })
    .superRefine((t, c) => {
      if (t.composition && !t.compositionRateBp) c.addIssue({ code: z.ZodIssueCode.custom, path: ['compositionRateBp'], message: 'Choose your composition rate' });
    }),
  branding: z.object({
    brandColor: z.string().superRefine((v, c) => {
      const message = brandColorError(v);
      if (message) c.addIssue({ code: z.ZodIssueCode.custom, message });
    }),
    theme: z.enum(['light', 'dark', 'system']),
    font: z.enum(['inter', 'manrope', 'plex', 'source']),
    density: z.enum(['comfortable', 'compact']),
  }),
} satisfies Record<keyof WorkspacePreferences, z.ZodTypeAny>;
export type PreferenceSection = keyof typeof PREFERENCE_SCHEMAS;

export const readProfile = (t: { profile: unknown }) => (t.profile ?? {}) as WorkspaceProfile;
export const readSetup = (t: { onboarding: unknown }) => (((t.onboarding ?? {}) as { setup?: SetupState }).setup ?? { steps: {} }) as SetupState;

export async function getWorkspace(tenantId: string) {
  const t = await getTenant(tenantId);
  return { profile: readProfile(t), preferences: withDefaults(t.preferences), setup: readSetup(t) };
}

export async function updateProfile(tenantId: string, patch: z.infer<typeof ProfileInput>) {
  const t = await getTenant(tenantId);
  const before = readProfile(t);
  const profile = { ...before, ...patch };
  await db().tenant.update({ where: { id: tenantId }, data: { profile: profile as Prisma.InputJsonValue } });
  await audit({ action: 'tenant.profile.update', entity: 'tenant', entityId: tenantId, before, after: patch });
  return profile;
}

/** Replace one preferences section. Bank numbers are masked in the audit log. */
export async function updatePreferences<S extends PreferenceSection>(tenantId: string, section: S, input: unknown) {
  const parsed = PREFERENCE_SCHEMAS[section].safeParse(input);
  if (!parsed.success) {
    const fields: Record<string, string> = {};
    for (const issue of parsed.error.issues) fields[issue.path.join('.') || '_'] = issue.message;
    throw new AppError('VALIDATION_FAILED', 'Some fields are invalid.', { fields });
  }
  const t = await getTenant(tenantId);
  const prefs = withDefaults(t.preferences);
  const before = prefs[section];
  const next = { ...prefs, [section]: parsed.data } as WorkspacePreferences;
  await db().tenant.update({ where: { id: tenantId }, data: { preferences: next as unknown as Prisma.InputJsonValue } });
  const mask = (v: unknown) => (section === 'payments' ? { ...(v as object), bankAccount: String((v as { bankAccount?: string }).bankAccount ?? '').replace(/.(?=.{4})/g, '•') } : v);
  await audit({ action: `tenant.preferences.${section}`, entity: 'tenant', entityId: tenantId, before: mask(before), after: mask(parsed.data) });
  return next;
}

/**
 * Start the current FY's invoice series at `n` (businesses moving from another tool).
 * Only while no invoice has been numbered in this financial year.
 */
export async function setInvoiceStart(tenantId: string, n: number) {
  const t = await getTenant(tenantId);
  const fy = financialYear(new Date(), t.fyStartMonth);
  const prefs = withDefaults(t.preferences);
  const prefix = prefs.documents.invoicePrefix.replace(/\{FY\}/g, fy);
  const used = await db().$queryRaw<{ next_no: number }[]>`SELECT next_no FROM tenant_sequences WHERE tenant_id = ${tenantId}::uuid AND doc_type = 'invoice' AND fy = ${fy}`;
  if (used[0] && used[0].next_no > 1) {
    const message = `Invoices are already numbered this year (next is ${used[0].next_no}).`;
    throw new AppError('VALIDATION_FAILED', message, { fields: { invoiceStartAt: message } });
  }
  await db().$executeRaw`INSERT INTO tenant_sequences (tenant_id, doc_type, fy, prefix, next_no) VALUES (${tenantId}::uuid, 'invoice', ${fy}, ${prefix}, ${n})
    ON CONFLICT (tenant_id, doc_type, fy) DO UPDATE SET next_no = ${n}, prefix = ${prefix}`;
  await audit({ action: 'tenant.sequence.start', entity: 'tenant', entityId: tenantId, after: { docType: 'invoice', fy, startAt: n } });
}

// ── Setup wizard ──

const STEP_KEYS = SETUP_STEPS.map((s) => s.key) as [SetupStepKey, ...SetupStepKey[]];
export const SetupPatch = z.object({
  step: z.enum(STEP_KEYS).optional(),
  state: z.enum(['done', 'skipped']).optional(),
  action: z.enum(['defer', 'complete', 'dismiss_card', 'reopen']).optional(),
});

export async function updateSetup(tenantId: string, patch: z.infer<typeof SetupPatch>) {
  const t = await getTenant(tenantId);
  const setup: SetupState = { ...readSetup(t), steps: { ...readSetup(t).steps } };
  const now = new Date().toISOString();
  if (patch.step && patch.state) {
    // "skipped" never overwrites "done" (a step finished in Settings stays finished)
    if (!(patch.state === 'skipped' && setup.steps[patch.step] === 'done')) setup.steps[patch.step] = patch.state;
  }
  if (patch.action === 'defer') setup.deferredAt = now;
  if (patch.action === 'complete') setup.completedAt = now;
  if (patch.action === 'dismiss_card') setup.cardDismissedAt = now;
  if (patch.action === 'reopen') {
    setup.cardDismissedAt = null;
    setup.completedAt = null;
  }
  await db().$executeRaw`UPDATE tenants SET onboarding = onboarding || jsonb_build_object('setup', ${JSON.stringify(setup)}::jsonb) WHERE id = ${tenantId}::uuid`;
  return setup;
}

// ── Provisioning (loading screen) ──

/** Consumers of tenant.created, in the order the loading screen shows them. */
const PROVISIONING_CONSUMERS: { key: 'template' | 'catalog'; consumer: string }[] = [
  { key: 'template', consumer: 'config.apply-template' },
  { key: 'catalog', consumer: 'catalog.seed-template' },
];

export async function provisioningStatus(tenantId: string, labels: { template: string; catalog: string }): Promise<ProvisioningStatus> {
  return withPlatform(async () => {
    const evt = await db().outboxEvent.findFirst({ where: { tenantId, type: 'tenant.created' }, orderBy: { occurredAt: 'asc' } });
    const tenant = await db().tenant.findUniqueOrThrow({ where: { id: tenantId }, select: { createdAt: true, configAppliedAt: true } });
    const done = evt
      ? new Set((await db().processedEvent.findMany({ where: { eventId: evt.id, consumer: { in: PROVISIONING_CONSUMERS.map((c) => c.consumer) } } })).map((p) => p.consumer))
      : new Set<string>();
    // Tenants created before the outbox existed: treat as ready when config is applied
    const isDone = (key: 'template' | 'catalog') =>
      !evt ? !!tenant.configAppliedAt : done.has(PROVISIONING_CONSUMERS.find((c) => c.key === key)!.consumer) || (key === 'template' && !!tenant.configAppliedAt);
    const failed = !!evt?.lastError && !PROVISIONING_CONSUMERS.every((c) => isDone(c.key));
    const order = ['template', 'catalog'] as const;
    const firstOpen = order.find((k) => !isDone(k));

    const steps: ProvisioningStatus['steps'] = [
      { key: 'business', label: 'Creating your business', state: 'done' },
      { key: 'roles', label: 'Setting up roles and access', state: 'done' },
      ...order.map((k) => ({
        key: k,
        label: labels[k],
        state: isDone(k) ? ('done' as const) : k === firstOpen ? (failed ? ('failed' as const) : ('running' as const)) : ('waiting' as const),
      })),
    ];
    const ready = order.every(isDone);
    steps.push({ key: 'dashboard', label: 'Getting your dashboard ready', state: ready ? 'done' : 'waiting' });
    return {
      state: ready ? 'ready' : failed ? 'failed' : 'running',
      steps,
      reference: failed && evt ? `PRV-${evt.id.slice(-8).toUpperCase()}` : null,
      startedAt: tenant.createdAt.toISOString(),
    };
  });
}

/** Re-queue the tenant.created event; finished consumers are skipped (processed_events). */
export async function retryProvisioning(tenantId: string) {
  return withPlatform(async () => {
    const evt = await db().outboxEvent.findFirst({ where: { tenantId, type: 'tenant.created' }, orderBy: { occurredAt: 'asc' } });
    if (!evt) return { requeued: false };
    await db().outboxEvent.update({ where: { id: evt.id }, data: { publishedAt: null, attempts: 0, lastError: null } });
    return { requeued: true };
  });
}
