import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth/config';
import { prisma } from '@/lib/prisma';
import { createAuditLog } from '@/lib/auth/audit';
import {
  createCustomerDeletedMarkerNotification,
  markCustomerDeletionNotificationsResolved,
} from '@/lib/delete-request-notification-fallback';

// POST /api/customers/delete-request/[id]/decide - Owner approves or rejects a customer deletion request
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Enforce Owner-only permission
  if (session.user?.role?.name !== 'Owner') {
    return NextResponse.json(
      { error: 'Forbidden: Only Owner can approve or reject customer deletion requests' },
      { status: 403 }
    );
  }

  try {
    const { id: requestId } = await params;
    const body = await req.json();
    const { decision, customerId: hintedCustomerId, publicCustomerId: hintedPublicCustomerId } = body; // 'APPROVED' or 'REJECTED'

    if (!decision || !['APPROVED', 'REJECTED'].includes(decision)) {
      return NextResponse.json(
        { error: 'Valid decision ("APPROVED" or "REJECTED") is required' },
        { status: 400 }
      );
    }

    let deletionRequest: any = null;

    deletionRequest = await prisma.customerDeletionRequest.findFirst({
      where: {
        OR: [
          { id: requestId },
          { customerId: requestId },
          ...(hintedCustomerId ? [{ customerId: hintedCustomerId }] : []),
        ],
      },
      include: {
        customer: {
          include: { bookings: { select: { id: true } } },
        },
      },
    });

    // Fallback: check if target is a Customer directly.
    if (!deletionRequest) {
      const targetCustomer = await prisma.customer.findFirst({
        where: {
          OR: [
            { id: requestId },
            { customerId: requestId },
            ...(hintedCustomerId ? [{ id: hintedCustomerId }] : []),
            ...(hintedPublicCustomerId ? [{ customerId: hintedPublicCustomerId }] : []),
          ],
        },
        select: {
          id: true,
          customerId: true,
          name: true,
        },
      });

      if (targetCustomer) {
        deletionRequest = {
          id: requestId,
          customerId: targetCustomer.id,
          publicCustomerId: targetCustomer.customerId,
          customerName: targetCustomer.name,
          reason: 'Owner Approval',
          status: 'PENDING',
        };
      }
    }

    if (!deletionRequest) {
      return NextResponse.json({ error: 'Customer deletion request not found' }, { status: 404 });
    }

    const customerId = deletionRequest.customerId;
    const requesterId = deletionRequest.requestedById;
    const customerName = deletionRequest.customerName || deletionRequest.customer?.name || 'Client';
    const publicCustomerId =
      deletionRequest.publicCustomerId ||
      deletionRequest.customer?.customerId ||
      hintedPublicCustomerId ||
      requestId;

    if (decision === 'APPROVED') {
      const bookings = await prisma.booking.findMany({
        where: { customerId },
        select: { id: true },
      });
      const bookingIds = bookings.map((b) => b.id);

      if (bookingIds.length > 0) {
        await prisma.paymentStage.deleteMany({ where: { bookingId: { in: bookingIds } } }).catch(() => {});
        await prisma.discountApproval.deleteMany({ where: { bookingId: { in: bookingIds } } }).catch(() => {});
        await prisma.event.deleteMany({ where: { bookingId: { in: bookingIds } } }).catch(() => {});
        await prisma.bookingDeletionRequest.deleteMany({ where: { bookingId: { in: bookingIds } } }).catch(() => {});
        await prisma.booking.deleteMany({ where: { customerId } }).catch(() => {});
      }

      await prisma.customerDeletionRequest.deleteMany({
        where: { OR: [{ customerId }, { id: requestId }] },
      }).catch(() => {});
      await prisma.lead.deleteMany({ where: { customerId } }).catch(() => {});
      await prisma.customer.delete({ where: { id: customerId } }).catch(() => {});
      await markCustomerDeletionNotificationsResolved(session.user.id, customerId, publicCustomerId, decision);
      await createCustomerDeletedMarkerNotification(customerName, publicCustomerId, session.user.name || 'Owner');

      // 4. Notify requester
      if (requesterId) {
        await prisma.notification.create({
          data: {
            title: `✅ Customer Deletion Approved`,
            message: `Your request to delete Customer "${customerName}" was APPROVED by Owner. Profile, bookings, and financial balances have been permanently removed.`,
            type: 'SUCCESS',
            userId: requesterId,
            link: '/customers',
          },
        }).catch(() => {});
      }

      await createAuditLog({
        userId: session.user.id,
        action: 'CUSTOMER_DELETE_APPROVED',
        entityType: 'customer',
        entityId: customerId,
        details: { requestId, customerName, reason: deletionRequest.reason },
        ipAddress: req.headers.get('x-forwarded-for') || undefined,
      });

      return NextResponse.json({
        success: true,
        message: `Deletion request for Client "${customerName}" APPROVED. Customer profile and all associated data permanently deleted.`,
      });
    }

    if (decision === 'REJECTED') {
      await prisma.customerDeletionRequest.updateMany({
        where: { OR: [{ id: requestId }, { customerId }] },
        data: {
          status: 'REJECTED',
          approvedById: session.user.id,
        },
      }).catch(() => {});
      await markCustomerDeletionNotificationsResolved(session.user.id, customerId, publicCustomerId, decision);

      // Notify requester
      if (requesterId) {
        await prisma.notification.create({
          data: {
            title: `❌ Customer Deletion Rejected`,
            message: `Your request to delete Customer "${customerName}" was REJECTED by Owner. Profile remains active.`,
            type: 'WARNING',
            userId: requesterId,
            link: `/customers/${customerId}`,
          },
        }).catch(() => {});
      }

      await createAuditLog({
        userId: session.user.id,
        action: 'CUSTOMER_DELETE_REJECTED',
        entityType: 'customer',
        entityId: customerId,
        details: { requestId, customerName, reason: deletionRequest.reason },
        ipAddress: req.headers.get('x-forwarded-for') || undefined,
      });

      return NextResponse.json({
        success: true,
        message: `Deletion request for Client "${customerName}" REJECTED.`,
      });
    }
  } catch (error: any) {
    console.error('Error deciding customer deletion request:', error);
    return NextResponse.json(
      { error: error?.message || 'Failed to process deletion request decision' },
      { status: 500 }
    );
  }
}
