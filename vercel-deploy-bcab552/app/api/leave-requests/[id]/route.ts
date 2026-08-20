import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth/config';
import { prisma } from '@/lib/prisma';
import { createAuditLog } from '@/lib/auth/audit';

// PATCH /api/leave-requests/[id] - Approve, Reject, Accept, or Decline a leave request
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const callerId = session.user.id;
  const callerName = session.user.name || 'User';
  const callerRole = session.user.role?.name || '';

  try {
    const body = await req.json();
    const { action, decisionNotes } = body; // action: 'Approve' | 'Reject' | 'Accept' | 'Decline'

    if (!['Approve', 'Reject', 'Accept', 'Decline'].includes(action)) {
      return NextResponse.json(
        { error: 'Action must be Approve, Reject, Accept, or Decline' },
        { status: 400 }
      );
    }

    const leaveRequest = await prisma.leaveRequest.findUnique({
      where: { id },
    });

    if (!leaveRequest) {
      return NextResponse.json({ error: 'Leave request not found' }, { status: 404 });
    }

    // ──────────────────────────────────────────────────────────────────────────
    // CASE A: Employee accepting or declining a leave that was assigned to them
    // ──────────────────────────────────────────────────────────────────────────
    if (action === 'Accept' || action === 'Decline') {
      if (leaveRequest.status !== 'Assigned') {
        return NextResponse.json(
          { error: `This leave request is ${leaveRequest.status.toLowerCase()} and cannot be accepted/declined.` },
          { status: 400 }
        );
      }

      // Must be the assigned employee or an Owner
      if (leaveRequest.userId !== callerId && callerRole !== 'Owner') {
        return NextResponse.json(
          { error: 'You are not authorized to accept or decline this assigned leave.' },
          { status: 403 }
        );
      }

      const finalStatus = action === 'Accept' ? 'Approved' : 'Rejected';

      const updated = await prisma.leaveRequest.update({
        where: { id },
        data: {
          status: finalStatus,
          decidedAt: new Date(),
          decisionNotes: decisionNotes?.trim() || (action === 'Accept' ? 'Accepted by employee' : 'Declined by employee'),
        },
      });

      // Notify the person who assigned the leave (or Accountant/Owner)
      const notifyTargetUserId = leaveRequest.assignedById;
      const notifyMessage = action === 'Accept'
        ? `✅ ${leaveRequest.userName} (${leaveRequest.userRole}) accepted the leave from ${new Date(leaveRequest.startDate).toISOString().split('T')[0]} to ${new Date(leaveRequest.endDate).toISOString().split('T')[0]}.`
        : `⚠️ ${leaveRequest.userName} (${leaveRequest.userRole}) declined the assigned leave from ${new Date(leaveRequest.startDate).toISOString().split('T')[0]} to ${new Date(leaveRequest.endDate).toISOString().split('T')[0]}.${decisionNotes ? ` Reason: ${decisionNotes}` : ''}`;

      if (notifyTargetUserId) {
        await prisma.notification.create({
          data: {
            title: `Assigned Leave ${action === 'Accept' ? 'Accepted' : 'Declined'}`,
            message: notifyMessage,
            type: action === 'Accept' ? 'SUCCESS' : 'WARNING',
            userId: notifyTargetUserId,
            link: '/leave/approve',
          },
        });
      } else {
        await prisma.notification.create({
          data: {
            title: `Assigned Leave ${action === 'Accept' ? 'Accepted' : 'Declined'}`,
            message: notifyMessage,
            type: action === 'Accept' ? 'SUCCESS' : 'WARNING',
            roleName: 'Accountant',
            link: '/leave/approve',
          },
        });
      }

      // Audit log
      await createAuditLog({
        userId: callerId,
        action: action === 'Accept' ? 'LEAVE_ASSIGNMENT_ACCEPTED' : 'LEAVE_ASSIGNMENT_DECLINED',
        entityType: 'leave_request',
        entityId: leaveRequest.id,
        details: {
          assignedById: leaveRequest.assignedById,
          assignedByName: leaveRequest.assignedByName,
          assignedByRole: leaveRequest.assignedByRole,
          employeeId: leaveRequest.userId,
          employeeName: leaveRequest.userName,
          decisionNotes: decisionNotes || null,
        },
      });

      return NextResponse.json({ request: updated });
    }

    // ──────────────────────────────────────────────────────────────────────────
    // CASE B: Manager Approving or Rejecting a pending leave request
    // ──────────────────────────────────────────────────────────────────────────
    if (leaveRequest.status !== 'Pending') {
      return NextResponse.json(
        { error: `Request has already been ${leaveRequest.status.toLowerCase()}` },
        { status: 400 }
      );
    }

    // Rule 1: No user can approve/reject their own self-requested leave
    if (leaveRequest.userId === callerId) {
      return NextResponse.json(
        { error: 'Self-approval is strictly forbidden. You cannot decide on your own leave request.' },
        { status: 403 }
      );
    }

    // Rule 2: Check required approver role
    const requiredApproverRole = leaveRequest.userRole === 'Accountant' ? 'Owner' : 'Accountant';

    if (callerRole !== requiredApproverRole && callerRole !== 'Owner' && callerRole !== 'IT/Admin') {
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
        approverId: callerId,
        approverName: callerName,
        decidedAt: new Date(),
        decisionNotes: decisionNotes?.trim() || null,
      },
    });

    // Notify the requester directly
    await prisma.notification.create({
      data: {
        title: `Leave Request ${newStatus}`,
        message: `Your leave request from ${new Date(leaveRequest.startDate).toISOString().split('T')[0]} to ${new Date(leaveRequest.endDate).toISOString().split('T')[0]} was ${newStatus.toLowerCase()} by ${callerName}.${decisionNotes ? ` Note: ${decisionNotes}` : ''}`,
        type: newStatus === 'Approved' ? 'SUCCESS' : 'WARNING',
        userId: leaveRequest.userId,
        link: '/leave',
      },
    });

    // Audit log
    await createAuditLog({
      userId: callerId,
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
