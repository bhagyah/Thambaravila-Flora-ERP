import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth/config';
import { prisma } from '@/lib/prisma';
import { createAuditLog } from '@/lib/auth/audit';

// PATCH /api/leave-requests/[id] - Approve or Reject a leave request
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const approverId = session.user.id;
  const approverName = session.user.name || 'Approver';
  const approverRole = session.user.role?.name || '';

  try {
    const body = await req.json();
    const { action, decisionNotes } = body; // action: 'Approve' | 'Reject'

    if (!['Approve', 'Reject'].includes(action)) {
      return NextResponse.json({ error: 'Action must be Approve or Reject' }, { status: 400 });
    }

    const leaveRequest = await prisma.leaveRequest.findUnique({
      where: { id },
    });

    if (!leaveRequest) {
      return NextResponse.json({ error: 'Leave request not found' }, { status: 404 });
    }

    if (leaveRequest.status !== 'Pending') {
      return NextResponse.json({ error: `Request has already been ${leaveRequest.status.toLowerCase()}` }, { status: 400 });
    }

    // --- Core Business Logic & Security Enforcements ---
    
    // Rule 1: No user can approve/reject their own leave request
    if (leaveRequest.userId === approverId) {
      return NextResponse.json(
        { error: 'Self-approval is strictly forbidden. You cannot decide on your own leave request.' },
        { status: 403 }
      );
    }

    // Rule 2: Check required approver role based on requester role
    const requiredApproverRole = leaveRequest.userRole === 'Accountant' ? 'Owner' : 'Accountant';

    if (approverRole !== requiredApproverRole && approverRole !== 'Owner') {
      // Owner is absolute admin, but explicitly Accountant requests must be approved by Owner, and non-Accountant requests by Accountant or Owner
      return NextResponse.json(
        { error: `This request requires approval from an ${requiredApproverRole}.` },
        { status: 403 }
      );
    }

    const newStatus = action === 'Approve' ? 'Approved' : 'Rejected';

    const updated = await prisma.leaveRequest.update({
      where: { id },
      data: {
        status: newStatus,
        approverId,
        approverName,
        decidedAt: new Date(),
        decisionNotes: decisionNotes?.trim() || null,
      },
    });

    // Notify the requester directly
    await prisma.notification.create({
      data: {
        title: `Leave Request ${newStatus}`,
        message: `Your leave request from ${new Date(leaveRequest.startDate).toISOString().split('T')[0]} to ${new Date(leaveRequest.endDate).toISOString().split('T')[0]} was ${newStatus.toLowerCase()} by ${approverName}.${decisionNotes ? ` Note: ${decisionNotes}` : ''}`,
        type: newStatus === 'Approved' ? 'SUCCESS' : 'WARNING',
        userId: leaveRequest.userId,
        link: '/leave',
      },
    });

    // Audit log
    await createAuditLog({
      userId: approverId,
      action: action === 'Approve' ? 'LEAVE_APPROVED' : 'LEAVE_REJECTED',
      entityType: 'leave_request',
      entityId: leaveRequest.id,
      details: {
        requesterId: leaveRequest.userId,
        requesterName: leaveRequest.userName,
        requesterRole: leaveRequest.userRole,
        decisionNotes: decisionNotes || null,
      },
    });

    return NextResponse.json({ request: updated });
  } catch (error) {
    console.error('Error updating leave request:', error);
    return NextResponse.json({ error: 'Failed to update leave request' }, { status: 500 });
  }
}
