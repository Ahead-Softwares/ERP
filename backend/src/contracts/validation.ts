// Field rules shared by the API (wrapped in Zod, see kernel/zodRules.ts) and the web app
// (frontend imports this file through the `@contracts/*` alias). Keep it dependency-free:
// plain functions that return an error message, or null when the value is fine.

export type Rule<T = string> = (value: T) => string | null;

export const GST_STATES: [string, string][] = [
  ['01', 'Jammu & Kashmir'], ['02', 'Himachal Pradesh'], ['03', 'Punjab'], ['04', 'Chandigarh'], ['05', 'Uttarakhand'],
  ['06', 'Haryana'], ['07', 'Delhi'], ['08', 'Rajasthan'], ['09', 'Uttar Pradesh'], ['10', 'Bihar'], ['11', 'Sikkim'],
  ['12', 'Arunachal Pradesh'], ['13', 'Nagaland'], ['14', 'Manipur'], ['15', 'Mizoram'], ['16', 'Tripura'], ['17', 'Meghalaya'],
  ['18', 'Assam'], ['19', 'West Bengal'], ['20', 'Jharkhand'], ['21', 'Odisha'], ['22', 'Chhattisgarh'], ['23', 'Madhya Pradesh'],
  ['24', 'Gujarat'], ['26', 'Dadra & Nagar Haveli and Daman & Diu'], ['27', 'Maharashtra'], ['29', 'Karnataka'], ['30', 'Goa'],
  ['31', 'Lakshadweep'], ['32', 'Kerala'], ['33', 'Tamil Nadu'], ['34', 'Puducherry'], ['35', 'Andaman & Nicobar Islands'],
  ['36', 'Telangana'], ['37', 'Andhra Pradesh'], ['38', 'Ladakh'], ['97', 'Other Territory'],
];
const STATE_NAMES = new Map(GST_STATES);
export const stateName = (code: string | null | undefined) => (code ? STATE_NAMES.get(code) ?? null : null);

// ---------------------------------------------------------------------------
// Clean-up applied on blur (web) and before validation (API)
// ---------------------------------------------------------------------------

export const squish = (v: string) => v.trim().replace(/\s+/g, ' ');
export const upperNoSpaces = (v: string) => v.replace(/\s+/g, '').toUpperCase();

/** Indian mobile → 10 digits (drops spaces, dashes, +91, 91 or a leading 0). Anything else is returned as typed. */
export function cleanMobile(v: string): string {
  const d = v.replace(/[\s\-().]/g, '');
  const m = /^(?:\+?91|0)?([6-9]\d{9})$/.exec(d);
  return m ? m[1] : d;
}

// ---------------------------------------------------------------------------
// Rules
// ---------------------------------------------------------------------------

export const required = (label = 'This field'): Rule<string | null | undefined> => (v) => (v == null || String(v).trim() === '' ? `${label} is required` : null);

export const length = (min: number, max: number, label = 'This field'): Rule => (v) => {
  const n = v.trim().length;
  if (n < min) return `${label} needs at least ${min} characters`;
  if (n > max) return `${label} can be up to ${max.toLocaleString('en-IN')} characters`;
  return null;
};

// Built at runtime: the web app compiles for ES2017, which can't parse \p{…} literals
const NAME_CHARS = new RegExp("^[\\p{L} .'-]+$", 'u');

export const personName: Rule = (v) => {
  const s = squish(v);
  if (s.length < 2) return 'Enter at least 2 letters';
  if (s.length > 60) return 'Keep the name under 60 characters';
  if (!NAME_CHARS.test(s)) return 'Use letters, spaces, dots and apostrophes only';
  return null;
};

export const mobileIN: Rule = (v) => (/^[6-9]\d{9}$/.test(cleanMobile(v)) ? null : 'Enter a 10-digit mobile number starting with 6, 7, 8 or 9');

/** Customer phone: an Indian mobile, or any number written with its country code (+44 …). */
export const phone: Rule = (v) => {
  const d = cleanMobile(v);
  if (/^[6-9]\d{9}$/.test(d) || /^\+[1-9]\d{7,14}$/.test(d)) return null;
  return 'Enter a 10-digit mobile, or a number with its country code (e.g. +44 20 7946 0958)';
};
/** Stored form of a valid phone: +91XXXXXXXXXX for Indian mobiles, otherwise as typed without spaces. */
export const storedPhone = (v: string) => {
  const d = cleanMobile(v);
  return /^[6-9]\d{9}$/.test(d) ? `+91${d}` : d;
};

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
export const email: Rule = (v) => (EMAIL.test(v.trim()) && v.trim().length <= 254 ? null : 'Enter a valid email address');

const MAIL_DOMAINS = ['gmail.com', 'yahoo.com', 'yahoo.co.in', 'hotmail.com', 'outlook.com', 'rediffmail.com', 'icloud.com', 'live.com'];

function distance(a: string, b: string) {
  const dp = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array<number>(b.length).fill(0)]);
  for (let j = 1; j <= b.length; j++) dp[0][j] = j;
  for (let i = 1; i <= a.length; i++)
    for (let j = 1; j <= b.length; j++) dp[i][j] = Math.min(dp[i - 1][j] + 1, dp[i][j - 1] + 1, dp[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
  return dp[a.length][b.length];
}

/** "rohan@gmial.com" → "rohan@gmail.com"; null when the domain looks fine. */
export function emailSuggestion(v: string): string | null {
  const [user, domain] = v.trim().toLowerCase().split('@');
  if (!user || !domain || MAIL_DOMAINS.includes(domain)) return null;
  const close = MAIL_DOMAINS.find((d) => distance(domain, d) <= 2);
  return close ? `${user}@${close}` : null;
}

export const password: Rule = (v) => {
  if (v.length < 8) return 'Use at least 8 characters';
  if (v.length > 64) return 'Use up to 64 characters';
  if (!/[A-Za-z]/.test(v) || !/\d/.test(v)) return 'Use at least one letter and one number';
  return null;
};

/** 0–4 for the strength meter: length, mixed case, digits, symbols. */
export function passwordStrength(v: string): 0 | 1 | 2 | 3 | 4 {
  if (!v) return 0;
  let s = 0;
  if (v.length >= 8) s++;
  if (v.length >= 12) s++;
  if (/[a-z]/.test(v) && /[A-Z]/.test(v)) s++;
  if (/\d/.test(v) && /[^A-Za-z0-9]/.test(v)) s++;
  return Math.max(1, Math.min(4, s)) as 1 | 2 | 3 | 4;
}

const GSTIN_CHARS = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ';
const GSTIN_SHAPE = /^\d{2}[A-Z]{5}\d{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/;

/** The 15th GSTIN character (mod-36 check digit over the first 14). */
export function gstinCheckChar(first14: string): string {
  let sum = 0;
  for (let i = 0; i < 14; i++) {
    const product = GSTIN_CHARS.indexOf(first14[i]) * (i % 2 === 0 ? 1 : 2);
    sum += Math.floor(product / 36) + (product % 36);
  }
  return GSTIN_CHARS[(36 - (sum % 36)) % 36];
}

export const gstin: Rule = (raw) => {
  const v = upperNoSpaces(raw);
  if (v.length !== 15) return 'GSTIN has 15 characters';
  if (!GSTIN_SHAPE.test(v)) return 'This doesn\'t look like a GSTIN (e.g. 27ABCDE1234F1Z5)';
  if (!STATE_NAMES.has(v.slice(0, 2))) return 'The first two digits are not a GST state code';
  if (gstinCheckChar(v.slice(0, 14)) !== v[14]) return 'Check the GSTIN — the last character doesn\'t match';
  return null;
};

/** GSTIN digits 1–2 must equal the business state. */
export function gstinStateMismatch(gstinValue: string | null | undefined, stateCode: string | null | undefined): string | null {
  if (!gstinValue || !stateCode) return null;
  const code = upperNoSpaces(gstinValue).slice(0, 2);
  if (code === stateCode) return null;
  return `This GSTIN belongs to ${stateName(code) ?? `state ${code}`}, but the state is ${stateName(stateCode) ?? stateCode}`;
}

export type BusinessType = 'proprietor' | 'partnership' | 'llp' | 'private_ltd' | 'public_ltd' | 'trust' | 'other';
export const BUSINESS_TYPES: { key: BusinessType; label: string }[] = [
  { key: 'proprietor', label: 'Proprietor' },
  { key: 'partnership', label: 'Partnership' },
  { key: 'llp', label: 'LLP' },
  { key: 'private_ltd', label: 'Private Ltd' },
  { key: 'public_ltd', label: 'Public Ltd' },
  { key: 'trust', label: 'Trust / NGO' },
  { key: 'other', label: 'Other' },
];
// 4th PAN character = holder type (P person, F firm/LLP, C company, T trust …)
const PAN_HOLDER: Partial<Record<BusinessType, string>> = { proprietor: 'P', partnership: 'F', llp: 'F', private_ltd: 'C', public_ltd: 'C', trust: 'T' };

export const pan: Rule = (raw) => (/^[A-Z]{5}\d{4}[A-Z]$/.test(upperNoSpaces(raw)) ? null : 'PAN has 10 characters, e.g. ABCDE1234F');

export function panTypeMismatch(panValue: string | null | undefined, type: BusinessType | null | undefined): string | null {
  if (!panValue || !type || !PAN_HOLDER[type]) return null;
  const holder = upperNoSpaces(panValue)[3];
  return holder === PAN_HOLDER[type] ? null : `For a ${BUSINESS_TYPES.find((t) => t.key === type)?.label} the 4th letter of the PAN is ${PAN_HOLDER[type]}`;
}

export const tan: Rule = (raw) => (/^[A-Z]{4}\d{5}[A-Z]$/.test(upperNoSpaces(raw)) ? null : 'TAN has 10 characters, e.g. MUMA12345B');
export const ifsc: Rule = (raw) => (/^[A-Z]{4}0[A-Z0-9]{6}$/.test(upperNoSpaces(raw)) ? null : 'IFSC has 11 characters, e.g. HDFC0001234');
export const pincode: Rule = (v) => (/^[1-9]\d{5}$/.test(v.trim()) ? null : 'PIN code has 6 digits');
export const bankAccount: Rule = (v) => (/^\d{9,18}$/.test(v.replace(/\s/g, '')) ? null : 'Account number has 9 to 18 digits');
export const upiId: Rule = (v) => (/^[a-zA-Z0-9.\-_]{2,256}@[a-zA-Z]{2,64}$/.test(v.trim()) ? null : 'Enter a UPI ID like name@bank');
export const hsn: Rule = (v) => (/^(\d{4}|\d{6}|\d{8})$/.test(v.trim()) ? null : 'HSN has 4, 6 or 8 digits');
export const sac: Rule = (v) => (/^99\d{4}$/.test(v.trim()) ? null : 'SAC has 6 digits and starts with 99');
export const url: Rule = (v) => {
  try {
    const u = new URL(v.trim());
    return u.protocol === 'https:' || u.protocol === 'http:' ? null : 'Use a link that starts with https://';
  } catch {
    return 'Enter a full link, e.g. https://example.com';
  }
};

export const percent: Rule<number> = (v) => (Number.isFinite(v) && v >= 0 && v <= 100 ? null : 'Enter a value between 0 and 100');

/** YYYY-MM-DD that exists on the calendar (rejects 2026-02-31). */
export const isoDate: Rule = (v) => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(v)) return 'Use a valid date';
  const d = new Date(`${v}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === v ? null : 'This date doesn\'t exist';
};

/** Today in India time as YYYY-MM-DD (dates are compared as strings). */
export const todayInIndia = () => new Date(Date.now() + 330 * 60_000).toISOString().slice(0, 10);
export const notFutureDate: Rule = (v) => isoDate(v) ?? (v > todayInIndia() ? 'This date can\'t be in the future' : null);

/** Reason kept in the audit log for sensitive changes. */
export const changeReason: Rule = (v) => length(10, 500, 'The reason')(v);

/** Run rules in order and return the first message. */
export function firstError<T>(value: T, ...rules: Rule<T>[]): string | null {
  for (const r of rules) {
    const m = r(value);
    if (m) return m;
  }
  return null;
}
