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
    const { dueDate, amountDue } = body;

    const existingStage = await prisma.paymentStage.findUnique({
      where: { id },
      include: { booking: true },
    });

    if (!existingStage) {
      return NextResponse.json({ error: 'Payment stage not found' }, { status: 404 });
    }

    const updateData: any = {};

    // 1. Extend / Update Due Date
    if (dueDate) {
      const newDueDate = new Date(dueDate);
      updateData.dueDate = newDueDate;

      // Reset status from OVERDUE to PENDING if extended into the future
      if (existingStage.status === 'OVERDUE' && newDueDate > new Date()) {
        updateData.status = 'PENDING';
      }
    }

    // 2. Edit Amount Due without changing the Overall Booking Total Budget
    if (amountDue !== undefined && amountDue !== null && existingStage.bookingId) {
      const numericAmountCents = Math.round(Number(amountDue));
      if (isNaN(numericAmountCents) || numericAmountCents < 0) {
        return NextResponse.json({ error: 'Invalid amount due' }, { status: 400 });
      }

      const totalQuoteCents = existingStage.booking.totalQuoteAmount;

      if (numericAmountCents > totalQuoteCents) {
        const totalLKR = (totalQuoteCents / 100).toLocaleString();
        return NextResponse.json(
          {
            error: `Requested stage amount (LKR ${(numericAmountCents / 100).toLocaleString()}) cannot exceed the total wedding budget of LKR ${totalLKR}.`,
          },
          { status: 400 }
        );
      }

      // Get all payment stages for this booking
      const allStages = await prisma.paymentStage.findMany({
        where: { bookingId: existingStage.bookingId },
      });

      const editedStageType = existingStage.stageType;
      const remainingUnallocated = Math.max(0, totalQuoteCents - numericAmountCents);

      if (editedStageType === 'ADVANCE') {
        // Merge FLOWER (40%) and FINAL (30%) together to absorb the remaining budget
        const flowerStage = allStages.find((s) => s.stageType === 'FLOWER');
        const finalStage = allStages.find((s) => s.stageType === 'FINAL');

        const flowerShare = Math.round(remainingUnallocated * (0.4 / 0.7));
        const finalShare = Math.max(0, remainingUnallocated - flowerShare);

        if (flowerStage) {
          await prisma.paymentStage.update({
            where: { id: flowerStage.id },
            data: { amountDue: flowerShare },
          });
        }
        if (finalStage) {
          await prisma.paymentStage.update({
            where: { id: finalStage.id },
            data: { amountDue: finalShare },
          });
        }
      } else if (editedStageType === 'FLOWER') {
        // Adjust FINAL stage first, and if ADVANCE needs scaling, scale ADVANCE
        const advanceStage = allStages.find((s) => s.stageType === 'ADVANCE');
        const finalStage = allStages.find((s) => s.stageType === 'FINAL');

        const advanceAmount = advanceStage ? advanceStage.amountDue : 0;

        if (advanceAmount + numericAmountCents <= totalQuoteCents) {
          const finalShare = Math.max(0, totalQuoteCents - advanceAmount - numericAmountCents);
          if (finalStage) {
            await prisma.paymentStage.update({
              where: { id: finalStage.id },
              data: { amountDue: finalShare },
            });
          }
        } else {
          // Proportionally split remaining between ADVANCE and FINAL
          const advanceShare = Math.round(remainingUnallocated * (0.3 / 0.6));
          const finalShare = Math.max(0, remainingUnallocated - advanceShare);

          if (advanceStage) {
            await prisma.paymentStage.update({
              where: { id: advanceStage.id },
              data: { amountDue: advanceShare },
            });
          }
          if (finalStage) {
            await prisma.paymentStage.update({
              where: { id: finalStage.id },
              data: { amountDue: finalShare },
            });
          }
        }
      } else if (editedStageType === 'FINAL') {
        // Adjust FLOWER stage
        const advanceStage = allStages.find((s) => s.stageType === 'ADVANCE');
        const flowerStage = allStages.find((s) => s.stageType === 'FLOWER');

        const advanceAmount = advanceStage ? advanceStage.amountDue : 0;

        if (advanceAmount + numericAmountCents <= totalQuoteCents) {
          const flowerShare = Math.max(0, totalQuoteCents - advanceAmount - numericAmountCents);
          if (flowerStage) {
            await prisma.paymentStage.update({
              where: { id: flowerStage.id },
              data: { amountDue: flowerShare },
            });
          }
        } else {
          const advanceShare = Math.round(remainingUnallocated * (0.3 / 0.7));
          const flowerShare = Math.max(0, remainingUnallocated - advanceShare);

          if (advanceStage) {
            await prisma.paymentStage.update({
              where: { id: advanceStage.id },
              data: { amountDue: advanceShare },
            });
          }
          if (flowerStage) {
            await prisma.paymentStage.update({
              where: { id: flowerStage.id },
              data: { amountDue: flowerShare },
            });
          }
        }
      }

      updateData.amountDue = numericAmountCents;
    }

    // Apply update to current PaymentStage
    const updatedStage = await prisma.paymentStage.update({
      where: { id },
      data: updateData,
    });

    // Recalculate Booking balanceDueAmount (Total Quote remains FIXED)
    if (amountDue !== undefined && existingStage.bookingId) {
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

    // Audit Log
    try {
      await createAuditLog({
        userId: session.user.id,
        action: AuditAction.PAYMENT_DEADLINE_CHANGED,
        entityType: 'payment_stage',
        entityId: id,
        details: {
          stageType: existingStage.stageType,
          oldDueDate: existingStage.dueDate,
          newDueDate: dueDate || existingStage.dueDate,
          oldAmountDue: existingStage.amountDue,
          newAmountDue: updateData.amountDue || existingStage.amountDue,
          totalBudgetPreserved: existingStage.booking.totalQuoteAmount,
        },
      });
    } catch (err) {
      console.error('Audit log failed:', err);
    }

    return NextResponse.json({
      stage: updatedStage,
      message: 'Payment stage updated successfully with smart merged auto-balancing',
    });
  } catch (error: any) {
    console.error('Error updating payment stage:', error);
    return NextResponse.json({ error: error.message || 'Failed to update payment stage' }, { status: 500 });
  }
}
