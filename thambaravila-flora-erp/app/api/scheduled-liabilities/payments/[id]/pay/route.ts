import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth/config';
import { prisma } from '@/lib/prisma';
import { createAuditLog } from '@/lib/auth/audit';

function allowed(session: any) { return session?.user?.role?.name === 'Owner' || session?.user?.role?.name === 'Accountant'; }

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!allowed(session)) return NextResponse.json({ error: 'Owner or Accountant role required.' }, { status: 403 });
  const { id } = await params;

  try {
    const result = await prisma.$transaction(async (tx) => {
      const payment = await tx.scheduledLiabilityPayment.findUnique({ where: { id }, include: { liability: true } });
      if (!payment) throw new Error('NOT_FOUND');
      if (payment.status === 'PAID' || payment.expenseId) throw new Error('ALREADY_PAID');

      const claimed = await tx.scheduledLiabilityPayment.updateMany({
        where: { id, status: { not: 'PAID' }, expenseId: null },
        data: { status: 'PAID', paidDate: new Date(), paidById: session.user.id },
      });
      if (claimed.count !== 1) throw new Error('ALREADY_PAID');

      const expense = await tx.expense.create({
        data: {
          category: payment.liability.category,
          description: `Monthly liability: ${payment.liability.name}`,
          amount: payment.amount,
          totalAmount: payment.amount,
          date: new Date(),
          department: 'FINANCE',
          paymentMethod: 'BANK_TRANSFER',
          paymentStatus: 'PAID',
          approvalStatus: 'APPROVED',
          paidByName: session.user.name,
          createdById: session.user.id,
          notes: payment.liability.description || `Scheduled payment for ${payment.period}`,
        },
      });
      const updated = await tx.scheduledLiabilityPayment.update({ where: { id }, data: { expenseId: expense.id } });
      return { expense, payment: updated };
    });

    await createAuditLog({ userId: session.user.id, action: 'SCHEDULED_LIABILITY_PAID', entityType: 'scheduled_liability_payment', entityId: id, details: { expenseId: result.expense.id, amount: result.payment.amount, period: result.payment.period } });
    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof Error && error.message === 'NOT_FOUND') return NextResponse.json({ error: 'Payment not found.' }, { status: 404 });
    if (error instanceof Error && error.message === 'ALREADY_PAID') return NextResponse.json({ error: 'This liability is already paid.' }, { status: 409 });
    console.error('Failed to pay scheduled liability:', error);
    return NextResponse.json({ error: 'Failed to record scheduled payment.' }, { status: 500 });
  }
}
