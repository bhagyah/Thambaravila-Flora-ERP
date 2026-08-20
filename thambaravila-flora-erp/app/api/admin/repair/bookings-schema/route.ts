import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth/config';
import { prisma } from '@/lib/prisma';
import { createAuditLog } from '@/lib/auth/audit';

const REPAIR_STEPS = [
  `DO $$ BEGIN
    CREATE TYPE "BookingConfirmationStatus" AS ENUM ('PENDING', 'CONFIRMED', 'NOT_CONFIRMED');
  EXCEPTION
    WHEN duplicate_object THEN null;
  END $$;`,
  `ALTER TABLE "bookings"
    ADD COLUMN IF NOT EXISTS "confirmation_status" "BookingConfirmationStatus" NOT NULL DEFAULT 'PENDING';`,
  `ALTER TABLE "bookings"
    ADD COLUMN IF NOT EXISTS "quotation_attachment_url" TEXT;`,
  `ALTER TABLE "bookings"
    ADD COLUMN IF NOT EXISTS "quotation_attachment_name" TEXT;`,
  `ALTER TABLE "bookings"
    ADD COLUMN IF NOT EXISTS "quotation_attachment_type" TEXT;`,
  `ALTER TABLE "bookings"
    ADD COLUMN IF NOT EXISTS "job_sheet_attachment_url" TEXT;`,
  `ALTER TABLE "bookings"
    ADD COLUMN IF NOT EXISTS "job_sheet_attachment_name" TEXT;`,
  `ALTER TABLE "bookings"
    ADD COLUMN IF NOT EXISTS "job_sheet_attachment_type" TEXT;`,
  `ALTER TABLE "bookings"
    ADD COLUMN IF NOT EXISTS "quote_outcome_reason" TEXT;`,
];

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    const roleName = session?.user?.role?.name || '';

    if (!session?.user?.id || (roleName !== 'Owner' && roleName !== 'IT/Admin')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const applied: string[] = [];

    for (const sql of REPAIR_STEPS) {
      await prisma.$executeRawUnsafe(sql);
      applied.push(sql.split('\n')[0].trim());
    }

    await createAuditLog({
      userId: session.user.id,
      action: 'BOOKING_SCHEMA_REPAIRED',
      details: {
        appliedSteps: applied.length,
      },
      ipAddress: request.headers.get('x-forwarded-for') || undefined,
    });

    return NextResponse.json({
      success: true,
      message: 'Booking schema repaired successfully.',
      appliedSteps: applied.length,
    });
  } catch (error: any) {
    console.error('[Repair bookings schema] Error:', error);
    return NextResponse.json(
      { error: error?.message || 'Failed to repair booking schema' },
      { status: 500 }
    );
  }
}
