import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth/config';
import { prisma } from '@/lib/prisma';
import { createAuditLog } from '@/lib/auth/audit';
import { ensureLiabilityPayment, monthPeriod } from '@/lib/finance/scheduled-liabilities';

function allowed(session: any) { return session?.user?.role?.name === 'Owner' || session?.user?.role?.name === 'Accountant'; }

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!allowed(session)) return NextResponse.json({ error: 'Owner or Accountant role required.' }, { status: 403 });
  const { id } = await params;
  try {
    const body = await req.json();
    const existing = await prisma.scheduledLiability.findUnique({ where: { id } });
    if (!existing) return NextResponse.json({ error: 'Liability not found.' }, { status: 404 });
    const data: Record<string, unknown> = {};
    for (const key of ['name', 'description', 'category']) if (body[key] !== undefined) data[key] = body[key] ? String(body[key]).trim() : null;
    if (body.amount !== undefined) { const value = Math.round(Number(body.amount)); if (!Number.isFinite(value) || value <= 0) return NextResponse.json({ error: 'Amount must be greater than 0.' }, { status: 400 }); data.amount = value; }
    if (body.dueDay !== undefined) { const value = Math.round(Number(body.dueDay)); if (value < 1 || value > 31) return NextResponse.json({ error: 'Due day must be between 1 and 31.' }, { status: 400 }); data.dueDay = value; }
    if (body.startDate !== undefined) { const value = new Date(body.startDate); if (Number.isNaN(value.getTime())) return NextResponse.json({ error: 'Invalid start date.' }, { status: 400 }); data.startDate = value; }
    if (body.isActive !== undefined) data.isActive = Boolean(body.isActive);
    const liability = await prisma.$transaction(async (tx) => {
      const updated = await tx.scheduledLiability.update({ where: { id }, data });
      await ensureLiabilityPayment(updated, monthPeriod(), tx);
      return updated;
    });
    await createAuditLog({ userId: session.user.id, action: 'SCHEDULED_LIABILITY_UPDATED', entityType: 'scheduled_liability', entityId: id, details: { before: existing, after: data } });
    return NextResponse.json({ liability });
  } catch (error) {
    console.error('Failed to update scheduled liability:', error);
    return NextResponse.json({ error: 'Failed to update scheduled liability.' }, { status: 500 });
  }
}
