import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth/config';
import { prisma } from '@/lib/prisma';
import { createAuditLog } from '@/lib/auth/audit';

const ANNUAL_LEAVE_ALLOWANCE = 21; // 21 days per calendar year per employee

// GET /api/leave-requests - List leave requests according to RBAC visibility & return user leave stats
export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const userId = session.user.id;
  const roleName = session.user.role?.name || '';
  const { searchParams } = new URL(req.url);
  const statusFilter = searchParams.get('status');
  const scope = searchParams.get('scope'); // 'mine' or default role-scoped

  try {
    let whereClause: any = {};

    if (scope === 'mine') {
      whereClause.userId = userId;
    } else if (roleName === 'Owner') {
      // Owner sees all leave requests across the company
      whereClause = {};
    } else if (roleName === 'Accountant') {
      // Accountant sees their own requests AND requests from non-Accountant roles needing approval
      whereClause = {
        OR: [
          { userId },
          { userRole: { not: 'Accountant' } },
        ],
      };
    } else {
      // Regular staff see only their own leave requests
      whereClause.userId = userId;
    }

    if (statusFilter && ['Pending', 'Approved', 'Rejected'].includes(statusFilter)) {
      whereClause.status = statusFilter;
    }

    const requests = await prisma.leaveRequest.findMany({
      where: whereClause,
      orderBy: { requestedAt: 'desc' },
    });

    // Calculate current user's annual leave stats for current year
    const currentYear = new Date().getFullYear();
    const yearStart = new Date(currentYear, 0, 1);
    const yearEnd = new Date(currentYear, 11, 31, 23, 59, 59);

    const userYearlyRequests = await prisma.leaveRequest.findMany({
      where: {
        userId,
        status: { in: ['Pending', 'Approved'] },
        startDate: { gte: yearStart, lte: yearEnd },
      },
    });

    let usedDays = 0;
    userYearlyRequests.forEach((r) => {
      const s = new Date(r.startDate);
      const e = new Date(r.endDate);
      const diffTime = Math.abs(e.getTime() - s.getTime());
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
      usedDays += diffDays;
    });

    const remainingDays = Math.max(0, ANNUAL_LEAVE_ALLOWANCE - usedDays);

    return NextResponse.json({
      requests,
      quota: {
        annualAllowance: ANNUAL_LEAVE_ALLOWANCE,
        usedDays,
        remainingDays,
      },
    });
  } catch (error) {
    console.error('Error fetching leave requests:', error);
    return NextResponse.json({ error: 'Failed to fetch leave requests' }, { status: 500 });
  }
}

// POST /api/leave-requests - Create a new leave request with strict date & 21-day annual quota checks
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await req.json();
    const { startDate, endDate, reason } = body;

    if (!startDate || !endDate) {
      return NextResponse.json({ error: 'Start date and end date are required' }, { status: 400 });
    }

    const start = new Date(startDate);
    const end = new Date(endDate);

    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
      return NextResponse.json({ error: 'Invalid start date or end date format' }, { status: 400 });
    }

    if (end < start) {
      return NextResponse.json({ error: 'End date cannot be before start date' }, { status: 400 });
    }

    // RULE 1 & 2: Disallow Past Days and Today
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const reqStart = new Date(start);
    reqStart.setHours(0, 0, 0, 0);

    if (reqStart <= today) {
      return NextResponse.json(
        { error: 'Leave requests cannot be made for today or past dates. Earliest selectable date is tomorrow.' },
        { status: 400 }
      );
    }

    // RULE 3: 21 Days Annual Quota Limit Validation
    const requestedDays = Math.ceil(Math.abs(end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1;

    const currentYear = start.getFullYear();
    const yearStart = new Date(currentYear, 0, 1);
    const yearEnd = new Date(currentYear, 11, 31, 23, 59, 59);

    const userId = session.user.id;

    const existingYearlyRequests = await prisma.leaveRequest.findMany({
      where: {
        userId,
        status: { in: ['Pending', 'Approved'] },
        startDate: { gte: yearStart, lte: yearEnd },
      },
    });

    let currentUsedDays = 0;
    existingYearlyRequests.forEach((r) => {
      const s = new Date(r.startDate);
      const e = new Date(r.endDate);
      const diffDays = Math.ceil(Math.abs(e.getTime() - s.getTime()) / (1000 * 60 * 60 * 24)) + 1;
      currentUsedDays += diffDays;
    });

    const remainingQuota = Math.max(0, ANNUAL_LEAVE_ALLOWANCE - currentUsedDays);

    if (requestedDays > remainingQuota) {
      return NextResponse.json(
        {
          error: `Annual leave quota exceeded. You requested ${requestedDays} days, but only have ${remainingQuota} days remaining out of your 21-day annual allowance.`,
        },
        { status: 400 }
      );
    }

    const userName = session.user.name || 'User';
    const userRole = session.user.role?.name || 'Staff';

    const leaveRequest = await prisma.leaveRequest.create({
      data: {
        userId,
        userName,
        userRole,
        startDate: start,
        endDate: end,
        reason: reason?.trim() || null,
        status: 'Pending',
      },
    });

    // Approval routing target role
    const targetRole = userRole === 'Accountant' ? 'Owner' : 'Accountant';

    // In-app notification to the approver group
    await prisma.notification.create({
      data: {
        title: 'New Leave Request',
        message: `${userName} (${userRole}) requested ${requestedDays} day(s) leave from ${start.toISOString().split('T')[0]} to ${end.toISOString().split('T')[0]}.`,
        type: 'WARNING',
        roleName: targetRole,
        link: '/leave/approve',
      },
    });

    // Audit log
    await createAuditLog({
      userId,
      action: 'LEAVE_REQUESTED',
      entityType: 'leave_request',
      entityId: leaveRequest.id,
      details: {
        startDate: start.toISOString(),
        endDate: end.toISOString(),
        requestedDays,
        remainingQuotaAfter: remainingQuota - requestedDays,
        userRole,
        targetRole,
      },
    });

    return NextResponse.json({ request: leaveRequest, remainingQuota: remainingQuota - requestedDays }, { status: 201 });
  } catch (error) {
    console.error('Error creating leave request:', error);
    return NextResponse.json({ error: 'Failed to create leave request' }, { status: 500 });
  }
}
