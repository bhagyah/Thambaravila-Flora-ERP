import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSessionUser } from '@/lib/auth/middleware';
import { createPaymentStagesForBooking } from '@/lib/payment/deadline-engine';
import { createAuditLog, AuditAction } from '@/lib/auth/audit';
import { parseLkrToCents } from '@/lib/utils/money';
import { generateNextReadableId } from '@/lib/utils/record-id';

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

    const lead = await prisma.lead.findUnique({
      where: { id },
      include: {
        customer: true,
        assignedSalesExec: { select: { id: true, name: true, email: true } },
        bookings: {
          include: {
            paymentStages: true,
            ceremonyVenue: true,
            receptionVenue: true,
          },
        },
      },
    });

    if (!lead) {
      return NextResponse.json({ error: 'Lead not found' }, { status: 404 });
    }

    return NextResponse.json(lead);
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

    const existingLead = await prisma.lead.findUnique({
      where: { id },
      include: { bookings: true },
    });

    if (!existingLead) {
      return NextResponse.json({ error: 'Lead not found' }, { status: 404 });
    }

    const body = await request.json();
    const {
      tentativeWeddingDate,
      tentativeVenue,
      estimatedGuestCount,
      budgetRange,
      leadSource,
      stage,
      nextFollowupDate,
      assignedSalesExecId,
      interestNotes,
    } = body;

    const newStage = stage || existingLead.stage;
    const isBecomingWon = newStage === 'WON' && existingLead.stage !== 'WON';

    const updatedLead = await prisma.lead.update({
      where: { id },
      data: {
        ...(tentativeWeddingDate !== undefined && {
          tentativeWeddingDate: tentativeWeddingDate ? new Date(tentativeWeddingDate) : null,
        }),
        ...(tentativeVenue !== undefined && { tentativeVenue }),
        ...(estimatedGuestCount !== undefined && {
          estimatedGuestCount: estimatedGuestCount ? parseInt(estimatedGuestCount, 10) : null,
        }),
        ...(budgetRange !== undefined && { budgetRange }),
        ...(leadSource !== undefined && { leadSource }),
        ...(stage !== undefined && { stage: newStage }),
        ...(nextFollowupDate !== undefined && {
          nextFollowupDate: nextFollowupDate ? new Date(nextFollowupDate) : null,
        }),
        ...(assignedSalesExecId !== undefined && { assignedSalesExecId }),
        ...(interestNotes !== undefined && { interestNotes }),
        ...(isBecomingWon && { converted: true }),
      },
      include: {
        customer: true,
        assignedSalesExec: true,
      },
    });

    // SYSTEM TRIGGER: Auto-create Booking when stage changes to WON
    if (isBecomingWon && existingLead.bookings.length === 0) {
      const bookingIds = await prisma.booking.findMany({
        select: { id: true },
        orderBy: { id: 'asc' },
      });
      const bookingId = generateNextReadableId(bookingIds.map((booking) => booking.id), 'B-', 3);

      const weddingDate = updatedLead.tentativeWeddingDate || new Date();
      const daysOfWeek = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
      const dayOfWeek = daysOfWeek[weddingDate.getDay()];

      let totalQuote = 15000000; // Default 150,000 LKR in cents
      if (updatedLead.budgetRange) {
        totalQuote = parseLkrToCents(updatedLead.budgetRange) ?? totalQuote;
      }

      const depositPercent = 30.0;
      const depositAmount = Math.round(totalQuote * (depositPercent / 100));
      const balanceDueAmount = totalQuote - depositAmount;

      const booking = await prisma.booking.create({
        data: {
          id: bookingId,
          customerId: updatedLead.customerId,
          leadId: updatedLead.id,
          weddingDate,
          dayOfWeek,
          packageType: 'CLASSIC_ELEGANCE',
          serviceScope: 'FULL_WEDDING_PACKAGE',
          salesExecId: updatedLead.assignedSalesExecId || user.id,
          totalQuoteAmount: totalQuote,
          depositPercent,
          depositAmount,
          balanceDueAmount,
          paymentStatus: 'DEPOSIT_DUE',
          bookingStatus: 'CONFIRMED',
        },
      });

      await createPaymentStagesForBooking(booking.id, new Date(), weddingDate, totalQuote);

      // Automated Notification Alert for Owner & Accountant
      try {
        await prisma.notification.create({
          data: {
            title: '💍 Lead Converted to Event Booking!',
            message: `Lead ${updatedLead.id} (${updatedLead.customer?.name || 'Client'}) was set to WON and automatically converted to Event Booking ${booking.id}.`,
            type: 'SUCCESS',
            roleName: 'ALL',
            link: `/bookings/${booking.id}`,
          },
        });
      } catch (err) {
        console.error('Failed to create conversion notification:', err);
      }

      // Automated Audit Log Entry
      try {
        await createAuditLog({
          userId: user.id,
          action: AuditAction.ENQUIRY_STATUS_CHANGED,
          entityType: 'Lead',
          entityId: updatedLead.id,
          details: {
            leadId: updatedLead.id,
            bookingId: booking.id,
            newStage: 'WON',
            totalQuote,
          },
        });
      } catch (err) {
        console.error('Failed to log audit event:', err);
      }
    }

    return NextResponse.json(updatedLead);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
