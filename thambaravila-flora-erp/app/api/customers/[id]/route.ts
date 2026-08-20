import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth/config';
import { prisma } from '@/lib/prisma';
import { createAuditLog, AuditAction } from '@/lib/auth/audit';
import { getDeletedCustomerPublicIds } from '@/lib/delete-request-notification-fallback';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    const deletedCustomerPublicIds = await getDeletedCustomerPublicIds();

    const customer = await prisma.customer.findUnique({
      where: { id },
      include: {
        assignedSalesManager: {
          select: {
            id: true,
            name: true,
            email: true,
            role: { select: { id: true, name: true } },
          },
        },
        leads: {
          orderBy: { createdAt: 'desc' },
          include: { assignedSalesExec: { select: { name: true, role: { select: { name: true } } } } },
        },
        bookings: {
          orderBy: { weddingDate: 'desc' },
          include: {
            ceremonyVenue: true,
            receptionVenue: true,
            salesExec: { select: { name: true, role: { select: { name: true } } } },
            paymentStages: { orderBy: { dueDate: 'asc' } },
          },
        },
      },
    });

    if (!customer) {
      return NextResponse.json({ error: 'Customer not found' }, { status: 404 });
    }

    if (deletedCustomerPublicIds.has(customer.customerId)) {
      return NextResponse.json({ error: 'Customer not found' }, { status: 404 });
    }

    return NextResponse.json({ customer });
  } catch (error) {
    console.error('Error fetching customer:', error);
    return NextResponse.json({ error: 'Failed to fetch customer' }, { status: 500 });
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    const body = await request.json();
    const {
      name,
      phone,
      email,
      address,
      source,
      nicNumber,
      dateOfBirth,
      gender,
      socialHandle,
      additionalNotes,
      assignedSalesManagerId,
    } = body;

    if (!name || !phone) {
      return NextResponse.json({ error: 'Name and phone are required' }, { status: 400 });
    }

    const customer = await prisma.customer.update({
      where: { id },
      data: {
        name,
        phone,
        email: email || null,
        address: address || null,
        source: source || 'OTHER',
        nicNumber: nicNumber || null,
        dateOfBirth: dateOfBirth ? new Date(dateOfBirth) : null,
        gender: gender || null,
        socialHandle: socialHandle || null,
        additionalNotes: additionalNotes !== undefined ? additionalNotes : undefined,
        assignedSalesManagerId: assignedSalesManagerId || null,
      },
      include: {
        assignedSalesManager: {
          select: {
            id: true,
            name: true,
            role: { select: { id: true, name: true } },
          },
        },
      },
    });

    await createAuditLog({
      userId: session.user.id,
      action: AuditAction.CUSTOMER_UPDATED,
      entityType: 'customer',
      entityId: id,
      details: { name, phone, additionalNotesUpdated: !!additionalNotes },
    });

    return NextResponse.json({ customer });
  } catch (error) {
    console.error('Error updating customer:', error);
    return NextResponse.json({ error: 'Failed to update customer' }, { status: 500 });
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    const body = await request.json();
    const { additionalNotes } = body;

    const customer = await prisma.customer.update({
      where: { id },
      data: {
        ...(additionalNotes !== undefined && { additionalNotes }),
      },
      include: {
        assignedSalesManager: {
          select: {
            id: true,
            name: true,
            role: { select: { id: true, name: true } },
          },
        },
      },
    });

    return NextResponse.json({ customer, message: 'Customer notes updated successfully' });
  } catch (error: any) {
    console.error('Error patching customer:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id: customerId } = await params;
    const customer = await prisma.customer.findUnique({
      where: { id: customerId },
      include: { bookings: { select: { id: true } } },
    });

    if (!customer) {
      return NextResponse.json({ error: 'Customer not found' }, { status: 404 });
    }

    const bookingIds = customer.bookings.map((b) => b.id);

    if (bookingIds.length > 0) {
      await prisma.paymentStage.deleteMany({ where: { bookingId: { in: bookingIds } } }).catch(() => {});
      await prisma.discountApproval.deleteMany({ where: { bookingId: { in: bookingIds } } }).catch(() => {});
      await prisma.event.deleteMany({ where: { bookingId: { in: bookingIds } } }).catch(() => {});
      await prisma.bookingDeletionRequest.deleteMany({ where: { bookingId: { in: bookingIds } } }).catch(() => {});
      await prisma.booking.deleteMany({ where: { customerId } }).catch(() => {});
    }

    await prisma.lead.deleteMany({ where: { customerId } }).catch(() => {});
    await prisma.customer.delete({ where: { id: customerId } });

    await createAuditLog({
      userId: session.user.id,
      action: 'CUSTOMER_DELETED',
      entityType: 'customer',
      entityId: customerId,
      details: { customerId: customer.customerId, name: customer.name },
      ipAddress: request.headers.get('x-forwarded-for') || undefined,
    });

    return NextResponse.json({ success: true, message: `Customer ${customer.name} and all associated data deleted.` });
  } catch (error: any) {
    console.error('Error deleting customer:', error);
    return NextResponse.json({ error: error?.message || 'Failed to delete customer' }, { status: 500 });
  }
}
