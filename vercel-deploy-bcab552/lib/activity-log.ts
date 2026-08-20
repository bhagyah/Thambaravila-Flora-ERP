import { prisma } from '@/lib/prisma';

const SENSITIVE_KEYS = /password|secret|token|authorization|cookie|qrCode|attachment|content/i;

export interface ActivityLogParams {
  actorUserId?: string | null;
  actorName?: string;
  actorEmail?: string | null;
  actorRole?: string;
  action: string;
  category?: string;
  entityType?: string | null;
  entityId?: string | null;
  summary?: string | null;
  httpMethod?: string | null;
  route?: string | null;
  outcome?: string;
  statusCode?: number | null;
  changedData?: unknown;
  previousData?: unknown;
  newData?: unknown;
  metadata?: unknown;
  ipAddress?: string | null;
  userAgent?: string | null;
}

function sanitize(value: unknown, depth = 0): unknown {
  if (value === null || value === undefined) return value;
  if (depth > 5) return '[MAX_DEPTH]';
  if (typeof value === 'string') return value.length > 1000 ? `${value.slice(0, 1000)}...[TRUNCATED]` : value;
  if (typeof value !== 'object') return value;
  if (Array.isArray(value)) return value.slice(0, 50).map((item) => sanitize(item, depth + 1));

  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>).map(([key, item]) => [
      key,
      SENSITIVE_KEYS.test(key) ? '[REDACTED]' : sanitize(item, depth + 1),
    ])
  );
}

export function inferEntityFromRoute(route?: string | null) {
  if (!route) return { entityType: null, entityId: null };
  const parts = route.split('/').filter(Boolean);
  const apiIndex = parts.indexOf('api');
  const entityType = apiIndex >= 0 ? parts[apiIndex + 1] || null : parts[0] || null;
  const candidateId = apiIndex >= 0 ? parts[apiIndex + 2] : parts[1];
  const entityId = candidateId && !['create', 'confirm', 'config', 'me', 'trigger-deadline-check'].includes(candidateId)
    ? candidateId
    : null;
  return { entityType, entityId };
}

export async function createActivityLog(params: ActivityLogParams) {
  try {
    let actorName = params.actorName || 'System';
    let actorEmail = params.actorEmail || null;
    let actorRole = params.actorRole || 'SYSTEM';

    if (params.actorUserId && (!params.actorName || !params.actorRole)) {
      const actor = await prisma.user.findUnique({
        where: { id: params.actorUserId },
        select: { name: true, email: true, role: { select: { name: true } } },
      });
      if (actor) {
        actorName = params.actorName || actor.name;
        actorEmail = params.actorEmail || actor.email;
        actorRole = params.actorRole || actor.role.name;
      }
    }

    await prisma.activityLog.create({
      data: {
        actorUserId: params.actorUserId || null,
        actorName,
        actorEmail,
        actorRole,
        action: params.action,
        category: params.category || 'BUSINESS',
        entityType: params.entityType || null,
        entityId: params.entityId || null,
        summary: params.summary || null,
        httpMethod: params.httpMethod || null,
        route: params.route || null,
        outcome: params.outcome || 'SUCCESS',
        statusCode: params.statusCode || null,
        changedData: params.changedData === undefined ? undefined : (sanitize(params.changedData) as any),
        previousData: params.previousData === undefined ? undefined : (sanitize(params.previousData) as any),
        newData: params.newData === undefined ? undefined : (sanitize(params.newData) as any),
        metadata: params.metadata === undefined ? undefined : (sanitize(params.metadata) as any),
        ipAddress: params.ipAddress || null,
        userAgent: params.userAgent || null,
      },
    });
  } catch (error) {
    console.error('Failed to create activity log:', error);
  }
}

export async function readSafeRequestBody(request: Request) {
  try {
    const contentType = request.headers.get('content-type') || '';
    if (!contentType.includes('application/json')) return undefined;
    return sanitize(await request.clone().json());
  } catch {
    return undefined;
  }
}

export async function readSafeResponseBody(response: Response) {
  try {
    const contentType = response.headers.get('content-type') || '';
    if (!contentType.includes('application/json')) return undefined;
    return sanitize(await response.clone().json());
  } catch {
    return undefined;
  }
}
