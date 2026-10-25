import type { Request } from 'express';
import { prisma } from '../../kernel/db';

// Sign-in history (My account › Security and Settings › Users & security). Written with the
// owner client outside the request transaction, so failed attempts are kept when the
// transaction rolls back.

export type SignInOutcome = 'success' | 'wrong_password' | 'locked' | 'mfa_challenge' | 'mfa_failed' | 'mfa_locked' | 'blocked_ip' | 'expired_password' | 'unknown_account';

const mask = (id: string) => (id.includes('@') ? id.replace(/^(.{2})[^@]*(@.*)$/, '$1•••$2') : id.replace(/\d(?=\d{3})/g, '•'));

export async function logSignIn(req: Request, e: { userId?: string | null; tenantId?: string | null; identifier?: string; outcome: SignInOutcome; method?: string }) {
  try {
    await prisma.signInEvent.create({
      data: {
        userId: e.userId ?? null,
        tenantId: e.tenantId ?? null,
        identifier: e.identifier ? (e.userId ? e.identifier : mask(e.identifier)) : null,
        outcome: e.outcome,
        method: e.method,
        ip: req.ip,
        userAgent: req.header('user-agent')?.slice(0, 300),
      },
    });
  } catch (err) {
    console.warn('sign-in event not recorded', err);
  }
}

/** "Chrome · Windows" from a user agent. */
export function deviceLabel(ua: string | null | undefined) {
  if (!ua) return 'Unknown device';
  const browser = /Edg\//.test(ua) ? 'Edge' : /OPR\//.test(ua) ? 'Opera' : /Firefox\//.test(ua) ? 'Firefox' : /Chrome\//.test(ua) ? 'Chrome' : /Safari\//.test(ua) ? 'Safari' : /curl|node|undici/i.test(ua) ? 'API client' : 'Browser';
  const os = /iPhone/.test(ua) ? 'iPhone' : /iPad/.test(ua) ? 'iPad' : /Android/.test(ua) ? 'Android' : /Windows/.test(ua) ? 'Windows' : /Mac OS X/.test(ua) ? 'Mac' : /Linux/.test(ua) ? 'Linux' : '';
  return os ? `${browser} · ${os}` : browser;
}
