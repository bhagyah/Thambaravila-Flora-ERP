import { NextRequest, NextResponse } from 'next/server';
import { withAnyPermission } from '@/lib/auth/middleware';
import { PermissionName, canManageUser } from '@/lib/auth/permissions';
import { prisma } from '@/lib/prisma';
import { hashPassword, validatePasswordStrength } from '@/lib/auth/password';
import { createAuditLog, AuditAction } from '@/lib/auth/audit';

/**
 * POST /api/users/create
 * Create a new user (requires user management permission)
 */
async function createUserHandler(
  request: NextRequest,
  context: { session: any; userId: string }
) {
  try {
    const body = await request.json();
    const { email, name, password, roleId } = body;

    // Validate required fields
    if (!email || !name || !password || !roleId) {
      return NextResponse.json(
        { error: 'Email, name, password, and role are required' },
        { status: 400 }
      );
    }

    // Validate password strength
    const passwordValidation = validatePasswordStrength(password);
    if (!passwordValidation.valid) {
      return NextResponse.json(
        { error: 'Password does not meet requirements', details: passwordValidation.errors },
        { status: 400 }
      );
    }

    // Check if email already exists
    const existingUser = await prisma.user.findUnique({
      where: { email },
    });

    if (existingUser) {
      return NextResponse.json(
        { error: 'A user with this email already exists' },
        { status: 409 }
      );
    }

    // Get the role being assigned
    const role = await prisma.role.findUnique({
      where: { id: roleId },
    });

    if (!role) {
      return NextResponse.json(
        { error: 'Invalid role' },
        { status: 400 }
      );
    }

    // Check if IT/Admin is trying to create an Owner user
    const adminRole = context.session.user.role.name;
    if (adminRole === 'IT/Admin' && role.name === 'Owner') {
      await createAuditLog({
        userId: context.userId,
        action: AuditAction.UNAUTHORIZED_ACCESS_ATTEMPT,
        details: {
          reason: 'IT/Admin attempted to create Owner user',
          targetRole: role.name,
        },
      });

      return NextResponse.json(
        { error: 'You cannot create users with Owner role' },
        { status: 403 }
      );
    }

    // Hash password
    const passwordHash = await hashPassword(password);

    // Create user
    const newUser = await prisma.user.create({
      data: {
        email,
        name,
        passwordHash,
        roleId,
      },
      select: {
        id: true,
        email: true,
        name: true,
        isActive: true,
        createdAt: true,
        role: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    // Audit log
    await createAuditLog({
      userId: context.userId,
      action: AuditAction.USER_CREATED,
      entityType: 'user',
      entityId: newUser.id,
      details: {
        createdEmail: newUser.email,
        createdRole: newUser.role.name,
      },
    });

    return NextResponse.json({
      success: true,
      user: newUser,
    });
  } catch (error: any) {
    console.error('Error creating user:', error);
    return NextResponse.json(
      { error: 'Failed to create user' },
      { status: 500 }
    );
  }
}

// Protect with permission check
export const POST = withAnyPermission(
  [PermissionName.MANAGE_USERS_ROLES, PermissionName.MANAGE_USERS_EXCEPT_OWNER],
  createUserHandler
);
