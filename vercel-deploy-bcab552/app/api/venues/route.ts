import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSessionUser, withPermission } from '@/lib/auth/middleware';
import { PermissionName } from '@/lib/auth/permissions';

export async function GET(request: NextRequest) {
  try {
    const user = await getSessionUser(request);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const venues = await prisma.venue.findMany({
      include: {
        ceremonyBookings: { select: { id: true } },
        receptionBookings: { select: { id: true } },
      },
      orderBy: { name: 'asc' },
    });

    const formattedVenues = venues.map(v => {
      const bookedSet = new Set([
        ...v.ceremonyBookings.map(b => b.id),
        ...v.receptionBookings.map(b => b.id),
      ]);
      return {
        ...v,
        weddingsBookedCount: bookedSet.size,
      };
    });

    return NextResponse.json(formattedVenues);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export const POST = withPermission(PermissionName.CREATE_EDIT_ENQUIRIES, async (request: NextRequest) => {
  try {
    const body = await request.json();
    const {
      name,
      cityArea,
      fullAddress,
      venueType,
      contactPerson,
      phone,
      email,
      maxCapacity,
      indoorOutdoor,
      loadInNotes,
      floralRestrictions,
      parkingAvailability,
      powerAccess,
      inHouseCatering,
      notesRating,
    } = body;

    if (!name || !cityArea || !venueType) {
      return NextResponse.json({ error: 'Name, City Area, and Venue Type are required' }, { status: 400 });
    }

    const venue = await prisma.venue.create({
      data: {
        name,
        cityArea,
        fullAddress: fullAddress || null,
        venueType,
        contactPerson: contactPerson || null,
        phone: phone || null,
        email: email || null,
        maxCapacity: maxCapacity ? parseInt(maxCapacity, 10) : null,
        indoorOutdoor: indoorOutdoor || 'Both',
        loadInNotes: loadInNotes || null,
        floralRestrictions: floralRestrictions || null,
        parkingAvailability: parkingAvailability || null,
        powerAccess: powerAccess || null,
        inHouseCatering: Boolean(inHouseCatering),
        notesRating: notesRating ? parseFloat(notesRating) : null,
      },
    });

    return NextResponse.json(venue, { status: 201 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
});
