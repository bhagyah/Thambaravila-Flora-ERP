import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth/config';
import { createAuditLog, AuditAction } from '@/lib/auth/audit';
import { getClientIp } from '@/lib/auth/middleware';
import { hashPassword, validatePasswordStrength, verifyPassword } from '@/lib/auth/password';
import { prisma } from '@/lib/prisma';

const MAX_PASSWORD_LENGTH = 256;

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { currentPassword, newPassword, confirmPassword } = body;

    if (
      typeof currentPassword !== 'string'
      || typeof newPassword !== 'string'
      || typeof confirmPassword !== 'string'
      || !currentPassword
      || !newPassword
      || !confirmPassword
    ) {
      return NextResponse.json({ error: 'All password fields are required' }, { status: 400 });
    }

    if (
      currentPassword.length > MAX_PASSWORD_LENGTH
      || newPassword.length > MAX_PASSWORD_LENGTH
      || confirmPassword.length > MAX_PASSWORD_LENGTH
    ) {
      return NextResponse.json({ error: 'Password is too long' }, { status: 400 });
    }

    if (newPassword !== confirmPassword) {
      return NextResponse.json({ error: 'New passwords do not match' }, { status: 400 });
    }

    const passwordValidation = validatePasswordStrength(newPassword);
    if (!passwordValidation.valid) {
      return NextResponse.json(
        { error: 'New password does not meet security requirements', details: passwordValidation.errors },
        { status: 400 }
      );
    }

    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { id: true, passwordHash: true, isActive: true },
    });

    if (!user || !user.isActive) {
      return NextResponse.json({ error: 'Account is not active' }, { status: 403 });
    }

    const currentPasswordValid = await verifyPassword(user.passwordHash, currentPassword);
    if (!currentPasswordValid) {
      await createAuditLog({
        userId: session.user.id,
        action: 'password_change_failed',
        entityType: 'user',
        entityId: session.user.id,
        details: { reason: 'Invalid current password' },
        ipAddress: getClientIp(request),
      });
      return NextResponse.json({ error: 'Current password is incorrect' }, { status: 401 });
    }

    if (await verifyPassword(user.passwordHash, newPassword)) {
      return NextResponse.json(
        { error: 'New password must be different from current password' },
        { status: 400 }
      );
    }

    const passwordHash = await hashPassword(newPassword);
    await prisma.user.update({
      where: { id: session.user.id },
      data: {
        passwordHash,
        failedAttempts: 0,
        lockedUntil: null,
      },
    });

    await createAuditLog({
      userId: session.user.id,
      action: AuditAction.PASSWORD_CHANGED,
      entityType: 'user',
      entityId: session.user.id,
      details: { sessionsAction: 'Current session signed out' },
      ipAddress: getClientIp(request),
    });

    return NextResponse.json(
      { success: true, message: 'Password changed successfully' },
      { headers: { 'Cache-Control': 'no-store' } }
    );
  } catch (error) {
    console.error('Password change error:', error);
    return NextResponse.json({ error: 'Failed to change password' }, { status: 500 });
  }
}
