import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth/config';
import { verifyPassword } from '@/lib/auth/password';
import { prisma } from '@/lib/prisma';
import { createAuditLog, AuditAction } from '@/lib/auth/audit';
import { verifyAndConsumeSecondFactor } from '@/lib/auth/totp-security';

/**
 * Disable 2FA for a user
 * Requires password re-authentication for security
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { password, token } = body;

    if (!password || !token) {
      return NextResponse.json(
        { error: 'Password and current Google Authenticator or recovery code are required' },
        { status: 400 }
      );
    }

    // Get user's password hash
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { passwordHash: true, totpSecret: true, totpSecretEncrypted: true },
    });

    if (!user) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }

    if (!user.totpSecret && !user.totpSecretEncrypted) {
      return NextResponse.json(
        { error: '2FA is not enabled' },
        { status: 400 }
      );
    }

    // Verify password
    const isPasswordValid = await verifyPassword(user.passwordHash, password);

    if (!isPasswordValid) {
      await createAuditLog({
        userId: session.user.id,
        action: 'totp_disable_failed',
        details: { reason: 'Invalid password' },
      });

      return NextResponse.json(
        { error: 'Invalid password' },
        { status: 401 }
      );
    }

    const secondFactor = await verifyAndConsumeSecondFactor(session.user.id, token);
    if (!secondFactor.valid) {
      await createAuditLog({
        userId: session.user.id,
        action: 'totp_disable_failed',
        details: { reason: 'Invalid second factor' },
      });
      return NextResponse.json({ error: 'Invalid authenticator or recovery code' }, { status: 401 });
    }

    // Disable 2FA by removing the secret
    await prisma.user.update({
      where: { id: session.user.id },
      data: {
        totpSecret: null,
        totpSecretEncrypted: null,
        totpPendingSecretEncrypted: null,
        totpBackupCodesEncrypted: null,
        totpLastUsedStep: null,
      },
    });

    await createAuditLog({
      userId: session.user.id,
      action: AuditAction.TOTP_DISABLED,
    });

    return NextResponse.json({
      success: true,
      message: '2FA has been disabled successfully',
    });
  } catch (error) {
    console.error('TOTP disable error:', error);
    return NextResponse.json(
      { error: 'Failed to disable 2FA' },
      { status: 500 }
    );
  }
}
