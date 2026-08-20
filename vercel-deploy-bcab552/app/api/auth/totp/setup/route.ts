import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth/config';
import { generateTOTPSecret, generateQRCode } from '@/lib/auth/totp';
import { prisma } from '@/lib/prisma';
import { createActivityLog } from '@/lib/activity-log';
import { getClientIp } from '@/lib/auth/middleware';
import { encryptText } from '@/lib/security/encryption';

/**
 * Generate TOTP secret and QR code for user
 * This initiates the 2FA setup process
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

    // Generate new TOTP secret
    const { secret, uri } = generateTOTPSecret(session.user.email);

    // Generate QR code
    const qrCodeDataUrl = await generateQRCode(uri);

    await prisma.user.update({
      where: { id: session.user.id },
      data: { totpPendingSecretEncrypted: encryptText(secret) },
    });

    await createActivityLog({
      actorUserId: session.user.id,
      actorName: session.user.name,
      actorEmail: session.user.email,
      actorRole: session.user.role?.name || 'Staff',
      action: 'TOTP_SETUP_STARTED',
      category: 'SECURITY',
      entityType: 'user',
      entityId: session.user.id,
      summary: 'Two-factor authentication setup started',
      httpMethod: 'POST',
      route: '/api/auth/totp/setup',
      statusCode: 200,
      ipAddress: getClientIp(request),
      userAgent: request.headers.get('user-agent'),
    });

    return NextResponse.json({
      secret,
      qrCode: qrCodeDataUrl,
      manualEntry: {
        issuer: 'Thambaravila Flora ERP',
        account: session.user.email,
        secret: secret,
      },
    });
  } catch (error) {
    console.error('TOTP setup error:', error);
    return NextResponse.json(
      { error: 'Failed to setup 2FA' },
      { status: 500 }
    );
  }
}
