CREATE TYPE "BookingConfirmationStatus" AS ENUM ('PENDING', 'CONFIRMED', 'NOT_CONFIRMED');

ALTER TABLE "bookings"
ADD COLUMN "confirmation_status" "BookingConfirmationStatus" NOT NULL DEFAULT 'PENDING',
ADD COLUMN "quotation_attachment_url" TEXT,
ADD COLUMN "quotation_attachment_name" TEXT,
ADD COLUMN "quotation_attachment_type" TEXT,
ADD COLUMN "job_sheet_attachment_url" TEXT,
ADD COLUMN "job_sheet_attachment_name" TEXT,
ADD COLUMN "job_sheet_attachment_type" TEXT,
ADD COLUMN "quote_outcome_reason" TEXT;
