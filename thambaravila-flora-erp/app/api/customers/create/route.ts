import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth/config';
import { prisma } from '@/lib/prisma';
import { createAuditLog, AuditAction } from '@/lib/auth/audit';

async function generateCustomerId(): Promise<string> {
  const year = new Date().getFullYear();
  const customers = await prisma.customer.findMany({
    where: { customerId: { startsWith: `TF-${year}-` } },
    select: { customerId: true },
  });

  let maxNum = 0;
  for (const c of customers) {
    const match = c.customerId?.match(/TF-\d{4}-(\d+)/);
    if (match) {
      const num = parseInt(match[1], 10);
      if (!isNaN(num) && num > maxNum) {
        maxNum = num;
      }
    }
  }

  const nextNumber = maxNum + 1;
  const formattedNumber = nextNumber.toString().padStart(4, '0');
  return `TF-${year}-${formattedNumber}`;
}

function parseDateInput(dob: string | undefined | null): Date | null {
  if (!dob) return null;
  const trimmed = String(dob).trim();
  if (!trimmed) return null;

  // Try direct Date parse (works for YYYY-MM-DD or ISO)
  const directDate = new Date(trimmed);
  if (!isNaN(directDate.getTime())) {
    return directDate;
  }

  // Handle DD/MM/YYYY format
  const parts = trimmed.split('/');
  if (parts.length === 3) {
    const day = parseInt(parts[0], 10);
    const month = parseInt(parts[1], 10) - 1;
    const year = parseInt(parts[2], 10);
    const parsed = new Date(year, month, day);
    if (!isNaN(parsed.getTime())) {
      return parsed;
    }
  }

  return null;
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized - Please sign in' }, { status: 401 });
    }

    const body = await request.json();
    const { name, phone, email, address, source, nicNumber, dateOfBirth, gender, socialHandle } = body;

    if (!name || !phone) {
      return NextResponse.json({ error: 'Client name and phone number are required' }, { status: 400 });
    }

    const customerId = await generateCustomerId();
    const parsedDob = parseDateInput(dateOfBirth);

    // Safely resolve valid Sales Manager user ID to prevent FK constraint failure
    let validSalesManagerId: string | null = null;
    if (session.user?.id) {
      const userObj = await prisma.user.findFirst({
        where: {
          OR: [{ id: session.user.id }, { email: session.user.email }],
        },
        select: { id: true },
      });
      if (userObj) {
        validSalesManagerId = userObj.id;
      }
    }

    const customer = await prisma.customer.create({
      data: {
        customerId,
        name: String(name).trim(),
        phone: String(phone).trim(),
        email: email ? String(email).trim() : null,
        address: address ? String(address).trim() : null,
        source: source || 'OTHER',
        nicNumber: nicNumber ? String(nicNumber).trim() : null,
        dateOfBirth: parsedDob,
        gender: gender ? String(gender).trim() : null,
        socialHandle: socialHandle ? String(socialHandle).trim() : null,
        assignedSalesManagerId: validSalesManagerId,
      },
      include: {
        assignedSalesManager: { select: { id: true, name: true, role: { select: { name: true } } } },
      },
    });

    try {
      await createAuditLog({
        userId: session.user.id,
        action: AuditAction.CUSTOMER_CREATED || 'customer_created',
        entityType: 'customer',
        entityId: customer.id,
        details: { customerId, name, phone },
        ipAddress: request.headers.get('x-forwarded-for') || undefined,
      });
    } catch (auditErr) {
      console.warn('[Audit Log Error]:', auditErr);
    }

    return NextResponse.json({ customer }, { status: 201 });
  } catch (error: any) {
    console.error('[Create Customer Error]:', error);
    return NextResponse.json(
      { error: error?.message || 'Failed to create customer profile' },
      { status: 500 }
    );
  }
}
