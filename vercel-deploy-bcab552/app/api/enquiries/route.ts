import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth/config';
import { prisma } from '@/lib/prisma';
import { parseLkrToCents } from '@/lib/utils/money';

// GET /api/enquiries - Compatibility route mapping to Leads & Bookings
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const leads = await prisma.lead.findMany({
      include: {
        customer: true,
        bookings: {
          include: {
            paymentStages: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    const enquiries = leads.map((l) => ({
      id: l.id,
      customer: l.customer,
      eventType: 'WEDDING',
      eventDate: l.tentativeWeddingDate ? l.tentativeWeddingDate.toISOString() : null,
      status: l.stage,
      totalQuoteAmount: parseLkrToCents(l.budgetRange) || 0,
      createdAt: l.createdAt.toISOString(),
      paymentStages: l.bookings?.[0]?.paymentStages || [],
    }));

    return NextResponse.json({
      enquiries,
      pagination: {
        page: 1,
        limit: 100,
        total: enquiries.length,
        totalPages: 1,
      },
    });
  } catch (error) {
    console.error('Error fetching enquiries compatibility:', error);
    return NextResponse.json({ enquiries: [] });
  }
}
