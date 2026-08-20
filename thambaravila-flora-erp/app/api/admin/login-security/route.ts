import { NextRequest, NextResponse } from 'next/server';
import { withRole } from '@/lib/auth/middleware';
import { RoleName } from '@/lib/auth/permissions';
import { prisma } from '@/lib/prisma';

async function listLoginSecurityEvents(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const page = Math.max(1, Number(searchParams.get('page') || 1));
  const limit = Math.min(100, Math.max(10, Number(searchParams.get('limit') || 50)));
  const status = searchParams.get('status');
  const search = searchParams.get('search')?.trim();
  const where: any = {};
  if (status === 'success') where.success = true;
  if (status === 'failed') where.success = false;
  if (search) {
    where.OR = [
      { attemptedEmail: { contains: search, mode: 'insensitive' } },
      { ipAddress: { contains: search, mode: 'insensitive' } },
      { failureReason: { contains: search, mode: 'insensitive' } },
      { user: { name: { contains: search, mode: 'insensitive' } } },
    ];
  }

  const [events, total] = await Promise.all([
    prisma.loginSecurityEvent.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
      include: { user: { select: { name: true, email: true, role: { select: { name: true } } } } },
    }),
    prisma.loginSecurityEvent.count({ where }),
  ]);

  return NextResponse.json({
    events,
    pagination: { page, limit, total, totalPages: Math.max(1, Math.ceil(total / limit)) },
  });
}

export const GET = withRole([RoleName.OWNER, RoleName.IT_ADMIN], listLoginSecurityEvents);
