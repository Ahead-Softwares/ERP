-- Platform design v2, Step 4b: payment links, gateway webhooks, credit notes.

-- AlterTable
ALTER TABLE "platform_orders"
  ADD COLUMN "payment_link_id" TEXT,
  ADD COLUMN "payment_link_url" TEXT,
  ADD COLUMN "payment_link_at" TIMESTAMPTZ;

-- CreateIndex
CREATE UNIQUE INDEX "platform_orders_payment_link_id_key" ON "platform_orders"("payment_link_id");

-- CreateTable: platform-only (no grants to app_user)
CREATE TABLE "platform_credit_notes" (
    "id" UUID NOT NULL,
    "number" TEXT NOT NULL,
    "fy" TEXT NOT NULL,
    "tenant_id" UUID NOT NULL,
    "invoice_id" UUID NOT NULL,
    "reason" TEXT NOT NULL,
    "taxable_paise" BIGINT NOT NULL,
    "cgst_paise" BIGINT NOT NULL,
    "sgst_paise" BIGINT NOT NULL,
    "igst_paise" BIGINT NOT NULL,
    "total_paise" BIGINT NOT NULL,
    "created_by" UUID NOT NULL,
    "issued_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "platform_credit_notes_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "platform_credit_notes_number_key" ON "platform_credit_notes"("number");
CREATE UNIQUE INDEX "platform_credit_notes_invoice_id_key" ON "platform_credit_notes"("invoice_id");
CREATE INDEX "platform_credit_notes_tenant_id_idx" ON "platform_credit_notes"("tenant_id");

-- CreateTable: platform-only
CREATE TABLE "webhook_events" (
    "id" UUID NOT NULL,
    "gateway" TEXT NOT NULL,
    "event_id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "received_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "processed_at" TIMESTAMPTZ,
    "error" TEXT,

    CONSTRAINT "webhook_events_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "webhook_events_event_id_key" ON "webhook_events"("event_id");
