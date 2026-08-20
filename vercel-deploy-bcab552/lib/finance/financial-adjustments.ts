import { FinancialAdjustmentStatus, FinancialRecordType, PaymentStatus, Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { computeBookingPaymentStatus } from '@/lib/payment/deadline-engine';

export async function ensurePaymentReceiptBackfill() {
  const stages = await prisma.paymentStage.findMany({
    where: { amountPaid: { gt: 0 }, receipt: null },
    select: {
      id: true,
      amountPaid: true,
      paidDate: true,
      paidConfirmedById: true,
      updatedAt: true,
    },
  });

  if (!stages.length) return 0;
  const result = await prisma.paymentReceipt.createMany({
    data: stages.map((stage) => ({
      paymentStageId: stage.id,
      amount: stage.amountPaid,
      receivedAt: stage.paidDate || stage.updatedAt,
      confirmedById: stage.paidConfirmedById,
      notes: 'Backfilled from confirmed payment stage.',
    })),
    skipDuplicates: true,
  });
  return result.count;
}

function unpaidStageStatus(dueDate: Date): PaymentStatus {
  return dueDate < new Date() ? PaymentStatus.OVERDUE : PaymentStatus.PENDING;
}

async function syncStageAndBooking(tx: Prisma.TransactionClient, paymentStageId: string) {
  const stage = await tx.paymentStage.findUnique({
    where: { id: paymentStageId },
    include: { receipt: true, booking: { select: { id: true, totalQuoteAmount: true } } },
  });
  if (!stage) throw new Error('Payment stage not found.');

  const amountPaid = stage.receipt?.amount || 0;
  const status = amountPaid >= stage.amountDue ? PaymentStatus.PAID : unpaidStageStatus(stage.dueDate);
  await tx.paymentStage.update({
    where: { id: stage.id },
    data: {
      amountPaid,
      paidDate: stage.receipt?.receivedAt || null,
      paidConfirmedById: stage.receipt?.confirmedById || null,
      status,
    },
  });

  const paid = await tx.paymentStage.aggregate({
    where: { bookingId: stage.booking.id },
    _sum: { amountPaid: true },
  });
  await tx.booking.update({
    where: { id: stage.booking.id },
    data: { balanceDueAmount: Math.max(0, stage.booking.totalQuoteAmount - (paid._sum.amountPaid || 0)) },
  });
  return stage.booking.id;
}

export async function approveFinancialAdjustment(
  requestId: string,
  ownerId: string,
  decisionNote?: string | null
) {
  const result = await prisma.$transaction(async (tx) => {
    const request = await tx.financialAdjustmentRequest.findUnique({ where: { id: requestId } });
    if (!request) throw new Error('Adjustment request not found.');
    if (request.status !== FinancialAdjustmentStatus.PENDING) throw new Error('Adjustment request already decided.');

    let bookingId: string | null = null;
    if (request.sourceType === FinancialRecordType.EXPENSE) {
      const expense = await tx.expense.findUnique({
        where: { id: request.sourceId },
        include: { scheduledLiabilityPayment: true },
      });
      if (!expense) throw new Error('Expense no longer exists.');

      if (request.action === 'DELETE') {
        if (expense.scheduledLiabilityPayment) {
          await tx.scheduledLiabilityPayment.update({
            where: { id: expense.scheduledLiabilityPayment.id },
            data: { status: 'SCHEDULED', paidDate: null, paidById: null, expenseId: null },
          });
        }
        await tx.expense.delete({ where: { id: expense.id } });
      } else {
        const nextTotal = request.proposedAmount ?? expense.totalAmount ?? expense.amount;
        await tx.expense.update({
          where: { id: expense.id },
          data: {
            amount: Math.max(0, nextTotal - (expense.taxVat || 0)),
            totalAmount: nextTotal,
            date: request.proposedDate || expense.date,
            description: request.proposedDescription ?? expense.description,
            category: request.proposedCategory ?? expense.category,
          },
        });
        if (expense.scheduledLiabilityPayment) {
          await tx.scheduledLiabilityPayment.update({
            where: { id: expense.scheduledLiabilityPayment.id },
            data: { amount: nextTotal, paidDate: request.proposedDate || expense.date },
          });
        }
      }
    } else {
      const receipt = await tx.paymentReceipt.findUnique({
        where: { id: request.sourceId },
        include: { paymentStage: true },
      });
      if (!receipt) throw new Error('Receipt no longer exists.');
      const paymentStageId = receipt.paymentStageId;

      if (request.action === 'DELETE') {
        await tx.paymentReceipt.delete({ where: { id: receipt.id } });
      } else {
        await tx.paymentReceipt.update({
          where: { id: receipt.id },
          data: {
            amount: request.proposedAmount ?? receipt.amount,
            receivedAt: request.proposedDate || receipt.receivedAt,
            notes: request.proposedDescription ?? receipt.notes,
          },
        });
      }
      bookingId = await syncStageAndBooking(tx, paymentStageId);
    }

    const decided = await tx.financialAdjustmentRequest.update({
      where: { id: request.id },
      data: {
        status: FinancialAdjustmentStatus.APPROVED,
        decidedById: ownerId,
        decisionNote: decisionNote || null,
        decidedAt: new Date(),
      },
      include: { requestedBy: { select: { id: true, name: true } } },
    });
    return { request: decided, bookingId };
  });

  if (result.bookingId) await computeBookingPaymentStatus(result.bookingId);
  return result.request;
}

export async function rejectFinancialAdjustment(
  requestId: string,
  ownerId: string,
  decisionNote?: string | null
) {
  const request = await prisma.financialAdjustmentRequest.findUnique({ where: { id: requestId } });
  if (!request) throw new Error('Adjustment request not found.');
  if (request.status !== FinancialAdjustmentStatus.PENDING) throw new Error('Adjustment request already decided.');
  return prisma.financialAdjustmentRequest.update({
    where: { id: requestId },
    data: {
      status: FinancialAdjustmentStatus.REJECTED,
      decidedById: ownerId,
      decisionNote: decisionNote || null,
      decidedAt: new Date(),
    },
    include: { requestedBy: { select: { id: true, name: true } } },
  });
}
