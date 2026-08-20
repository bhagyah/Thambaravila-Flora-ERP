import { NextRequest, NextResponse } from 'next/server';
import { withAnyPermission } from '@/lib/auth/middleware';
import { PermissionName } from '@/lib/auth/permissions';
import { getPaymentQueue } from '@/lib/queue/init';
import { triggerManualDeadlineCheck } from '@/lib/queue/payment-notifications';

/**
 * POST /api/jobs/trigger-deadline-check
 * Manually trigger payment deadline check job
 * Only Owner/IT can trigger this
 */
async function triggerDeadlineCheckHandler(
  request: NextRequest,
  context: { session: any; userId: string }
) {
  try {
    const queue = getPaymentQueue();
    await triggerManualDeadlineCheck(queue);

    return NextResponse.json({
      success: true,
      message: 'Deadline check job triggered successfully',
    });
  } catch (error: any) {
    console.error('Error triggering deadline check:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to trigger deadline check' },
      { status: 500 }
    );
  }
}

// Only Owner/IT can manually trigger jobs
export const POST = withAnyPermission(
  [PermissionName.MANAGE_USERS_ROLES, PermissionName.SET_PAYMENT_DEADLINE_RULES],
  triggerDeadlineCheckHandler
);
