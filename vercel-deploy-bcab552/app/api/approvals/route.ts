import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth/config';
import { prisma } from '@/lib/prisma';
import { createAuditLog } from '@/lib/auth/audit';
import { RoleName } from '@/lib/auth/permissions';

const APPROVAL_ROLES: string[] = [RoleName.OWNER, RoleName.ACCOUNTANT, RoleName.IT_ADMIN];

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  if (!APPROVAL_ROLES.includes(session.user.role?.name || '')) {
    return NextResponse.json({ error: 'Access denied' }, { status: 403 });
  }

  try {
    const approvals = await prisma.discountApproval.findMany({
      orderBy: { createdAt: 'desc' },
    });
    return NextResponse.json({ approvals });
  } catch (error) {
    console.error('Error fetching discount approvals:', error);
    return NextResponse.json({ error: 'Failed to fetch discount approvals' }, { status: 500 });
  }
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  if (!APPROVAL_ROLES.includes(session.user.role?.name || '')) {
    return NextResponse.json({ error: 'Access denied' }, { status: 403 });
  }

  try {
    const body = await req.json();
    const { action, bookingId, enquiryId, amount, reason, approvalId, decision } = body;
    const targetBookingId = bookingId || enquiryId;

    if (action === 'REQUEST_DISCOUNT') {
      if (!targetBookingId || !amount || !reason) {
        return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
      }

      const approval = await prisma.discountApproval.create({
        data: {
          bookingId: targetBookingId,
          requestedById: session.user.id,
          amount: Math.round(Number(amount)),
          reason,
        },
      });

      return NextResponse.json({ approval }, { status: 201 });
    }

    if (action === 'DECIDE') {
      if (session.user.role.name !== 'Owner') {
        return NextResponse.json({ error: 'Only Owner can approve discounts' }, { status: 403 });
      }

      if (!approvalId || !decision) {
        return NextResponse.json({ error: 'Missing approvalId or decision' }, { status: 400 });
      }

      const approval = await prisma.discountApproval.update({
        where: { id: approvalId },
        data: {
          status: decision, // APPROVED or REJECTED
          approvedById: session.user.id,
        },
      });

      await createAuditLog({
        userId: session.user.id,
        action: `DISCOUNT_${decision}`,
        entityType: 'discount_approval',
        entityId: approval.id,
        details: { bookingId: approval.bookingId, amount: approval.amount },
      });

      return NextResponse.json({ approval });
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  } catch (error) {
    console.error('Error processing discount approval:', error);
    return NextResponse.json({ error: 'Failed to process discount approval' }, { status: 500 });
  }
}
