import type { ModuleKey } from './modules';
import { MODULE_KEYS } from './modules';

// Plans, limits and demo prices (Module Catalogue §13; prices are the client's demo pricing
// in paise, excluding GST). Module sets per plan are a proposal for the client to finalise.

export interface PlanLimits {
  users: number;
  branches: number;
  contacts: number | null; // null = unlimited
  items: number | null;
  invoicesPerMonth: number | null;
  storageMb: number;
  aiCredits: number;
}

export interface PlanDef {
  key: 'free' | 'starter' | 'growth' | 'business_pro' | 'enterprise';
  name: string;
  tagline: string;
  limits: PlanLimits;
  /** Modules unlocked at full tier. Free-tier modules not listed stay at basic tier. */
  fullModules: ModuleKey[];
  monthlyPaise: number | null;
  yearlyPaise: number | null;
  isPublic: boolean;
}

const BASE_PAID: ModuleKey[] = ['crm', 'catalog', 'sales', 'billing', 'tasks', 'bookings', 'reports', 'finance', 'automation'];

export const PLANS: PlanDef[] = [
  {
    key: 'free', name: 'Free', tagline: 'Run the basics, free forever', isPublic: true,
    limits: { users: 3, branches: 1, contacts: 1000, items: 500, invoicesPerMonth: 100, storageMb: 1024, aiCredits: 0 },
    fullModules: [], monthlyPaise: 0, yearlyPaise: 0,
  },
  {
    key: 'starter', name: 'Starter', tagline: 'Full core modules plus inventory', isPublic: true,
    limits: { users: 5, branches: 1, contacts: 10000, items: 5000, invoicesPerMonth: null, storageMb: 5120, aiCredits: 0 },
    fullModules: [...BASE_PAID, 'inventory'], monthlyPaise: 99900, yearlyPaise: 999000,
  },
  {
    key: 'growth', name: 'Growth', tagline: 'For growing teams: HR, support and automation', isPublic: true,
    limits: { users: 10, branches: 3, contacts: null, items: null, invoicesPerMonth: null, storageMb: 20480, aiCredits: 200 },
    fullModules: [...BASE_PAID, 'inventory', 'hr', 'support'], monthlyPaise: 249900, yearlyPaise: 2499000,
  },
  {
    key: 'business_pro', name: 'Business Pro', tagline: 'Every module, AI and multi-location', isPublic: true,
    limits: { users: 25, branches: 10, contacts: null, items: null, invoicesPerMonth: null, storageMb: 102400, aiCredits: 1000 },
    fullModules: [...MODULE_KEYS], monthlyPaise: 599900, yearlyPaise: 5999000,
  },
  {
    key: 'enterprise', name: 'Enterprise', tagline: 'Custom limits, SSO and dedicated support', isPublic: true,
    limits: { users: 50, branches: 50, contacts: null, items: null, invoicesPerMonth: null, storageMb: 512000, aiCredits: 5000 },
    fullModules: [...MODULE_KEYS], monthlyPaise: 1500000, yearlyPaise: null,
  },
];

/** Trial: all 12 modules at full tier, Growth-level users, small usage allowance (TRL-02) */
export const TRIAL_LIMITS: PlanLimits = { users: 10, branches: 3, contacts: null, items: null, invoicesPerMonth: null, storageMb: 5120, aiCredits: 50 };
export const TRIAL_PLAN_KEY = 'growth';

/** Module add-on prices (monthly, paise) from the catalogue */
export const ADDON_MONTHLY_PAISE: Partial<Record<ModuleKey, number>> = {
  inventory: 49900,
  finance: 49900,
  hr: 39900,
  support: 39900,
  ai: 79900,
  automation: 59900,
  sales: 49900,
};
export const EXTRA_USER_MONTHLY_PAISE = 19900;

export const planByKey = (key: string) => PLANS.find((p) => p.key === key);
