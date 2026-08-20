import { prisma } from '@/lib/prisma';

type HeaderSource = Record<string, string | string[] | undefined> | Headers | undefined;

export interface LoginLocation {
  granted: boolean;
  latitude: number | null;
  longitude: number | null;
  accuracy: number | null;
}

function readHeader(headers: HeaderSource, name: string): string | undefined {
  if (!headers) return undefined;
  if (headers instanceof Headers) return headers.get(name) || undefined;
  const value = headers[name] ?? headers[name.toLowerCase()];
  return Array.isArray(value) ? value[0] : value;
}

export function getRequestIp(headers: HeaderSource): string | undefined {
  return readHeader(headers, 'x-forwarded-for')?.split(',')[0]?.trim()
    || readHeader(headers, 'x-real-ip')
    || readHeader(headers, 'cf-connecting-ip');
}

export function getRequestUserAgent(headers: HeaderSource): string | undefined {
  return readHeader(headers, 'user-agent');
}

export function parseLoginLocation(credentials: Record<string, unknown> | undefined): LoginLocation {
  const latitude = Number(credentials?.loginLatitude);
  const longitude = Number(credentials?.loginLongitude);
  const accuracy = Number(credentials?.loginAccuracy);
  const granted = credentials?.locationGranted === 'true';
  const valid = granted
    && Number.isFinite(latitude) && latitude >= -90 && latitude <= 90
    && Number.isFinite(longitude) && longitude >= -180 && longitude <= 180
    && Number.isFinite(accuracy) && accuracy >= 0 && accuracy <= 10000;

  return {
    granted: valid,
    latitude: valid ? latitude : null,
    longitude: valid ? longitude : null,
    accuracy: valid ? accuracy : null,
  };
}

export async function recordLoginSecurityEvent(input: {
  userId?: string | null;
  attemptedEmail?: string | null;
  success: boolean;
  failureReason?: string | null;
  ipAddress?: string;
  location: LoginLocation;
  userAgent?: string;
  deviceFingerprint?: string | null;
}): Promise<void> {
  try {
    await prisma.loginSecurityEvent.create({
      data: {
        userId: input.userId || null,
        attemptedEmail: input.attemptedEmail?.trim().toLowerCase() || null,
        success: input.success,
        failureReason: input.failureReason || null,
        ipAddress: input.ipAddress || null,
        latitude: input.location.latitude,
        longitude: input.location.longitude,
        locationAccuracy: input.location.accuracy,
        locationGranted: input.location.granted,
        userAgent: input.userAgent?.slice(0, 1000) || null,
        deviceFingerprint: input.deviceFingerprint?.slice(0, 128) || null,
      },
    });
  } catch (error) {
    console.error('Failed to record login security event:', error);
  }
}
