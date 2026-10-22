import { Router } from 'express';
import { z } from 'zod';
import { db, withPlatform } from '../../kernel/db';
import { AppError } from '../../kernel/errors';
import { hashPassword, normaliseEmail, normaliseMobile } from '../../kernel/crypto';
import { validate } from '../../middleware/request';
import { authenticate, publicRoute } from '../../middleware/auth';
import { loginLimiter, otpLimiter } from '../../middleware/rateLimit';
import { getMember } from '../access/service';
import { createTenant } from '../tenancy/createTenant';
import { audit } from '../audit/service';
import { consumeOtp, sendOtp } from './otp';
import { REFRESH_COOKIE, clearRefreshCookie, rotateSession, signAccessToken, signPurposeToken, startSession, verifyPurposeToken } from './tokens';
import { buildMe, checkPassword, completeLogin, sendEmailVerification, setPassword } from './service';

const router = Router();

const Mobile = z.string().trim().transform(normaliseMobile).pipe(z.string().regex(/^\+[1-9]\d{7,14}$/, 'Enter a valid mobile number'));
const Email = z.string().trim().email('Enter a valid email').transform(normaliseEmail);
const Password = z.string().min(8, 'Use at least 8 characters').max(128);
const Target = z.string().trim().min(3).transform((v) => (v.includes('@') ? normaliseEmail(v) : normaliseMobile(v)));

// ── OTP ──

router.post(
  '/otp/send',
  publicRoute,
  otpLimiter,
  validate(z.object({ target: Target, purpose: z.enum(['signup', 'login', 'reset', 'invite']) })),
  async (req, res) => {
    const { target, purpose } = req.body as { target: string; purpose: 'signup' | 'login' | 'reset' | 'invite' };
    const result = await withPlatform(async () => {
      const existing = await db().user.findFirst({ where: target.includes('@') ? { email: target } : { mobile: target } });
      if ((purpose === 'signup' || purpose === 'invite') && target.includes('@')) throw new AppError('VALIDATION_FAILED', 'Use a mobile number.', { fields: { target: 'Use a mobile number' } });
      if (purpose === 'signup' && existing) throw new AppError('MOBILE_TAKEN', 'An account with this mobile number already exists. Please sign in.');
      // login/reset: never reveal whether the account exists
      if ((purpose === 'login' || purpose === 'reset') && !existing) return { channel: target.includes('@') ? 'email' : 'sms' };
      return sendOtp(target, purpose);
    });
    res.json({ sent: true, ...result });
  },
);

router.post(
  '/otp/verify',
  publicRoute,
  otpLimiter,
  validate(z.object({ target: Mobile, purpose: z.enum(['signup', 'invite']), code: z.string().regex(/^\d{6}$/, 'Enter the 6-digit code') })),
  async (req, res) => {
    const { target, purpose, code } = req.body;
    const otpId = await withPlatform(() => consumeOtp(target, purpose, code));
    const verificationToken = signPurposeToken('mobile_verified', { mobile: target, otpId, purpose }, 10 * 60);
    res.json({ verificationToken });
  },
);

// ── Signup (ONB-02: only six fields) ──

const SignupBody = z.object({
  name: z.string().trim().min(2).max(100),
  email: Email,
  mobile: Mobile,
  password: Password,
  businessName: z.string().trim().min(2).max(120),
  industryKey: z.string().min(2),
  mobileVerificationToken: z.string().min(10),
  couponCode: z.string().trim().max(20).optional(),
});

router.post('/signup', publicRoute, loginLimiter, validate(SignupBody), async (req, res) => {
  const body = req.body as z.infer<typeof SignupBody>;
  const proof = verifyPurposeToken<{ mobile: string; otpId: string; purpose: string }>('mobile_verified', body.mobileVerificationToken);
  if (proof.mobile !== body.mobile || proof.purpose !== 'signup') throw new AppError('OTP_TOKEN_INVALID', 'Please verify your mobile number again.');
  const passwordHash = await hashPassword(body.password);

  const result = await withPlatform(async () => {
    // Single use: the OTP row is deleted when the token is redeemed
    const used = await db().otpCode.deleteMany({ where: { id: proof.otpId, consumedAt: { not: null } } });
    if (!used.count) throw new AppError('OTP_TOKEN_INVALID', 'Please verify your mobile number again.');
    const created = await createTenant({
      owner: { kind: 'new', name: body.name, email: body.email, mobile: body.mobile, passwordHash, mobileVerified: true },
      businessName: body.businessName,
      industryKey: body.industryKey,
      source: 'direct', // vendor attribution by coupon/link arrives with the referral module
    });
    const accessToken = await startSession(req, res, created.user.id, created.tenant.id, created.ownerRoleId);
    await sendEmailVerification(created.user);
    return { ...created, accessToken };
  });

  res.status(201).json({
    user: { id: result.user.id, name: result.user.name, emailVerified: false },
    tenant: { id: result.tenant.id, name: result.tenant.name, status: result.tenant.status, trialEndsAt: result.subscription.trialEndsAt },
    accessToken: result.accessToken,
  });
});

// ── Login ──

const LoginBody = z.union([
  z.object({ identifier: z.string().trim().min(3), password: z.string().min(1) }),
  z.object({ mobile: Mobile, otp: z.string().regex(/^\d{6}$/) }),
]);

router.post('/login', publicRoute, loginLimiter, validate(LoginBody), async (req, res) => {
  const body = req.body as z.infer<typeof LoginBody>;
  const out = await withPlatform(async () => {
    let userId: string;
    if ('password' in body) {
      const id = body.identifier.includes('@') ? { email: normaliseEmail(body.identifier) } : { mobile: normaliseMobile(body.identifier) };
      userId = (await checkPassword(id, body.password)).id;
    } else {
      const user = await db().user.findUnique({ where: { mobile: body.mobile } });
      if (!user) throw new AppError('INVALID_CREDENTIALS', 'Incorrect mobile number or code.');
      await consumeOtp(body.mobile, 'login', body.otp);
      userId = user.id;
    }
    return completeLogin(req, res, userId, 'password' in body ? 'password' : 'otp');
  });
  res.json(out);
});

router.post('/refresh', publicRoute, async (req, res) => {
  const refresh = req.cookies?.[REFRESH_COOKIE];
  if (!refresh) throw new AppError('UNAUTHENTICATED', 'Please sign in.');
  const accessToken = await withPlatform(async () => {
    const session = await rotateSession(req, res, refresh);
    let tenantId = session.tenantId;
    let roleId: string | null = null;
    if (tenantId) {
      const member = await getMember(tenantId, session.userId);
      if (member?.status === 'active') roleId = member.roleId;
      else tenantId = null;
    }
    return signAccessToken({ sub: session.userId, tid: tenantId, rid: roleId, sid: session.id });
  }).catch((e) => {
    clearRefreshCookie(res);
    throw e;
  });
  res.json({ accessToken });
});

router.post('/logout', authenticate, async (req, res) => {
  await withPlatform(() => db().userSession.updateMany({ where: { id: req.auth!.sid, revokedAt: null }, data: { revokedAt: new Date() } }));
  clearRefreshCookie(res);
  res.status(204).end();
});

router.post('/switch-tenant', authenticate, validate(z.object({ tenantId: z.string().uuid() })), async (req, res) => {
  const { tenantId } = req.body;
  const member = await getMember(tenantId, req.auth!.sub);
  if (!member || member.status !== 'active') throw new AppError('TENANT_FORBIDDEN', 'You are not a member of this business.');
  await withPlatform(async () => {
    await db().userSession.update({ where: { id: req.auth!.sid }, data: { tenantId } });
    await db().user.update({ where: { id: req.auth!.sub }, data: { lastTenantId: tenantId } });
  });
  res.json({ accessToken: signAccessToken({ sub: req.auth!.sub, tid: tenantId, rid: member.roleId, sid: req.auth!.sid }) });
});

// ── Email verification & password reset ──

router.post('/email/verify', publicRoute, validate(z.object({ token: z.string().min(10) })), async (req, res) => {
  const p = verifyPurposeToken<{ sub: string; email: string }>('email_verify', req.body.token);
  await withPlatform(async () => {
    const user = await db().user.findUnique({ where: { id: p.sub } });
    if (!user || user.email !== p.email) throw new AppError('OTP_TOKEN_INVALID', 'This link is no longer valid.');
    if (!user.emailVerifiedAt) await db().user.update({ where: { id: user.id }, data: { emailVerifiedAt: new Date() } });
  });
  res.json({ verified: true });
});

router.post('/email/resend', authenticate, otpLimiter, async (req, res) => {
  await withPlatform(async () => {
    const user = await db().user.findUniqueOrThrow({ where: { id: req.auth!.sub } });
    if (!user.emailVerifiedAt) await sendEmailVerification(user);
  });
  res.json({ sent: true });
});

router.post(
  '/password/reset',
  publicRoute,
  otpLimiter,
  validate(z.object({ target: Target, code: z.string().regex(/^\d{6}$/), password: Password })),
  async (req, res) => {
    const { target, code, password } = req.body;
    await withPlatform(async () => {
      const user = await db().user.findFirst({ where: target.includes('@') ? { email: target } : { mobile: target } });
      if (!user) throw new AppError('OTP_INVALID', 'The code is incorrect.');
      await consumeOtp(target, 'reset', code);
      await setPassword(user.id, password);
      await db().userSession.updateMany({ where: { userId: user.id, revokedAt: null }, data: { revokedAt: new Date() } });
      await audit({ tenantId: null, actorId: user.id, action: 'auth.password_reset' });
    });
    res.json({ reset: true });
  },
);

export const meHandler = Router().get('/', authenticate, async (req, res) => {
  res.json(await buildMe(req.auth!.sub, req.auth!.tid));
});

export default router;
