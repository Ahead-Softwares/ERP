-- Platform design v2, Step 3: trial / grace extensions given from the Console.

-- CreateEnum
CREATE TYPE "extension_kind" AS ENUM ('trial', 'grace');

-- CreateTable: platform-only (tenant_id present, no RLS policy and no grants to app_user)
CREATE TABLE "grace_periods" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "kind" "extension_kind" NOT NULL,
    "days" INTEGER NOT NULL,
    "reason" TEXT NOT NULL,
    "previous_end_at" TIMESTAMPTZ,
    "new_end_at" TIMESTAMPTZ NOT NULL,
    "granted_by" UUID NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "grace_periods_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "grace_periods_tenant_id_created_at_idx" ON "grace_periods"("tenant_id", "created_at");
