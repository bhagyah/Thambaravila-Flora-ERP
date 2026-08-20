import { NextAuthOptions, Session } from 'next-auth';
import { JWT } from 'next-auth/jwt';
import CredentialsProvider from 'next-auth/providers/credentials';
import { prisma } from '@/lib/prisma';
import { verifyPassword } from './password';
import {
  checkAccountLockout, 
  checkEmailRateLimit, 
  incrementEmailRateLimit,
  resetEmailRateLimit 
} from './rate-limit';
import { createAuditLog, AuditAction } from './audit';
import { requiresTwoFactor, requiresTwoFactorForRole } from './two-factor-policy';
import { verifyAndConsumeSecondFactor } from './totp-security';
import {
  getRequestIp,
  getRequestUserAgent,
  parseLoginLocation,
  recordLoginSecurityEvent,
} from './login-security';

declare module 'next-auth' {
  interface Session {
    user: {
      id: string;
      email: string;
      name: string;
      role: {
        id: string;
        name: string;
      };
      requires2FA: boolean;
      totpConfigured: boolean;
      totpVerified?: boolean;
    };
  }

  interface User {
    id: string;
    email: string;
    name: string;
    roleId: string;
    roleName: string;
    totpSecret: string | null;
    requires2FA: boolean;
    totpConfigured: boolean;
    totpVerified?: boolean;
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    id: string;
    email: string;
    name: string;
    roleId: string;
    roleName: string;
    requires2FA: boolean;
    totpConfigured: boolean;
    totpVerified?: boolean;
  }
}

// Helper function to find user by email
async function findUserByEmail(email: string) {
  try {
    const user = await prisma.user.findUnique({
      where: { email },
      include: { role: true },
    });
    if (!user) return null;
    return {
      id: user.id,
      email: user.email,
      name: user.name,
      password_hash: user.passwordHash,
      totp_secret: user.totpSecret,
      totp_secret_encrypted: user.totpSecretEncrypted,
      is_active: user.isActive,
      failed_attempts: user.failedAttempts,
      locked_until: user.lockedUntil,
      role_id: user.roleId,
      role_name: user.role.name,
    };
  } catch (error) {
    console.error('Error finding user:', error);
    return null;
  }
}

// Helper function to update failed attempts
async function updateFailedAttempts(userId: string, attempts: number) {
  try {
    await prisma.user.update({
      where: { id: userId },
      data: { failedAttempts: attempts },
    });
  } catch (error) {
    console.error('Error updating failed attempts:', error);
  }
}

export const authOptions: NextAuthOptions = {
  providers: [
    CredentialsProvider({
      name: 'Credentials',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' },
        totpToken: { label: 'TOTP Token', type: 'text', optional: true },
        loginLatitude: { label: 'Latitude', type: 'text' },
        loginLongitude: { label: 'Longitude', type: 'text' },
        loginAccuracy: { label: 'Location accuracy', type: 'text' },
        locationGranted: { label: 'Location granted', type: 'text' },
        deviceFingerprint: { label: 'Device fingerprint', type: 'text' },
      },
      async authorize(credentials, req) {
        const attemptedEmail = credentials?.email || '';
        const location = parseLoginLocation(credentials);
        const ipAddress = getRequestIp(req.headers);
        const userAgent = getRequestUserAgent(req.headers);
        let attemptedUserId: string | null = null;
        let success = false;
        let failureReason = 'Unknown authentication failure';

        try {
          if (!credentials?.email || !credentials?.password) {
            throw new Error('Email and password are required');
          }
          if (!location.granted) {
            throw new Error('Location permission and a valid device location are required to sign in');
          }

          const emailRateLimit = checkEmailRateLimit(credentials.email);
          if (!emailRateLimit.allowed) {
            throw new Error(
              `Too many failed attempts. Please try again after ${emailRateLimit.lockedUntil?.toLocaleTimeString()}`
            );
          }

          const user = await findUserByEmail(credentials.email.trim().toLowerCase());
          attemptedUserId = user?.id || null;
          if (!user) throw new Error('Invalid email or password');

          if (!user.is_active) {
            await createAuditLog({
              userId: user.id,
              action: AuditAction.LOGIN_FAILED,
              details: { reason: 'Account deactivated' },
              ipAddress,
            });
            throw new Error('Your account has been deactivated. Contact system administrator.');
          }

          const lockoutStatus = await checkAccountLockout(user.id);
          if (!lockoutStatus.allowed) {
            await createAuditLog({
              userId: user.id,
              action: AuditAction.LOGIN_FAILED,
              details: { reason: 'Account locked', lockedUntil: lockoutStatus.lockedUntil },
              ipAddress,
            });
            throw new Error(
              `Account is temporarily locked due to too many failed attempts. Try again after ${lockoutStatus.lockedUntil?.toLocaleTimeString()}`
            );
          }

          const isPasswordValid = await verifyPassword(user.password_hash, credentials.password);
          if (!isPasswordValid) {
            incrementEmailRateLimit(credentials.email);
            await updateFailedAttempts(user.id, (user.failed_attempts || 0) + 1);
            await createAuditLog({
              userId: user.id,
              action: AuditAction.LOGIN_FAILED,
              details: { reason: 'Invalid password' },
              ipAddress,
            });
            throw new Error('Invalid email or password');
          }

          const activeSecondFactor = user.totp_secret_encrypted || user.totp_secret;
          const userRequires2FA = requiresTwoFactorForRole(user.role_name);
          const has2FAConfigured = Boolean(activeSecondFactor);
          if (userRequires2FA && has2FAConfigured) {
            const submittedSecondFactor = credentials.totpToken?.trim();
            if (
              !submittedSecondFactor
              || submittedSecondFactor.toLowerCase() === 'undefined'
              || submittedSecondFactor.toLowerCase() === 'null'
            ) {
              throw new Error('2FA_REQUIRED');
            }

            const secondFactor = await verifyAndConsumeSecondFactor(user.id, submittedSecondFactor);
            if (!secondFactor.valid) {
              await createAuditLog({
                userId: user.id,
                action: 'totp_verification_failed',
                details: { reason: 'Invalid or replayed second-factor code during login' },
                ipAddress,
              });
              throw new Error('Invalid, expired, or already-used 2FA code');
            }

            await createAuditLog({
              userId: user.id,
              action: 'totp_verification_success',
              details: { context: 'login', method: secondFactor.method },
              ipAddress,
            });
          }

          await prisma.user.update({
            where: { id: user.id },
            data: { failedAttempts: 0, lastLogin: new Date() },
          });
          resetEmailRateLimit(user.email);
          await createAuditLog({ userId: user.id, action: AuditAction.LOGIN_SUCCESS, ipAddress });

          success = true;
          failureReason = '';
          return {
            id: user.id,
            email: user.email,
            name: user.name,
            roleId: user.role_id,
            roleName: user.role_name,
            totpSecret: activeSecondFactor,
            requires2FA: userRequires2FA,
            totpConfigured: has2FAConfigured,
            totpVerified: has2FAConfigured,
          };
        } catch (error) {
          failureReason = error instanceof Error ? error.message : failureReason;
          throw error;
        } finally {
          await recordLoginSecurityEvent({
            userId: attemptedUserId,
            attemptedEmail,
            success,
            failureReason: success ? null : failureReason,
            ipAddress,
            location,
            userAgent,
            deviceFingerprint: credentials?.deviceFingerprint || null,
          });
        }
      },
    }),
  ],
  
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.email = user.email;
        token.name = user.name;
        token.roleId = user.roleId;
        token.roleName = user.roleName;
        token.requires2FA = user.requires2FA;
        token.totpConfigured = user.totpConfigured;
        token.totpVerified = user.totpVerified ?? false;
      }
      return token;
    },
    
    async session({ session, token }: { session: Session; token: JWT }) {
      const dbUser = token.id
        ? await prisma.user.findUnique({
            where: { id: token.id },
            select: {
              id: true,
              email: true,
              name: true,
              totpSecret: true,
              totpSecretEncrypted: true,
              role: {
                select: {
                  id: true,
                  name: true,
                },
              },
            },
          })
        : null;

      const dbRequires2FA = dbUser
        ? requiresTwoFactorForRole(dbUser.role.name)
        : token.requires2FA ?? false;
      const dbTotpConfigured = dbUser
        ? Boolean(dbUser.totpSecretEncrypted || dbUser.totpSecret)
        : token.totpConfigured ?? false;

      session.user = {
        id: dbUser?.id || token.id,
        email: dbUser?.email || token.email,
        name: dbUser?.name || token.name,
        role: {
          id: dbUser?.role.id || token.roleId,
          name: dbUser?.role.name || token.roleName,
        },
        requires2FA: dbRequires2FA,
        totpConfigured: dbTotpConfigured,
        totpVerified: dbRequires2FA
          ? dbTotpConfigured && token.totpVerified === true && token.requires2FA === dbRequires2FA
          : true,
      };
      return session;
    },
  },

  pages: {
    signIn: '/auth/signin',
    error: '/auth/error',
  },

  session: {
    strategy: 'jwt',
    maxAge: 8 * 60 * 60, // 8 hours
  },

  secret: process.env.NEXTAUTH_SECRET,
};
