import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth/config';
import { prisma } from '@/lib/prisma';
import { createAuditLog } from '@/lib/auth/audit';

export async function GET(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const timeframe = (searchParams.get('timeframe') || 'MONTHLY').toUpperCase();
  const period = searchParams.get('period') || new Date().toISOString().slice(0, 7);

  try {
    const targets = await prisma.salesTarget.findMany({
      where: { timeframe },
      orderBy: { createdAt: 'desc' },
    });

    // Calculate actual confirmed payments for achieved sum
    const confirmedPayments = await prisma.paymentStage.findMany({
      where: { status: 'PAID' },
    });

    const totalCollected = confirmedPayments.reduce((acc, curr) => acc + curr.amountPaid, 0);

    // Compute sales rep achievement per user
    const users = await prisma.user.findMany({
      include: { role: true },
    });

    const targetList = targets.map((t) => {
      const userPayments = confirmedPayments;
      const userAchieved = userPayments.reduce((sum, p) => sum + p.amountPaid, 0);
      return {
        ...t,
        targetAmountLKR: t.targetAmount / 100,
        achievedAmountLKR: userAchieved / 100,
        pctAchieved: t.targetAmount > 0 ? Math.min(100, Math.round((userAchieved / t.targetAmount) * 100)) : 0,
      };
    });

    return NextResponse.json({
      timeframe,
      period,
      targets: targetList,
      totalCollectedLKR: totalCollected / 100,
      users: users.map(u => ({ id: u.id, name: u.name, role: u.role.name })),
      userRole: session.user.role.name,
    });
  } catch (error) {
    console.error('Error fetching sales targets:', error);
    return NextResponse.json({ error: 'Failed to fetch sales targets' }, { status: 500 });
  }
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Strictly enforce that ONLY Owner can assign or edit targets
  const userRole = session.user.role?.name;
  if (userRole !== 'Owner') {
    return NextResponse.json({ error: 'Forbidden: Only the Owner account can set or modify target allocations' }, { status: 403 });
  }

  try {
    const body = await req.json();
    const { userId, userName, targetAmountLKR, period, timeframe = 'MONTHLY' } = body;

    if (!userId || !targetAmountLKR || !period) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const amountInCents = Math.round(Number(targetAmountLKR) * 100);

    const target = await prisma.salesTarget.create({
      data: {
        userId,
        userName: userName || session.user.name,
        targetAmount: amountInCents,
        period,
        timeframe: timeframe.toUpperCase(),
      },
    });

    await createAuditLog({
      userId: session.user.id,
      action: 'OWNER_SALES_TARGET_ASSIGNED',
      entityType: 'sales_target',
      entityId: target.id,
      details: { userId, targetAmountLKR, period, timeframe },
    });

    return NextResponse.json({ target }, { status: 201 });
  } catch (error) {
    console.error('Error creating sales target:', error);
    return NextResponse.json({ error: 'Failed to create sales target' }, { status: 500 });
  }
}
