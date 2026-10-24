// Workspace profile, preferences and setup-wizard contract (Phase 1). Dependency-free so
// the web app imports the same option lists and defaults (`@contracts/workspace`); the API
// validates with Zod in modules/tenancy/workspace.ts.

import type { BusinessType } from './validation';

export const TEAM_SIZES = ['just_me', '2_5', '6_20', '21_50', '51_plus'] as const;
export type TeamSize = (typeof TEAM_SIZES)[number];
export const TEAM_SIZE_LABEL: Record<TeamSize, string> = { just_me: 'Just me', '2_5': '2–5 people', '6_20': '6–20 people', '21_50': '21–50 people', '51_plus': '51+ people' };

export const BRANCH_BANDS = ['1', '2_5', '6_20', '21_plus'] as const;
export type BranchBand = (typeof BRANCH_BANDS)[number];
export const BRANCH_BAND_LABEL: Record<BranchBand, string> = { '1': '1 location', '2_5': '2–5 locations', '6_20': '6–20 locations', '21_plus': '21+ locations' };

export const GOALS = [
  { key: 'billing', label: 'Billing & GST invoices', description: 'Invoices, receipts, dues', modules: ['billing', 'catalog'] },
  { key: 'bookings', label: 'Appointments', description: 'Calendar, no double booking', modules: ['bookings'] },
  { key: 'customers', label: 'Customers', description: 'Contacts, follow-ups', modules: ['crm'] },
  { key: 'stock', label: 'Stock & purchases', description: 'Products, suppliers', modules: ['inventory', 'catalog'] },
  { key: 'staff', label: 'Staff & payroll', description: 'Attendance, salary', modules: ['hr'] },
  { key: 'accounts', label: 'Expenses & accounts', description: 'Spends, P&L', modules: ['finance'] },
  { key: 'quotes', label: 'Quotations & orders', description: 'Quotes → invoices', modules: ['sales', 'catalog'] },
  { key: 'tasks', label: 'Tasks & team work', description: 'To-dos, checklists', modules: ['tasks'] },
  { key: 'support', label: 'Customer support', description: 'Tickets, complaints', modules: ['support'] },
] as const;
export type GoalKey = (typeof GOALS)[number]['key'];

/**
 * Industries offered at signup. `template` is the industry template applied today; an
 * industry without its own template yet (`ready: false`) starts on the closest one and the
 * choice is kept in the profile for the product team.
 */
export const INDUSTRY_GROUPS = ['Retail & trade', 'Health & wellness', 'Food & hospitality', 'Services', 'Education', 'Manufacturing & construction', 'Other'] as const;
export const INDUSTRIES: { key: string; name: string; group: (typeof INDUSTRY_GROUPS)[number]; template: string; ready: boolean; sub: string[]; keywords?: string }[] = [
  { key: 'retail', name: 'Retail store', group: 'Retail & trade', template: 'retail', ready: true, sub: ['Kirana / grocery', 'Supermarket', 'Stationery', 'Gift shop', 'Hardware store', 'Furniture'], keywords: 'shop kirana grocery general store' },
  { key: 'wholesale', name: 'Wholesale & distribution', group: 'Retail & trade', template: 'retail', ready: false, sub: ['FMCG distributor', 'Stockist', 'Trader', 'Import / export'], keywords: 'distributor trader stockist' },
  { key: 'pharmacy', name: 'Pharmacy', group: 'Retail & trade', template: 'pharmacy', ready: true, sub: ['Retail chemist', 'Wholesale chemist', 'Ayurvedic store'], keywords: 'chemist medical medicine' },
  { key: 'apparel', name: 'Apparel & footwear', group: 'Retail & trade', template: 'retail', ready: false, sub: ['Clothing store', 'Boutique', 'Footwear', 'Textiles'], keywords: 'clothes garments boutique shoes' },
  { key: 'electronics', name: 'Electronics & mobiles', group: 'Retail & trade', template: 'retail', ready: false, sub: ['Mobile shop', 'Electronics store', 'Computer shop', 'Repair centre'], keywords: 'mobile phone laptop' },
  { key: 'jewellery', name: 'Jewellery', group: 'Retail & trade', template: 'retail', ready: false, sub: ['Gold & silver', 'Imitation jewellery', 'Diamonds'], keywords: 'gold jeweller' },
  { key: 'optical', name: 'Optical store', group: 'Retail & trade', template: 'retail', ready: false, sub: ['Spectacles', 'Contact lenses'], keywords: 'glasses spectacles' },
  { key: 'salon', name: 'Salon & spa', group: 'Health & wellness', template: 'salon', ready: true, sub: ['Unisex salon', 'Ladies salon / parlour', "Men's barber", 'Spa', 'Bridal studio', 'Nail / lash studio'], keywords: 'parlour beauty barber' },
  { key: 'gym', name: 'Gym & fitness', group: 'Health & wellness', template: 'gym', ready: true, sub: ['Gym', 'Yoga studio', 'Dance studio', 'CrossFit / boxing', 'Sports academy'], keywords: 'fitness yoga' },
  { key: 'clinic', name: 'Clinic', group: 'Health & wellness', template: 'services', ready: false, sub: ['General physician', 'Dental', 'Physiotherapy', 'Skin / hair clinic', 'Veterinary'], keywords: 'doctor hospital dental' },
  { key: 'lab', name: 'Diagnostic lab', group: 'Health & wellness', template: 'services', ready: false, sub: ['Pathology', 'Imaging'], keywords: 'pathology test' },
  { key: 'restaurant', name: 'Restaurant & café', group: 'Food & hospitality', template: 'retail', ready: false, sub: ['Restaurant', 'Café', 'Cloud kitchen', 'Bakery', 'Sweet shop'], keywords: 'food cafe hotel kitchen' },
  { key: 'hotel', name: 'Hotel & homestay', group: 'Food & hospitality', template: 'services', ready: false, sub: ['Hotel', 'Homestay', 'Resort', 'PG / hostel'], keywords: 'rooms lodge' },
  { key: 'services', name: 'Service company', group: 'Services', template: 'services', ready: true, sub: ['Agency', 'IT services', 'Consulting', 'Facility services', 'Events'], keywords: 'agency consulting' },
  { key: 'professional', name: 'CA / legal / consulting', group: 'Services', template: 'services', ready: false, sub: ['Chartered accountant', 'Law firm', 'Tax consultant'], keywords: 'ca accountant lawyer' },
  { key: 'repairs', name: 'Repairs & field service', group: 'Services', template: 'services', ready: false, sub: ['AC / appliance service', 'Automobile garage', 'Pest control', 'AMC contractor'], keywords: 'garage service amc' },
  { key: 'travel', name: 'Travel agency', group: 'Services', template: 'services', ready: false, sub: ['Tours', 'Ticketing', 'Visa services'], keywords: 'tour' },
  { key: 'logistics', name: 'Logistics & transport', group: 'Services', template: 'services', ready: false, sub: ['Transporter', 'Courier', 'Packers & movers'], keywords: 'transport courier' },
  { key: 'school', name: 'Coaching / school', group: 'Education', template: 'school', ready: true, sub: ['Coaching institute', 'School', 'Pre-school', 'Training centre', 'Music / art classes'], keywords: 'tuition classes institute' },
  { key: 'manufacturing', name: 'Manufacturing', group: 'Manufacturing & construction', template: 'retail', ready: false, sub: ['Food processing', 'Garments', 'Engineering', 'Plastics', 'Printing'], keywords: 'factory production' },
  { key: 'construction', name: 'Construction & real estate', group: 'Manufacturing & construction', template: 'services', ready: false, sub: ['Builder', 'Contractor', 'Interior design', 'Real estate agent'], keywords: 'builder contractor property' },
  { key: 'ngo', name: 'NGO / trust', group: 'Other', template: 'services', ready: false, sub: ['Charitable trust', 'Society', 'Section 8 company'], keywords: 'charity donation' },
  { key: 'other', name: 'Other', group: 'Other', template: 'services', ready: true, sub: [] },
];
export const industryByKey = (key: string) => INDUSTRIES.find((i) => i.key === key);

export const HEARD_FROM = ['Google search', 'Instagram / Facebook', 'YouTube', 'A friend or another business', 'Our accountant / CA', 'AHEAD sales team', 'Other'] as const;

/** Answers given at signup (and later in Settings › Organization). */
export interface WorkspaceProfile {
  businessType?: BusinessType;
  gstRegistered?: boolean;
  pan?: string | null;
  teamSize?: TeamSize;
  branches?: BranchBand;
  subIndustry?: string | null;
  /** Free text when the industry is "Other" or has no template yet */
  industryRequested?: string | null;
  goals?: GoalKey[];
  /** Modules the owner wants first in the menu (order matters) */
  modules?: string[];
  heardFrom?: string | null;
  /** Phone and email printed on documents (default: the owner's) */
  phone?: string | null;
  email?: string | null;
}

export const DOC_TEMPLATES = [
  { key: 'classic', label: 'Classic' },
  { key: 'modern', label: 'Modern' },
  { key: 'compact', label: 'Compact' },
] as const;
export type DocTemplate = (typeof DOC_TEMPLATES)[number]['key'];

export const BRAND_COLORS = [
  { name: 'Blue', hex: '#2450D8' },
  { name: 'Indigo', hex: '#4F46E5' },
  { name: 'Teal', hex: '#0F766E' },
  { name: 'Green', hex: '#15803D' },
  { name: 'Plum', hex: '#86198F' },
  { name: 'Rose', hex: '#BE123C' },
  { name: 'Orange', hex: '#C2410C' },
  { name: 'Slate', hex: '#334155' },
] as const;

/** WCAG contrast ratio between two #RRGGBB colours. */
export function contrastRatio(a: string, b: string) {
  const lum = (hex: string) => {
    const [r, g, bl] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
    return 0.2126 * r + 0.7152 * g + 0.0722 * bl;
  };
  const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p);
  return (x + 0.05) / (y + 0.05);
}

/** Brand colours carry white text (buttons, active menu), so they need 4.5:1 against white. */
export function brandColorError(hex: string): string | null {
  if (!/^#[0-9A-Fa-f]{6}$/.test(hex)) return 'Use a colour like #2450D8';
  const ratio = contrastRatio(hex, '#FFFFFF');
  return ratio < 4.5 ? `Too light for white text (${ratio.toFixed(1)}:1, needs 4.5:1) — pick a darker shade` : null;
}

export const FONTS = [
  { key: 'inter', label: 'Inter', family: 'Inter' },
  { key: 'manrope', label: 'Manrope', family: 'Manrope' },
  { key: 'plex', label: 'IBM Plex Sans', family: 'IBM Plex Sans' },
  { key: 'source', label: 'Source Sans 3', family: 'Source Sans 3' },
] as const;
export type FontKey = (typeof FONTS)[number]['key'];

export interface WorkspacePreferences {
  documents: {
    /** Tokens: {FY} = 26-27. The running number (4+ digits) is added at the end. */
    invoicePrefix: string;
    quotationPrefix: string;
    receiptPrefix: string;
    template: DocTemplate;
    paper: 'a4' | '80mm';
    terms: string;
  };
  payments: {
    bankHolder: string;
    bankAccount: string;
    ifsc: string;
    upiId: string;
    showUpiQr: boolean;
  };
  taxes: {
    composition: boolean;
    compositionRateBp: 100 | 500 | 600 | null;
    pricesIncludeTax: boolean;
    defaultGstRateBp: number;
    hsnDigits: 4 | 6;
    reverseCharge: boolean;
  };
  branding: {
    brandColor: string;
    theme: 'light' | 'dark' | 'system';
    font: FontKey;
    density: 'comfortable' | 'compact';
  };
}

export const DEFAULT_PREFERENCES: WorkspacePreferences = {
  documents: { invoicePrefix: 'INV/{FY}/', quotationPrefix: 'QT/{FY}/', receiptPrefix: 'RCT/{FY}/', template: 'classic', paper: 'a4', terms: '' },
  payments: { bankHolder: '', bankAccount: '', ifsc: '', upiId: '', showUpiQr: false },
  taxes: { composition: false, compositionRateBp: null, pricesIncludeTax: true, defaultGstRateBp: 1800, hsnDigits: 4, reverseCharge: false },
  branding: { brandColor: '#2450D8', theme: 'system', font: 'inter', density: 'comfortable' },
};

/** Fill missing keys from defaults (old rows, new settings added later). */
export function withDefaults(stored: unknown): WorkspacePreferences {
  const s = (stored && typeof stored === 'object' ? stored : {}) as Partial<Record<keyof WorkspacePreferences, object>>;
  return {
    documents: { ...DEFAULT_PREFERENCES.documents, ...(s.documents ?? {}) },
    payments: { ...DEFAULT_PREFERENCES.payments, ...(s.payments ?? {}) },
    taxes: { ...DEFAULT_PREFERENCES.taxes, ...(s.taxes ?? {}) },
    branding: { ...DEFAULT_PREFERENCES.branding, ...(s.branding ?? {}) },
  } as WorkspacePreferences;
}

/** Number preview: "INV/{FY}/" + 1 → "INV/26-27/0001" */
export function previewNumber(prefix: string, fy: string, n: number) {
  return `${prefix.replace(/\{FY\}/g, fy)}${String(n).padStart(4, '0')}`;
}

/** GST rule 46: invoice numbers up to 16 characters, letters, digits, "/" and "-" only. */
export function prefixError(prefix: string, fy = '26-27'): string | null {
  const sample = previewNumber(prefix, fy, 1);
  if (!prefix.trim()) return 'Add a prefix, e.g. INV/{FY}/';
  if (!/^[A-Za-z0-9/\-{}]+$/.test(prefix) || /\{(?!FY\})/.test(prefix)) return 'Use letters, digits, / and - (and {FY} for the year)';
  if (sample.length > 16) return `Too long: ${sample} has ${sample.length} characters (GST allows 16)`;
  return null;
}

// ── Setup wizard ──

export const SETUP_STEPS = [
  { key: 'profile', label: 'Business profile', neededForInvoices: true },
  { key: 'documents', label: 'Invoices & payments', neededForInvoices: false },
  { key: 'taxes', label: 'Taxes', neededForInvoices: false },
  { key: 'data', label: 'Bring your data', neededForInvoices: false },
  { key: 'team', label: 'Invite team', neededForInvoices: false },
  { key: 'branding', label: 'Branding', neededForInvoices: false },
] as const;
export type SetupStepKey = (typeof SETUP_STEPS)[number]['key'];
export type SetupStepState = 'done' | 'skipped';

export interface SetupState {
  steps: Partial<Record<SetupStepKey, SetupStepState>>;
  /** Owner closed the wizard ("Finish later") — dashboard shows the resume card */
  deferredAt?: string | null;
  completedAt?: string | null;
  /** Owner dismissed the dashboard card */
  cardDismissedAt?: string | null;
}

// ── Workspace provisioning (the loading screen) ──

export type ProvisioningStepKey = 'business' | 'template' | 'roles' | 'catalog' | 'dashboard';
export interface ProvisioningStatus {
  state: 'running' | 'ready' | 'failed';
  steps: { key: ProvisioningStepKey; label: string; state: 'waiting' | 'running' | 'done' | 'failed' }[];
  /** Quoted to support when something failed */
  reference: string | null;
  startedAt: string;
}
