import type { PlanLimits, Scope, TenantStatus } from "@/lib/types"

// Shapes returned by the Console API (/console/*), design v2.

export interface ClientRow {
  id: string
  name: string
  industryKey: string
  status: TenantStatus
  source: "direct" | "vendor" | "sales" | "partner"
  isInternal: boolean
  createdAt: string
  plan: string | null
  trialEndsAt: string | null
  renewsAt: string | null
  owner: { id: string; name: string; email: string } | null
  acquiredBy: string | null
  activeUsers: number
}

export type AcquiredByType = "self" | "vendor" | "sales_user" | "partner_user"
export type AcquisitionMethod = "signup" | "referral_link" | "referral_code" | "manual"

export interface ClientDetail {
  id: string
  name: string
  legalName: string | null
  industryKey: string
  gstin: string | null
  billingStateCode: string | null
  status: TenantStatus
  source: ClientRow["source"]
  onboardingType: "trial" | "direct_paid"
  isInternal: boolean
  createdAt: string
  owner: { name: string; email: string; mobile: string; emailVerified: boolean; lastLoginAt: string | null } | null
  subscription: {
    status: TenantStatus
    cycle: "monthly" | "yearly"
    plan: { key: string; name: string; limits: PlanLimits } | null
    trialEndsAt: string | null
    currentPeriodEnd: string | null
    graceEndsAt: string | null
    cancelAtPeriodEnd: boolean
  } | null
  modules: { key: string; status: "active" | "read_only" | "inactive"; tier: string }[]
  usage: { activeUsers: number; branches: number; thisMonth: Record<string, number> }
  acquisition: {
    byType: AcquiredByType
    by: { id: string; name: string; email: string } | null
    method: AcquisitionMethod
    referralCode: string | null
    couponCode: string | null
    lockedAt: string
    changeReason: string | null
    changedBy: string | null
  } | null
  extensions: { id: string; kind: "trial" | "grace"; days: number; reason: string; newEndAt: string; createdAt: string; grantedBy: string | null }[]
  history: { id: string; action: string; at: string; actor: string | null }[]
}

export interface Catalog {
  plans: { key: string; name: string; tagline: string | null; limits: PlanLimits; isPublic: boolean; fullModules: string[]; subscribers: number }[]
  modules: { key: string; name: string; freeTier: boolean; dependsOn: string[] }[]
  prices: { id: string; itemType: "plan" | "addon_module" | "extra_user"; itemRef: string; cycle: "monthly" | "yearly"; amountPaise: number; activeFrom: string }[]
  coupons: { code: string; type: "percent" | "flat"; value: number; appliesTo: string; validFrom: string | null; validTo: string | null; maxRedemptions: number | null; redeemed: number; active: boolean }[]
}

export interface ConsoleMember {
  id: string
  status: "invited" | "active" | "deactivated"
  joinedAt: string
  user: { id: string; name: string; email: string; mobile: string; lastLoginAt: string | null }
  role: { key: string; name: string }
  reportsTo: { userId: string; name: string | null } | null
}

export interface ConsoleRole {
  id: string
  key: string
  name: string
  description: string | null
  members: number
  permissions: Record<string, Scope>
}

export interface SettingRow {
  key: string
  description: string
  default: unknown
  value: unknown
  overridden: boolean
  version: number
}

export const STATUS_LABEL: Record<TenantStatus, string> = {
  trialing: "On trial",
  active: "Paying",
  past_due: "Payment failed",
  free: "Free plan",
  closed: "Closed",
  purged: "Deleted",
}

export const SOURCE_LABEL: Record<ClientRow["source"], string> = { direct: "Self-signup", vendor: "Vendor", sales: "Sales team", partner: "Partner" }

export const ACQUIRER_LABEL: Record<AcquiredByType, string> = { self: "Self-signup", vendor: "Vendor", sales_user: "Sales team", partner_user: "Partner" }

export const METHOD_LABEL: Record<AcquisitionMethod, string> = { signup: "Signed up", referral_link: "Referral link", referral_code: "Referral code", manual: "Added by hand" }
