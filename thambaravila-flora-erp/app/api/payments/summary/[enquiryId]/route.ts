import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/auth/middleware';
import { getEnquiryPaymentSummary } from '@/lib/payment/payment-workflow';

/**
 * GET /api/payments/summary/[enquiryId]
 * Get payment summary for an enquiry
 * Accessible to authenticated users (permissions checked based on role)
 */
async function getPaymentSummaryHandler(
  request: NextRequest,
  context: { session: any; userId: string; params: { enquiryId: string } }
) {
  try {
    const { enquiryId } = context.params;

    if (!enquiryId) {
      return NextResponse.json(
        { error: 'Enquiry ID is required' },
        { status: 400 }
      );
    }

    const summary = await getEnquiryPaymentSummary(enquiryId);

    // Convert Decimal to string for JSON serialization
    return NextResponse.json({
      ...summary,
      totalQuote: summary.totalQuote.toString(),
      totalDue: summary.totalDue.toString(),
      totalPaid: summary.totalPaid.toString(),
      balance: summary.balance.toString(),
      allStages: summary.allStages.map((stage) => ({
        ...stage,
        amountDue: stage.amountDue.toString(),
        amountPaid: stage.amountPaid.toString(),
      })),
      paymentsByStage: {
        advance: summary.paymentsByStage.advance ? {
          ...summary.paymentsByStage.advance,
          amountDue: summary.paymentsByStage.advance.amountDue.toString(),
          amountPaid: summary.paymentsByStage.advance.amountPaid.toString(),
        } : null,
        flower: summary.paymentsByStage.flower ? {
          ...summary.paymentsByStage.flower,
          amountDue: summary.paymentsByStage.flower.amountDue.toString(),
          amountPaid: summary.paymentsByStage.flower.amountPaid.toString(),
        } : null,
        final: summary.paymentsByStage.final ? {
          ...summary.paymentsByStage.final,
          amountDue: summary.paymentsByStage.final.amountDue.toString(),
          amountPaid: summary.paymentsByStage.final.amountPaid.toString(),
        } : null,
      },
    });
  } catch (error: any) {
    console.error('Error fetching payment summary:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch payment summary' },
      { status: 500 }
    );
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ enquiryId: string }> }
) {
  const resolvedParams = await params;
  return withAuth(async (req, context) => {
    return getPaymentSummaryHandler(req, { ...context, params: resolvedParams });
  })(request);
}
