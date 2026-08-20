import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth/config';
import { prisma } from '@/lib/prisma';
import { createAuditLog, AuditAction } from '@/lib/auth/audit';

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { customerId, eventDate, eventType, totalQuoteAmount } = body;

    if (!customerId || !totalQuoteAmount) {
      return NextResponse.json({ error: 'customerId and totalQuoteAmount are required' }, { status: 400 });
    }

    const quoteAmount = parseFloat(totalQuoteAmount);
    if (isNaN(quoteAmount) || quoteAmount <= 0) {
      return NextResponse.json({ error: 'Quote amount must be greater than 0' }, { status: 400 });
    }

    const quoteAmountInCents = Math.round(quoteAmount * 100);

    const customer = await prisma.customer.findUnique({
      where: { id: customerId },
    });

    if (!customer) {
      return NextResponse.json({ error: 'Customer not found' }, { status: 404 });
    }

    const leadCount = await prisma.lead.count();
    const leadId = `L-${String(leadCount + 1).padStart(3, '0')}`;

    const lead = await prisma.lead.create({
      data: {
        id: leadId,
        customerId,
        tentativeWeddingDate: eventDate ? new Date(eventDate) : null,
        budgetRange: `LKR ${(quoteAmountInCents / 100).toLocaleString()}`,
        assignedSalesExecId: session.user.id,
      },
    });

    await createAuditLog({
      userId: session.user.id,
      action: AuditAction.ENQUIRY_CREATED,
      entityType: 'enquiry',
      entityId: lead.id,
      details: { customerId, eventType, totalQuoteAmount: quoteAmountInCents },
      ipAddress: request.headers.get('x-forwarded-for') || undefined,
    });

    return NextResponse.json(
      {
        enquiry: lead,
        message: 'Enquiry created successfully',
      },
      { status: 201 }
    );
  } catch (error) {
    console.error('Error creating enquiry:', error);
    return NextResponse.json({ error: 'Failed to create enquiry' }, { status: 500 });
  }
}
