import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSessionUser, getClientIp } from '@/lib/auth/middleware';
import { computeBookingPaymentStatus } from '@/lib/payment/deadline-engine';
import { createActivityLog } from '@/lib/activity-log';
import { createAuditLog } from '@/lib/auth/audit';
import { PaymentStageType } from '@prisma/client';

const ALLOWED_ROLES = ['Accountant', 'Owner', 'IT/Admin'];

interface SubSplitInput {
  title?: string;
  customTitle?: string;
  amountDue: number; // in cents
  dueDate: string; // ISO string
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getSessionUser(request);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const roleName = user.role?.name || '';
    if (!ALLOWED_ROLES.includes(roleName)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { id } = await params;
    const body = await request.json();
    const { splits } = body as { splits: SubSplitInput[] };

    if (!Array.isArray(splits) || splits.length < 2) {
      return NextResponse.json({ error: 'Please provide at least 2 portions to split this due into.' }, { status: 400 });
    }

    const targetStage = await prisma.paymentStage.findUnique({
      where: { id },
      include: {
        booking: {
          include: {
            customer: true,
          },
        },
        receipt: true,
      },
    });

    if (!targetStage) {
      return NextResponse.json({ error: 'Payment stage not found' }, { status: 404 });
    }

    if (targetStage.status === 'PAID' || targetStage.amountPaid > 0 || targetStage.receipt) {
      return NextResponse.json({ error: 'Cannot split an already paid stage.' }, { status: 400 });
    }

    // Validate splits
    for (let i = 0; i < splits.length; i++) {
      const s = splits[i];
      if (!s.amountDue || s.amountDue <= 0) {
        return NextResponse.json({ error: `Portion #${i + 1} must have a positive amount.` }, { status: 400 });
      }
      if (!s.dueDate || isNaN(new Date(s.dueDate).getTime())) {
        return NextResponse.json({ error: `Portion #${i + 1} must have a valid due date.` }, { status: 400 });
      }
    }

    const totalSplitCents = splits.reduce((sum, s) => sum + Math.round(s.amountDue), 0);
    if (Math.abs(totalSplitCents - targetStage.amountDue) > 100) { // allow ±1 LKR rounding
      return NextResponse.json({
        error: `Sum of split portions (LKR ${(totalSplitCents / 100).toLocaleString()}) must equal the original due amount of LKR ${(targetStage.amountDue / 100).toLocaleString()}.`,
      }, { status: 400 });
    }

    const baseTitle = targetStage.customTitle || targetStage.stageType || 'Installment';
    const baseStageNumber = targetStage.stageNumber || 1;

    await prisma.$transaction(async (tx) => {
      // 1. Delete original unpaid stage
      await tx.paymentStage.delete({
        where: { id },
      });

      // 2. Create the split stages
      for (let i = 0; i < splits.length; i++) {
        const s = splits[i];
        const parsedDate = new Date(s.dueDate);
        const title = s.customTitle || s.title || `${baseTitle} (Part ${i + 1})`;

        await tx.paymentStage.create({
          data: {
            bookingId: targetStage.bookingId,
            stageType: PaymentStageType.INSTALLMENT,
            customTitle: title,
            stageNumber: baseStageNumber + i,
            amountDue: Math.round(s.amountDue),
            dueDate: parsedDate,
            amountPaid: 0,
            status: parsedDate < new Date() ? 'OVERDUE' : 'PENDING',
          },
        });
      }
    });

    await computeBookingPaymentStatus(targetStage.bookingId);

    // Audit and Activity Log
    await createAuditLog({
      userId: user.id,
      action: 'PAYMENT_STAGE_SPLIT' as any,
      entityType: 'payment_stage',
      entityId: id,
      details: {
        bookingId: targetStage.bookingId,
        originalAmountCents: targetStage.amountDue,
        splitParts: splits.length,
      },
      ipAddress: getClientIp(request),
    });

    await createActivityLog({
      actorUserId: user.id,
      actorName: user.name,
      actorEmail: user.email,
      actorRole: roleName,
      action: 'PAYMENT_STAGE_SPLIT',
      category: 'FINANCE',
      entityType: 'booking',
      entityId: targetStage.bookingId,
      summary: `Split pending due of LKR ${(targetStage.amountDue / 100).toLocaleString()} into ${splits.length} parts for booking ${targetStage.bookingId}`,
      httpMethod: 'POST',
      route: `/api/payments/stage/${id}/split`,
      statusCode: 200,
      ipAddress: getClientIp(request),
      userAgent: request.headers.get('user-agent'),
    });

    return NextResponse.json({
      message: `Successfully split due into ${splits.length} parts!`,
    });
  } catch (error: any) {
    console.error('Error splitting single stage:', error);
    return NextResponse.json({ error: error.message || 'Failed to split payment stage' }, { status: 500 });
  }
}
