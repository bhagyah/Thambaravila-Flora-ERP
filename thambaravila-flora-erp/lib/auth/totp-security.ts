import { prisma } from '@/lib/prisma';
import { decryptText, encryptText, sha256 } from '@/lib/security/encryption';
import {
  isValidBackupCodeFormat,
  isValidTOTPTokenFormat,
  normalizeBackupCode,
  verifyTOTPTokenWithStep,
} from './totp';

type SecretFields = {
  totpSecret: string | null;
  totpSecretEncrypted: string | null;
};

export function readActiveTOTPSecret(user: SecretFields): string | null {
  if (user.totpSecretEncrypted) {
    try {
      return decryptText(user.totpSecretEncrypted);
    } catch (error) {
      console.error('Failed to decrypt TOTP secret:', error);
      return null;
    }
  }
  return user.totpSecret || null;
}

export async function migrateLegacyTOTPSecret(userId: string, secret: string): Promise<void> {
  await prisma.user.updateMany({
    where: { id: userId, totpSecretEncrypted: null, totpSecret: secret },
    data: { totpSecretEncrypted: encryptText(secret), totpSecret: null },
  });
}

export async function verifyAndConsumeSecondFactor(
  userId: string,
  rawToken: string
): Promise<{ valid: boolean; method?: 'totp' | 'recovery' }> {
  const token = rawToken.trim();
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      totpSecret: true,
      totpSecretEncrypted: true,
      totpBackupCodesEncrypted: true,
      totpLastUsedStep: true,
    },
  });

  if (!user) return { valid: false };
  const secret = readActiveTOTPSecret(user);

  if (secret && isValidTOTPTokenFormat(token)) {
    const matchedStep = verifyTOTPTokenWithStep(secret, token);
    if (matchedStep === null) return { valid: false };

    const consumed = await prisma.user.updateMany({
      where: {
        id: userId,
        OR: [
          { totpLastUsedStep: null },
          { totpLastUsedStep: { lt: matchedStep } },
        ],
      },
      data: {
        totpLastUsedStep: matchedStep,
        ...(user.totpSecret && !user.totpSecretEncrypted
          ? { totpSecretEncrypted: encryptText(secret), totpSecret: null }
          : {}),
      },
    });

    return consumed.count === 1 ? { valid: true, method: 'totp' } : { valid: false };
  }

  if (!user.totpBackupCodesEncrypted || !isValidBackupCodeFormat(token)) {
    return { valid: false };
  }

  try {
    const currentEncrypted = user.totpBackupCodesEncrypted;
    const hashes = JSON.parse(decryptText(currentEncrypted)) as string[];
    const codeHash = sha256(normalizeBackupCode(token));
    const index = hashes.indexOf(codeHash);
    if (index < 0) return { valid: false };

    const remaining = hashes.filter((_, itemIndex) => itemIndex !== index);
    const consumed = await prisma.user.updateMany({
      where: { id: userId, totpBackupCodesEncrypted: currentEncrypted },
      data: { totpBackupCodesEncrypted: encryptText(JSON.stringify(remaining)) },
    });
    return consumed.count === 1 ? { valid: true, method: 'recovery' } : { valid: false };
  } catch (error) {
    console.error('Failed to verify recovery code:', error);
    return { valid: false };
  }
}
