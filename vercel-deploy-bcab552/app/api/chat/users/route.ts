import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth/config';
import { prisma } from '@/lib/prisma';

// GET /api/chat/users - Returns list of all active staff members for chat selection
export async function GET(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const users = await prisma.user.findMany({
      where: { isActive: true },
      select: {
        id: true,
        name: true,
        email: true,
        avatarUrl: true,
        role: { select: { id: true, name: true } },
      },
      orderBy: { name: 'asc' },
    });

    const roles = Array.from(new Set(users.map(u => u.role.name)));

    return NextResponse.json({
      users: users.map(u => ({
        id: u.id,
        name: u.name,
        email: u.email,
        avatarUrl: u.avatarUrl || '👤',
        roleName: u.role.name,
      })),
      roles,
    });
  } catch (error) {
    console.error('Error fetching chat users:', error);
    return NextResponse.json({ error: 'Failed to fetch chat users' }, { status: 500 });
  }
}
