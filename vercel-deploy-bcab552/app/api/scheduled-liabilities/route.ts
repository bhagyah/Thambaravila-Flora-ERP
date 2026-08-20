import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth/config';
import { prisma } from '@/lib/prisma';
import { createAuditLog } from '@/lib/auth/audit';
import { ensureCurrentMonthPayments, ensureLiabilityPayment, monthPeriod, paymentStatus } from '@/lib/finance/scheduled-liabilities';

function allowed(session: any) {
  return session?.user?.role?.name === 'Owner' || session?.user?.role?.name === 'Accountant';
}

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!allowed(session)) return NextResponse.json({ error: 'Owner or Accountant role required.' }, { status: 403 });

  try {
    await ensureCurrentMonthPayments();
    const period = monthPeriod();
    const liabilities = await prisma.scheduledLiability.findMany({
      orderBy: [{ isActive: 'desc' }, { dueDay: 'asc' }, { name: 'asc' }],
      include: { payments: { where: { period }, orderBy: { dueDate: 'asc' } } },
    });
    const payments = liabilities.flatMap((liability) => liability.payments.map((payment) => ({
      ...payment,
      liability: { id: liability.id, name: liability.name, description: liability.description, category: liability.category, isActive: liability.isActive, dueDay: liability.dueDay },
      displayStatus: paymentStatus(payment.dueDate, payment.status),
    })));
    return NextResponse.json({ period, liabilities, payments });
  } catch (error) {
    console.error('Failed to load scheduled liabilities:', error);
    return NextResponse.json({ error: 'Failed to load scheduled liabilities.' }, { status: 500 });
  }
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!allowed(session)) return NextResponse.json({ error: 'Owner or Accountant role required.' }, { status: 403 });

  try {
    const body = await req.json();
    const name = String(body.name || '').trim();
    const category = String(body.category || '').trim();
    const amount = Math.round(Number(body.amount));
    const dueDay = Math.round(Number(body.dueDay));
    const startDate = new Date(body.startDate);
    if (!name || !category || !Number.isFinite(amount) || amount <= 0 || !Number.isInteger(dueDay) || dueDay < 1 || dueDay > 31 || Number.isNaN(startDate.getTime())) {
      return NextResponse.json({ error: 'Name, category, amount, due day, and valid start date are required.' }, { status: 400 });
    }

    const liability = await prisma.$transaction(async (tx) => {
      const created = await tx.scheduledLiability.create({
        data: { name, description: body.description ? String(body.description).trim() : null, category, amount, dueDay, startDate, createdById: session.user.id },
      });
      await ensureLiabilityPayment(created, monthPeriod(), tx);
      return created;
    });
    await createAuditLog({ userId: session.user.id, action: 'SCHEDULED_LIABILITY_CREATED', entityType: 'scheduled_liability', entityId: liability.id, details: { name, category, amount, dueDay, startDate } });
    return NextResponse.json({ liability }, { status: 201 });
  } catch (error) {
    console.error('Failed to create scheduled liability:', error);
    return NextResponse.json({ error: 'Failed to create scheduled liability.' }, { status: 500 });
  }
}
