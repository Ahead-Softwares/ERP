-- Phase 1: signup answers and workspace preferences (documents, payments, taxes, branding).
-- Both live on the tenant row, so the existing tenant_self RLS policy covers them.
ALTER TABLE "tenants" ADD COLUMN "profile" JSONB NOT NULL DEFAULT '{}';
ALTER TABLE "tenants" ADD COLUMN "preferences" JSONB NOT NULL DEFAULT '{}';
