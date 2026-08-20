import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth/config';
import { createAuditLog, AuditAction } from '@/lib/auth/audit';
import { verifyAndConsumeSecondFactor } from '@/lib/auth/totp-security';

/**
 * Verify TOTP token during login or setup
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

    if (!token || typeof token !== 'string') {
      return NextResponse.json(
        { error: 'Verification code is required.' },
        { status: 400 }
      );
    }

    const result = await verifyAndConsumeSecondFactor(session.user.id, token);

    if (!result.valid) {
      await createAuditLog({
        userId: session.user.id,
        action: 'totp_verification_failed',
        details: { reason: 'Invalid token' },
      });

      return NextResponse.json(
        { error: 'Invalid verification code' },
        { status: 401 }
      );
    }

    // Log successful verification
    await createAuditLog({
      userId: session.user.id,
      action: 'totp_verification_success',
    });

    return NextResponse.json({
      success: true,
      message: '2FA verified successfully',
      method: result.method,
    });
  } catch (error) {
    console.error('TOTP verification error:', error);
    return NextResponse.json(
      { error: 'Failed to verify 2FA' },
      { status: 500 }
    );
  }
}
