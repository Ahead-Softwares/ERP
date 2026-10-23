-- Platform design v2, Step 1: tenant source record (R1) and settings in the database (R2).

-- R1: sales team replaces the generic "admin" source
ALTER TYPE "tenant_source" RENAME VALUE 'admin' TO 'sales';

-- CreateEnum
CREATE TYPE "onboarding_type" AS ENUM ('trial', 'direct_paid');

-- CreateEnum
CREATE TYPE "acquired_by_type" AS ENUM ('self', 'vendor', 'sales_user', 'partner_user');

-- CreateEnum
CREATE TYPE "acquisition_method" AS ENUM ('signup', 'referral_link', 'referral_code', 'manual');

-- AlterTable
ALTER TABLE "tenants"
  ADD COLUMN "onboarding_type" "onboarding_type" NOT NULL DEFAULT 'trial',
  ADD COLUMN "is_internal" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable: platform-only, no grants to app_user (tenants never see who brought them in)
CREATE TABLE "tenant_acquisitions" (
    "tenant_id" UUID NOT NULL,
    "acquired_by_type" "acquired_by_type" NOT NULL,
    "acquired_by_user_id" UUID,
    "method" "acquisition_method" NOT NULL,
    "referral_code" TEXT,
    "coupon_code" TEXT,
    "locked_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "changed_by" UUID,
    "change_reason" TEXT,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "tenant_acquisitions_pkey" PRIMARY KEY ("tenant_id")
);

-- CreateIndex
CREATE INDEX "tenant_acquisitions_acquired_by_user_id_idx" ON "tenant_acquisitions"("acquired_by_user_id");

-- AddForeignKey
ALTER TABLE "tenant_acquisitions" ADD CONSTRAINT "tenant_acquisitions_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Backfill: every existing tenant came from self-signup
INSERT INTO "tenant_acquisitions" ("tenant_id", "acquired_by_type", "method", "locked_at", "updated_at")
SELECT "id", 'self', 'signup', "created_at", "created_at" FROM "tenants"
ON CONFLICT DO NOTHING;

-- CreateTable: platform-only settings (definitions live in src/contracts/config.ts)
CREATE TABLE "config_values" (
    "scope" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "value" JSONB NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "updated_by" UUID,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "config_values_pkey" PRIMARY KEY ("scope", "key")
);
