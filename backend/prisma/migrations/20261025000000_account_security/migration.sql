-- Phase 2: My account + security. All tables here are platform tables (no RLS policy for
-- app_user): they are read and written only with platform privileges.

ALTER TYPE "otp_purpose" ADD VALUE IF NOT EXISTS 'email_change';
ALTER TYPE "otp_purpose" ADD VALUE IF NOT EXISTS 'mobile_change';
ALTER TYPE "otp_purpose" ADD VALUE IF NOT EXISTS 'close_account';

-- Personal look and working preferences; password age for expiry policies
ALTER TABLE "users" ADD COLUMN "preferences" JSONB NOT NULL DEFAULT '{}';
ALTER TABLE "users" ADD COLUMN "password_changed_at" TIMESTAMPTZ;

-- Two-step verification (TOTP). The secret is encrypted; backup codes are stored hashed.
CREATE TABLE "user_mfa" (
    "user_id" UUID NOT NULL,
    "secret_enc" TEXT NOT NULL,
    "enabled_at" TIMESTAMPTZ,
    "backup_codes" JSONB NOT NULL DEFAULT '[]',
    "failed_attempts" INTEGER NOT NULL DEFAULT 0,
    "locked_until" TIMESTAMPTZ,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT "user_mfa_pkey" PRIMARY KEY ("user_id"),
    CONSTRAINT "user_mfa_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE
);

-- "Trust this device for 30 days"
CREATE TABLE "user_trusted_devices" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "token_hash" TEXT NOT NULL,
    "user_agent" TEXT,
    "expires_at" TIMESTAMPTZ NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT "user_trusted_devices_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "user_trusted_devices_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE
);
CREATE UNIQUE INDEX "user_trusted_devices_token_hash_key" ON "user_trusted_devices"("token_hash");
CREATE INDEX "user_trusted_devices_user_id_idx" ON "user_trusted_devices"("user_id");

-- Last password hashes, for "no reuse of the last 3"
CREATE TABLE "user_password_history" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "password_hash" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT "user_password_history_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "user_password_history_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE
);
CREATE INDEX "user_password_history_user_id_idx" ON "user_password_history"("user_id", "created_at");

-- Every sign-in attempt (kept even when the attempt fails)
CREATE TABLE "sign_in_events" (
    "id" UUID NOT NULL,
    "user_id" UUID,
    "tenant_id" UUID,
    "identifier" TEXT,
    "outcome" TEXT NOT NULL,
    "method" TEXT,
    "ip" TEXT,
    "user_agent" TEXT,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT "sign_in_events_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "sign_in_events_user_id_idx" ON "sign_in_events"("user_id", "created_at");
CREATE INDEX "sign_in_events_created_at_idx" ON "sign_in_events"("created_at");
