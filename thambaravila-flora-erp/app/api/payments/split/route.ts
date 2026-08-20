import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSessionUser, getClientIp } from '@/lib/auth/middleware';
import { computeBookingPaymentStatus } from '@/lib/payment/deadline-engine';
import { createActivityLog } from '@/lib/activity-log';
import { createAuditLog, AuditAction } from '@/lib/auth/audit';
import { PaymentStageType } from '@prisma/client';

const ALLOWED_ROLES = ['Accountant', 'Owner', 'IT/Admin'];

interface InstallmentInput {
  title?: string;
  customTitle?: string;
  amountDue: number; // in cents
  dueDate: string; // ISO date string
  stageType?: string;
}

export async function POST(request: NextRequest) {
  try {
    const user = await getSessionUser(request);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const roleName = user.role?.name || '';
    if (!ALLOWED_ROLES.includes(roleName)) {
      return NextResponse.json({ error: 'Forbidden. Only Accountant and Owner roles can customize payment installments.' }, { status: 403 });
    }

    const body = await request.json();
    const { bookingId, installments } = body as { bookingId: string; installments: InstallmentInput[] };

    if (!bookingId || !Array.isArray(installments) || installments.length === 0) {
      return NextResponse.json({ error: 'bookingId and an array of at least 1 installment are required' }, { status: 400 });
    }

    const booking = await prisma.booking.findUnique({
      where: { id: bookingId },
      include: {
        paymentStages: {
          include: { receipt: true },
          orderBy: [{ stageNumber: 'asc' }, { dueDate: 'asc' }],
        },
        customer: true,
      },
    });

    if (!booking) {
      return NextResponse.json({ error: 'Booking not found' }, { status: 404 });
    }

    // Validate installment values
    for (let i = 0; i < installments.length; i++) {
      const inst = installments[i];
      if (!inst.amountDue || inst.amountDue <= 0) {
        return NextResponse.json({ error: `Installment #${i + 1} must have a positive amount.` }, { status: 400 });
      }
      if (!inst.dueDate || isNaN(new Date(inst.dueDate).getTime())) {
        return NextResponse.json({ error: `Installment #${i + 1} must have a valid due date.` }, { status: 400 });
      }
    }

    const paidStages = booking.paymentStages.filter((s) => s.status === 'PAID' || s.amountPaid > 0);
    const totalPaidCents = paidStages.reduce((sum, s) => sum + s.amountPaid, 0);
    const remainingBalanceCents = Math.max(0, booking.totalQuoteAmount - totalPaidCents);

    const inputTotalCents = installments.reduce((sum, inst) => sum + Math.round(inst.amountDue), 0);

    // If there are already paid stages, the input installments can either represent the remaining balance OR the full new schedule
    // Let's accept inputTotal matching either remainingBalanceCents OR booking.totalQuoteAmount (if paid stages are included)
    const isMatchingRemaining = Math.abs(inputTotalCents - remainingBalanceCents) <= 100; // allow ±1 LKR rounding
    const isMatchingTotal = Math.abs(inputTotalCents - booking.totalQuoteAmount) <= 100;

    if (!isMatchingRemaining && !isMatchingTotal) {
      return NextResponse.json({
        error: `Total installments amount (LKR ${(inputTotalCents / 100).toLocaleString()}) must match the remaining balance (LKR ${(remainingBalanceCents / 100).toLocaleString()}) or total budget (LKR ${(booking.totalQuoteAmount / 100).toLocaleString()}).`,
      }, { status: 400 });
    }

    const unpaidStages = booking.paymentStages.filter((s) => s.status !== 'PAID' && s.amountPaid === 0);

    await prisma.$transaction(async (tx) => {
      // Delete existing unpaid stages
      if (unpaidStages.length > 0) {
        await tx.paymentStage.deleteMany({
          where: {
            id: { in: unpaidStages.map((s) => s.id) },
          },
        });
      }

      // Create new customized installment stages
      const startStageNum = paidStages.length + 1;
      for (let i = 0; i < installments.length; i++) {
        const inst = installments[i];
        const title = inst.customTitle || inst.title || (installments.length === 1 ? 'Full Settlement' : `Installment ${i + 1}`);
        const parsedDueDate = new Date(inst.dueDate);
        const stageType: PaymentStageType = inst.stageType && ['ADVANCE', 'FLOWER', 'FINAL', 'INSTALLMENT', 'CUSTOM'].includes(inst.stageType)
          ? (inst.stageType as PaymentStageType)
          : PaymentStageType.INSTALLMENT;

        await tx.paymentStage.create({
          data: {
            bookingId,
            stageType,
            customTitle: title,
            stageNumber: startStageNum + i,
            amountDue: Math.round(inst.amountDue),
            dueDate: parsedDueDate,
            amountPaid: 0,
            status: parsedDueDate < new Date() ? 'OVERDUE' : 'PENDING',
          },
        });
      }
    });

    // Recompute booking payment status
    const newPaymentStatus = await computeBookingPaymentStatus(bookingId);

    // Audit and Activity Logging
    await createAuditLog({
      userId: user.id,
      action: 'PAYMENT_STAGES_SPLIT' as any,
      entityType: 'booking',
      entityId: bookingId,
      details: {
        installmentsCount: installments.length,
        totalAllocatedCents: inputTotalCents,
        configuredBy: user.name,
      },
      ipAddress: getClientIp(request),
    });

    await createActivityLog({
      actorUserId: user.id,
      actorName: user.name,
      actorEmail: user.email,
      actorRole: roleName,
      action: 'PAYMENT_STAGES_SPLIT',
      category: 'FINANCE',
      entityType: 'booking',
      entityId: bookingId,
      summary: `Accountant configured ${installments.length} payment installments for booking ${bookingId} (${booking.customer.name})`,
      changedData: { installmentsCount: installments.length, totalAllocated: inputTotalCents },
      httpMethod: 'POST',
      route: '/api/payments/split',
      statusCode: 200,
      ipAddress: getClientIp(request),
      userAgent: request.headers.get('user-agent'),
    });

    const updatedBooking = await prisma.booking.findUnique({
      where: { id: bookingId },
      include: {
        paymentStages: {
          include: {
            paidConfirmedBy: { select: { id: true, name: true, email: true } },
            receipt: true,
          },
          orderBy: [{ stageNumber: 'asc' }, { dueDate: 'asc' }],
        },
      },
    });

    return NextResponse.json({
      message: `Successfully configured ${installments.length} installment(s) for booking ${bookingId}!`,
      booking: updatedBooking,
      paymentStatus: newPaymentStatus,
    });
  } catch (error: any) {
    console.error('Error splitting payment stages:', error);
    return NextResponse.json({ error: error.message || 'Failed to split installments' }, { status: 500 });
  }
}
