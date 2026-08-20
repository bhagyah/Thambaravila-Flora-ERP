import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSessionUser, withPermission } from '@/lib/auth/middleware';
import { PermissionName } from '@/lib/auth/permissions';
import { createPaymentStagesForBooking } from '@/lib/payment/deadline-engine';
import { parseLkrToCents } from '@/lib/utils/money';
import { generateNextReadableId } from '@/lib/utils/record-id';

export async function GET(request: NextRequest) {
  try {
    const user = await getSessionUser(request);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const bookingStatus = searchParams.get('bookingStatus');
    const paymentStatus = searchParams.get('paymentStatus');

    const whereClause = {
      ...(bookingStatus ? { bookingStatus: bookingStatus as any } : {}),
      ...(paymentStatus ? { paymentStatus: paymentStatus as any } : {}),
    };

    // Try fetching with deletionRequests first, fall back if table doesn't exist yet
    let bookings: any[] = [];
    try {
      bookings = await prisma.booking.findMany({
        where: whereClause,
        include: {
          customer: true,
          lead: true,
          ceremonyVenue: true,
          receptionVenue: true,
          photographerVendor: true,
          decoratorVendor: true,
          catererVendor: true,
          salesExec: { select: { id: true, name: true, email: true } },
          paymentStages: { orderBy: { dueDate: 'asc' } },
          deletionRequests: {
            where: { status: 'PENDING' },
            select: { id: true, reason: true, createdAt: true, requestedBy: { select: { name: true } } },
          },
        },
        orderBy: { weddingDate: 'asc' },
      });
    } catch (includeError: any) {
      // Fall back without deletionRequests (handles schema mismatch on cold start)
      console.warn('[Bookings API] Falling back without deletionRequests:', includeError?.message);
      bookings = await prisma.booking.findMany({
        where: whereClause,
        include: {
          customer: true,
          lead: true,
          ceremonyVenue: true,
          receptionVenue: true,
          photographerVendor: true,
          decoratorVendor: true,
          catererVendor: true,
          salesExec: { select: { id: true, name: true, email: true } },
          paymentStages: { orderBy: { dueDate: 'asc' } },
        },
        orderBy: { weddingDate: 'asc' },
      });
    }

    const now = new Date();
    const formatted = bookings.map(b => {
      const daysUntil = Math.ceil((new Date(b.weddingDate).getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
      return {
        ...b,
        daysUntilWedding: daysUntil,
        hasPendingDeletion: b.deletionRequests && b.deletionRequests.length > 0,
        pendingDeletionRequest: b.deletionRequests?.[0] || null,
      };
    });

    return NextResponse.json(formatted);
  } catch (error: any) {
    console.error('[Bookings API] Error:', error?.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export const POST = withPermission(PermissionName.CREATE_EDIT_ENQUIRIES, async (request: NextRequest, context) => {
  try {
    const user = await getSessionUser(request);
    const roleName = user?.role?.name || '';
    if (roleName !== 'Owner' && roleName !== 'Sales Manager') {
      return NextResponse.json(
        { error: 'Only Sales Manager or Owner can create wedding bookings.' },
        { status: 403 }
      );
    }

    const body = await request.json();
    const {
      customerId,
      leadId,
      weddingDate,
      ceremonyVenueId,
      ceremonyTime,
      receptionVenueId,
      receptionTime,
      floristSetupTime,
      guestCount,
      packageType,
      serviceScope,
      colourTheme,
      salesExecId,
      totalQuoteAmount,
      depositPercent,
      notes,
      photographerVendorId,
      decoratorVendorId,
      catererVendorId,
    } = body;

    if (!customerId || !weddingDate || !totalQuoteAmount) {
      return NextResponse.json({ error: 'Customer, wedding date, and total quote amount are required' }, { status: 400 });
    }

    const existingBookingIds = await prisma.booking.findMany({
      select: { id: true },
      orderBy: { id: 'asc' },
    });
    const bookingId = generateNextReadableId(existingBookingIds.map((booking) => booking.id), 'B-', 3);

    const dateObj = new Date(weddingDate);
    const daysOfWeek = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const dayOfWeek = daysOfWeek[dateObj.getDay()];

    const total = parseLkrToCents(totalQuoteAmount);
    if (total === null) {
      return NextResponse.json({ error: 'Total quote amount must be a valid LKR amount' }, { status: 400 });
    }

    const depPercent = depositPercent ? Float(depositPercent) : 30.0;
    const depAmount = Math.round(total * (depPercent / 100));
    const balanceAmount = total - depAmount;

    const booking = await prisma.booking.create({
      data: {
        id: bookingId,
        customerId,
        leadId: leadId || null,
        weddingDate: dateObj,
        dayOfWeek,
        ceremonyVenueId: ceremonyVenueId || null,
        ceremonyTime: ceremonyTime || null,
        receptionVenueId: receptionVenueId || null,
        receptionTime: receptionTime || null,
        floristSetupTime: floristSetupTime || null,
        guestCount: guestCount ? parseInt(guestCount, 10) : null,
        packageType: packageType || 'CLASSIC_ELEGANCE',
        serviceScope: serviceScope || 'FULL_WEDDING_PACKAGE',
        colourTheme: colourTheme || null,
        salesExecId: salesExecId || context.userId,
        totalQuoteAmount: total,
        depositPercent: depPercent,
        depositAmount: depAmount,
        balanceDueAmount: balanceAmount,
        paymentStatus: 'NOT_STARTED',
        bookingStatus: body.bookingStatus || 'INQUIRY',
        confirmationStatus: body.bookingStatus === 'CONFIRMED' ? 'CONFIRMED' : 'PENDING',
        notes: notes || null,
        photographerVendorId: photographerVendorId || null,
        decoratorVendorId: decoratorVendorId || null,
        catererVendorId: catererVendorId || null,
      },
      include: {
        customer: true,
        ceremonyVenue: true,
        receptionVenue: true,
      },
    });

    await createPaymentStagesForBooking(booking.id, new Date(), dateObj, total);

    return NextResponse.json(booking, { status: 201 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
});

function Float(val: any): number {
  return parseFloat(val) || 30.0;
}
