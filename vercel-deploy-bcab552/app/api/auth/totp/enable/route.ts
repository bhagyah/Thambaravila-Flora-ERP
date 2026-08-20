import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth/config';
import { generateBackupCodes, verifyTOTPTokenWithStep, isValidTOTPTokenFormat } from '@/lib/auth/totp';
import { prisma } from '@/lib/prisma';
import { createAuditLog, AuditAction } from '@/lib/auth/audit';
import { decryptText, encryptText, sha256 } from '@/lib/security/encryption';

/**
 * Enable 2FA after successful token verification
 * This confirms the user has successfully set up their authenticator app
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
    const { token } = body;

    if (!token || !isValidTOTPTokenFormat(token)) {
      return NextResponse.json(
        { error: 'Invalid token format. Must be 6 digits.' },
        { status: 400 }
      );
    }

    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { totpPendingSecretEncrypted: true },
    });

    if (!user?.totpPendingSecretEncrypted) {
      return NextResponse.json(
        { error: '2FA setup not initiated. Call /api/auth/totp/setup first.' },
        { status: 400 }
      );
    }

    const secret = decryptText(user.totpPendingSecretEncrypted);
    const matchedStep = verifyTOTPTokenWithStep(secret, token);

    if (matchedStep === null) {
      return NextResponse.json(
        { error: 'Invalid verification code. Please try again.' },
        { status: 401 }
      );
    }

    const backupCodes = generateBackupCodes();
    await prisma.user.update({
      where: { id: session.user.id },
      data: {
        totpSecret: null,
        totpSecretEncrypted: encryptText(secret),
        totpPendingSecretEncrypted: null,
        totpBackupCodesEncrypted: encryptText(JSON.stringify(backupCodes.map(sha256))),
        // Replay tracking starts on first real login, not enrollment verification.
        totpLastUsedStep: null,
      },
    });

    await createAuditLog({
      userId: session.user.id,
      action: AuditAction.TOTP_ENABLED,
    });

    return NextResponse.json({
      success: true,
      message: '2FA has been enabled successfully',
      backupCodes,
    });
  } catch (error) {
    console.error('TOTP enable error:', error);
    return NextResponse.json(
      { error: 'Failed to enable 2FA' },
      { status: 500 }
    );
  }
}
