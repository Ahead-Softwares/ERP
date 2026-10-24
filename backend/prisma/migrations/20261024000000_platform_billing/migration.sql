-- Platform design v2, Step 4a: paid onboarding from the Console, platform orders, payments, invoices.

-- A client created by sales/vendor waits in "incomplete" until the first payment
ALTER TYPE "tenant_status" ADD VALUE IF NOT EXISTS 'incomplete' BEFORE 'trialing';

-- CreateEnum
CREATE TYPE "platform_order_status" AS ENUM ('pending_approval', 'awaiting_payment', 'paid', 'cancelled');

-- CreateEnum
CREATE TYPE "platform_payment_method" AS ENUM ('bank_transfer', 'upi', 'cheque', 'cash', 'razorpay');

-- CreateTable
CREATE TABLE "platform_orders" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "kind" TEXT NOT NULL DEFAULT 'fresh',
    "status" "platform_order_status" NOT NULL DEFAULT 'awaiting_payment',
    "plan_id" UUID NOT NULL,
    "cycle" "billing_cycle" NOT NULL,
    "items" JSONB NOT NULL,
    "list_paise" BIGINT NOT NULL,
    "discount_bp" INTEGER NOT NULL DEFAULT 0,
    "coupon_code" TEXT,
    "discount_paise" BIGINT NOT NULL DEFAULT 0,
    "taxable_paise" BIGINT NOT NULL,
    "cgst_paise" BIGINT NOT NULL DEFAULT 0,
    "sgst_paise" BIGINT NOT NULL DEFAULT 0,
    "igst_paise" BIGINT NOT NULL DEFAULT 0,
    "total_paise" BIGINT NOT NULL,
    "bill_to" JSONB NOT NULL,
    "created_by" UUID NOT NULL,
    "approved_by" UUID,
    "approved_at" TIMESTAMPTZ,
    "cancelled_reason" TEXT,
    "expires_at" TIMESTAMPTZ NOT NULL,
    "paid_at" TIMESTAMPTZ,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "platform_orders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "platform_payments" (
    "id" UUID NOT NULL,
    "order_id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "method" "platform_payment_method" NOT NULL,
    "amount_paise" BIGINT NOT NULL,
    "reference" TEXT,
    "gateway_payment_id" TEXT,
    "received_at" TIMESTAMPTZ NOT NULL,
    "recorded_by" UUID,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "platform_payments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "platform_invoices" (
    "id" UUID NOT NULL,
    "number" TEXT NOT NULL,
    "fy" TEXT NOT NULL,
    "tenant_id" UUID NOT NULL,
    "order_id" UUID NOT NULL,
    "seller" JSONB NOT NULL,
    "bill_to" JSONB NOT NULL,
    "lines" JSONB NOT NULL,
    "taxable_paise" BIGINT NOT NULL,
    "cgst_paise" BIGINT NOT NULL,
    "sgst_paise" BIGINT NOT NULL,
    "igst_paise" BIGINT NOT NULL,
    "total_paise" BIGINT NOT NULL,
    "issued_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "platform_invoices_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "platform_sequences" (
    "doc_type" TEXT NOT NULL,
    "fy" TEXT NOT NULL,
    "next_no" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "platform_sequences_pkey" PRIMARY KEY ("doc_type", "fy")
);

-- CreateIndex
CREATE INDEX "platform_orders_tenant_id_created_at_idx" ON "platform_orders"("tenant_id", "created_at");
CREATE INDEX "platform_orders_status_idx" ON "platform_orders"("status");
CREATE UNIQUE INDEX "platform_payments_gateway_payment_id_key" ON "platform_payments"("gateway_payment_id");
CREATE INDEX "platform_payments_tenant_id_idx" ON "platform_payments"("tenant_id");
CREATE UNIQUE INDEX "platform_invoices_number_key" ON "platform_invoices"("number");
CREATE UNIQUE INDEX "platform_invoices_order_id_key" ON "platform_invoices"("order_id");
CREATE INDEX "platform_invoices_tenant_id_idx" ON "platform_invoices"("tenant_id");

-- AddForeignKey
ALTER TABLE "platform_payments" ADD CONSTRAINT "platform_payments_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "platform_orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "platform_invoices" ADD CONSTRAINT "platform_invoices_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "platform_orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
