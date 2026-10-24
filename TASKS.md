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
- [x] Cursor pagination helper (`?limit&cursor`, `nextCursor`)
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
- [x] Scope filter helper (`own/team/branch/all`) used by module repos — `team` behaves as `own` until HR reporting lines exist
- [x] Field-level access serializer (salary, cost price, bank details) — used for item cost price; salary/bank arrive with HR
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
- [x] Limit enforcement helpers (users, records, invoices/month with atomic usage counter)
- [ ] Trial reminder job (day 0, 2–3, 7/3/1 left, expiry, +3/+7) with notification_log de-dup
- [ ] "Choose active users" screen when over Free user limit

### 1.9 Free-core business modules
- [x] Product & Service Catalogue (CAT-01, CAT-02): items, categories, units, GST rate, HSN/SAC — plus template starter catalogue, archive-on-delete, cost price hidden by role
- [x] CRM basic (CRM-01..04): contacts, leads, convert, timeline notes/calls/follow-ups, CSV import with duplicate detection
- [x] Billing basic (BIL-01..04): GST invoice (CGST/SGST vs IGST), FY number series via `document_sequences`, PDF/print, receipts, paid/partial/unpaid, immutable after issue — numbering via `tenant_sequences`; print/PDF via browser (A4, 80/58 mm); public share link; cancel with reason
- [x] Quotations (SAL-01) → convert to invoice
- [x] Expenses (FIN-01)
- [x] Tasks basic (TSK-01, TSK-02)
- [x] Calendar & appointments basic (BKG-01, BKG-02, BKG-08) with no double-booking — enforced by a Postgres exclusion constraint
- [x] Home dashboard (RPT-01) with widgets per enabled module
- [x] In-app notifications (AUT-01) — assignments, follow-ups, comments, task completion

### 1.10 Frontend foundation
- [x] API client with access token in memory + silent refresh
- [x] Auth pages: signup (6 fields + mobile OTP step), login (password / OTP), forgot password
- [x] App shell: sidebar built from entitlements, terminology applied, trial banner, email-unverified banner
- [x] Onboarding checklist (logo, first customer, first item, first invoice, invite team)
- [x] Settings: business profile, branches, team & invitations, roles view, terminology, custom fields
- [x] Plans page (read-only pricing)
- [x] Placeholder screen per module (locked / coming-soon) until 1.9 lands
- [x] Module screens for 1.9

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

### 1.12 Verified for Phase 1.9 (2026-10-22)
- 45-check API run (twice in a row): catalogue + template seed, SKU/GST validation, custom fields, duplicate detection, draft → issue with FY number, CGST/SGST and IGST maths, immutability, partial/full payment and receipts, cancel rules, public share link, quotation → invoice, lead → customer, timeline, CSV import, expenses, tasks/subtasks/comments/history, double-booking blocked, appointment → invoice, dashboard figures, staff scope (own invoices only, no cost price, no cancel/delete)
- 20 Vitest tests incl. GST rounding and financial-year boundaries
- Browser: catalogue add-item flow, every module screen renders, shared invoice layout checked (pane hidden for the rest of the click-through)

### Known issues
- [ ] Latency: every query round-trips to Neon us-east-2; signup takes ~8 s and the dashboard ~15–20 s from India. Host the API in the same region as the database (or move the Neon project closer) and batch the /me queries.
- [ ] Rotate the Neon database password (it was shared in chat) and keep it only in backend/.env.

## Platform v2 — Console + ERP (design v2, 2026-10-23)
Design: `Platform design - Multi level flow, super admin, verder, partner.docx` (v2; v1 kept as `... (v1 backup 22 Oct).docx`). One app, two workspaces: **Console** (`/console`, AHEAD team) and **Business ERP** (`/app`, tenants). Partner white-label and vendor payouts move to "Later". Each step starts only when the previous step's tests are green.

### Step 1 — Data model and settings (R1, R2, R4) — done 2026-10-23
- [x] R1: `tenant_source` `admin` → `sales`; `tenants.onboarding_type` (trial / direct_paid) + `is_internal`
- [x] R1: `tenant_acquisitions` (platform table, never visible to tenants): who brought the tenant in, method, referral/coupon code, locked at signup; existing tenants backfilled as self-signup
- [x] R1: `createTenant()` takes an acquisition (default self-signup) and derives `source`; trial registry only for trial, non-internal tenants; signup records the coupon code
- [x] R1: `changeAcquisition()` for the Super Admin — reason required, updates `source`, audited (screen comes in Step 3)
- [x] R2: `config_values` table + definitions in `contracts/settings.ts` + `getSetting / setSetting / resetSetting / listSettings` (validated, versioned, audited, 60 s cache; an invalid stored value falls back to the default)
- [x] R2: trial days, trial plan, trial limits and grace days (monthly/yearly) moved from `.env` / constants to settings
- [x] R4: seed no longer overwrites plans, plan modules, prices or free-tier flags (`syncCatalog`); `npm run db:seed -- --reset-commercials` restores the code defaults in dev
- [x] R4: runtime reads the commercial catalogue from the DB (`getCatalog`): `/billing/plans`, Free limits, free-tier modules
- [x] Tests (30/30 green): seed keeps DB edits, reset restores defaults, settings fallback/validation/versioning, acquisition rules and lock, internal tenant, new platform tables closed to `app_user`
- Note: `direct_paid` is stored but not used yet — the `incomplete` subscription state arrives in Step 4

### Step 2 — R3-lite: Console workspace — done 2026-10-23
- [x] `platform_members` (user, Console role, `reports_to`, status) — platform table, closed to `app_user`
- [x] 18 `platform.*` permissions; 7 Console roles: Super Admin, Operations / Support, Support Agent, Finance, Sales Manager (`team`), Sales Executive (`own`), Vendor (`own`). Console keys only go to Console roles and vice versa (`expandGrants`)
- [x] Token and session carry the workspace (`ws = tenant | console`); old tokens count as tenant; refresh keeps the workspace and drops a removed Console member back to tenant
- [x] `consoleAuth` + `requirePlatformPermission` + `consoleTx`; scope filter over clients by `tenant_acquisitions` (own / team via reporting tree / all)
- [x] `POST /auth/switch-console`; login lands Console-only users in the Console; `/me` returns `workspace` + `console` (role, permissions)
- [x] `GET /console/me`, `GET /console/dashboard` (client counts in scope)
- [x] Bootstrap: `npm run console:member -- --email … --role super_admin [--name --mobile] [--reports-to …] [--deactivate]` (new users have no password: mobile OTP or "Forgot password")
- [x] Frontend: `/console` shell (sidebar by permission, Step 3 items marked "Soon"), dashboard, workspace switcher in both shells, login and `/app` route Console sessions to `/console`
- [x] Tests (38/38 green): role separation, route guards, old-token default, tenant token refused by Console, team/own/all scope; checked in the browser (switch in and out) and via API (login → Console → refresh → logout)
- Dev data: test Super Admin `console-admin@example.test` (mobile `+919000000011`, OTP login)

### Step 3 — Console screens — done 2026-10-23
- [x] Clients list (search by name/GSTIN, status filter, plan, source, users) and detail (subscription, owner, source, usage counts, modules, history) — account metadata only, scoped own / team / all; out-of-scope ids return 404
- [x] Extra days: extend a trial (trialing) or payment grace (past_due), 1–30 days with a reason; `grace_periods` table + audit
- [x] Change who brought a client in (reason required) from the detail screen
- [x] Plans & prices: edit plan name, tagline, visibility, limits and modules (re-computes entitlements of clients on that plan); versioned price edits; coupons (create, end now)
- [x] Settings screen: trial days/plan/limits, grace days, discount limit per role (`sales.discount_limits`), announcement banner (`announcement.banner`, shown on top of every client workspace via `/me`)
- [x] Console users: add (existing account by email, or new with name + mobile), change role and manager, deactivate/reactivate; roles overview. Rules: only a Super Admin grants or changes Super Admin, nobody edits their own role/status, the last Super Admin stays, no reporting loops
- [x] Platform audit log screen (tenant_id null entries) with filters
- [x] Tests (46/46 green): extensions, scope 404, versioned prices, plan module validation, coupons, Console-user rules; screens checked in the browser
- Not yet: MRR on the dashboard and payments screens (need Step 4); free-tier flags per module are not editable from the UI yet

### Step 4a — Paid onboarding from the Console — done 2026-10-24
- [x] `incomplete` tenant/subscription status: workspace exists, every module closed until the first payment; `incomplete → active` on payment, `incomplete → closed` when unpaid
- [x] Platform tables (closed to `app_user`): `platform_orders`, `platform_payments`, `platform_invoices`, `platform_sequences`
- [x] Quote: plan + add-on modules + extra users for the cycle from the active price list, sales discount, coupon, GST (CGST+SGST in AHEAD's state, else IGST), discount split pro-rata across lines
- [x] New client (Console → Clients → New client): owner by email (existing account or new, OTP login), acquisition = the sales user / vendor, no trial registry, live price panel
- [x] Discount above the role limit (`sales.discount_limits`) → order needs approval (`platform.discount.approve`); the creator cannot approve their own discount
- [x] Record offline payment (bank transfer, UPI, cheque, cash; full amount only) → AHEAD GST invoice `AHD/26-27/000001` numbered at payment, subscription active with cycle, add-ons and extra users (extra users raise the user limit), coupon redeemed
- [x] Console screens: New client, Payments (orders by status), order detail (approve, record payment, cancel), printable AHEAD invoice; orders on the client detail; dashboard tiles for awaiting payment / approvals
- [x] Settings: AHEAD billing details (legal name, GSTIN, state, address, SAC, GST rate) — invoicing is blocked until the state is set; unpaid order lapse days
- [x] Client ERP shows "workspace ready, modules open after payment" while `incomplete`
- [x] Tests (6 new, suite green): allocation, seller state required, approval rules, full-amount rule, intra/inter-state GST, invoice numbering, entitlements after payment
- To do before go-live: set AHEAD's real billing details in Console → Settings; CA to confirm SAC and rate

### Step 4b — Online payments and renewals — done 2026-10-24
- [x] Gateway adapter: Razorpay payment links (`RAZORPAY_KEY_ID/SECRET/WEBHOOK_SECRET`); without keys, development uses a built-in test gateway (`/pay/test/<link>` page with a Pay button)
- [x] `POST /api/v1/webhooks/razorpay`: HMAC-SHA256 signature on the raw body, stored once by event id (`webhook_events`), paid link → `capturePayment()`; wrong amount / unknown link kept as "needs attention" (200, no retry loop)
- [x] Console: send / resend payment link (owner gets email + SMS, link copied); client Plan & billing page shows what is due with a Pay button
- [x] Hourly jobs (worker): unpaid orders lapse (never-paid client → `closed`), renewal order 7 days before the period ends at current prices with a link and reminders at 7/3/1 days, dunning (period over → `past_due` + grace, grace over → Free), trial reminders at 7/3/1 days — every message de-duplicated in `notification_log`
- [x] A renewal paid on time extends from the old period end (`renewal_succeeded`)
- [x] Credit notes `CN/26-27/000001`: full refund of an AHEAD invoice, optional "end the paid plan now" (→ Free); shown on the invoice
- [x] Tests (9 new; suite 61/61 green): signatures, Razorpay parsing, webhook once-only and forged/wrong-amount cases, lapse, renewal + reminders + period extension, dunning, trial reminders, credit notes
- To do before go-live: add Razorpay keys, register the webhook (event `payment_link.paid`), and set AHEAD billing details; auto-debit (UPI AutoPay / e-mandate) is not built yet — renewals are paid by link

### Step 5 — Support and reports
- [ ] Support access with tenant consent (time-limited "Login as", banner, audit)
- [ ] Vendor / salesperson commission report (manual payout)

### Public website — homepage + SEO — done 2026-10-24
- [x] New homepage (`app/page.tsx`, `components/marketing/`): hero, product mockups drawn in HTML/SVG, getting-started steps, feature rows (CRM, GST billing, bookings, stock), AI assistant, before/after by industry, security, FAQ, module list with "Soon" badges for modules not built yet
- [x] SEO: metadata + Open Graph/Twitter in the root layout, canonical URLs, generated OG/Twitter/Apple images, `icon.svg`, `robots.txt`, `sitemap.xml`, web manifest, JSON-LD (Organization, WebSite, SoftwareApplication, FAQPage), titles for /login and /signup
- [x] Private areas (`/app`, `/console`, `/d`, `/pay`, `/print`, `/invite`, …) blocked in robots.txt and sent `X-Robots-Tag: noindex`
- To do before go-live: set `NEXT_PUBLIC_SITE_URL` to the production domain (canonical, sitemap and OG URLs use it); move a module's badge from "Soon" to live in `components/marketing/content.ts` as each ships; add Privacy and Terms pages and link them in the footer

### Later (design v2 §13)
- [ ] White-label partner (panel, domains, price book, monthly billing), vendor KYC + payouts, full theming, dedicated-DB tier, visual workflow builder

## Phase 2 — Operations (weeks 5–8)
Exit gate: stock and accounts update from sales and purchases.
Can run in parallel once Platform v2 Step 2 is merged. From the Maglo reference, add: reporting manager + teams, permission matrix UI, Contact vs Lead (re-enquiry count), configurable pipeline stages, round-robin assignment, follow-up screen, quotation statuses + proforma, one shared list-page component.
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
- [ ] Platform billing (payment links, webhook, platform invoices, offline payments and renewals move up to Platform v2 Step 4): checkout preview (proration, GST, dependencies), Razorpay order/mandate, webhook (HMAC, idempotent), platform invoice numbering, PDF, dunning, renewal job, downgrade at period end, cancel auto-renew, offline payments (PAY-01..12)
- [ ] Customer Service: tickets, SLA, complaints/warranty (SUP-01..03)
- [ ] Reports & Analytics: standard reports + export, dashboard builder, report builder (RPT-02..06)
- [ ] AI Business Assistant (Python FastAPI): permission-checked tools, code-computed totals, briefing, drafts, credit metering + hard limit (AI-01..09)
- [ ] Automation & Notifications: ready-made automations, rule builder, SMS/WhatsApp provider, run-time entitlement checks (AUT-02..06)
- [ ] Tasks advanced: recurring, templates, multi-step approvals (TSK-03..05)
- [ ] Bookings advanced: resources, public booking page, classes, memberships, reminders (BKG-03..07)
- [ ] Vendor program — moved: v1 is a Console role + referral code (Platform v2 Steps 2 and 5); KYC and payouts under "Later" (VND-01..09)
- [ ] White-label partners — moved to Platform v2 "Later" (WL-01..06)
- [ ] Super Admin console — moved to Platform v2 Steps 2–5 (ADM-01..08)
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
