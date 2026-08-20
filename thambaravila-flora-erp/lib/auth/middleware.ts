import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from './config';
import { PermissionNameType, requirePermission } from './permissions';
import { createActivityLog, inferEntityFromRoute, readSafeRequestBody, readSafeResponseBody } from '@/lib/activity-log';

/**
 * Get client IP address from request
 */
export function getClientIp(request: NextRequest): string | undefined {
  return (
    request.headers.get('x-forwarded-for')?.split(',')[0] ||
    request.headers.get('x-real-ip') ||
    undefined
  );
}

/**
 * Get current session user
 */
export async function getSessionUser(request?: NextRequest) {
  const session = await getServerSession(authOptions);
  return session?.user || null;
}

/**
 * Middleware factory for protecting API routes with authentication
 */
export function withAuth(
  handler: (request: NextRequest, context: { session: any; userId: string }) => Promise<NextResponse>
) {
  return async (request: NextRequest) => {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Unauthorized - Please sign in' },
        { status: 401 }
      );
    }

    // Check if 2FA is required but not verified
    if (session.user.requires2FA && session.user.totpConfigured && !session.user.totpVerified) {
      return NextResponse.json(
        { error: 'Two-factor authentication required' },
        { status: 403 }
      );
    }

    const startedAt = Date.now();
    const isMutation = ['POST', 'PUT', 'PATCH', 'DELETE'].includes(request.method);
    const requestBody = isMutation
      ? await readSafeRequestBody(request)
      : undefined;
    const url = new URL(request.url);
    const entity = inferEntityFromRoute(url.pathname);

    try {
      const response = await handler(request, {
        session,
        userId: session.user.id,
      });

      if (isMutation) {
        const responseBody = await readSafeResponseBody(response);
        await createActivityLog({
          actorUserId: session.user.id,
          actorName: session.user.name,
          actorEmail: session.user.email,
          actorRole: session.user.role?.name || 'Staff',
          action: `${request.method}_${(entity.entityType || 'SYSTEM').toUpperCase()}`,
          category: 'API_MUTATION',
          entityType: entity.entityType,
          entityId: entity.entityId,
          summary: `${request.method} ${url.pathname}`,
          httpMethod: request.method,
          route: url.pathname,
          outcome: response.status >= 400 ? 'FAILED' : 'SUCCESS',
          statusCode: response.status,
          changedData: requestBody,
          newData: responseBody,
          metadata: { durationMs: Date.now() - startedAt },
          ipAddress: getClientIp(request),
          userAgent: request.headers.get('user-agent'),
        });
      }

      return response;
    } catch (error) {
      if (isMutation) {
        await createActivityLog({
          actorUserId: session.user.id,
          actorName: session.user.name,
          actorEmail: session.user.email,
          actorRole: session.user.role?.name || 'Staff',
          action: `${request.method}_${(entity.entityType || 'SYSTEM').toUpperCase()}`,
          category: 'API_MUTATION',
          entityType: entity.entityType,
          entityId: entity.entityId,
          summary: `${request.method} ${url.pathname} failed`,
          httpMethod: request.method,
          route: url.pathname,
          outcome: 'FAILED',
          statusCode: 500,
          changedData: requestBody,
          metadata: { durationMs: Date.now() - startedAt, error: error instanceof Error ? error.message : 'Unknown error' },
          ipAddress: getClientIp(request),
          userAgent: request.headers.get('user-agent'),
        });
      }
      throw error;
    }
  };
}

/**
 * Middleware factory for protecting API routes with permission check
 */
export function withPermission(
  permissionName: PermissionNameType,
  handler: (request: NextRequest, context: { session: any; userId: string }) => Promise<NextResponse>
) {
  return withAuth(async (request, context) => {
    try {
      // Enforce permission check
      await requirePermission(context.userId, permissionName, {
        ipAddress: getClientIp(request),
      });

      return handler(request, context);
    } catch (error: any) {
      return NextResponse.json(
        { error: error.message || 'Permission denied' },
        { status: 403 }
      );
    }
  });
}

/**
 * Middleware factory for protecting API routes with multiple permission options
 * User needs at least ONE of the specified permissions
 */
export function withAnyPermission(
  permissionNames: PermissionNameType[],
  handler: (request: NextRequest, context: { session: any; userId: string }) => Promise<NextResponse>
) {
  return withAuth(async (request, context) => {
    try {
      const { userHasAnyPermission } = await import('./permissions');
      const hasPermission = await userHasAnyPermission(context.userId, permissionNames);

      if (!hasPermission) {
        const { createAuditLog, AuditAction } = await import('./audit');
        await createAuditLog({
          userId: context.userId,
          action: AuditAction.UNAUTHORIZED_ACCESS_ATTEMPT,
          details: {
            requiredPermissions: permissionNames,
          },
          ipAddress: getClientIp(request),
        });

        return NextResponse.json(
          { error: 'Permission denied' },
          { status: 403 }
        );
      }

      return handler(request, context);
    } catch (error: any) {
      return NextResponse.json(
        { error: error.message || 'Permission denied' },
        { status: 403 }
      );
    }
  });
}

/**
 * Middleware factory for protecting API routes with role check
 */
export function withRole(
  allowedRoles: string[],
  handler: (request: NextRequest, context: { session: any; userId: string }) => Promise<NextResponse>
) {
  return withAuth(async (request, context) => {
    const userRole = context.session.user.role.name;

    if (!allowedRoles.includes(userRole)) {
      const { createAuditLog, AuditAction } = await import('./audit');
      await createAuditLog({
        userId: context.userId,
        action: AuditAction.UNAUTHORIZED_ACCESS_ATTEMPT,
        details: {
          requiredRoles: allowedRoles,
          userRole,
        },
        ipAddress: getClientIp(request),
      });

      return NextResponse.json(
        { error: 'Access denied for your role' },
        { status: 403 }
      );
    }

    return handler(request, context);
  });
}

/**
 * Require password re-authentication for sensitive operations
 * Returns the validated user or null
 */
export async function requirePasswordReauth(
  userId: string,
  password: string
): Promise<boolean> {
  const { prisma } = await import('@/lib/prisma');
  const { verifyPassword } = await import('./password');

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { passwordHash: true },
  });

  if (!user) {
    return false;
  }

  return await verifyPassword(user.passwordHash, password);
}

/**
 * Middleware for operations requiring password re-authentication
 */
export function withPasswordReauth(
  handler: (request: NextRequest, context: { session: any; userId: string }) => Promise<NextResponse>
) {
  return withAuth(async (request, context) => {
    try {
      const body = await request.json();
      const { password } = body;

      if (!password) {
        return NextResponse.json(
          { error: 'Password re-authentication required' },
          { status: 400 }
        );
      }

      const isValid = await requirePasswordReauth(context.userId, password);

      if (!isValid) {
        const { createAuditLog } = await import('./audit');
        await createAuditLog({
          userId: context.userId,
          action: 'password_reauth_failed',
          ipAddress: getClientIp(request),
        });

        return NextResponse.json(
          { error: 'Invalid password' },
          { status: 401 }
        );
      }

      // Re-create request with original body for handler
      const newRequest = new NextRequest(request.url, {
        method: request.method,
        headers: request.headers,
        body: JSON.stringify(body),
      });

      return handler(newRequest, context);
    } catch (error: any) {
      return NextResponse.json(
        { error: error.message || 'Authentication failed' },
        { status: 500 }
      );
    }
  });
}
