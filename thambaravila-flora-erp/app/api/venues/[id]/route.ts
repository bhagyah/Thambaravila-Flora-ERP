import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSessionUser, withPermission } from '@/lib/auth/middleware';
import { PermissionName } from '@/lib/auth/permissions';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const user = await getSessionUser(request);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const venue = await prisma.venue.findUnique({
      where: { id },
      include: {
        ceremonyBookings: {
          include: { customer: true },
        },
        receptionBookings: {
          include: { customer: true },
        },
      },
    });

    if (!venue) {
      return NextResponse.json({ error: 'Venue not found' }, { status: 404 });
    }

    const bookedSet = new Set([
      ...venue.ceremonyBookings.map(b => b.id),
      ...venue.receptionBookings.map(b => b.id),
    ]);

    return NextResponse.json({
      ...venue,
      weddingsBookedCount: bookedSet.size,
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const user = await getSessionUser(request);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();

    const venue = await prisma.venue.update({
      where: { id },
      data: {
        ...(body.name && { name: body.name }),
        ...(body.cityArea && { cityArea: body.cityArea }),
        ...(body.fullAddress !== undefined && { fullAddress: body.fullAddress }),
        ...(body.venueType && { venueType: body.venueType }),
        ...(body.contactPerson !== undefined && { contactPerson: body.contactPerson }),
        ...(body.phone !== undefined && { phone: body.phone }),
        ...(body.email !== undefined && { email: body.email }),
        ...(body.maxCapacity !== undefined && { maxCapacity: body.maxCapacity ? parseInt(body.maxCapacity, 10) : null }),
        ...(body.indoorOutdoor !== undefined && { indoorOutdoor: body.indoorOutdoor }),
        ...(body.loadInNotes !== undefined && { loadInNotes: body.loadInNotes }),
        ...(body.floralRestrictions !== undefined && { floralRestrictions: body.floralRestrictions }),
        ...(body.parkingAvailability !== undefined && { parkingAvailability: body.parkingAvailability }),
        ...(body.powerAccess !== undefined && { powerAccess: body.powerAccess }),
        ...(body.inHouseCatering !== undefined && { inHouseCatering: Boolean(body.inHouseCatering) }),
        ...(body.notesRating !== undefined && { notesRating: body.notesRating ? parseFloat(body.notesRating) : null }),
      },
    });

    return NextResponse.json(venue);
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
    const user = await getSessionUser(request);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check if venue has bookings before deleting
    const venue = await prisma.venue.findUnique({
      where: { id },
      include: {
        ceremonyBookings: { select: { id: true } },
        receptionBookings: { select: { id: true } },
      },
    });

    if (!venue) {
      return NextResponse.json({ error: 'Venue not found' }, { status: 404 });
    }

    const totalBookings = venue.ceremonyBookings.length + venue.receptionBookings.length;
    if (totalBookings > 0) {
      return NextResponse.json(
        { error: `Cannot delete — this venue has ${totalBookings} booking(s) linked to it.` },
        { status: 409 }
      );
    }

    await prisma.venue.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

