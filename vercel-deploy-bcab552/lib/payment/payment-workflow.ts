import { prisma } from '@/lib/prisma';
import { BookingConfirmationStatus, BookingStatus, PaymentStageType } from '@prisma/client';
import { createAuditLog, AuditAction } from '@/lib/auth/audit';
import { computeBookingPaymentStatus } from '@/lib/payment/deadline-engine';

/**
 * Payment Workflow System for Bookings
 * 
 * CRITICAL BUSINESS RULE:
 * Only Accountant role can mark payments as paid.
 * Payment confirmation is the ONLY trigger that updates Booking payment status.
 */

interface PaymentConfirmationData {
  paymentStageId: string;
  amountPaid: number;
  paidDate: Date;
  confirmedByUserId: string;
  paymentMethod?: string | null;
  notes?: string | null;
  ipAddress?: string;
}

export async function confirmPayment(
  data: PaymentConfirmationData
): Promise<{
  paymentStage: any;
  bookingPaymentStatus: string;
}> {
  const { paymentStageId, amountPaid, paidDate, confirmedByUserId, paymentMethod, notes, ipAddress } = data;

  const paymentStage = await prisma.paymentStage.findUnique({ where: { id: paymentStageId } });

  if (!paymentStage) {
    throw new Error('Payment stage not found');
  }

  if (paymentStage.status === 'PAID') {
    throw new Error('Payment has already been confirmed');
  }

  if (amountPaid <= 0) {
    throw new Error('Payment amount must be positive');
  }

  const updatedPaymentStage = await prisma.$transaction(async (tx) => {
    const updated = await tx.paymentStage.update({
      where: { id: paymentStageId },
      data: {
        amountPaid,
        paidDate,
        paidConfirmedById: confirmedByUserId,
        status: 'PAID',
      },
    });

    await tx.paymentReceipt.upsert({
      where: { paymentStageId },
      create: {
        paymentStageId,
        amount: amountPaid,
        receivedAt: paidDate,
        confirmedById: confirmedByUserId,
        paymentMethod: paymentMethod || null,
        notes: notes || null,
      },
      update: {
        amount: amountPaid,
        receivedAt: paidDate,
        confirmedById: confirmedByUserId,
        paymentMethod: paymentMethod || null,
        notes: notes || null,
      },
    });

    const booking = await tx.booking.findUnique({
      where: { id: paymentStage.bookingId },
      select: { totalQuoteAmount: true },
    });
    const paid = await tx.paymentStage.aggregate({
      where: { bookingId: paymentStage.bookingId },
      _sum: { amountPaid: true },
    });
    if (booking) {
      await tx.booking.update({
        where: { id: paymentStage.bookingId },
        data: { balanceDueAmount: Math.max(0, booking.totalQuoteAmount - (paid._sum.amountPaid || 0)) },
      });
    }
    return updated;
  });

  await createAuditLog({
    userId: confirmedByUserId,
    action: AuditAction.PAYMENT_CONFIRMED,
    entityType: 'payment_stage',
    entityId: paymentStageId,
    details: {
      stageType: paymentStage.stageType,
      amountPaid: amountPaid.toString(),
      bookingId: paymentStage.bookingId,
      paymentMethod: paymentMethod || null,
    },
    ipAddress,
  });

  // Re-calculate computed payment_status rollup on Booking
  const newPaymentStatus = await computeBookingPaymentStatus(paymentStage.bookingId);

  return {
    paymentStage: updatedPaymentStage,
    bookingPaymentStatus: newPaymentStatus,
  };
}

export async function getBookingPaymentSummary(bookingId: string) {
  const booking = await prisma.booking.findUnique({
    where: { id: bookingId },
    include: {
      paymentStages: {
        include: {
          paidConfirmedBy: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
        },
        orderBy: {
          dueDate: 'asc',
        },
      },
    },
  });

  if (!booking) {
    throw new Error('Booking not found');
  }

  const totalQuote = booking.totalQuoteAmount;
  const totalPaid = booking.paymentStages.reduce((sum, stage) => sum + stage.amountPaid, 0);
  const totalDue = booking.paymentStages.reduce((sum, stage) => sum + stage.amountDue, 0);
  const balance = totalQuote - totalPaid;

  const paymentsByStage = {
    advance: booking.paymentStages.find((s) => s.stageType === PaymentStageType.ADVANCE),
    flower: booking.paymentStages.find((s) => s.stageType === PaymentStageType.FLOWER),
    final: booking.paymentStages.find((s) => s.stageType === PaymentStageType.FINAL),
  };

  return {
    bookingId: booking.id,
    paymentStatus: booking.paymentStatus,
    bookingStatus: booking.bookingStatus,
    totalQuote,
    totalDue,
    totalPaid,
    balance,
    paymentsByStage,
    allStages: booking.paymentStages,
  };
}

export const getEnquiryPaymentSummary = getBookingPaymentSummary;

export async function getPendingPayments() {
  return await prisma.paymentStage.findMany({
    where: {
      status: {
        in: ['PENDING', 'DUE_SOON', 'OVERDUE'],
      },
      booking: {
        confirmationStatus: BookingConfirmationStatus.CONFIRMED,
        bookingStatus: { in: ACTIVE_PAYMENT_STATUSES },
      },
    },
    include: {
      booking: {
        include: {
          customer: true,
          lead: {
            select: { assignedSalesExecId: true },
          },
        },
      },
    },
    orderBy: {
      dueDate: 'asc',
    },
  });
}
const ACTIVE_PAYMENT_STATUSES: BookingStatus[] = [
  BookingStatus.IN_PRODUCTION,
  BookingStatus.DELIVERED,
  BookingStatus.COMPLETED,
];
