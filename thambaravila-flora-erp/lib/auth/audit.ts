import { prisma } from '@/lib/prisma';
import { createActivityLog } from '@/lib/activity-log';

export interface AuditLogParams {
  userId: string;
  action: string;
  entityType?: string;
  entityId?: string;
  details?: Record<string, any>;
  ipAddress?: string;
}

/**
 * Create an audit log entry
 * Audit logs are append-only and cannot be deleted by any user
 */
export async function createAuditLog(params: AuditLogParams) {
  try {
    await prisma.auditLog.create({
      data: {
        userId: params.userId,
        action: params.action,
        entityType: params.entityType || null,
        entityId: params.entityId || null,
        details: params.details ? params.details : undefined,
        ipAddress: params.ipAddress || null,
      },
    });
    await createActivityLog({
      actorUserId: params.userId,
      action: params.action,
      category: params.action.toLowerCase().includes('approv') || params.action.toLowerCase().includes('reject')
        ? 'APPROVAL'
        : 'DETAILED_AUDIT',
      entityType: params.entityType,
      entityId: params.entityId,
      summary: params.action.replace(/_/g, ' '),
      changedData: params.details,
      ipAddress: params.ipAddress,
    });
  } catch (error) {
    console.error('Failed to create audit log:', error);
  }
}

/**
 * Common audit actions
 */
export const AuditAction = {
  // Auth actions
  LOGIN_SUCCESS: 'login_success',
  LOGIN_FAILED: 'login_failed',
  LOGOUT: 'logout',
  PASSWORD_CHANGED: 'password_changed',
  TOTP_ENABLED: 'totp_enabled',
  TOTP_DISABLED: 'totp_disabled',
  ACCOUNT_LOCKED: 'account_locked',

  // User management
  USER_CREATED: 'user_created',
  USER_UPDATED: 'user_updated',
  USER_DEACTIVATED: 'user_deactivated',
  USER_ACTIVATED: 'user_activated',

  // Role management
  ROLE_CREATED: 'role_created',
  ROLE_UPDATED: 'role_updated',
  ROLE_DELETED: 'role_deleted',
  ROLE_PERMISSION_CHANGED: 'role_permission_changed',

  // Payment actions (critical for security)
  PAYMENT_CONFIRMED: 'payment_confirmed',
  PAYMENT_UPDATED: 'payment_updated',
  PAYMENT_DEADLINE_CHANGED: 'payment_deadline_changed',

  // Customer actions
  CUSTOMER_CREATED: 'customer_created',
  CUSTOMER_UPDATED: 'customer_updated',
  ENQUIRY_CREATED: 'enquiry_created',
  ENQUIRY_UPDATED: 'enquiry_updated',
  ENQUIRY_STATUS_CHANGED: 'enquiry_status_changed',

  // System actions
  PAYMENT_RULE_CHANGED: 'payment_rule_changed',
  UNAUTHORIZED_ACCESS_ATTEMPT: 'unauthorized_access_attempt',
} as const;
