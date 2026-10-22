import type { TenantSource } from '@prisma/client';
import { env } from '../../config/env';
import { db } from '../../kernel/db';
import { AppError } from '../../kernel/errors';
import { pepperedHash } from '../../kernel/crypto';
import { templateByKey } from '../../contracts/templates';
import { TRIAL_PLAN_KEY } from '../../contracts/plans';
import { persistEntitlements } from '../subscription/entitlements';
import { publish } from '../events/outbox';
import { audit } from '../audit/service';

// ONB-01: every channel (self-signup, vendor link/code, Super Admin, partner) calls this one service.

export interface CreateTenantInput {
  owner:
    | { kind: 'new'; name: string; email: string; mobile: string; passwordHash: string | null; mobileVerified: boolean; emailVerified?: boolean }
    | { kind: 'existing'; userId: string };
  businessName: string;
  industryKey: string;
  source: TenantSource;
  partnerId?: string;
  gstin?: string;
}

/** End of the trial's last day in IST (e.g. 2026-11-06T18:29:59Z). */
export function trialEnd(from: Date, days = env.TRIAL_DAYS) {
  const IST_OFFSET = 330 * 60 * 1000;
  const ist = new Date(from.getTime() + IST_OFFSET + days * 86_400_000);
  ist.setUTCHours(23, 59, 59, 0);
  return new Date(ist.getTime() - IST_OFFSET);
}

/** Must run inside withPlatform(). */
export async function createTenant(input: CreateTenantInput) {
  const tx = db();
  const template = templateByKey(input.industryKey);
  if (!template) throw new AppError('VALIDATION_FAILED', 'Unknown industry.', { fields: { industryKey: 'Unknown industry' } });

  // Resolve owner identity
  let user;
  if (input.owner.kind === 'existing') {
    user = await tx.user.findUniqueOrThrow({ where: { id: input.owner.userId } });
  } else {
    const o = input.owner;
    if (await tx.user.findUnique({ where: { email: o.email } })) throw new AppError('EMAIL_TAKEN', 'An account with this email already exists. Please sign in.');
    if (await tx.user.findUnique({ where: { mobile: o.mobile } })) throw new AppError('MOBILE_TAKEN', 'An account with this mobile number already exists. Please sign in.');
    user = await tx.user.create({
      data: {
        name: o.name,
        email: o.email,
        mobile: o.mobile,
        passwordHash: o.passwordHash,
        mobileVerifiedAt: o.mobileVerified ? new Date() : null,
        emailVerifiedAt: o.emailVerified ? new Date() : null,
      },
    });
  }

  // ONB-03: one trial per business (mobile, email, GSTIN)
  const mobileHash = pepperedHash(user.mobile);
  const emailHash = pepperedHash(user.email);
  const gstin = input.gstin?.toUpperCase();
  if (input.source === 'direct' || input.source === 'vendor') {
    const dup = await tx.trialRegistry.findFirst({
      where: { OR: [{ mobileHash }, { emailHash }, ...(gstin ? [{ gstin }] : [])] },
    });
    if (dup) throw new AppError('DUPLICATE_TRIAL', 'A free trial has already been used with these details.');
  }

  const now = new Date();
  const tenant = await tx.tenant.create({
    data: {
      name: input.businessName,
      industryKey: template.key,
      templateVersion: template.version,
      status: 'trialing',
      source: input.source,
      partnerId: input.partnerId,
      billingOwner: input.partnerId ? 'partner' : 'self',
      gstin,
      ownerUserId: user.id,
    },
  });

  const branch = await tx.branch.create({ data: { tenantId: tenant.id, name: 'Main Branch', code: 'MAIN', isDefault: true } });

  const trialPlan = await tx.plan.findUniqueOrThrow({ where: { key: TRIAL_PLAN_KEY } });
  const subscription = await tx.subscription.create({
    data: { tenantId: tenant.id, planId: trialPlan.id, status: 'trialing', trialEndsAt: trialEnd(now) },
  });

  const ownerRole = await tx.role.findFirstOrThrow({ where: { tenantId: null, key: 'owner' } });
  await tx.tenantMember.create({
    data: { tenantId: tenant.id, userId: user.id, roleId: ownerRole.id, status: 'active', joinedAt: now },
  });

  await tx.trialRegistry.create({ data: { tenantId: tenant.id, mobileHash, emailHash, gstin } });
  await tx.user.update({ where: { id: user.id }, data: { lastTenantId: tenant.id } });
  await persistEntitlements(tenant.id);

  await publish(
    'tenant.created',
    { tenantId: tenant.id, source: input.source, partnerId: input.partnerId ?? null, industryKey: template.key, ownerUserId: user.id },
    { tenantId: tenant.id },
  );
  await audit({ tenantId: tenant.id, actorId: user.id, action: 'tenant.created', entity: 'tenant', entityId: tenant.id, after: { name: tenant.name, source: input.source } });

  return { user, tenant, branch, subscription, ownerRoleId: ownerRole.id };
}
