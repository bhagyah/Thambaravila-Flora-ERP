import { NextRequest, NextResponse } from 'next/server';
import { withAnyPermission } from '@/lib/auth/middleware';
import { PermissionName } from '@/lib/auth/permissions';
import { prisma } from '@/lib/prisma';

/**
 * GET /api/users
 * List all users (requires user management permission)
 */
async function getUsersHandler(
  request: NextRequest,
  context: { session: any; userId: string }
) {
  try {
    const userRows = await prisma.user.findMany({
      select: {
        id: true,
        email: true,
        name: true,
        isActive: true,
        totpSecret: true,
        totpSecretEncrypted: true,
        totpPendingSecretEncrypted: true,
        lastLogin: true,
        createdAt: true,
        role: {
          select: {
            id: true,
            name: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    const users = userRows.map(({ totpSecret, totpSecretEncrypted, totpPendingSecretEncrypted, ...user }) => ({
      ...user,
      twoFactorStatus: totpSecret || totpSecretEncrypted
        ? 'ENABLED'
        : totpPendingSecretEncrypted
          ? 'SETUP_IN_PROGRESS'
          : 'DISABLED',
    }));

    const roles = await prisma.role.findMany({
      select: { id: true, name: true, description: true },
      orderBy: { name: 'asc' },
    });
    return NextResponse.json({ users, roles });
  } catch (error: any) {
    return NextResponse.json(
      { error: 'Failed to fetch users' },
      { status: 500 }
    );
  }
}

// Protect with permission check - requires either full user management or except-owner variant
export const GET = withAnyPermission(
  [PermissionName.MANAGE_USERS_ROLES, PermissionName.MANAGE_USERS_EXCEPT_OWNER],
  getUsersHandler
);
