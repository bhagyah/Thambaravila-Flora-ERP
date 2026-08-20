import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth/config';
import { prisma } from '@/lib/prisma';
import { ensurePaymentReceiptBackfill } from '@/lib/finance/financial-adjustments';
import { resolveColomboDateRange } from '@/lib/finance/date-range';

function allowed(role?: string | null) {
  return role === 'Owner' || role === 'Accountant';
}

export async function GET(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!allowed(session.user.role?.name)) return NextResponse.json({ error: 'Owner or Accountant role required.' }, { status: 403 });

  try {
    const { searchParams } = new URL(req.url);
    const range = resolveColomboDateRange(searchParams.get('from'), searchParams.get('to'));
    await ensurePaymentReceiptBackfill();

    const [receipts, expenses, pendingRequests] = await Promise.all([
      prisma.paymentReceipt.findMany({
        where: { receivedAt: { gte: range.start, lte: range.end } },
        include: {
          confirmedBy: { select: { id: true, name: true } },
          paymentStage: {
            include: {
              booking: { include: { customer: { select: { id: true, name: true, customerId: true } } } },
            },
          },
        },
        orderBy: { receivedAt: 'desc' },
      }),
      prisma.expense.findMany({
        where: {
          date: { gte: range.start, lte: range.end },
          approvalStatus: 'APPROVED',
          paymentStatus: { in: ['PAID', 'PARTIALLY_PAID', 'REIMBURSED'] },
        },
        include: { scheduledLiabilityPayment: { include: { liability: { select: { name: true } } } } },
        orderBy: { date: 'desc' },
      }),
      prisma.financialAdjustmentRequest.findMany({
        where: { status: 'PENDING' },
        include: { requestedBy: { select: { id: true, name: true, role: { select: { name: true } } } } },
        orderBy: { createdAt: 'desc' },
      }),
    ]);

    const pendingBySource = new Map(
      pendingRequests.map((request) => [`${request.sourceType}:${request.sourceId}`, request])
    );

    const receiptRows = receipts.map((receipt) => ({
      id: `RECEIPT:${receipt.id}`,
      sourceType: 'RECEIPT' as const,
      sourceId: receipt.id,
      direction: 'IN' as const,
      amount: receipt.amount,
      occurredAt: receipt.receivedAt,
      title: receipt.paymentStage.booking.customer?.name || 'Customer payment',
      description: `${receipt.paymentStage.stageType.replace(/_/g, ' ')} payment for booking`,
      category: receipt.paymentStage.stageType,
      method: receipt.paymentMethod,
      actorName: receipt.confirmedBy?.name || 'System/legacy entry',
      reference: receipt.paymentStage.booking.customer?.customerId || receipt.paymentStage.bookingId,
      pendingRequest: pendingBySource.get(`RECEIPT:${receipt.id}`) || null,
    }));

    const expenseRows = expenses.map((expense) => ({
      id: `EXPENSE:${expense.id}`,
      sourceType: 'EXPENSE' as const,
      sourceId: expense.id,
      direction: 'OUT' as const,
      amount: expense.totalAmount || expense.amount,
      occurredAt: expense.date,
      title: expense.scheduledLiabilityPayment?.liability.name || expense.description,
      description: expense.description,
      category: expense.category,
      method: expense.paymentMethod,
      actorName: expense.paidByName || 'Recorded expense',
      reference: expense.expenseId || expense.bookingId || expense.id,
      pendingRequest: pendingBySource.get(`EXPENSE:${expense.id}`) || null,
    }));

    const records = [...receiptRows, ...expenseRows].sort(
      (a, b) => new Date(b.occurredAt).getTime() - new Date(a.occurredAt).getTime()
    );
    const received = receiptRows.reduce((sum, row) => sum + row.amount, 0);
    const paid = expenseRows.reduce((sum, row) => sum + row.amount, 0);

    return NextResponse.json({
      range: { from: range.from, to: range.to },
      summary: { received, paid, net: received - paid, transactions: records.length },
      records,
      pendingRequests,
    });
  } catch (error) {
    console.error('Failed to load cashflow history:', error);
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Failed to load cashflow history.' }, { status: 500 });
  }
}
