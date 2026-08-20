import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth/config';
import { prisma } from '@/lib/prisma';
import { createAuditLog } from '@/lib/auth/audit';

function allowed(session: any) {
  return session?.user?.role?.name === 'Owner' || session?.user?.role?.name === 'Accountant';
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!allowed(session)) return NextResponse.json({ error: 'Owner or Accountant role required.' }, { status: 403 });

  const { id } = await params;

  try {
    const payment = await prisma.scheduledLiabilityPayment.findUnique({
      where: { id },
      include: { liability: true },
    });

    if (!payment) {
      return NextResponse.json({ error: 'Scheduled payment not found.' }, { status: 404 });
    }

    await prisma.$transaction(async (tx) => {
      // If this payment was paid and created a Finance Expense, delete the expense too
      if (payment.expenseId) {
        await tx.expense.deleteMany({
          where: { id: payment.expenseId },
        });
      }

      // Delete the scheduled liability payment
      await tx.scheduledLiabilityPayment.delete({
        where: { id },
      });
    });

    await createAuditLog({
      userId: session.user.id,
      action: 'SCHEDULED_LIABILITY_PAYMENT_DELETED',
      entityType: 'scheduled_liability_payment',
      entityId: id,
      details: {
        liabilityName: payment.liability?.name,
        amount: payment.amount,
        period: payment.period,
        hadExpense: Boolean(payment.expenseId),
      },
    });

    return NextResponse.json({
      success: true,
      message: 'Scheduled payment and associated expense deleted successfully.',
    });
  } catch (error) {
    console.error('Failed to delete scheduled liability payment:', error);
    return NextResponse.json({ error: 'Failed to delete scheduled payment.' }, { status: 500 });
  }
}
