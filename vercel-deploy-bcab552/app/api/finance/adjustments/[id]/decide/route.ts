import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth/config';
import { prisma } from '@/lib/prisma';
import { createAuditLog } from '@/lib/auth/audit';
import { approveFinancialAdjustment, rejectFinancialAdjustment } from '@/lib/finance/financial-adjustments';

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (session.user.role?.name !== 'Owner') return NextResponse.json({ error: 'Only Owner can decide financial changes.' }, { status: 403 });

  try {
    const { id } = await params;
    const body = await req.json();
    const decision = String(body.decision || '').toUpperCase();
    const decisionNote = String(body.decisionNote || '').trim() || null;
    if (!['APPROVED', 'REJECTED'].includes(decision)) return NextResponse.json({ error: 'Decision must be APPROVED or REJECTED.' }, { status: 400 });

    const current = await prisma.financialAdjustmentRequest.findUnique({ where: { id } });
    if (!current) return NextResponse.json({ error: 'Adjustment request not found.' }, { status: 404 });
    const decided = decision === 'APPROVED'
      ? await approveFinancialAdjustment(id, session.user.id, decisionNote)
      : await rejectFinancialAdjustment(id, session.user.id, decisionNote);

    await createAuditLog({
      userId: session.user.id,
      action: `FINANCIAL_${current.action}_${decision}`,
      entityType: current.sourceType.toLowerCase(),
      entityId: current.sourceId,
      details: { requestId: id, decisionNote },
    });
    await prisma.notification.create({
      data: {
        userId: current.requestedById,
        title: `Financial change ${decision.toLowerCase()}`,
        message: `Owner ${decision.toLowerCase()} your ${current.action.toLowerCase()} request.${decisionNote ? ` Note: ${decisionNote}` : ''}`,
        type: decision === 'APPROVED' ? 'SUCCESS' : 'WARNING',
        link: '/accountant/cashflow-history',
      },
    });
    return NextResponse.json({ request: decided });
  } catch (error) {
    console.error('Failed to decide financial adjustment:', error);
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Failed to decide adjustment.' }, { status: 500 });
  }
}
