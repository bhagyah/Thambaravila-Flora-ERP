import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth/config';

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();

    const vendor = await prisma.vendor.update({
      where: { id },
      data: {
        ...(body.name       !== undefined && { name: body.name }),
        ...(body.category   !== undefined && { category: body.category }),
        ...(body.contactPerson !== undefined && { contactPerson: body.contactPerson }),
        ...(body.phone      !== undefined && { phone: body.phone }),
        ...(body.email      !== undefined && { email: body.email }),
        ...(body.areaServed !== undefined && { areaServed: body.areaServed }),
        ...(body.reliabilityRating !== undefined && { reliabilityRating: parseInt(body.reliabilityRating, 10) }),
        ...(body.notes      !== undefined && { notes: body.notes }),
        ...(body.status     !== undefined && { status: body.status }),
      },
    });

    return NextResponse.json(vendor);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check for linked bookings
    const vendor = await prisma.vendor.findUnique({
      where: { id },
      include: {
        photographerBookings: { select: { id: true } },
        decoratorBookings:    { select: { id: true } },
        catererBookings:      { select: { id: true } },
        payments:             { select: { id: true } },
      },
    });

    if (!vendor) {
      return NextResponse.json({ error: 'Vendor not found' }, { status: 404 });
    }

    const totalBookings =
      vendor.photographerBookings.length +
      vendor.decoratorBookings.length +
      vendor.catererBookings.length;

    if (totalBookings > 0) {
      return NextResponse.json(
        { error: `Cannot delete — this vendor is linked to ${totalBookings} booking(s).` },
        { status: 409 }
      );
    }

    // Delete vendor payments first, then vendor
    await prisma.vendorPayment.deleteMany({ where: { vendorId: id } });
    await prisma.vendor.delete({ where: { id } });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
