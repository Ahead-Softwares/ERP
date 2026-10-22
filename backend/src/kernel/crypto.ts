import { createHash, randomBytes, randomInt } from 'node:crypto';
import { hash, verify } from '@node-rs/argon2';
import { env } from '../config/env';

export const sha256 = (value: string) => createHash('sha256').update(value).digest('hex');

/** Peppered hash for lookups of normalised identifiers (trial registry, OTPs). */
export const pepperedHash = (value: string) => sha256(`${env.PEPPER}:${value}`);

export const randomToken = (bytes = 32) => randomBytes(bytes).toString('base64url');

export const otpCode = () => String(randomInt(0, 1_000_000)).padStart(6, '0');

export const hashPassword = (password: string) => hash(password); // Argon2id defaults

export const verifyPassword = (passwordHash: string, password: string) =>
  verify(passwordHash, password).catch(() => false);

export const normaliseEmail = (email: string) => email.trim().toLowerCase();

/** Normalise to E.164; bare 10-digit numbers are treated as Indian (+91). */
export function normaliseMobile(input: string): string {
  const digits = input.replace(/[\s\-()]/g, '');
  if (/^[6-9]\d{9}$/.test(digits)) return `+91${digits}`;
  if (/^91[6-9]\d{9}$/.test(digits)) return `+${digits}`;
  return digits;
}
