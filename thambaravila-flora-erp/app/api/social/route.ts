import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth/config';
import { prisma } from '@/lib/prisma';
import { createAuditLog } from '@/lib/auth/audit';

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const campaigns = await prisma.socialCampaign.findMany({
      orderBy: { createdAt: 'desc' },
    });

    const socialLeads = await prisma.lead.findMany({
      where: { leadSource: { in: ['INSTAGRAM_DM', 'FACEBOOK', 'TIKTOK'] } },
      include: { customer: true, bookings: true },
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json({ campaigns, socialLeads });
  } catch (error) {
    console.error('Error fetching social data:', error);
    return NextResponse.json({ error: 'Failed to fetch social data' }, { status: 500 });
  }
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await req.json();
    const { action } = body;

    // Create Campaign
    if (action === 'CREATE_CAMPAIGN') {
      const { title, platform, startDate, endDate, budget } = body;
      if (!title || !platform || !startDate) {
        return NextResponse.json({ error: 'Missing title, platform, or startDate' }, { status: 400 });
      }

      const campaign = await prisma.socialCampaign.create({
        data: {
          title,
          platform,
          startDate: new Date(startDate),
          endDate: endDate ? new Date(endDate) : null,
          budget: Math.round(Number(budget || 0)),
        },
      });

      return NextResponse.json({ campaign }, { status: 201 });
    }

    // Lead Capture Form (Creates Customer + Lead with leadSource=SOCIAL)
    if (action === 'LEAD_CAPTURE') {
      const { name, phone, email, eventDate, budgetRange } = body;

      if (!name || !phone) {
        return NextResponse.json({ error: 'Missing customer name or phone' }, { status: 400 });
      }

      // Generate customer_id TF-YYYY-XXXX
      const year = new Date().getFullYear();
      const count = await prisma.customer.count();
      const customerId = `TF-${year}-${(count + 1).toString().padStart(4, '0')}`;

      const customer = await prisma.customer.create({
        data: {
          customerId,
          name,
          phone,
          email: email || null,
          source: 'SOCIAL',
        },
      });

      const leadCount = await prisma.lead.count();
      const leadId = `L-${String(leadCount + 1).padStart(3, '0')}`;

      const lead = await prisma.lead.create({
        data: {
          id: leadId,
          customerId: customer.id,
          tentativeWeddingDate: eventDate ? new Date(eventDate) : null,
          budgetRange: budgetRange || null,
          leadSource: 'INSTAGRAM_DM',
          stage: 'NEW_INQUIRY',
          assignedSalesExecId: session.user.id,
        },
      });

      await createAuditLog({
        userId: session.user.id,
        action: 'SOCIAL_LEAD_CAPTURED',
        entityType: 'lead',
        entityId: lead.id,
        details: { customerId, name, leadId },
      });

      return NextResponse.json({ customer, lead }, { status: 201 });
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  } catch (error) {
    console.error('Error processing social action:', error);
    return NextResponse.json({ error: 'Failed to process social action' }, { status: 500 });
  }
}
