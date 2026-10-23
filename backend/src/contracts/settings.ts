import { z } from 'zod';
import { TRIAL_LIMITS, TRIAL_PLAN_KEY } from './plans';

// Platform settings (design v2 §9): the definition lives in code, the value in `config_values`.
// A missing or invalid stored value falls back to the default here, so a bad row can never
// break signups. Super Admin edits arrive with the Console (Step 3).

const PlanLimitsSchema = z.object({
  users: z.number().int().positive(),
  branches: z.number().int().positive(),
  contacts: z.number().int().positive().nullable(),
  items: z.number().int().positive().nullable(),
  invoicesPerMonth: z.number().int().positive().nullable(),
  storageMb: z.number().int().positive(),
  aiCredits: z.number().int().min(0),
});

interface SettingDef<S extends z.ZodTypeAny> {
  description: string;
  schema: S;
  default: z.infer<S>;
}

const def = <S extends z.ZodTypeAny>(d: SettingDef<S>) => d;

export const SETTINGS = {
  'trial.days': def({ description: 'Length of the free trial in days', schema: z.number().int().min(1).max(90), default: 15 }),
  'trial.plan_key': def({ description: 'Plan a new trial tenant is subscribed to', schema: z.string().min(1).max(40), default: TRIAL_PLAN_KEY }),
  'trial.limits': def({ description: 'Usage limits during the trial', schema: PlanLimitsSchema, default: TRIAL_LIMITS }),
  'grace.days_monthly': def({ description: 'Grace days after a failed monthly renewal', schema: z.number().int().min(0).max(60), default: 7 }),
  'grace.days_yearly': def({ description: 'Grace days after a failed yearly renewal', schema: z.number().int().min(0).max(90), default: 14 }),
  'sales.discount_limits': def({
    description: 'Highest discount (%) each Console role may give without Super Admin approval',
    schema: z.record(z.string(), z.number().min(0).max(100)),
    default: { console_sales_executive: 10, console_sales_manager: 20, vendor: 0 } as Record<string, number>,
  }),
  'announcement.banner': def({
    description: 'One line shown on top of every client workspace (empty = none)',
    schema: z.object({ text: z.string().trim().max(200), tone: z.enum(['info', 'warning']), until: z.string().datetime().nullable() }).nullable(),
    default: null as { text: string; tone: 'info' | 'warning'; until: string | null } | null,
  }),
};

export type SettingKey = keyof typeof SETTINGS;
export type SettingValue<K extends SettingKey> = z.infer<(typeof SETTINGS)[K]['schema']>;
export const SETTING_KEYS = Object.keys(SETTINGS) as SettingKey[];
