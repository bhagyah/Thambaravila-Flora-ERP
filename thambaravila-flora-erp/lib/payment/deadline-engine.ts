import { prisma } from '@/lib/prisma';
import { BookingConfirmationStatus, BookingStatus, PaymentStageType } from '@prisma/client';
import { addDays, subDays } from 'date-fns';

/**
 * PaymentDeadlineRule Engine for Bookings
 */

export interface PaymentDeadlineRuleData {
  stageType: PaymentStageType;
  daysBeforeDueToNotify: number;
  defaultDaysFromEnquiry?: number | null;
  defaultDaysBeforeEvent?: number | null;
}

const ACTIVE_PAYMENT_STATUSES: BookingStatus[] = [
  BookingStatus.IN_PRODUCTION,
  BookingStatus.DELIVERED,
  BookingStatus.COMPLETED,
];

function isPaymentActiveBooking(status: BookingStatus, confirmationStatus: BookingConfirmationStatus) {
  return confirmationStatus === BookingConfirmationStatus.CONFIRMED && ACTIVE_PAYMENT_STATUSES.includes(status);
}

export async function getPaymentDeadlineRules(): Promise<PaymentDeadlineRuleData[]> {
  const rules = await prisma.paymentDeadlineRule.findMany();
  return rules.map(rule => ({
    stageType: rule.stageType,
    daysBeforeDueToNotify: rule.daysBeforeDueToNotify,
    defaultDaysFromEnquiry: rule.defaultDaysFromEnquiry,
    defaultDaysBeforeEvent: rule.defaultDaysBeforeEvent,
  }));
}

export async function getPaymentDeadlineRule(
  stageType: PaymentStageType
): Promise<PaymentDeadlineRuleData | null> {
  const rule = await prisma.paymentDeadlineRule.findUnique({
    where: { stageType },
  });

  if (!rule) return null;

  return {
    stageType: rule.stageType,
    daysBeforeDueToNotify: rule.daysBeforeDueToNotify,
    defaultDaysFromEnquiry: rule.defaultDaysFromEnquiry,
    defaultDaysBeforeEvent: rule.defaultDaysBeforeEvent,
  };
}

export async function updatePaymentDeadlineRule(
  stageType: PaymentStageType,
  data: Partial<PaymentDeadlineRuleData>
): Promise<PaymentDeadlineRuleData> {
  const rule = await prisma.paymentDeadlineRule.update({
    where: { stageType },
    data: {
      daysBeforeDueToNotify: data.daysBeforeDueToNotify,
      defaultDaysFromEnquiry: data.defaultDaysFromEnquiry,
      defaultDaysBeforeEvent: data.defaultDaysBeforeEvent,
    },
  });

  return {
    stageType: rule.stageType,
    daysBeforeDueToNotify: rule.daysBeforeDueToNotify,
    defaultDaysFromEnquiry: rule.defaultDaysFromEnquiry,
    defaultDaysBeforeEvent: rule.defaultDaysBeforeEvent,
  };
}

export async function calculateDueDate(
  stageType: PaymentStageType,
  baseDate: Date,
  weddingDate: Date | null
): Promise<Date> {
  const rule = await getPaymentDeadlineRule(stageType);

  if (!rule) {
    // Default fallback
    if (stageType === PaymentStageType.ADVANCE) return addDays(baseDate, 5);
    if (stageType === PaymentStageType.FLOWER) return subDays(weddingDate || baseDate, 14);
    return subDays(weddingDate || baseDate, 3);
  }

  if (stageType === PaymentStageType.ADVANCE) {
    const days = rule.defaultDaysFromEnquiry ?? 5;
    return addDays(baseDate, days);
  }

  if (stageType === PaymentStageType.FLOWER || stageType === PaymentStageType.FINAL) {
    const targetDate = weddingDate || baseDate;
    const days = rule.defaultDaysBeforeEvent ?? (stageType === PaymentStageType.FLOWER ? 14 : 3);
    return subDays(targetDate, days);
  }

  return addDays(baseDate, 7);
}

/**
 * Create initial payment stage for a Booking (Single Clean Due, ready for Accountant Split)
 */
export async function createPaymentStagesForBooking(
  bookingId: string,
  bookingCreatedAt: Date,
  weddingDate: Date | null,
  totalQuoteAmount: number
): Promise<void> {
  const booking = await prisma.booking.findUnique({
    where: { id: bookingId },
    select: {
      bookingStatus: true,
      confirmationStatus: true,
      paymentStages: { select: { id: true } },
    },
  });

  if (!booking || !isPaymentActiveBooking(booking.bookingStatus, booking.confirmationStatus)) {
    return;
  }

  if (booking.paymentStages.length > 0) {
    return;
  }

  // Default: Create 1 single clear initial due for the full amount (Accountant can split as requested)
  const dueDate = weddingDate
    ? subDays(weddingDate, 14)
    : addDays(bookingCreatedAt || new Date(), 7);

  await prisma.paymentStage.create({
    data: {
      bookingId,
      stageType: PaymentStageType.INSTALLMENT,
      customTitle: 'Total Payment Due',
      stageNumber: 1,
      amountDue: totalQuoteAmount,
      dueDate: dueDate < new Date() ? addDays(new Date(), 7) : dueDate,
      status: 'PENDING',
    },
  });

  // Compute initial payment status rollup
  await computeBookingPaymentStatus(bookingId);
}

/**
 * Computed Rollup Engine for Booking.payment_status (Supports any number of custom installments 1..N)
 */
export async function computeBookingPaymentStatus(bookingId: string): Promise<string> {
  const booking = await prisma.booking.findUnique({
    where: { id: bookingId },
    select: {
      totalQuoteAmount: true,
      bookingStatus: true,
      confirmationStatus: true,
    },
  });

  if (!booking) {
    return 'NOT_STARTED';
  }

  if (!isPaymentActiveBooking(booking.bookingStatus, booking.confirmationStatus)) {
    await prisma.booking.update({
      where: { id: bookingId },
      data: { paymentStatus: 'NOT_STARTED' },
    });
    return 'NOT_STARTED';
  }

  const stages = await prisma.paymentStage.findMany({
    where: { bookingId },
    orderBy: [{ stageNumber: 'asc' }, { dueDate: 'asc' }],
  });

  if (stages.length === 0) {
    await prisma.booking.update({
      where: { id: bookingId },
      data: { paymentStatus: 'NOT_STARTED' },
    });
    return 'NOT_STARTED';
  }

  const now = new Date();
  const totalPaid = stages.reduce((sum, s) => sum + (s.amountPaid || 0), 0);
  const totalDue = stages.reduce((sum, s) => sum + (s.amountDue || 0), 0);
  const targetTotal = booking.totalQuoteAmount || totalDue;
  const balanceRemaining = Math.max(0, targetTotal - totalPaid);

  // Check for any overdue stages
  const hasOverdue = stages.some(
    s => s.status === 'OVERDUE' || (s.amountPaid < s.amountDue && new Date(s.dueDate) < now)
  );

  let newPaymentStatus: 'NOT_STARTED' | 'DEPOSIT_DUE' | 'DEPOSIT_PAID' | 'PARTIAL_PAYMENT' | 'PAID_IN_FULL' | 'OVERDUE' = 'NOT_STARTED';

  if (totalPaid >= targetTotal && targetTotal > 0) {
    newPaymentStatus = 'PAID_IN_FULL';
  } else if (hasOverdue) {
    newPaymentStatus = 'OVERDUE';
  } else if (totalPaid > 0) {
    const firstStage = stages[0];
    if (firstStage && firstStage.amountPaid >= firstStage.amountDue && stages.length > 1 && totalPaid === firstStage.amountPaid) {
      newPaymentStatus = 'DEPOSIT_PAID';
    } else {
      newPaymentStatus = 'PARTIAL_PAYMENT';
    }
  } else {
    newPaymentStatus = 'DEPOSIT_DUE';
  }

  await prisma.booking.update({
    where: { id: bookingId },
    data: {
      paymentStatus: newPaymentStatus,
      balanceDueAmount: balanceRemaining,
    },
  });

  return newPaymentStatus;
}

export async function updatePaymentStatuses(): Promise<number> {
  const now = new Date();
  let updatedCount = 0;
  const stages = await prisma.paymentStage.findMany({
    where: {
      status: { in: ['PENDING', 'DUE_SOON'] },
      booking: {
        confirmationStatus: BookingConfirmationStatus.CONFIRMED,
        bookingStatus: { in: ACTIVE_PAYMENT_STATUSES },
      },
    },
  });

  for (const stage of stages) {
    if (stage.status !== 'PAID' && stage.dueDate < now) {
      await prisma.paymentStage.update({
        where: { id: stage.id },
        data: { status: 'OVERDUE' },
      });
      await computeBookingPaymentStatus(stage.bookingId);
      updatedCount++;
    }
  }

  return updatedCount;
}
