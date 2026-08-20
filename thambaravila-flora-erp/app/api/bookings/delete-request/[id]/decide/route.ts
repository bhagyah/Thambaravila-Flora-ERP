import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth/config';
import { prisma } from '@/lib/prisma';
import { createAuditLog } from '@/lib/auth/audit';
import { markBookingDeletionNotificationsResolved } from '@/lib/delete-request-notification-fallback';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  if (session.user?.role?.name !== 'Owner') {
    return NextResponse.json(
      { error: 'Forbidden: Only Owner can approve or reject deletion requests' },
      { status: 403 }
    );
  }

  try {
    const { id: requestId } = await params;
    const body = await req.json();
    const { decision } = body;

    if (!decision || !['APPROVED', 'REJECTED'].includes(decision)) {
      return NextResponse.json(
        { error: 'Valid decision ("APPROVED" or "REJECTED") is required' },
        { status: 400 }
      );
    }

    let deletionRequest = await prisma.bookingDeletionRequest.findUnique({
      where: { id: requestId },
      include: { booking: true },
    });

    if (!deletionRequest) {
      const booking = await prisma.booking.findUnique({
        where: { id: requestId },
      });

      if (booking) {
        deletionRequest = {
          id: requestId,
          bookingId: booking.id,
          booking,
          requestedById: null,
          customerName: null,
          reason: 'Owner Approval',
          status: 'PENDING',
          approvedById: null,
          createdAt: new Date(),
          updatedAt: new Date(),
        };
      }
    }

    if (!deletionRequest) {
      return NextResponse.json({ error: 'Deletion request not found' }, { status: 404 });
    }

    const bookingId = deletionRequest.bookingId;
    const requesterId = deletionRequest.requestedById;

    if (decision === 'APPROVED') {
      await prisma.paymentStage.deleteMany({ where: { bookingId } }).catch(() => {});
      await prisma.discountApproval.deleteMany({ where: { bookingId } }).catch(() => {});
      await prisma.event.deleteMany({ where: { bookingId } }).catch(() => {});
      await prisma.bookingDeletionRequest.deleteMany({ where: { bookingId } }).catch(() => {});

      await prisma.booking.delete({
        where: { id: bookingId },
      }).catch(() => {});

      await markBookingDeletionNotificationsResolved(session.user.id, bookingId, decision);

      if (requesterId) {
        await prisma.notification.create({
          data: {
            title: `âœ… Booking Deletion Approved`,
            message: `Request for Booking ${bookingId} APPROVED by Owner. The booking was deleted and the customer profile was retained.`,
            type: 'SUCCESS',
            userId: requesterId,
            link: '/bookings',
          },
        }).catch(() => {});
      }

      await createAuditLog({
        userId: session.user.id,
        action: 'BOOKING_DELETE_APPROVED',
        entityType: 'booking',
        entityId: bookingId,
        details: { requestId, reason: deletionRequest.reason, customerDeleted: false },
        ipAddress: req.headers.get('x-forwarded-for') || undefined,
      });

      return NextResponse.json({
        success: true,
        message: `Deletion request for Booking ${bookingId} APPROVED. Booking deleted and customer profile retained.`,
      });
    }

    if (decision === 'REJECTED') {
      await prisma.bookingDeletionRequest.update({
        where: { id: requestId },
        data: {
          status: 'REJECTED',
          approvedById: session.user.id,
        },
      }).catch(() => {});
      await markBookingDeletionNotificationsResolved(session.user.id, bookingId, decision);

      if (requesterId) {
        await prisma.notification.create({
          data: {
            title: `âŒ Booking Deletion Rejected`,
            message: `Your request to delete Booking ${bookingId} was REJECTED by Owner. The booking and customer remain active.`,
            type: 'WARNING',
            userId: requesterId,
            link: `/bookings/${bookingId}`,
          },
        });
      }

      await createAuditLog({
        userId: session.user.id,
        action: 'BOOKING_DELETE_REJECTED',
        entityType: 'booking',
        entityId: bookingId,
        details: { requestId, reason: deletionRequest.reason },
        ipAddress: req.headers.get('x-forwarded-for') || undefined,
      });

      return NextResponse.json({
        success: true,
        message: `Deletion request for Booking ${bookingId} REJECTED.`,
      });
    }
  } catch (error: any) {
    console.error('Error deciding booking deletion request:', error);
    return NextResponse.json(
      { error: error?.message || 'Failed to process deletion request decision' },
      { status: 500 }
    );
  }
}
