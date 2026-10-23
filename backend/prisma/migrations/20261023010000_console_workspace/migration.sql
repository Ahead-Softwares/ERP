-- Platform design v2, Step 2 (R3-lite): the Console workspace for the AHEAD team.

-- CreateEnum
CREATE TYPE "workspace" AS ENUM ('tenant', 'console');

-- AlterTable: which workspace a session is in (console sessions have no tenant)
ALTER TABLE "user_sessions" ADD COLUMN "workspace" "workspace" NOT NULL DEFAULT 'tenant';

-- CreateTable: platform-only, no grants to app_user
CREATE TABLE "platform_members" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "role_id" UUID NOT NULL,
    "reports_to" UUID,
    "status" "member_status" NOT NULL DEFAULT 'active',
    "created_by" UUID,
    "joined_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deactivated_at" TIMESTAMPTZ,

    CONSTRAINT "platform_members_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "platform_members_user_id_key" ON "platform_members"("user_id");

-- CreateIndex
CREATE INDEX "platform_members_reports_to_idx" ON "platform_members"("reports_to");

-- AddForeignKey
ALTER TABLE "platform_members" ADD CONSTRAINT "platform_members_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "platform_members" ADD CONSTRAINT "platform_members_role_id_fkey" FOREIGN KEY ("role_id") REFERENCES "roles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
