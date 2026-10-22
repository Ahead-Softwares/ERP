-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "user_status" AS ENUM ('active', 'locked', 'disabled');

-- CreateEnum
CREATE TYPE "otp_channel" AS ENUM ('sms', 'whatsapp', 'email');

-- CreateEnum
CREATE TYPE "otp_purpose" AS ENUM ('signup', 'login', 'reset', 'vendor_signup', 'mfa', 'invite');

-- CreateEnum
CREATE TYPE "tenant_status" AS ENUM ('trialing', 'active', 'past_due', 'free', 'closed', 'purged');

-- CreateEnum
CREATE TYPE "tenant_source" AS ENUM ('direct', 'vendor', 'admin', 'partner');

-- CreateEnum
CREATE TYPE "billing_owner" AS ENUM ('self', 'partner');

-- CreateEnum
CREATE TYPE "member_status" AS ENUM ('invited', 'active', 'deactivated');

-- CreateEnum
CREATE TYPE "permission_action" AS ENUM ('view', 'create', 'edit', 'delete', 'approve', 'export');

-- CreateEnum
CREATE TYPE "role_layer" AS ENUM ('platform', 'partner', 'vendor', 'tenant');

-- CreateEnum
CREATE TYPE "role_type" AS ENUM ('admin', 'user', 'salesperson', 'counter', 'employee');

-- CreateEnum
CREATE TYPE "permission_scope" AS ENUM ('own', 'team', 'branch', 'all');

-- CreateEnum
CREATE TYPE "field_access" AS ENUM ('hidden', 'read', 'write');

-- CreateEnum
CREATE TYPE "field_type" AS ENUM ('text', 'number', 'date', 'dropdown', 'multi_select', 'checkbox', 'attachment', 'relation');

-- CreateEnum
CREATE TYPE "record_source" AS ENUM ('template', 'tenant');

-- CreateEnum
CREATE TYPE "price_item_type" AS ENUM ('plan', 'addon_module', 'extra_user', 'credit_pack');

-- CreateEnum
CREATE TYPE "billing_cycle" AS ENUM ('monthly', 'yearly', 'one_time');

-- CreateEnum
CREATE TYPE "coupon_type" AS ENUM ('percent', 'flat');

-- CreateEnum
CREATE TYPE "entitlement_status" AS ENUM ('active', 'read_only', 'inactive');

-- CreateTable
CREATE TABLE "users" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "mobile" VARCHAR(15) NOT NULL,
    "password_hash" TEXT,
    "email_verified_at" TIMESTAMPTZ,
    "mobile_verified_at" TIMESTAMPTZ,
    "mfa_enabled" BOOLEAN NOT NULL DEFAULT false,
    "status" "user_status" NOT NULL DEFAULT 'active',
    "failed_logins" INTEGER NOT NULL DEFAULT 0,
    "locked_until" TIMESTAMPTZ,
    "last_tenant_id" UUID,
    "last_login_at" TIMESTAMPTZ,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_sessions" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "family_id" UUID NOT NULL,
    "refresh_token_hash" TEXT NOT NULL,
    "user_agent" TEXT,
    "ip" TEXT,
    "expires_at" TIMESTAMPTZ NOT NULL,
    "revoked_at" TIMESTAMPTZ,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "otp_codes" (
    "id" UUID NOT NULL,
    "target" TEXT NOT NULL,
    "channel" "otp_channel" NOT NULL,
    "purpose" "otp_purpose" NOT NULL,
    "code_hash" TEXT NOT NULL,
    "attempts" SMALLINT NOT NULL DEFAULT 0,
    "expires_at" TIMESTAMPTZ NOT NULL,
    "consumed_at" TIMESTAMPTZ,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "otp_codes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tenants" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "legal_name" TEXT,
    "industry_key" TEXT NOT NULL,
    "template_version" INTEGER NOT NULL,
    "status" "tenant_status" NOT NULL DEFAULT 'trialing',
    "source" "tenant_source" NOT NULL DEFAULT 'direct',
    "partner_id" UUID,
    "billing_owner" "billing_owner" NOT NULL DEFAULT 'self',
    "gstin" VARCHAR(15),
    "billing_state_code" CHAR(2),
    "address" JSONB,
    "logo_url" TEXT,
    "timezone" TEXT NOT NULL DEFAULT 'Asia/Kolkata',
    "fy_start_month" SMALLINT NOT NULL DEFAULT 4,
    "owner_user_id" UUID NOT NULL,
    "needs_seat_choice" BOOLEAN NOT NULL DEFAULT false,
    "config_applied_at" TIMESTAMPTZ,
    "onboarding" JSONB NOT NULL DEFAULT '{}',
    "closed_at" TIMESTAMPTZ,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "tenants_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "branches" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "address" JSONB,
    "state_code" CHAR(2),
    "gstin" VARCHAR(15),
    "is_default" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "branches_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tenant_members" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "role_id" UUID NOT NULL,
    "branch_ids" UUID[] DEFAULT ARRAY[]::UUID[],
    "status" "member_status" NOT NULL DEFAULT 'invited',
    "joined_at" TIMESTAMPTZ,
    "deactivated_at" TIMESTAMPTZ,
    "version" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "tenant_members_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "invitations" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "name" TEXT,
    "email" TEXT,
    "mobile" VARCHAR(15),
    "role_id" UUID NOT NULL,
    "branch_ids" UUID[] DEFAULT ARRAY[]::UUID[],
    "token_hash" TEXT NOT NULL,
    "invited_by" UUID NOT NULL,
    "expires_at" TIMESTAMPTZ NOT NULL,
    "accepted_at" TIMESTAMPTZ,
    "revoked_at" TIMESTAMPTZ,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "invitations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "trial_registry" (
    "id" UUID NOT NULL,
    "mobile_hash" TEXT,
    "email_hash" TEXT,
    "gstin" VARCHAR(15),
    "tenant_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "trial_registry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "permissions" (
    "key" TEXT NOT NULL,
    "module_key" TEXT NOT NULL,
    "resource" TEXT NOT NULL,
    "action" "permission_action" NOT NULL,
    "description" TEXT NOT NULL,

    CONSTRAINT "permissions_pkey" PRIMARY KEY ("key")
);

-- CreateTable
CREATE TABLE "roles" (
    "id" UUID NOT NULL,
    "tenant_id" UUID,
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "layer" "role_layer" NOT NULL,
    "role_type" "role_type" NOT NULL,
    "required_modules" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "is_system" BOOLEAN NOT NULL DEFAULT false,
    "is_predefined" BOOLEAN NOT NULL DEFAULT false,
    "cloned_from" UUID,
    "template_version" INTEGER NOT NULL DEFAULT 1,
    "sort" INTEGER NOT NULL DEFAULT 0,
    "version" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "roles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "role_permissions" (
    "role_id" UUID NOT NULL,
    "tenant_id" UUID,
    "permission_key" TEXT NOT NULL,
    "scope" "permission_scope" NOT NULL DEFAULT 'all',

    CONSTRAINT "role_permissions_pkey" PRIMARY KEY ("role_id","permission_key")
);

-- CreateTable
CREATE TABLE "role_field_access" (
    "id" UUID NOT NULL,
    "role_id" UUID NOT NULL,
    "tenant_id" UUID,
    "entity" TEXT NOT NULL,
    "field" TEXT NOT NULL,
    "access" "field_access" NOT NULL DEFAULT 'hidden',

    CONSTRAINT "role_field_access_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tenant_role_settings" (
    "tenant_id" UUID NOT NULL,
    "role_id" UUID NOT NULL,
    "hidden" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "tenant_role_settings_pkey" PRIMARY KEY ("tenant_id","role_id")
);

-- CreateTable
CREATE TABLE "industry_templates" (
    "key" VARCHAR(40) NOT NULL,
    "version" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "definition" JSONB NOT NULL,
    "published_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "industry_templates_pkey" PRIMARY KEY ("key","version")
);

-- CreateTable
CREATE TABLE "tenant_terms" (
    "tenant_id" UUID NOT NULL,
    "term_key" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "source" "record_source" NOT NULL DEFAULT 'template',

    CONSTRAINT "tenant_terms_pkey" PRIMARY KEY ("tenant_id","term_key")
);

-- CreateTable
CREATE TABLE "field_definitions" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "entity" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "type" "field_type" NOT NULL,
    "required" BOOLEAN NOT NULL DEFAULT false,
    "options" JSONB,
    "validation" JSONB,
    "relation_entity" TEXT,
    "position" INTEGER NOT NULL DEFAULT 0,
    "source" "record_source" NOT NULL DEFAULT 'tenant',
    "archived_at" TIMESTAMPTZ,
    "version" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "field_definitions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "form_layouts" (
    "tenant_id" UUID NOT NULL,
    "entity" TEXT NOT NULL,
    "layout" JSONB NOT NULL,

    CONSTRAINT "form_layouts_pkey" PRIMARY KEY ("tenant_id","entity")
);

-- CreateTable
CREATE TABLE "modules" (
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "category" TEXT NOT NULL,
    "depends_on" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "is_free_tier" BOOLEAN NOT NULL DEFAULT false,
    "is_usage_based" BOOLEAN NOT NULL DEFAULT false,
    "is_v1" BOOLEAN NOT NULL DEFAULT true,
    "sort" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "modules_pkey" PRIMARY KEY ("key")
);

-- CreateTable
CREATE TABLE "plans" (
    "id" UUID NOT NULL,
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "tagline" TEXT,
    "limits" JSONB NOT NULL,
    "is_public" BOOLEAN NOT NULL DEFAULT true,
    "sort" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "plans_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "plan_modules" (
    "plan_id" UUID NOT NULL,
    "module_key" TEXT NOT NULL,

    CONSTRAINT "plan_modules_pkey" PRIMARY KEY ("plan_id","module_key")
);

-- CreateTable
CREATE TABLE "prices" (
    "id" UUID NOT NULL,
    "item_type" "price_item_type" NOT NULL,
    "item_ref" TEXT NOT NULL,
    "cycle" "billing_cycle" NOT NULL,
    "amount_paise" BIGINT NOT NULL,
    "active_from" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "active_to" TIMESTAMPTZ,

    CONSTRAINT "prices_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "coupons" (
    "code" TEXT NOT NULL,
    "type" "coupon_type" NOT NULL,
    "value" INTEGER NOT NULL,
    "applies_to" TEXT NOT NULL DEFAULT 'all',
    "valid_from" TIMESTAMPTZ,
    "valid_to" TIMESTAMPTZ,
    "max_redemptions" INTEGER,
    "redeemed" INTEGER NOT NULL DEFAULT 0,
    "vendor_id" UUID,

    CONSTRAINT "coupons_pkey" PRIMARY KEY ("code")
);

-- CreateTable
CREATE TABLE "subscriptions" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "plan_id" UUID NOT NULL,
    "status" "tenant_status" NOT NULL,
    "cycle" "billing_cycle" NOT NULL DEFAULT 'monthly',
    "trial_ends_at" TIMESTAMPTZ,
    "current_period_start" TIMESTAMPTZ,
    "current_period_end" TIMESTAMPTZ,
    "grace_ends_at" TIMESTAMPTZ,
    "cancel_at_period_end" BOOLEAN NOT NULL DEFAULT false,
    "auto_renew" BOOLEAN NOT NULL DEFAULT true,
    "mandate_id" UUID,
    "purge_at" TIMESTAMPTZ,
    "version" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "subscriptions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "subscription_items" (
    "id" UUID NOT NULL,
    "subscription_id" UUID NOT NULL,
    "price_id" UUID NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "unit_amount_paise" BIGINT NOT NULL,
    "starts_at" TIMESTAMPTZ NOT NULL,
    "ends_at" TIMESTAMPTZ,

    CONSTRAINT "subscription_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "scheduled_changes" (
    "id" UUID NOT NULL,
    "subscription_id" UUID NOT NULL,
    "change" JSONB NOT NULL,
    "effective_at" TIMESTAMPTZ NOT NULL,
    "applied_at" TIMESTAMPTZ,

    CONSTRAINT "scheduled_changes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tenant_entitlements" (
    "tenant_id" UUID NOT NULL,
    "module_key" TEXT NOT NULL,
    "status" "entitlement_status" NOT NULL,
    "limits" JSONB NOT NULL DEFAULT '{}',
    "activated_at" TIMESTAMPTZ,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "tenant_entitlements_pkey" PRIMARY KEY ("tenant_id","module_key")
);

-- CreateTable
CREATE TABLE "usage_counters" (
    "tenant_id" UUID NOT NULL,
    "metric" TEXT NOT NULL,
    "period" TEXT NOT NULL,
    "used" BIGINT NOT NULL DEFAULT 0,

    CONSTRAINT "usage_counters_pkey" PRIMARY KEY ("tenant_id","metric","period")
);

-- CreateTable
CREATE TABLE "credit_balances" (
    "tenant_id" UUID NOT NULL,
    "type" TEXT NOT NULL,
    "balance" BIGINT NOT NULL DEFAULT 0,
    "expires_at" TIMESTAMPTZ,

    CONSTRAINT "credit_balances_pkey" PRIMARY KEY ("tenant_id","type")
);

-- CreateTable
CREATE TABLE "outbox_events" (
    "id" UUID NOT NULL,
    "tenant_id" UUID,
    "type" TEXT NOT NULL,
    "version" SMALLINT NOT NULL DEFAULT 1,
    "payload" JSONB NOT NULL,
    "actor" JSONB NOT NULL,
    "occurred_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "published_at" TIMESTAMPTZ,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "last_error" TEXT,

    CONSTRAINT "outbox_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "processed_events" (
    "consumer" TEXT NOT NULL,
    "event_id" UUID NOT NULL,
    "processed_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "processed_events_pkey" PRIMARY KEY ("consumer","event_id")
);

-- CreateTable
CREATE TABLE "audit_log" (
    "id" UUID NOT NULL,
    "tenant_id" UUID,
    "actor_kind" TEXT NOT NULL,
    "actor_id" UUID,
    "action" TEXT NOT NULL,
    "entity" TEXT,
    "entity_id" TEXT,
    "before" JSONB,
    "after" JSONB,
    "ip" TEXT,
    "request_id" TEXT,
    "at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_log_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notification_log" (
    "id" UUID NOT NULL,
    "tenant_id" UUID,
    "template" TEXT NOT NULL,
    "channel" TEXT NOT NULL,
    "dedup_key" TEXT,
    "target" TEXT,
    "status" TEXT NOT NULL DEFAULT 'sent',
    "sent_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notification_log_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notifications" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT,
    "link" TEXT,
    "read_at" TIMESTAMPTZ,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "users_mobile_key" ON "users"("mobile");

-- CreateIndex
CREATE UNIQUE INDEX "user_sessions_refresh_token_hash_key" ON "user_sessions"("refresh_token_hash");

-- CreateIndex
CREATE INDEX "user_sessions_user_id_revoked_at_idx" ON "user_sessions"("user_id", "revoked_at");

-- CreateIndex
CREATE INDEX "user_sessions_family_id_idx" ON "user_sessions"("family_id");

-- CreateIndex
CREATE INDEX "otp_codes_target_purpose_created_at_idx" ON "otp_codes"("target", "purpose", "created_at" DESC);

-- CreateIndex
CREATE INDEX "tenants_partner_id_idx" ON "tenants"("partner_id");

-- CreateIndex
CREATE INDEX "tenants_status_idx" ON "tenants"("status");

-- CreateIndex
CREATE INDEX "tenants_source_idx" ON "tenants"("source");

-- CreateIndex
CREATE UNIQUE INDEX "branches_tenant_id_code_key" ON "branches"("tenant_id", "code");

-- CreateIndex
CREATE INDEX "tenant_members_tenant_id_role_id_idx" ON "tenant_members"("tenant_id", "role_id");

-- CreateIndex
CREATE INDEX "tenant_members_user_id_idx" ON "tenant_members"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "tenant_members_tenant_id_user_id_key" ON "tenant_members"("tenant_id", "user_id");

-- CreateIndex
CREATE UNIQUE INDEX "invitations_token_hash_key" ON "invitations"("token_hash");

-- CreateIndex
CREATE INDEX "invitations_tenant_id_idx" ON "invitations"("tenant_id");

-- CreateIndex
CREATE INDEX "trial_registry_mobile_hash_idx" ON "trial_registry"("mobile_hash");

-- CreateIndex
CREATE INDEX "trial_registry_email_hash_idx" ON "trial_registry"("email_hash");

-- CreateIndex
CREATE INDEX "trial_registry_gstin_idx" ON "trial_registry"("gstin");

-- CreateIndex
CREATE INDEX "roles_tenant_id_idx" ON "roles"("tenant_id");

-- CreateIndex
CREATE UNIQUE INDEX "role_field_access_role_id_entity_field_key" ON "role_field_access"("role_id", "entity", "field");

-- CreateIndex
CREATE UNIQUE INDEX "field_definitions_tenant_id_entity_key_key" ON "field_definitions"("tenant_id", "entity", "key");

-- CreateIndex
CREATE UNIQUE INDEX "plans_key_key" ON "plans"("key");

-- CreateIndex
CREATE INDEX "prices_item_type_item_ref_cycle_idx" ON "prices"("item_type", "item_ref", "cycle");

-- CreateIndex
CREATE UNIQUE INDEX "subscriptions_tenant_id_key" ON "subscriptions"("tenant_id");

-- CreateIndex
CREATE INDEX "subscriptions_status_trial_ends_at_idx" ON "subscriptions"("status", "trial_ends_at");

-- CreateIndex
CREATE INDEX "outbox_events_published_at_occurred_at_idx" ON "outbox_events"("published_at", "occurred_at");

-- CreateIndex
CREATE INDEX "audit_log_tenant_id_at_idx" ON "audit_log"("tenant_id", "at" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "notification_log_dedup_key_key" ON "notification_log"("dedup_key");

-- CreateIndex
CREATE INDEX "notification_log_tenant_id_idx" ON "notification_log"("tenant_id");

-- CreateIndex
CREATE INDEX "notifications_tenant_id_user_id_created_at_idx" ON "notifications"("tenant_id", "user_id", "created_at" DESC);

-- AddForeignKey
ALTER TABLE "user_sessions" ADD CONSTRAINT "user_sessions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "branches" ADD CONSTRAINT "branches_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tenant_members" ADD CONSTRAINT "tenant_members_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tenant_members" ADD CONSTRAINT "tenant_members_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tenant_members" ADD CONSTRAINT "tenant_members_role_id_fkey" FOREIGN KEY ("role_id") REFERENCES "roles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "role_permissions" ADD CONSTRAINT "role_permissions_role_id_fkey" FOREIGN KEY ("role_id") REFERENCES "roles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "role_field_access" ADD CONSTRAINT "role_field_access_role_id_fkey" FOREIGN KEY ("role_id") REFERENCES "roles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "plan_modules" ADD CONSTRAINT "plan_modules_plan_id_fkey" FOREIGN KEY ("plan_id") REFERENCES "plans"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "subscription_items" ADD CONSTRAINT "subscription_items_subscription_id_fkey" FOREIGN KEY ("subscription_id") REFERENCES "subscriptions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "scheduled_changes" ADD CONSTRAINT "scheduled_changes_subscription_id_fkey" FOREIGN KEY ("subscription_id") REFERENCES "subscriptions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

