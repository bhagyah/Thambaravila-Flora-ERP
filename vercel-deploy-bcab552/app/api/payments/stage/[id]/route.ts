import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth/config';
import { prisma } from '@/lib/prisma';
import { createAuditLog, AuditAction } from '@/lib/auth/audit';

// PATCH /api/payments/stage/[id] — Extend Due Date & Edit Amount Due with Proportional Auto-Balancing
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const roleName = session.user.role?.name || '';
    if (roleName !== 'Accountant' && roleName !== 'Owner') {
      return NextResponse.json(
        { error: 'Forbidden: Only Accountant or Owner can modify payment deadlines or amounts.' },
        { status: 403 }
      );
    }

    const { id } = await params;
    const body = await req.json();
    const { dueDate, amountDue, customTitle, stageNumber, stageType } = body;

    const existingStage = await prisma.paymentStage.findUnique({
      where: { id },
      include: { booking: true },
    });

    if (!existingStage) {
      return NextResponse.json({ error: 'Payment stage not found' }, { status: 404 });
    }

    const updateData: any = {};

    if (customTitle !== undefined) {
      updateData.customTitle = customTitle;
    }
    if (stageNumber !== undefined) {
      updateData.stageNumber = Number(stageNumber);
    }
    if (stageType && ['ADVANCE', 'FLOWER', 'FINAL', 'INSTALLMENT', 'CUSTOM'].includes(stageType)) {
      updateData.stageType = stageType;
    }

    // 1. Extend / Update Due Date
    if (dueDate) {
      const newDueDate = new Date(dueDate);
      updateData.dueDate = newDueDate;

      // Reset status from OVERDUE to PENDING if extended into the future
      if (existingStage.status === 'OVERDUE' && newDueDate > new Date()) {
        updateData.status = 'PENDING';
      }
    }

    // 2. Edit Amount Due
    if (amountDue !== undefined && amountDue !== null && existingStage.bookingId) {
      const numericAmountCents = Math.round(Number(amountDue));
      if (isNaN(numericAmountCents) || numericAmountCents < 0) {
        return NextResponse.json({ error: 'Invalid amount due' }, { status: 400 });
      }

      updateData.amountDue = numericAmountCents;
    }

    // Apply update to current PaymentStage
    const updatedStage = await prisma.paymentStage.update({
      where: { id },
      data: updateData,
    });

    // Recalculate Booking balanceDueAmount
    if (existingStage.bookingId) {
      const allStages = await prisma.paymentStage.findMany({
        where: { bookingId: existingStage.bookingId },
      });

      const paidTotalCents = allStages.reduce((sum, s) => sum + s.amountPaid, 0);
      const newBalanceDueCents = Math.max(0, existingStage.booking.totalQuoteAmount - paidTotalCents);

      await prisma.booking.update({
        where: { id: existingStage.bookingId },
        data: {
          balanceDueAmount: newBalanceDueCents,
        },
      });
    }

    return NextResponse.json({
      stage: updatedStage,
      message: 'Payment stage updated successfully',
    });
  } catch (error: any) {
    console.error('Error updating payment stage:', error);
    return NextResponse.json({ error: error.message || 'Failed to update payment stage' }, { status: 500 });
  }
}

// DELETE /api/payments/stage/[id] — Delete an unpaid installment
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const roleName = session.user.role?.name || '';
    if (roleName !== 'Accountant' && roleName !== 'Owner') {
      return NextResponse.json(
        { error: 'Forbidden: Only Accountant or Owner can delete installment stages.' },
        { status: 403 }
      );
    }

    const { id } = await params;

    const existingStage = await prisma.paymentStage.findUnique({
      where: { id },
      include: { receipt: true },
    });

    if (!existingStage) {
      return NextResponse.json({ error: 'Payment stage not found' }, { status: 404 });
    }

    if (existingStage.status === 'PAID' || existingStage.amountPaid > 0 || existingStage.receipt) {
      return NextResponse.json(
        { error: 'Cannot delete a payment stage that has already been paid or has an attached receipt.' },
        { status: 400 }
      );
    }

    await prisma.paymentStage.delete({
      where: { id },
    });

    return NextResponse.json({ message: 'Installment deleted successfully' });
  } catch (error: any) {
    console.error('Error deleting payment stage:', error);
    return NextResponse.json({ error: error.message || 'Failed to delete payment stage' }, { status: 500 });
  }
}
