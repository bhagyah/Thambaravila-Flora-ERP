import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/auth/middleware';
import { getUserPermissions } from '@/lib/auth/permissions';

/**
 * GET /api/permissions/me
 * Get current user's permissions
 * This endpoint is used by the frontend to determine what UI elements to show
 */
async function getMyPermissionsHandler(
  request: NextRequest,
  context: { session: any; userId: string }
) {
  try {
    const permissions = await getUserPermissions(context.userId);

    return NextResponse.json({
      permissions,
      role: context.session.user.role,
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: 'Failed to fetch permissions' },
      { status: 500 }
    );
  }
}

// Only requires authentication, not specific permission
export const GET = withAuth(getMyPermissionsHandler);
