-- CreateEnum
CREATE TYPE "item_type" AS ENUM ('product', 'service');

-- CreateEnum
CREATE TYPE "contact_type" AS ENUM ('lead', 'customer');

-- CreateEnum
CREATE TYPE "lead_status" AS ENUM ('new', 'contacted', 'qualified', 'lost', 'converted');

-- CreateEnum
CREATE TYPE "activity_type" AS ENUM ('note', 'call', 'meeting', 'follow_up');

-- CreateEnum
CREATE TYPE "sales_doc_kind" AS ENUM ('quotation', 'invoice');

-- CreateEnum
CREATE TYPE "sales_doc_status" AS ENUM ('draft', 'sent', 'accepted', 'declined', 'converted', 'issued', 'partially_paid', 'paid', 'cancelled');

-- CreateEnum
CREATE TYPE "payment_method" AS ENUM ('cash', 'upi', 'card', 'bank', 'cheque', 'other');

-- CreateEnum
CREATE TYPE "task_status" AS ENUM ('todo', 'in_progress', 'done', 'cancelled');

-- CreateEnum
CREATE TYPE "task_priority" AS ENUM ('low', 'medium', 'high', 'urgent');

-- CreateEnum
CREATE TYPE "appointment_kind" AS ENUM ('appointment', 'event');

-- CreateEnum
CREATE TYPE "appointment_status" AS ENUM ('scheduled', 'confirmed', 'completed', 'cancelled', 'no_show');

-- CreateTable
CREATE TABLE "item_categories" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "item_categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "items" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "type" "item_type" NOT NULL DEFAULT 'product',
    "name" TEXT NOT NULL,
    "sku" TEXT,
    "category_id" UUID,
    "unit" TEXT NOT NULL DEFAULT 'pcs',
    "price_paise" BIGINT NOT NULL DEFAULT 0,
    "cost_price_paise" BIGINT,
    "gst_rate_bp" INTEGER NOT NULL DEFAULT 1800,
    "hsn_sac" VARCHAR(10),
    "duration_min" INTEGER,
    "skill" TEXT,
    "description" TEXT,
    "image_url" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "custom" JSONB NOT NULL DEFAULT '{}',
    "source" "record_source" NOT NULL DEFAULT 'tenant',
    "created_by" UUID,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "contacts" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "branch_id" UUID,
    "type" "contact_type" NOT NULL DEFAULT 'customer',
    "name" TEXT NOT NULL,
    "company_name" TEXT,
    "phone" VARCHAR(15),
    "email" TEXT,
    "gstin" VARCHAR(15),
    "state_code" CHAR(2),
    "address" JSONB,
    "lead_status" "lead_status",
    "lead_source" TEXT,
    "owner_id" UUID,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "notes" TEXT,
    "custom" JSONB NOT NULL DEFAULT '{}',
    "created_by" UUID,
    "converted_at" TIMESTAMPTZ,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "contacts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "activities" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "contact_id" UUID NOT NULL,
    "type" "activity_type" NOT NULL,
    "title" TEXT,
    "body" TEXT,
    "due_at" TIMESTAMPTZ,
    "completed_at" TIMESTAMPTZ,
    "assignee_id" UUID,
    "created_by" UUID,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "activities_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tenant_sequences" (
    "tenant_id" UUID NOT NULL,
    "doc_type" TEXT NOT NULL,
    "fy" TEXT NOT NULL,
    "prefix" TEXT NOT NULL,
    "next_no" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "tenant_sequences_pkey" PRIMARY KEY ("tenant_id","doc_type","fy")
);

-- CreateTable
CREATE TABLE "sales_documents" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "branch_id" UUID,
    "kind" "sales_doc_kind" NOT NULL,
    "status" "sales_doc_status" NOT NULL DEFAULT 'draft',
    "number" TEXT,
    "fy" TEXT,
    "contact_id" UUID,
    "buyer" JSONB NOT NULL DEFAULT '{}',
    "seller" JSONB,
    "place_of_supply" CHAR(2),
    "issue_date" DATE NOT NULL,
    "due_date" DATE,
    "subtotal_paise" BIGINT NOT NULL DEFAULT 0,
    "discount_paise" BIGINT NOT NULL DEFAULT 0,
    "taxable_paise" BIGINT NOT NULL DEFAULT 0,
    "cgst_paise" BIGINT NOT NULL DEFAULT 0,
    "sgst_paise" BIGINT NOT NULL DEFAULT 0,
    "igst_paise" BIGINT NOT NULL DEFAULT 0,
    "total_paise" BIGINT NOT NULL DEFAULT 0,
    "paid_paise" BIGINT NOT NULL DEFAULT 0,
    "notes" TEXT,
    "terms" TEXT,
    "source_type" TEXT,
    "source_id" UUID,
    "share_token" TEXT,
    "custom" JSONB NOT NULL DEFAULT '{}',
    "created_by" UUID,
    "issued_at" TIMESTAMPTZ,
    "cancelled_at" TIMESTAMPTZ,
    "cancel_reason" TEXT,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "sales_documents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sales_document_lines" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "document_id" UUID NOT NULL,
    "item_id" UUID,
    "description" TEXT NOT NULL,
    "hsn_sac" VARCHAR(10),
    "unit" TEXT NOT NULL DEFAULT 'pcs',
    "quantity" DECIMAL(18,3) NOT NULL,
    "unit_price_paise" BIGINT NOT NULL,
    "discount_paise" BIGINT NOT NULL DEFAULT 0,
    "taxable_paise" BIGINT NOT NULL,
    "gst_rate_bp" INTEGER NOT NULL,
    "cgst_paise" BIGINT NOT NULL DEFAULT 0,
    "sgst_paise" BIGINT NOT NULL DEFAULT 0,
    "igst_paise" BIGINT NOT NULL DEFAULT 0,
    "total_paise" BIGINT NOT NULL,
    "position" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "sales_document_lines_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payments_received" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "document_id" UUID NOT NULL,
    "contact_id" UUID,
    "number" TEXT NOT NULL,
    "amount_paise" BIGINT NOT NULL,
    "method" "payment_method" NOT NULL,
    "reference" TEXT,
    "paid_on" DATE NOT NULL,
    "notes" TEXT,
    "created_by" UUID,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "payments_received_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "expenses" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "branch_id" UUID,
    "category" TEXT NOT NULL,
    "amount_paise" BIGINT NOT NULL,
    "paid_on" DATE NOT NULL,
    "method" "payment_method" NOT NULL DEFAULT 'cash',
    "payee" TEXT,
    "notes" TEXT,
    "receipt_url" TEXT,
    "created_by" UUID,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "expenses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tasks" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "parent_id" UUID,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "status" "task_status" NOT NULL DEFAULT 'todo',
    "priority" "task_priority" NOT NULL DEFAULT 'medium',
    "due_at" TIMESTAMPTZ,
    "assignee_id" UUID,
    "contact_id" UUID,
    "created_by" UUID,
    "completed_at" TIMESTAMPTZ,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "tasks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "task_events" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "task_id" UUID NOT NULL,
    "actor_id" UUID,
    "type" TEXT NOT NULL,
    "body" TEXT,
    "data" JSONB,
    "at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "task_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "appointments" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "branch_id" UUID,
    "kind" "appointment_kind" NOT NULL DEFAULT 'appointment',
    "title" TEXT NOT NULL,
    "contact_id" UUID,
    "item_id" UUID,
    "staff_id" UUID,
    "start_at" TIMESTAMPTZ NOT NULL,
    "end_at" TIMESTAMPTZ NOT NULL,
    "status" "appointment_status" NOT NULL DEFAULT 'scheduled',
    "notes" TEXT,
    "invoice_id" UUID,
    "created_by" UUID,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "appointments_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "item_categories_tenant_id_name_key" ON "item_categories"("tenant_id", "name");

-- CreateIndex
CREATE INDEX "items_tenant_id_name_idx" ON "items"("tenant_id", "name");

-- CreateIndex
CREATE INDEX "contacts_tenant_id_type_name_idx" ON "contacts"("tenant_id", "type", "name");

-- CreateIndex
CREATE INDEX "contacts_tenant_id_phone_idx" ON "contacts"("tenant_id", "phone");

-- CreateIndex
CREATE INDEX "contacts_tenant_id_email_idx" ON "contacts"("tenant_id", "email");

-- CreateIndex
CREATE INDEX "activities_tenant_id_contact_id_created_at_idx" ON "activities"("tenant_id", "contact_id", "created_at" DESC);

-- CreateIndex
CREATE INDEX "activities_tenant_id_assignee_id_due_at_idx" ON "activities"("tenant_id", "assignee_id", "due_at");

-- CreateIndex
CREATE UNIQUE INDEX "sales_documents_share_token_key" ON "sales_documents"("share_token");

-- CreateIndex
CREATE INDEX "sales_documents_tenant_id_kind_status_issue_date_idx" ON "sales_documents"("tenant_id", "kind", "status", "issue_date");

-- CreateIndex
CREATE INDEX "sales_documents_tenant_id_contact_id_idx" ON "sales_documents"("tenant_id", "contact_id");

-- CreateIndex
CREATE UNIQUE INDEX "sales_documents_tenant_id_kind_number_key" ON "sales_documents"("tenant_id", "kind", "number");

-- CreateIndex
CREATE INDEX "sales_document_lines_tenant_id_document_id_idx" ON "sales_document_lines"("tenant_id", "document_id");

-- CreateIndex
CREATE INDEX "payments_received_tenant_id_document_id_idx" ON "payments_received"("tenant_id", "document_id");

-- CreateIndex
CREATE INDEX "payments_received_tenant_id_paid_on_idx" ON "payments_received"("tenant_id", "paid_on");

-- CreateIndex
CREATE INDEX "expenses_tenant_id_paid_on_idx" ON "expenses"("tenant_id", "paid_on");

-- CreateIndex
CREATE INDEX "tasks_tenant_id_status_due_at_idx" ON "tasks"("tenant_id", "status", "due_at");

-- CreateIndex
CREATE INDEX "tasks_tenant_id_assignee_id_idx" ON "tasks"("tenant_id", "assignee_id");

-- CreateIndex
CREATE INDEX "tasks_tenant_id_parent_id_idx" ON "tasks"("tenant_id", "parent_id");

-- CreateIndex
CREATE INDEX "task_events_tenant_id_task_id_at_idx" ON "task_events"("tenant_id", "task_id", "at");

-- CreateIndex
CREATE INDEX "appointments_tenant_id_start_at_idx" ON "appointments"("tenant_id", "start_at");

-- CreateIndex
CREATE INDEX "appointments_tenant_id_staff_id_start_at_idx" ON "appointments"("tenant_id", "staff_id", "start_at");

-- AddForeignKey
ALTER TABLE "sales_document_lines" ADD CONSTRAINT "sales_document_lines_document_id_fkey" FOREIGN KEY ("document_id") REFERENCES "sales_documents"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payments_received" ADD CONSTRAINT "payments_received_document_id_fkey" FOREIGN KEY ("document_id") REFERENCES "sales_documents"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


-- ── Row-level security for Phase 1 module tables ──
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'item_categories', 'items', 'contacts', 'activities', 'tenant_sequences',
    'sales_documents', 'sales_document_lines', 'payments_received', 'expenses',
    'tasks', 'task_events', 'appointments'
  ] LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY', t);
    EXECUTE format('CREATE POLICY tenant_isolation ON %I USING (tenant_id = app_tenant()) WITH CHECK (tenant_id = app_tenant())', t);
    EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON %I TO app_user', t);
  END LOOP;
END $$;

-- Task history and receipts are append-only for tenants
REVOKE UPDATE, DELETE ON task_events FROM app_user;
REVOKE UPDATE, DELETE ON payments_received FROM app_user;

-- SKU unique per tenant when present
CREATE UNIQUE INDEX items_tenant_sku_uq ON items (tenant_id, lower(sku)) WHERE sku IS NOT NULL;

-- Custom-field filtering (LLD §5.3)
CREATE INDEX items_custom_gin ON items USING gin (custom jsonb_path_ops);
CREATE INDEX contacts_custom_gin ON contacts USING gin (custom jsonb_path_ops);

-- BKG-02: a staff member can never be double-booked (database-enforced)
CREATE EXTENSION IF NOT EXISTS btree_gist;
ALTER TABLE appointments ADD CONSTRAINT appointments_no_double_booking
  EXCLUDE USING gist (tenant_id WITH =, staff_id WITH =, tstzrange(start_at, end_at) WITH &&)
  WHERE (staff_id IS NOT NULL AND status NOT IN ('cancelled', 'no_show'));
ALTER TABLE appointments ADD CONSTRAINT appointments_end_after_start CHECK (end_at > start_at);
