# AHEAD SOFTWARE ERP — Development Task Breakdown

Source docs: PRD v1, LLD v1 (Platform Core), Roles & Permissions Design, Onboarding/Trial/Subscription/Payment Flow, Module Catalogue (30 modules), Client Clarifications (web-first).

Status legend: `[x]` done · `[~]` in progress / partial · `[ ]` not started
Priority from PRD: P0 = launch blocker, P1 = should have, P2 = later.

Stack (as per PRD §9 / LLD): Next.js (frontend/) · Express + TypeScript (backend/) · PostgreSQL on Neon with RLS · Prisma ORM · Zod · JWT access + rotating refresh cookie.
Dev-time substitutions (swap before production): OTP/email are logged to the backend console (no SMS/SES provider yet); outbox events are consumed by an in-process poller instead of Redis + BullMQ; permission/entitlement caches are in-memory.

---

## Phase 1 — Foundation + free core (weeks 1–4)
Exit gate: a tenant can sign up, configure, and issue a GST invoice.

### 1.1 Backend kernel
- [x] Config validated with Zod at startup (exit on missing values)
- [x] Prisma setup, UUID v7 ids, money in paise (bigint)
- [x] Request-scoped tenant transaction (`withTenant`) with `SET LOCAL ROLE app_user` + `app.tenant_id` (RLS), `withPlatform` for platform tables
- [x] Standard error format + error codes (LLD §12.2), `X-Request-Id`
- [x] Zod `validate()` middleware → 422 `VALIDATION_FAILED`
- [x] Rate limiting on auth/OTP routes (NFR-07)
- [ ] Idempotency-Key store for money/document POSTs
- [ ] Cursor pagination helper (`?limit&cursor`, `nextCursor`)
- [ ] OpenAPI generation from Zod
- [ ] Route-coverage test: every route has `requirePermission` or `public()`

### 1.2 Database & RLS
- [x] Identity/tenancy tables: users, user_sessions, otp_codes, tenants, branches, tenant_members, invitations, trial_registry
- [x] Access tables: permissions, roles, role_permissions, role_field_access, tenant_role_settings
- [x] Config tables: industry_templates, tenant_terms, field_definitions, form_layouts
- [x] Subscription tables: modules, plans, plan_modules, prices, coupons, subscriptions, subscription_items, scheduled_changes, tenant_entitlements, usage_counters, credit_balances
- [x] Events/audit: outbox_events, processed_events, audit_log, notification_log
- [x] RLS migration: `app_user` role, `app_tenant()` helper, ENABLE + FORCE RLS + policy on every tenant table
- [x] Test that fails if any table with `tenant_id` lacks forced RLS
- [ ] Platform billing tables (platform_invoices, lines, credit notes, payments, mandates, webhook_events, dunning_attempts, document_sequences) — Phase 3
- [ ] Vendor/partner tables — Phase 3

### 1.3 Seed data
- [x] Module catalogue (12 v1 modules + catalogue master; dependencies; free-tier flags)
- [x] Plans: Free, Starter, Growth, Business Pro, Enterprise with limits; prices (monthly/yearly)
- [x] Permission catalogue (module.resource.action) from code
- [x] 21 tenant roles (4 core + 17 module roles) with required modules and permission sets; 7 platform/partner/vendor roles
- [x] 6 industry templates: salon, retail, pharmacy, gym, coaching/school, service company (modules, terms, custom fields, dashboard widgets, catalogue seed)

### 1.4 Identity & auth (PLT-03..09)
- [x] `POST /auth/otp/send`, `/auth/otp/verify` (hashed codes, 5-min expiry, 3 attempts, verification token)
- [x] `POST /auth/signup` → one `createTenant` service (user, tenant, default branch, trialing subscription, Owner membership, trial registry, outbox `tenant.created`)
- [x] Duplicate-trial check by mobile/email/GSTIN hash (ONB-03)
- [x] `POST /auth/login` (email or mobile + password, or mobile OTP), lockout after 5 failures for 15 min
- [x] `POST /auth/refresh` (HttpOnly cookie, rotation, family revoke on reuse), `/auth/logout`
- [x] `POST /auth/switch-tenant`, `GET /me` (user, memberships, tenant, role, permissions, entitlements, terms)
- [x] Email verification link (`/auth/email/verify`) — link logged in dev
- [x] Password reset via OTP (`/auth/password/reset`)
- [ ] MFA (OTP) for Owner/Admin (P1)
- [ ] Owner can sign out all sessions of a user (P1)

### 1.5 Access control (ROL-01..07)
- [x] `requirePermission(key)`: entitlement (active / read_only / inactive) → role permission → scope on `req.ctx`
- [x] Visible roles = core + module roles whose required modules are active (LLD §4.4)
- [x] `GET /roles`, `GET /permissions` (filtered to active modules)
- [ ] Scope filter helper (`own/team/branch/all`) used by module repos
- [ ] Field-level access serializer (salary, cost price, bank details)
- [ ] Custom roles: clone & edit (paid, P1)

### 1.6 Tenancy admin
- [x] `GET/PATCH /tenant` (profile, GSTIN, state code, time zone, FY start)
- [x] `GET/POST/PATCH /branches` (Free plan = 1 branch limit)
- [x] `GET /members`, `POST /invitations`, `POST /invitations/:token/accept`, `PATCH /members/:id` (user-limit check)
- [x] `GET /audit-log`; audit writes for login, role change, member change
- [ ] Data export job (`POST /exports`) — NFR-19
- [ ] Account closure with 30-day soft delete (`POST /tenant/close`)

### 1.7 Configuration engine (CFG-01..07)
- [x] Apply industry template on `tenant.created` (terms, field definitions, catalogue seed, template version)
- [x] `GET/PUT /config/terms`, `GET/POST/PATCH /config/fields`
- [x] Custom field validator (typed JSONB, unknown keys rejected, required enforced)
- [ ] Form layouts (P1)
- [ ] Template upgrade that never overwrites tenant edits (P1)

### 1.8 Subscription & entitlements (SUB-01..06, TRL-01..05)
- [x] State machine table (trialing/active/past_due/free/closed/purged) with `INVALID_TRANSITION`
- [x] Entitlement resolver (trial = all modules; free = free modules; `everUsed` → read_only)
- [x] `GET /billing/plans`, `GET /billing/subscription`
- [x] Trial-expiry job (hourly) → Free; paid modules read-only (unit-tested; not yet run against an expired tenant)
- [ ] Limit enforcement helpers (users, records, invoices/month with atomic usage counter)
- [ ] Trial reminder job (day 0, 2–3, 7/3/1 left, expiry, +3/+7) with notification_log de-dup
- [ ] "Choose active users" screen when over Free user limit

### 1.9 Free-core business modules
- [ ] Product & Service Catalogue (CAT-01, CAT-02): items, categories, units, GST rate, HSN/SAC
- [ ] CRM basic (CRM-01..04): contacts, leads, convert, timeline notes/calls/follow-ups, CSV import with duplicate detection
- [ ] Billing basic (BIL-01..04): GST invoice (CGST/SGST vs IGST), FY number series via `document_sequences`, PDF/print, receipts, paid/partial/unpaid, immutable after issue
- [ ] Quotations (SAL-01) → convert to invoice
- [ ] Expenses (FIN-01)
- [ ] Tasks basic (TSK-01, TSK-02)
- [ ] Calendar & appointments basic (BKG-01, BKG-02, BKG-08) with no double-booking
- [ ] Home dashboard (RPT-01) with widgets per enabled module
- [ ] In-app notifications (AUT-01)

### 1.10 Frontend foundation
- [x] API client with access token in memory + silent refresh
- [x] Auth pages: signup (6 fields + mobile OTP step), login (password / OTP), forgot password
- [x] App shell: sidebar built from entitlements, terminology applied, trial banner, email-unverified banner
- [x] Onboarding checklist (logo, first customer, first item, first invoice, invite team)
- [x] Settings: business profile, branches, team & invitations, roles view, terminology, custom fields
- [x] Plans page (read-only pricing)
- [x] Placeholder screen per module (locked / coming-soon) until 1.9 lands
- [ ] Module screens for 1.9

---

### 1.11 Verified so far
- 30-step API smoke run: OTP, signup, single-use verification token, template application, 21 roles on trial, GSTIN/state validation, invite → accept → staff login, staff 403s, refresh rotation, lockout path, subscription limits
- 15 Vitest tests: RLS enabled+forced on every tenant table, cross-tenant read/write blocked by Postgres, platform tables closed to app_user, state machine, entitlement resolver, role grants
- Browser: signup → OTP → dashboard (gym terminology), roles page, mobile layout

### Fixed 2026-10-22
- [x] Network blocked Postgres port 5432 → API could not reach Neon. Switched to Neon's serverless driver (WebSockets on 443) via `@prisma/adapter-neon`; added `prisma/migrate.ts` so migrations also run over 443
- [x] DB outage returned a vague 500 → now 503 `PROVIDER_UNAVAILABLE`; health endpoint reports DB state; worker backs off instead of logging every second
- [x] Frontend treated server outage as "signed out" → reconnect screen with auto-retry, session kept
- [x] Concurrent refresh (two tabs) revoked all sessions → 30 s reuse grace window

### Known issues
- [ ] Latency: every query round-trips to Neon us-east-2; signup takes ~8 s from India. Host the API in the same region as the database (or move the Neon project closer) and batch the /me queries.
- [ ] Rotate the Neon database password (it was shared in chat) and keep it only in backend/.env.

## Phase 2 — Operations (weeks 5–8)
Exit gate: stock and accounts update from sales and purchases.
- [ ] Sales orders, approvals, delivery challan, returns + credit notes (SAL-02..05)
- [ ] Billing advanced: dues & ageing, recurring billing, POS counter screen, tenant Razorpay links, reminders (BIL-05..09)
- [ ] Inventory: stock ledger, warehouses, GRN/dispatch, transfers/adjustments with approval, batch/serial/expiry + FEFO, reorder alerts, valuation (INV-01..07, 09)
- [ ] Purchasing: suppliers, purchase requests, POs, supplier bills, 3-way match (INV-08)
- [ ] Catalogue advanced: variants, barcode, bundles, batch attributes, price lists (CAT-03..07)
- [ ] Finance: chart of accounts, posting engine (only writer of ledgers), AR/AP, cash/bank book, P&L, BS, TB, cash flow, GST summary, period lock (FIN-02..09)
- [ ] HR: employees, attendance, leave, shifts, self-service, payroll run + payslips, statutory rule sets, sensitive-field protection (HR-01..08, 10)
- [ ] CRM advanced: tags/segments, pipeline Kanban, enquiry form, Customer 360 (CRM-05..08)

## Phase 3 — Growth + intelligence (weeks 9–11)
Exit gate: paid checkout, vendor commission and partner billing work end to end.
- [ ] Platform billing: checkout preview (proration, GST, dependencies), Razorpay order/mandate, webhook (HMAC, idempotent), platform invoice numbering, PDF, dunning, renewal job, downgrade at period end, cancel auto-renew, offline payments (PAY-01..12)
- [ ] Customer Service: tickets, SLA, complaints/warranty (SUP-01..03)
- [ ] Reports & Analytics: standard reports + export, dashboard builder, report builder (RPT-02..06)
- [ ] AI Business Assistant (Python FastAPI): permission-checked tools, code-computed totals, briefing, drafts, credit metering + hard limit (AI-01..09)
- [ ] Automation & Notifications: ready-made automations, rule builder, SMS/WhatsApp provider, run-time entitlement checks (AUT-02..06)
- [ ] Tasks advanced: recurring, templates, multi-step approvals (TSK-03..05)
- [ ] Bookings advanced: resources, public booking page, classes, memberships, reminders (BKG-03..07)
- [ ] Vendor program: registration with OTP, KYC upload (encrypted), approval queue, referral link/code, attribution lock, commissions pending→approved→paid, payouts (VND-01..09)
- [ ] White-label partners: branding, subdomain/custom domain, partner panel, partner billing snapshot (WL-01..06)
- [ ] Super Admin console: tenants, assisted onboarding, vendor queue, payouts, plans/prices/coupons, offline payments, failed jobs (ADM-01..08)
- [ ] Replace in-process poller with Redis + BullMQ; Redis caches

## Phase 4 — Hardware + hardening (weeks 12–13)
- [ ] USB barcode scanner (keyboard mode) on billing/POS/inventory screens (HW-01)
- [ ] A4 invoice + 80/58 mm receipt print layouts (HW-02)
- [ ] Device Bridge desktop app (ESC/POS, cash drawer, labels), device registry (HW-03, HW-04)
- [ ] Biometric attendance import (HW-05, HW-06)
- [ ] Tenant-isolation test suite across API/exports/jobs/AI (NFR-10)
- [ ] Permission matrix tests (role × route)
- [ ] E2E (Playwright): signup → trial → checkout → renewal failure → grace → Free → upgrade
- [ ] Load test (k6) for NFR-01..03; security review (OWASP), backups/restore drill
- [ ] Docker + GitHub Actions CI/CD, staging + production
