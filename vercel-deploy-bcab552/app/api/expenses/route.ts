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

  const roleName = (session.user as any)?.role?.name ?? '';
  if (roleName === 'IT') {
    return NextResponse.json({ error: 'Access denied' }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const category = searchParams.get('category');
  const search = searchParams.get('search');

  try {
    const expenses = await prisma.expense.findMany({
      where: {
        ...(category ? { category } : {}),
        ...(search
          ? {
              OR: [
                { description: { contains: search } },
                { category: { contains: search } },
                { clientName: { contains: search } },
              ],
            }
          : {}),
      },
      orderBy: { date: 'desc' },
    });

    const totalAmount = expenses.reduce((acc, curr) => acc + curr.amount, 0);

    return NextResponse.json({ expenses, totalAmount });
  } catch (error) {
    console.error('Error fetching expenses:', error);
    return NextResponse.json({ error: 'Failed to fetch expenses' }, { status: 500 });
  }
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const roleName = (session.user as any)?.role?.name ?? '';
  if (roleName === 'IT') {
    return NextResponse.json({ error: 'Access denied — Accountant or Owner role required.' }, { status: 403 });
  }

  try {
    const body = await req.json();
    const { category, description, amount, date, department, paymentMethod, notes } = body;

    if (!category || !description || amount === undefined) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const amountCents = Math.round(Number(amount));
    const expense = await prisma.expense.create({
      data: {
        category,
        description,
        amount: amountCents,
        totalAmount: amountCents,
        date: date ? new Date(date) : new Date(),
        department: department ?? 'OTHER_DEPT',
        paymentMethod: paymentMethod ?? 'CASH',
        paymentStatus: 'PAID',
        approvalStatus: 'APPROVED',
        notes: notes ?? null,
        paidByName: (session.user as any)?.name ?? null,
        createdById: session.user.id,
      },
    });

    await createAuditLog({
      userId: session.user.id,
      action: 'EXPENSE_CREATED',
      entityType: 'expense',
      entityId: expense.id,
      details: { category, amount, description },
    });

    return NextResponse.json({ expense }, { status: 201 });
  } catch (error) {
    console.error('Error creating expense:', error);
    return NextResponse.json({ error: 'Failed to create expense' }, { status: 500 });
  }
}
