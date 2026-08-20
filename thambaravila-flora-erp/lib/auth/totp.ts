import * as OTPAuth from 'otpauth';
import QRCode from 'qrcode';
import { randomBytes } from 'crypto';

const APP_NAME = 'Thambaravila Flora ERP';

/**
 * Generate a new TOTP secret for a user
 */
export function generateTOTPSecret(userEmail: string): {
  secret: string;
  uri: string;
} {
  // Create a new TOTP instance
  const totp = new OTPAuth.TOTP({
    issuer: APP_NAME,
    label: userEmail,
    algorithm: 'SHA1',
    digits: 6,
    period: 30,
  });

  return {
    secret: totp.secret.base32,
    uri: totp.toString(),
  };
}

/**
 * Generate QR code data URL for TOTP setup
 */
export async function generateQRCode(uri: string): Promise<string> {
  try {
    return await QRCode.toDataURL(uri);
  } catch (error) {
    throw new Error('Failed to generate QR code');
  }
}

/**
 * Verify a TOTP token against a secret
 * Allows for time drift (±1 period = ±30 seconds)
 */
export function verifyTOTPToken(secret: string, token: string): boolean {
  return verifyTOTPTokenWithStep(secret, token) !== null;
}

export function verifyTOTPTokenWithStep(secret: string, token: string): number | null {
  try {
    const totp = new OTPAuth.TOTP({
      issuer: APP_NAME,
      algorithm: 'SHA1',
      digits: 6,
      period: 30,
      secret: OTPAuth.Secret.fromBase32(secret),
    });

    // Verify with window of 1 (allows ±30 seconds time drift)
    const delta = totp.validate({
      token,
      window: 1,
    });

    // delta is null if invalid, or a number indicating time offset
    return delta === null ? null : Math.floor(Date.now() / 1000 / 30) + delta;
  } catch {
    return null;
  }
}

/**
 * Generate backup codes for 2FA recovery
 * Returns 10 single-use backup codes
 */
export function generateBackupCodes(): string[] {
  return Array.from({ length: 10 }, () => {
    const value = randomBytes(8).toString('hex').toUpperCase();
    return value.match(/.{1,4}/g)!.join('-');
  });
}

/**
 * Validate TOTP token format (6 digits)
 */
export function isValidTOTPTokenFormat(token: string): boolean {
  return /^\d{6}$/.test(token);
}

export function normalizeBackupCode(code: string): string {
  return code.trim().toUpperCase().replace(/\s+/g, '');
}

export function isValidBackupCodeFormat(code: string): boolean {
  return /^[A-F0-9]{4}(?:-[A-F0-9]{4}){3}$/.test(normalizeBackupCode(code));
}
