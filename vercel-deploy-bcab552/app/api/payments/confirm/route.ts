import { NextRequest, NextResponse } from 'next/server';
import { withPermission, getClientIp } from '@/lib/auth/middleware';
import { PermissionName } from '@/lib/auth/permissions';
import { confirmPayment } from '@/lib/payment/payment-workflow';

/**
 * POST /api/payments/confirm
 * Confirm a payment (Accountant-only)
 * 
 * CRITICAL: This is the ONLY way to mark a payment stage as paid
 * Only users with record_payment_status permission can call this
 */
async function confirmPaymentHandler(
  request: NextRequest,
  context: { session: any; userId: string }
) {
  try {
    const body = await request.json();
    const { paymentStageId, amountPaid, paidDate, paymentMethod, notes } = body;

    if (!paymentStageId || !amountPaid || !paidDate) {
      return NextResponse.json(
        { error: 'paymentStageId, amountPaid, and paidDate are required' },
        { status: 400 }
      );
    }

    const amount = Math.round(Number(amountPaid));
    if (amount <= 0) {
      return NextResponse.json(
        { error: 'Amount must be greater than 0' },
        { status: 400 }
      );
    }

    const paymentDate = new Date(paidDate);
    if (isNaN(paymentDate.getTime())) {
      return NextResponse.json(
        { error: 'Invalid payment date' },
        { status: 400 }
      );
    }

    const result = await confirmPayment({
      paymentStageId,
      amountPaid: amount,
      paidDate: paymentDate,
      confirmedByUserId: context.userId,
      paymentMethod: paymentMethod ? String(paymentMethod) : null,
      notes: notes ? String(notes).trim() : null,
      ipAddress: getClientIp(request),
    });

    return NextResponse.json({
      success: true,
      message: 'Payment confirmed successfully',
      paymentStage: {
        id: result.paymentStage.id,
        stageType: result.paymentStage.stageType,
        amountPaid: result.paymentStage.amountPaid,
        paidDate: result.paymentStage.paidDate,
        status: result.paymentStage.status,
      },
      bookingPaymentStatus: result.bookingPaymentStatus,
    });
  } catch (error: any) {
    console.error('Error confirming payment:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to confirm payment' },
      { status: 500 }
    );
  }
}

export const POST = withPermission(
  PermissionName.RECORD_PAYMENT_STATUS,
  confirmPaymentHandler
);
