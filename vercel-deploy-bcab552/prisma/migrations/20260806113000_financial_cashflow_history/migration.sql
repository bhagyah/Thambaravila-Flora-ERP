CREATE TYPE "FinancialRecordType" AS ENUM ('RECEIPT', 'EXPENSE');
CREATE TYPE "FinancialAdjustmentAction" AS ENUM ('EDIT', 'DELETE');
CREATE TYPE "FinancialAdjustmentStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

CREATE TABLE "payment_receipts" (
    "id" TEXT NOT NULL,
    "payment_stage_id" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "received_at" TIMESTAMP(3) NOT NULL,
    "payment_method" TEXT,
    "notes" TEXT,
    "confirmed_by_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "payment_receipts_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "financial_adjustment_requests" (
    "id" TEXT NOT NULL,
    "source_type" "FinancialRecordType" NOT NULL,
    "source_id" TEXT NOT NULL,
    "action" "FinancialAdjustmentAction" NOT NULL,
    "status" "FinancialAdjustmentStatus" NOT NULL DEFAULT 'PENDING',
    "proposed_amount" INTEGER,
    "proposed_date" TIMESTAMP(3),
    "proposed_description" TEXT,
    "proposed_category" TEXT,
    "reason" TEXT NOT NULL,
    "snapshot" JSONB NOT NULL,
    "requested_by_id" TEXT NOT NULL,
    "decided_by_id" TEXT,
    "decision_note" TEXT,
    "decided_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "financial_adjustment_requests_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "payment_receipts_payment_stage_id_key" ON "payment_receipts"("payment_stage_id");
CREATE INDEX "payment_receipts_received_at_idx" ON "payment_receipts"("received_at");
CREATE INDEX "payment_receipts_confirmed_by_id_idx" ON "payment_receipts"("confirmed_by_id");
CREATE INDEX "financial_adjustment_requests_source_type_source_id_idx" ON "financial_adjustment_requests"("source_type", "source_id");
CREATE INDEX "financial_adjustment_requests_status_created_at_idx" ON "financial_adjustment_requests"("status", "created_at");
CREATE INDEX "financial_adjustment_requests_requested_by_id_idx" ON "financial_adjustment_requests"("requested_by_id");

ALTER TABLE "payment_receipts" ADD CONSTRAINT "payment_receipts_payment_stage_id_fkey" FOREIGN KEY ("payment_stage_id") REFERENCES "payment_stages"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "payment_receipts" ADD CONSTRAINT "payment_receipts_confirmed_by_id_fkey" FOREIGN KEY ("confirmed_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "financial_adjustment_requests" ADD CONSTRAINT "financial_adjustment_requests_requested_by_id_fkey" FOREIGN KEY ("requested_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "financial_adjustment_requests" ADD CONSTRAINT "financial_adjustment_requests_decided_by_id_fkey" FOREIGN KEY ("decided_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
