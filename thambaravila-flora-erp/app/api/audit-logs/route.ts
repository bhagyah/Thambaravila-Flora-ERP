import { NextRequest, NextResponse } from 'next/server';
import { withRole } from '@/lib/auth/middleware';
import { RoleName } from '@/lib/auth/permissions';
import { prisma } from '@/lib/prisma';

async function getActivityLogsHandler(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const page = Math.max(1, Number(searchParams.get('page') || 1));
    const limit = Math.min(100, Math.max(10, Number(searchParams.get('limit') || 50)));
    const search = searchParams.get('search')?.trim();
    const role = searchParams.get('role')?.trim();
    const category = searchParams.get('category')?.trim();
    const outcome = searchParams.get('outcome')?.trim();
    const from = searchParams.get('from');
    const to = searchParams.get('to');

    const where: any = {};
    if (role) where.actorRole = role;
    if (category) where.category = category;
    if (outcome) where.outcome = outcome;
    if (from || to) {
      where.occurredAt = {};
      if (from) where.occurredAt.gte = new Date(`${from}T00:00:00.000Z`);
      if (to) where.occurredAt.lte = new Date(`${to}T23:59:59.999Z`);
    }
    if (search) {
      where.OR = [
        { actorName: { contains: search, mode: 'insensitive' } },
        { actorEmail: { contains: search, mode: 'insensitive' } },
        { actorRole: { contains: search, mode: 'insensitive' } },
        { action: { contains: search, mode: 'insensitive' } },
        { category: { contains: search, mode: 'insensitive' } },
        { entityType: { contains: search, mode: 'insensitive' } },
        { entityId: { contains: search, mode: 'insensitive' } },
        { summary: { contains: search, mode: 'insensitive' } },
      ];
    }

    const [logs, total, roleRows, categoryRows] = await Promise.all([
      prisma.activityLog.findMany({
        where,
        orderBy: { occurredAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.activityLog.count({ where }),
      prisma.activityLog.findMany({ distinct: ['actorRole'], select: { actorRole: true }, orderBy: { actorRole: 'asc' } }),
      prisma.activityLog.findMany({ distinct: ['category'], select: { category: true }, orderBy: { category: 'asc' } }),
    ]);

    return NextResponse.json({
      logs,
      filters: {
        roles: roleRows.map((row) => row.actorRole),
        categories: categoryRows.map((row) => row.category),
      },
      pagination: { page, limit, total, totalPages: Math.max(1, Math.ceil(total / limit)) },
    });
  } catch (error) {
    console.error('Error fetching activity logs:', error);
    return NextResponse.json({ error: 'Failed to fetch activity logs' }, { status: 500 });
  }
}

export const GET = withRole([RoleName.OWNER, RoleName.IT_ADMIN], getActivityLogsHandler);

export async function DELETE() {
  return NextResponse.json({ error: 'Activity logs are append-only and cannot be deleted' }, { status: 403 });
}
