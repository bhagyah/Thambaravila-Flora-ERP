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
    const vendors = await prisma.vendor.findMany({
      include: {
        payments: { orderBy: { dueDate: 'asc' } },
        photographerBookings: { select: { id: true } },
        decoratorBookings: { select: { id: true } },
        catererBookings: { select: { id: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    const formattedVendors = vendors.map(v => {
      const bookedSet = new Set([
        ...v.photographerBookings.map(b => b.id),
        ...v.decoratorBookings.map(b => b.id),
        ...v.catererBookings.map(b => b.id),
      ]);

      return {
        id: v.id,
        name: v.name,
        contactPerson: v.contactPerson,
        phone: v.phone,
        email: v.email,
        category: v.category,
        areaServed: v.areaServed,
        reliabilityRating: v.reliabilityRating ?? 5,
        notes: v.notes,
        status: v.status,
        createdAt: v.createdAt,
        updatedAt: v.updatedAt,
        payments: v.payments,
        weddingsBookedCount: bookedSet.size,
      };
    });

    return NextResponse.json({ vendors: formattedVendors });
  } catch (error) {
    console.error('Error fetching vendors:', error);
    return NextResponse.json({ error: 'Failed to fetch vendors' }, { status: 500 });
  }
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await req.json();
    const { action, name, contactPerson, phone, email, category, areaServed, reliabilityRating, notes, vendorId, amount, dueDate, description } = body;

    if (action === 'CREATE_VENDOR' || (!action && name)) {
      if (!name || !phone || !category) {
        return NextResponse.json({ error: 'Missing name, phone, or category' }, { status: 400 });
      }

      const vendor = await prisma.vendor.create({
        data: {
          name,
          contactPerson: contactPerson || null,
          phone,
          email: email || null,
          category,
          areaServed: areaServed || null,
          reliabilityRating: reliabilityRating ? parseInt(reliabilityRating, 10) : 5,
          notes: notes || null,
        },
      });

      await createAuditLog({
        userId: session.user.id,
        action: 'VENDOR_CREATED',
        entityType: 'vendor',
        entityId: vendor.id,
        details: { name, category },
      });

      return NextResponse.json({ vendor }, { status: 201 });
    }

    if (action === 'ADD_PAYMENT') {
      if (!vendorId || !amount || !dueDate) {
        return NextResponse.json({ error: 'Missing vendorId, amount, or dueDate' }, { status: 400 });
      }

      const payment = await prisma.vendorPayment.create({
        data: {
          vendorId,
          amount: Math.round(Number(amount)),
          dueDate: new Date(dueDate),
          description: description || null,
        },
      });

      return NextResponse.json({ payment }, { status: 201 });
    }

    if (action === 'MARK_PAID') {
      const { paymentId } = body;
      if (!paymentId) {
        return NextResponse.json({ error: 'Missing paymentId' }, { status: 400 });
      }

      const payment = await prisma.vendorPayment.update({
        where: { id: paymentId },
        data: {
          status: 'PAID',
          paidDate: new Date(),
        },
      });

      return NextResponse.json({ payment });
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  } catch (error) {
    console.error('Error handling vendor request:', error);
    return NextResponse.json({ error: 'Failed to process vendor request' }, { status: 500 });
  }
}
