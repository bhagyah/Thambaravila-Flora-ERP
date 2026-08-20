import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSessionUser, withPermission } from '@/lib/auth/middleware';
import { PermissionName } from '@/lib/auth/permissions';
import { createPaymentStagesForBooking } from '@/lib/payment/deadline-engine';
import { createAuditLog, AuditAction } from '@/lib/auth/audit';
import { parseLkrToCents } from '@/lib/utils/money';
import { generateNextReadableId } from '@/lib/utils/record-id';

export async function GET(request: NextRequest) {
  try {
    const user = await getSessionUser(request);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const stage = searchParams.get('stage');
    const source = searchParams.get('source');

    const leads = await prisma.lead.findMany({
      where: {
        ...(stage ? { stage: stage as any } : {}),
        ...(source ? { leadSource: source as any } : {}),
      },
      include: {
        customer: true,
        assignedSalesExec: { select: { id: true, name: true, email: true } },
        bookings: { select: { id: true, paymentStatus: true, bookingStatus: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    const directWonBookings = await prisma.booking.findMany({
      where: {
        leadId: null,
        bookingStatus: { in: ['IN_PRODUCTION', 'DELIVERED', 'COMPLETED'] },
      },
      include: { customer: true },
      orderBy: { createdAt: 'desc' },
    });

    const syntheticWonLeads = directWonBookings
      .filter((booking) => (!stage || stage === 'WON') && (!source || source === 'DIRECT_BOOKING'))
      .map((booking) => ({
        id: booking.id,
        customerId: booking.customerId,
        customer: booking.customer,
        inquiryDate: booking.createdAt,
        tentativeWeddingDate: booking.weddingDate,
        tentativeVenue: null,
        estimatedGuestCount: booking.guestCount,
        budgetRange: String(booking.totalQuoteAmount / 100),
        leadSource: 'DIRECT_BOOKING',
        stage: 'WON',
        nextFollowupDate: null,
        assignedSalesExecId: booking.salesExecId,
        assignedSalesExec: null,
        interestNotes: booking.notes,
        converted: true,
        isSynthetic: true,
        bookings: [{ id: booking.id, paymentStatus: booking.paymentStatus, bookingStatus: booking.bookingStatus }],
      }));

    const normalizedLeads = leads.map((lead) => {
      const hasWonBooking = lead.bookings.some((booking) =>
        ['IN_PRODUCTION', 'DELIVERED', 'COMPLETED'].includes(booking.bookingStatus)
      );
      return {
        ...lead,
        stage: hasWonBooking ? 'WON' : lead.stage === 'WON' ? 'NEGOTIATION' : lead.stage,
        converted: hasWonBooking,
      };
    });

    return NextResponse.json([...normalizedLeads, ...syntheticWonLeads]);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export const POST = withPermission(PermissionName.CREATE_EDIT_ENQUIRIES, async (request: NextRequest, context) => {
  try {
    const body = await request.json();
    const {
      customerId,
      inquiryDate,
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

    if (!customerId) {
      return NextResponse.json({ error: 'Customer is required' }, { status: 400 });
    }

    // Auto-generate Lead ID: L-001, L-002...
    const leadIds = await prisma.lead.findMany({
      select: { id: true },
      orderBy: { id: 'asc' },
    });
    const leadId = generateNextReadableId(leadIds.map((lead) => lead.id), 'L-', 3);

    const leadStage = stage || 'NEW_INQUIRY';
    const isWon = leadStage === 'WON';

    const newLead = await prisma.lead.create({
      data: {
        id: leadId,
        customerId,
        inquiryDate: inquiryDate ? new Date(inquiryDate) : new Date(),
        tentativeWeddingDate: tentativeWeddingDate ? new Date(tentativeWeddingDate) : null,
        tentativeVenue: tentativeVenue || null,
        estimatedGuestCount: estimatedGuestCount ? parseInt(estimatedGuestCount, 10) : null,
        budgetRange: budgetRange || null,
        leadSource: leadSource || 'INSTAGRAM_DM',
        stage: leadStage,
        nextFollowupDate: nextFollowupDate ? new Date(nextFollowupDate) : null,
        assignedSalesExecId: assignedSalesExecId || context.userId,
        interestNotes: interestNotes || null,
        converted: isWon,
      },
      include: {
        customer: true,
        assignedSalesExec: true,
      },
    });

    // System Trigger: If created directly as WON, auto-create Booking + PaymentStages
    if (isWon) {
      const bookingIds = await prisma.booking.findMany({
        select: { id: true },
        orderBy: { id: 'asc' },
      });
      const bookingId = generateNextReadableId(bookingIds.map((booking) => booking.id), 'B-', 3);

      const weddingDate = newLead.tentativeWeddingDate || new Date();
      const daysOfWeek = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
      const dayOfWeek = daysOfWeek[weddingDate.getDay()];

      let totalQuote = 15000000; // Default 150,000 LKR in cents
      if (budgetRange) {
        totalQuote = parseLkrToCents(budgetRange) ?? totalQuote;
      }

      const depositPercent = 30.0;
      const depositAmount = Math.round(totalQuote * (depositPercent / 100));
      const balanceDueAmount = totalQuote - depositAmount;

      const booking = await prisma.booking.create({
        data: {
          id: bookingId,
          customerId: newLead.customerId,
          leadId: newLead.id,
          weddingDate,
          dayOfWeek,
          packageType: 'CLASSIC_ELEGANCE',
          serviceScope: 'FULL_WEDDING_PACKAGE',
          salesExecId: newLead.assignedSalesExecId || context.userId,
          totalQuoteAmount: totalQuote,
          depositPercent,
          depositAmount,
          balanceDueAmount,
          paymentStatus: 'DEPOSIT_DUE',
          bookingStatus: 'CONFIRMED',
          confirmationStatus: 'CONFIRMED',
        },
      });

      await createPaymentStagesForBooking(booking.id, new Date(), weddingDate, totalQuote);

      // System notification
      try {
        await prisma.notification.create({
          data: {
            title: '💍 New Event Booking Created!',
            message: `Lead ${newLead.id} was created as WON and auto-converted to Booking ${booking.id}.`,
            type: 'SUCCESS',
            roleName: 'ALL',
            link: `/bookings/${booking.id}`,
          },
        });
      } catch (err) {
        console.error('Failed to create notification:', err);
      }

      // Audit Log
      try {
        await createAuditLog({
          userId: context.userId,
          action: AuditAction.ENQUIRY_CREATED,
          entityType: 'Lead',
          entityId: newLead.id,
          details: { leadId: newLead.id, bookingId: booking.id, stage: 'WON' },
        });
      } catch (err) {
        console.error('Failed to log audit event:', err);
      }
    }

    return NextResponse.json(newLead, { status: 201 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
});
