import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth/config';
import { prisma } from '@/lib/prisma';
import { createAuditLog } from '@/lib/auth/audit';
import { getCustomerDeletionRequestsFromNotifications } from '@/lib/delete-request-notification-fallback';

// POST /api/customers/delete-request - Create a customer deletion request requiring Owner approval
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await req.json();
    const { customerId, reason } = body;

    if (!customerId || !reason) {
      return NextResponse.json({ error: 'Customer ID and deletion reason are required' }, { status: 400 });
    }

    const customer = await prisma.customer.findFirst({
      where: {
        OR: [{ id: customerId }, { customerId: customerId }],
      },
    });

    if (!customer) {
      return NextResponse.json({ error: 'Customer not found' }, { status: 404 });
    }

    // Resolve valid user ID for foreign key safety
    let validUserId: string | null = null;
    if (session.user?.id) {
      const userObj = await prisma.user.findFirst({
        where: { OR: [{ id: session.user.id }, { email: session.user.email }] },
        select: { id: true },
      });
      if (userObj) {
        validUserId = userObj.id;
      }
    }

    const userRoleName = session.user.role?.name || 'Staff';

    const existingPending = await prisma.customerDeletionRequest.findFirst({
      where: { customerId: customer.id, status: 'PENDING' },
    });

    const deletionRequest = existingPending
      ? await prisma.customerDeletionRequest.update({
          where: { id: existingPending.id },
          data: {
            requestedById: validUserId,
            reason,
            customerName: customer.name,
          },
        })
      : await prisma.customerDeletionRequest.create({
          data: {
            customerId: customer.id,
            requestedById: validUserId,
            customerName: customer.name,
            reason,
            status: 'PENDING',
          },
        });

    // Send mandatory approval notification directly to each active Owner.
    // Role-wide notifications share read state; direct rows keep each Owner's alert independent.
    const ownerUsers = await prisma.user.findMany({
      where: { isActive: true, role: { name: 'Owner' } },
      select: { id: true },
    }).catch(() => []);

    const approvalNotification = {
      title: `🚨 Mandatory Approval: Customer Deletion (${customer.name})`,
      message: `${session.user.name} (${userRoleName}) requested deletion of Customer ${customer.name} (${customer.customerId}). Reason: "${reason}"`,
      type: 'URGENT',
      link: '/approvals',
    };

    if (ownerUsers.length > 0) {
      await Promise.all(
        ownerUsers.map((owner) =>
          prisma.notification.create({
            data: {
              ...approvalNotification,
              userId: owner.id,
              roleName: null,
            },
          })
        )
      ).catch((err) => console.error('Failed to notify Owner users:', err));
    } else {
      await prisma.notification.create({
        data: {
          ...approvalNotification,
          roleName: 'Owner',
        },
      }).catch((err) => console.error('Failed to create Owner role notification:', err));
    }

    await createAuditLog({
      userId: session.user.id,
      action: 'CUSTOMER_DELETE_REQUESTED',
      entityType: 'customer',
      entityId: customer.id,
      details: { reason, requestId: deletionRequest.id },
      ipAddress: req.headers.get('x-forwarded-for') || undefined,
    });

    return NextResponse.json({
      success: true,
      deletionRequest,
      message: `Deletion request for Client "${customer.name}" submitted successfully. Mandatory Owner approval required before removal.`,
    });
  } catch (error: any) {
    console.error('Error handling customer deletion request:', error);
    return NextResponse.json(
      { error: error?.message || 'Failed to submit customer deletion request' },
      { status: 500 }
    );
  }
}

// GET /api/customers/delete-request - List all customer deletion requests
export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const requests: any[] = await prisma.customerDeletionRequest.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        customer: {
          select: {
            id: true,
            customerId: true,
            name: true,
            phone: true,
            email: true,
          },
        },
        requestedBy: {
          select: { id: true, name: true, role: { select: { name: true } } },
        },
        approvedBy: {
          select: { id: true, name: true, role: { select: { name: true } } },
        },
      },
    });

    const fallbackRequests = await getCustomerDeletionRequestsFromNotifications(session);
    const knownCustomerIds = new Set(
      requests.map((r) => r.customerId || r.customer?.id).filter(Boolean)
    );
    for (const fallback of fallbackRequests) {
      if (!knownCustomerIds.has(fallback.customerId)) {
        requests.push(fallback);
        knownCustomerIds.add(fallback.customerId);
      }
    }

    return NextResponse.json({ requests });
  } catch (error: any) {
    console.error('Error fetching customer deletion requests:', error);
    return NextResponse.json({ requests: [] });
  }
}
