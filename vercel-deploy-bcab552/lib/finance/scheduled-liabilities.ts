import { prisma } from '@/lib/prisma';
import type { Prisma } from '@prisma/client';

type LiabilityForPayment = {
  id: string;
  amount: number;
  dueDay: number;
  startDate: Date;
  isActive: boolean;
};

type LiabilityPaymentClient = Pick<Prisma.TransactionClient, 'scheduledLiabilityPayment'>;

export function monthPeriod(date = new Date()) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

export function dueDateForPeriod(period: string, dueDay: number) {
  const [year, month] = period.split('-').map(Number);
  const lastDay = new Date(year, month, 0).getDate();
  return new Date(year, month - 1, Math.min(Math.max(dueDay, 1), lastDay), 12, 0, 0, 0);
}

export function liabilityAppliesToPeriod(startDate: Date, period: string) {
  return monthPeriod(startDate) <= period;
}

export async function ensureLiabilityPayment(
  liability: LiabilityForPayment,
  period = monthPeriod(),
  db: LiabilityPaymentClient = prisma
) {
  if (!liability.isActive || !liabilityAppliesToPeriod(liability.startDate, period)) return;

  await db.scheduledLiabilityPayment.upsert({
    where: { liabilityId_period: { liabilityId: liability.id, period } },
    create: {
      liabilityId: liability.id,
      period,
      dueDate: dueDateForPeriod(period, liability.dueDay),
      amount: liability.amount,
    },
    update: {},
  });

  await db.scheduledLiabilityPayment.updateMany({
    where: { liabilityId: liability.id, period, status: 'SCHEDULED', expenseId: null },
    data: { amount: liability.amount, dueDate: dueDateForPeriod(period, liability.dueDay) },
  });
}

export async function ensureCurrentMonthPayments() {
  const period = monthPeriod();
  const liabilities = await prisma.scheduledLiability.findMany({ where: { isActive: true } });

  await Promise.all(liabilities.map((liability) => ensureLiabilityPayment(liability, period)));
}

export function paymentStatus(dueDate: Date, status: string) {
  if (status === 'PAID') return 'PAID';
  if (status === 'CANCELLED') return 'CANCELLED';
  return dueDate < new Date() ? 'OVERDUE' : 'SCHEDULED';
}
