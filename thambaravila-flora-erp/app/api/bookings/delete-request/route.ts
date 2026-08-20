import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth/config';
import { prisma } from '@/lib/prisma';
import { createAuditLog } from '@/lib/auth/audit';
import { getBookingDeletionRequestsFromNotifications } from '@/lib/delete-request-notification-fallback';

// POST /api/bookings/delete-request - Create or update a deletion request for a booking (Requires Owner Approval)
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized - Please sign in' }, { status: 401 });
  }

  try {
    const body = await req.json();
    const { bookingId, reason, customerName } = body;

    if (!bookingId || !reason) {
      return NextResponse.json({ error: 'Booking ID and mandatory deletion reason are required' }, { status: 400 });
    }

    const booking = await prisma.booking.findUnique({
      where: { id: bookingId },
      include: { customer: true },
    });

    if (!booking) {
      return NextResponse.json({ error: 'Booking not found' }, { status: 404 });
    }

    const userRoleName = session.user.role?.name || 'Staff';

    // Upsert pending deletion request: every deletion requires Owner approval
    const existingPending = await prisma.bookingDeletionRequest.findFirst({
      where: { bookingId, status: 'PENDING' },
    });

    let deletionRequest;
    if (existingPending) {
      deletionRequest = await prisma.bookingDeletionRequest.update({
        where: { id: existingPending.id },
        data: {
          requestedById: session.user.id,
          reason,
          customerName: customerName || booking.customer.name,
        },
      });
    } else {
      deletionRequest = await prisma.bookingDeletionRequest.create({
        data: {
          bookingId,
          requestedById: session.user.id,
          customerName: customerName || booking.customer.name,
          reason,
          status: 'PENDING',
        },
      });
    }

    // Send mandatory approval notification directly to each active Owner.
    // Role-wide notifications share read state; direct rows keep each Owner's alert independent.
    const ownerUsers = await prisma.user.findMany({
      where: { isActive: true, role: { name: 'Owner' } },
      select: { id: true },
    }).catch(() => []);

    const approvalNotification = {
      title: `🚨 Mandatory Approval: Booking Deletion (${bookingId})`,
      message: `${session.user.name} (${userRoleName}) requested deletion of Booking ${bookingId}. Reason: "${reason}"`,
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
      action: 'BOOKING_DELETE_REQUESTED',
      entityType: 'booking',
      entityId: bookingId,
      details: { reason, requestId: deletionRequest.id },
      ipAddress: req.headers.get('x-forwarded-for') || undefined,
    });

    return NextResponse.json({
      success: true,
      deleted: false,
      deletionRequest,
      message: `Deletion request for Booking ${bookingId} submitted successfully. Owner approval is required before removal.`,
    });
  } catch (error: any) {
    console.error('[Delete Request Error]:', error);
    return NextResponse.json(
      { error: error?.message || 'Failed to process booking deletion request' },
      { status: 500 }
    );
  }
}

// GET /api/bookings/delete-request - List all deletion requests for Owner review
export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const requests = await prisma.bookingDeletionRequest.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        booking: {
          select: {
            id: true,
            weddingDate: true,
            totalQuoteAmount: true,
            customer: { select: { name: true, phone: true } },
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

    const fallbackRequests = await getBookingDeletionRequestsFromNotifications(session);
    const knownBookingIds = new Set(
      requests.map((r) => r.bookingId || r.booking?.id).filter(Boolean)
    );
    for (const fallback of fallbackRequests) {
      if (!knownBookingIds.has(fallback.bookingId)) {
        requests.push(fallback);
        knownBookingIds.add(fallback.bookingId);
      }
    }

    return NextResponse.json({ requests });
  } catch (error: any) {
    console.error('[Fetch Delete Requests Error]:', error);
    return NextResponse.json(
      { error: error?.message || 'Failed to fetch deletion requests' },
      { status: 500 }
    );
  }
}
