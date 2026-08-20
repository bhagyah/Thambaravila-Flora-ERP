import { prisma } from '@/lib/prisma';
import { createAuditLog, AuditAction } from './audit';

/**
 * Permission names - matches database permission names
 */
export const PermissionName = {
  VIEW_FINANCIAL_DASHBOARD: 'view_financial_dashboard',
  RECORD_PAYMENT_STATUS: 'record_payment_status',
  CREATE_EDIT_ENQUIRIES: 'create_edit_enquiries',
  VIEW_CUSTOMER_FULL_HISTORY: 'view_customer_full_history',
  VIEW_CUSTOMER_FINANCIAL_ONLY: 'view_customer_financial_only',
  VIEW_CUSTOMER_EVENT_ONLY: 'view_customer_event_only',
  MANAGE_USERS_ROLES: 'manage_users_roles',
  MANAGE_USERS_EXCEPT_OWNER: 'manage_users_except_owner',
  SET_PAYMENT_DEADLINE_RULES: 'set_payment_deadline_rules',
  DOWNLOAD_BALANCE_SHEETS: 'download_balance_sheets',
  VIEW_OWNER_INSIGHTS: 'view_owner_insights',
  INTERNAL_CHAT: 'internal_chat',
  PRINT_LAN: 'print_lan',
} as const;

export type PermissionNameType = typeof PermissionName[keyof typeof PermissionName];

/**
 * Role names
 */
export const RoleName = {
  OWNER: 'Owner',
  IT_ADMIN: 'IT/Admin',
  ACCOUNTANT: 'Accountant',
  SALES_MANAGER: 'Sales Manager',
  WEDDING_COORDINATOR: 'Wedding Coordinator',
  SOCIAL_MEDIA_MANAGER: 'Social Media Manager',
  LABOUR: 'Labour',
} as const;

/**
 * Check if a user has a specific permission
 * This is the core RBAC enforcement function
 */
export async function userHasPermission(
  userId: string,
  permissionName: PermissionNameType
): Promise<boolean> {
  try {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: {
        role: {
          include: {
            rolePermissions: {
              include: {
                permission: true,
              },
            },
          },
        },
      },
    });

    if (!user || !user.isActive) {
      return false;
    }

    // Owner role has full permission access
    if (user.role.name === 'Owner') {
      return true;
    }
    const hasPermission = user.role.rolePermissions.some(
      (rp) => rp.permission.name === permissionName
    );

    return hasPermission;
  } catch (error) {
    console.error('Error checking permission:', error);
    return false;
  }
}

/**
 * Check if a user has any of the specified permissions
 */
export async function userHasAnyPermission(
  userId: string,
  permissionNames: PermissionNameType[]
): Promise<boolean> {
  for (const permissionName of permissionNames) {
    if (await userHasPermission(userId, permissionName)) {
      return true;
    }
  }
  return false;
}

/**
 * Check if a user has all of the specified permissions
 */
export async function userHasAllPermissions(
  userId: string,
  permissionNames: PermissionNameType[]
): Promise<boolean> {
  for (const permissionName of permissionNames) {
    if (!(await userHasPermission(userId, permissionName))) {
      return false;
    }
  }
  return true;
}

/**
 * Get all permissions for a user
 */
export async function getUserPermissions(userId: string): Promise<string[]> {
  try {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: {
        role: {
          include: {
            rolePermissions: {
              include: {
                permission: true,
              },
            },
          },
        },
      },
    });

    if (!user) {
      return [];
    }

    return user.role.rolePermissions.map((rp) => rp.permission.name);
  } catch (error) {
    console.error('Error getting user permissions:', error);
    return [];
  }
}

/**
 * Check if user has a specific role
 */
export async function userHasRole(userId: string, roleName: string): Promise<boolean> {
  try {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: { role: true },
    });

    return user?.role.name === roleName;
  } catch (error) {
    console.error('Error checking role:', error);
    return false;
  }
}

/**
 * Get user's role name
 */
export async function getUserRole(userId: string): Promise<string | null> {
  try {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: { role: true },
    });

    return user?.role.name || null;
  } catch (error) {
    console.error('Error getting user role:', error);
    return null;
  }
}

/**
 * Enforce permission check with audit logging
 * Throws error if permission denied
 */
export async function requirePermission(
  userId: string,
  permissionName: PermissionNameType,
  context?: {
    action?: string;
    entityType?: string;
    entityId?: string;
    ipAddress?: string;
  }
): Promise<void> {
  const hasPermission = await userHasPermission(userId, permissionName);

  if (!hasPermission) {
    // Log unauthorized access attempt
    await createAuditLog({
      userId,
      action: AuditAction.UNAUTHORIZED_ACCESS_ATTEMPT,
      entityType: context?.entityType,
      entityId: context?.entityId,
      details: {
        requiredPermission: permissionName,
        attemptedAction: context?.action,
      },
      ipAddress: context?.ipAddress,
    });

    throw new Error('Permission denied');
  }
}

/**
 * Special check for IT/Admin role
 * IT/Admin can manage all users EXCEPT Owner role users
 */
export async function canManageUser(
  adminUserId: string,
  targetUserId: string
): Promise<boolean> {
  const adminRole = await getUserRole(adminUserId);
  const targetRole = await getUserRole(targetUserId);

  // Owner can manage anyone
  if (adminRole === RoleName.OWNER) {
    return true;
  }

  // IT/Admin can manage anyone except Owner
  if (adminRole === RoleName.IT_ADMIN) {
    return targetRole !== RoleName.OWNER;
  }

  return false;
}

/**
 * Validate financial data access
 * IT/Admin should NEVER access financial tables
 */
export function isFinancialDataAccess(entityType: string): boolean {
  const financialEntities = ['payment', 'payment_stage', 'account', 'balance_sheet'];
  return financialEntities.includes(entityType.toLowerCase());
}
