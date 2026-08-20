import { prisma } from '@/lib/prisma';

const LOCKOUT_DURATION_MINUTES = 30;
const MAX_FAILED_ATTEMPTS = 5;

export interface RateLimitResult {
  allowed: boolean;
  remainingAttempts?: number;
  lockedUntil?: Date;
}

/**
 * Check if user is currently locked out
 */
export async function checkAccountLockout(userId: string): Promise<RateLimitResult> {
  try {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { lockedUntil: true, failedAttempts: true },
    });

    if (!user) {
      return { allowed: false };
    }

    // Check if account is currently locked
    const lockedUntil = user.lockedUntil ? new Date(user.lockedUntil) : null;
    if (lockedUntil && lockedUntil > new Date()) {
      return {
        allowed: false,
        lockedUntil,
      };
    }

    // If lock has expired, reset it
    if (lockedUntil && lockedUntil <= new Date()) {
      await prisma.user.update({
        where: { id: userId },
        data: { lockedUntil: null, failedAttempts: 0 },
      });
    }

    const remainingAttempts = MAX_FAILED_ATTEMPTS - (user.failedAttempts || 0);

    return {
      allowed: true,
      remainingAttempts: Math.max(0, remainingAttempts),
    };
  } catch (error) {
    console.error('Error checking account lockout:', error);
    return { allowed: true };
  }
}

/**
 * Record a failed login attempt
 * Locks account if max attempts exceeded
 */
export async function recordFailedLogin(userId: string): Promise<void> {
  try {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { failedAttempts: true },
    });

    if (!user) return;

    const newFailedAttempts = (user.failedAttempts || 0) + 1;
    const shouldLock = newFailedAttempts >= MAX_FAILED_ATTEMPTS;

    const lockedUntil = shouldLock
      ? new Date(Date.now() + LOCKOUT_DURATION_MINUTES * 60 * 1000)
      : null;

    await prisma.user.update({
      where: { id: userId },
      data: {
        failedAttempts: newFailedAttempts,
        lockedUntil,
      },
    });
  } catch (error) {
    console.error('Error recording failed login:', error);
  }
}

/**
 * Reset failed attempts on successful login
 */
export async function resetFailedAttempts(userId: string): Promise<void> {
  try {
    await prisma.user.update({
      where: { id: userId },
      data: {
        failedAttempts: 0,
        lockedUntil: null,
        lastLogin: new Date(),
      },
    });
  } catch (error) {
    console.error('Error resetting failed attempts:', error);
  }
}

/**
 * Check if email-based rate limiting should apply
 * This prevents brute force attacks by email
 */
const emailAttempts = new Map<string, { count: number; resetAt: Date }>();

export function checkEmailRateLimit(email: string): RateLimitResult {
  const now = new Date();
  const record = emailAttempts.get(email);

  if (!record || record.resetAt < now) {
    return { allowed: true, remainingAttempts: MAX_FAILED_ATTEMPTS };
  }

  if (record.count >= MAX_FAILED_ATTEMPTS) {
    return { allowed: false, lockedUntil: record.resetAt };
  }

  return { allowed: true, remainingAttempts: MAX_FAILED_ATTEMPTS - record.count };
}

export function incrementEmailRateLimit(email: string): void {
  const now = new Date();
  const record = emailAttempts.get(email);

  if (!record || record.resetAt < now) {
    emailAttempts.set(email, {
      count: 1,
      resetAt: new Date(now.getTime() + 15 * 60 * 1000), // 15 minutes
    });
  } else {
    record.count += 1;
  }
}

/**
 * Reset email rate limit on successful login
 */
export function resetEmailRateLimit(email: string): void {
  emailAttempts.delete(email);
}
