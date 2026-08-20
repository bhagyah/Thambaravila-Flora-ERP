import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSessionUser } from '@/lib/auth/middleware';
import { createPaymentStagesForBooking, computeBookingPaymentStatus } from '@/lib/payment/deadline-engine';
import { createActivityLog } from '@/lib/activity-log';
import { getClientIp } from '@/lib/auth/middleware';

const ALLOWED_ROLES = ['Accountant', 'Owner', 'IT/Admin'];

export async function POST(request: NextRequest) {
  try {
    const user = await getSessionUser(request);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (!ALLOWED_ROLES.includes(user.role?.name || '')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const bookings = await prisma.booking.findMany({
      where: {
        bookingStatus: { in: ['IN_PRODUCTION', 'DELIVERED', 'COMPLETED'] },
        confirmationStatus: { not: 'NOT_CONFIRMED' },
      },
      select: {
        id: true,
        leadId: true,
        bookingStatus: true,
        confirmationStatus: true,
        weddingDate: true,
        totalQuoteAmount: true,
        createdAt: true,
        paymentStages: { select: { id: true } },
      },
    });

    let repaired = 0;
    for (const booking of bookings) {
      const needsConfirmation = booking.confirmationStatus !== 'CONFIRMED';
      const needsPaymentStages = booking.paymentStages.length === 0;
      if (!needsConfirmation && !needsPaymentStages) continue;

      if (needsConfirmation) {
        await prisma.booking.update({
          where: { id: booking.id },
          data: { confirmationStatus: 'CONFIRMED' },
        });
      }

      if (booking.leadId) {
        await prisma.lead.update({
          where: { id: booking.leadId },
          data: { stage: 'WON', converted: true },
        });
      }

      await createPaymentStagesForBooking(
        booking.id,
        booking.createdAt,
        booking.weddingDate,
        booking.totalQuoteAmount
      );

      const firstPendingStage = await prisma.paymentStage.findFirst({
        where: { bookingId: booking.id, status: 'PENDING' },
        orderBy: [{ stageNumber: 'asc' }, { dueDate: 'asc' }],
      });
      if (firstPendingStage) {
        await prisma.paymentStage.update({
          where: { id: firstPendingStage.id },
          data: {
            dueDate: new Date(Date.now() + 5 * 60 * 1000),
            status: 'DUE_SOON',
          },
        });
      }

      await computeBookingPaymentStatus(booking.id);
      repaired += 1;
    }

    await createActivityLog({
      actorUserId: user.id,
      actorName: user.name,
      actorEmail: user.email,
      actorRole: user.role?.name || 'Staff',
      action: 'PAYMENT_STAGES_REPAIRED',
      category: 'FINANCE',
      entityType: 'booking',
      summary: `${repaired} confirmed bookings repaired`,
      changedData: { repaired },
      httpMethod: 'POST',
      route: '/api/payments/activate-confirmed',
      statusCode: 200,
      ipAddress: getClientIp(request),
      userAgent: request.headers.get('user-agent'),
    });

    return NextResponse.json({ repaired });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
