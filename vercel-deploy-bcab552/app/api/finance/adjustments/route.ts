import { FinancialAdjustmentAction, FinancialRecordType, Prisma } from '@prisma/client';
import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth/config';
import { prisma } from '@/lib/prisma';
import { createAuditLog } from '@/lib/auth/audit';
import { approveFinancialAdjustment } from '@/lib/finance/financial-adjustments';

function allowed(role?: string | null) {
  return role === 'Owner' || role === 'Accountant';
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const role = session.user.role?.name || '';
  if (!allowed(role)) return NextResponse.json({ error: 'Owner or Accountant role required.' }, { status: 403 });

  try {
    const body = await req.json();
    const sourceType = String(body.sourceType || '') as FinancialRecordType;
    const action = String(body.action || '') as FinancialAdjustmentAction;
    const sourceId = String(body.sourceId || '').trim();
    const reason = String(body.reason || '').trim();
    if (!Object.values(FinancialRecordType).includes(sourceType) || !Object.values(FinancialAdjustmentAction).includes(action) || !sourceId || reason.length < 3) {
      return NextResponse.json({ error: 'Valid record, action, and reason are required.' }, { status: 400 });
    }

    const existingPending = await prisma.financialAdjustmentRequest.findFirst({
      where: { sourceType, sourceId, status: 'PENDING' },
    });
    if (existingPending) return NextResponse.json({ error: 'This record already has a pending Owner request.' }, { status: 409 });

    let snapshot: Prisma.InputJsonValue;
    if (sourceType === FinancialRecordType.EXPENSE) {
      const expense = await prisma.expense.findUnique({ where: { id: sourceId } });
      if (!expense) return NextResponse.json({ error: 'Expense not found.' }, { status: 404 });
      snapshot = JSON.parse(JSON.stringify(expense)) as Prisma.InputJsonValue;
    } else {
      const receipt = await prisma.paymentReceipt.findUnique({ where: { id: sourceId } });
      if (!receipt) return NextResponse.json({ error: 'Receipt not found.' }, { status: 404 });
      snapshot = JSON.parse(JSON.stringify(receipt)) as Prisma.InputJsonValue;
    }

    let proposedAmount: number | null = null;
    let proposedDate: Date | null = null;
    if (action === FinancialAdjustmentAction.EDIT) {
      proposedAmount = Math.round(Number(body.proposedAmount));
      proposedDate = new Date(body.proposedDate);
      if (!Number.isFinite(proposedAmount) || proposedAmount <= 0 || Number.isNaN(proposedDate.getTime())) {
        return NextResponse.json({ error: 'Positive amount and valid date are required for edits.' }, { status: 400 });
      }
    }

    const request = await prisma.financialAdjustmentRequest.create({
      data: {
        sourceType,
        sourceId,
        action,
        proposedAmount,
        proposedDate,
        proposedDescription: action === FinancialAdjustmentAction.EDIT ? String(body.proposedDescription || '').trim() || null : null,
        proposedCategory: action === FinancialAdjustmentAction.EDIT && sourceType === FinancialRecordType.EXPENSE ? String(body.proposedCategory || '').trim() || null : null,
        reason,
        snapshot,
        requestedById: session.user.id,
      },
    });

    await createAuditLog({
      userId: session.user.id,
      action: 'FINANCIAL_ADJUSTMENT_REQUESTED',
      entityType: sourceType.toLowerCase(),
      entityId: sourceId,
      details: { requestId: request.id, action, reason, proposedAmount, proposedDate },
    });

    if (role === 'Owner') {
      const approved = await approveFinancialAdjustment(request.id, session.user.id, 'Confirmed directly by Owner.');
      await createAuditLog({
        userId: session.user.id,
        action: `FINANCIAL_${action}_APPROVED`,
        entityType: sourceType.toLowerCase(),
        entityId: sourceId,
        details: { requestId: request.id, directOwnerConfirmation: true },
      });
      return NextResponse.json({ request: approved, applied: true }, { status: 201 });
    }

    await prisma.notification.create({
      data: {
        roleName: 'Owner',
        title: `Financial ${action.toLowerCase()} approval required`,
        message: `${session.user.name || 'Accountant'} requested ${action.toLowerCase()} approval. Reason: ${reason}`,
        type: 'WARNING',
        link: '/accountant/cashflow-history',
      },
    });
    return NextResponse.json({ request, applied: false }, { status: 201 });
  } catch (error) {
    console.error('Failed to create financial adjustment:', error);
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Failed to create adjustment request.' }, { status: 500 });
  }
}
