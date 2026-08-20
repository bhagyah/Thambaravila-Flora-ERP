import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth/config';
import { prisma } from '@/lib/prisma';
import { createAuditLog } from '@/lib/auth/audit';
import { colomboDateKey, colomboDayBounds } from '@/lib/attendance/colombo-time';

// Helper: Haversine distance in metres between two lat/lon points.
// NOTE: This runs ONLY on the server. Client-side distance calculations
// must never be trusted for geofence accept/reject decisions.
function haversineMeters(
  lat1: number, lon1: number,
  lat2: number, lon2: number
): number {
  const R = 6371000; // Earth radius in metres
  const φ1 = (lat1 * Math.PI) / 180;
  const φ2 = (lat2 * Math.PI) / 180;
  const Δφ = ((lat2 - lat1) * Math.PI) / 180;
  const Δλ = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(Δφ / 2) ** 2 +
    Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// Maximum accepted GPS accuracy in metres. Readings worse than this
// are considered too unreliable for attendance validation.
// NOTE: Indoor WiFi-based positioning commonly reports 50–200m accuracy.
// Desktop browsers (no GPS chip) often report 100–500m via IP/WiFi geolocation.
// 300m is a practical threshold that still prevents users who are clearly
// in a different city/area while allowing normal indoor office usage.
const MAX_ACCURACY_METERS = 300;

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const isPrivileged =
      session.user.role.name === 'Owner' ||
      session.user.role.name === 'IT/Admin';

    // Active session for the current user
    const activeSession = await prisma.workSession.findFirst({
      where: { userId: session.user.id, endTime: null },
      include: { geofence: { select: { name: true } } },
    });

    // Session history — IT/Owner see all users, others see own only
    const sessions = await prisma.workSession.findMany({
      where: isPrivileged ? {} : { userId: session.user.id },
      include: { geofence: { select: { name: true } } },
      orderBy: { startTime: 'desc' },
      take: 50,
    });

    return NextResponse.json({ activeSession, sessions });
  } catch (error) {
    console.error('Error fetching work sessions:', error);
    return NextResponse.json(
      { error: 'Failed to fetch work sessions' },
      { status: 500 }
    );
  }
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await req.json();
    const {
      action,
      notes,
      latitude,
      longitude,
      accuracyMeters,
      deviceInfo,
    } = body;

    // ── Validate that coordinates were supplied ──────────────────────────
    if (latitude == null || longitude == null || accuracyMeters == null) {
      await logAttempt({
        userId: session.user.id,
        userName: session.user.name || 'User',
        action,
        latitude: null,
        longitude: null,
        accuracyMeters: null,
        result: 'REJECTED_NO_LOCATION',
        rejectionReason: 'No GPS coordinates supplied. Location access is required.',
        deviceInfo: deviceInfo || null,
      });
      return NextResponse.json(
        { error: 'Location access is required to mark attendance. Please allow location access and try again.' },
        { status: 400 }
      );
    }

    // ── Reject weak GPS signals ──────────────────────────────────────────
    // IMPORTANT: A large accuracy value means the device is LESS certain
    // of its position. We reject high values to avoid accepting
    // low-confidence positions that could place someone inside a zone
    // when they are actually outside it.
    if (accuracyMeters > MAX_ACCURACY_METERS) {
      await logAttempt({
        userId: session.user.id,
        userName: session.user.name || 'User',
        action,
        latitude,
        longitude,
        accuracyMeters,
        result: 'REJECTED_WEAK_GPS',
        rejectionReason: `GPS accuracy too low (${Math.round(accuracyMeters)}m reported, max ${MAX_ACCURACY_METERS}m allowed).`,
        deviceInfo: deviceInfo || null,
      });
      return NextResponse.json(
        {
          error: `Location signal too weak (±${Math.round(accuracyMeters)}m). Please move to an area with better GPS coverage and try again.`,
        },
        { status: 400 }
      );
    }

    // ── Server-side Haversine geofence check ────────────────────────────
    // NOTE: This is best-effort geofencing. Browser GPS coordinates can be
    // spoofed by fake-location applications or modified device settings.
    // This system prevents accidental/casual off-site check-ins and
    // provides a verifiable record, but is NOT a guarantee against
    // a deliberately spoofed location.
    const activeGeofences = await prisma.geofence.findMany({
      where: { isActive: true },
    });

    let matchedGeofence: typeof activeGeofences[0] | null = null;
    let nearestGeofence: typeof activeGeofences[0] | null = null;
    let nearestDistance = Infinity;

    for (const fence of activeGeofences) {
      const distM = haversineMeters(
        latitude,
        longitude,
        fence.centerLatitude,
        fence.centerLongitude
      );
      if (distM < nearestDistance) {
        nearestDistance = distM;
        nearestGeofence = fence;
      }
      if (distM <= fence.radiusMeters) {
        matchedGeofence = fence;
        break; // Inside at least one zone — no need to check further
      }
    }

    if (!matchedGeofence) {
      const reason =
        activeGeofences.length === 0
          ? 'No active attendance zones are configured. Please contact IT to set up a geofence.'
          : `You are ${nearestDistance < 10000 ? Math.round(nearestDistance) + 'm away from' : 'outside'} the nearest approved attendance zone${nearestGeofence ? ` (${nearestGeofence.name})` : ''}.`;

      await logAttempt({
        userId: session.user.id,
        userName: session.user.name || 'User',
        action,
        latitude,
        longitude,
        accuracyMeters,
        result: 'REJECTED_OUTSIDE_ZONE',
        rejectionReason: reason,
        nearestGeofenceId: nearestGeofence?.id || null,
        nearestDistanceM: nearestDistance === Infinity ? null : nearestDistance,
        deviceInfo: deviceInfo || null,
      });

      await createAuditLog({
        userId: session.user.id,
        action: `ATTENDANCE_${action}_REJECTED`,
        entityType: 'attendance',
        details: {
          reason,
          latitude,
          longitude,
          accuracyMeters,
          nearestGeofence: nearestGeofence?.name,
          nearestDistanceM: nearestDistance,
        },
      });

      return NextResponse.json(
        { error: reason },
        { status: 403 }
      );
    }

    // ── Process the verified clock-in or clock-out ───────────────────────
    if (action === 'CLOCK_IN') {
      const existing = await prisma.workSession.findFirst({
        where: { userId: session.user.id, endTime: null },
      });
      if (existing) {
        return NextResponse.json({ error: 'Already clocked in' }, { status: 400 });
      }

      if (session.user.role.name === 'Labour') {
        const { start, end } = colomboDayBounds();
        const todaySession = await prisma.workSession.findFirst({
          where: { userId: session.user.id, startTime: { gte: start, lt: end } },
        });
        if (todaySession) {
          return NextResponse.json({ error: `Today's attendance is already recorded (${colomboDateKey()}). Only one shift is allowed per day.` }, { status: 409 });
        }
      }

      const workSession = await prisma.workSession.create({
        data: {
          userId: session.user.id,
          userName: session.user.name || 'User',
          startTime: new Date(),
          notes: notes || null,
          clockInLatitude: latitude,
          clockInLongitude: longitude,
          clockInAccuracyMeters: accuracyMeters,
          geofenceId: matchedGeofence.id,
          locationVerified: true,
          deviceInfo: deviceInfo ? JSON.stringify(deviceInfo) : null,
        },
      });

      await logAttempt({
        userId: session.user.id,
        userName: session.user.name || 'User',
        action: 'CLOCK_IN',
        latitude,
        longitude,
        accuracyMeters,
        result: 'SUCCESS',
        nearestGeofenceId: matchedGeofence.id,
        nearestDistanceM: haversineMeters(latitude, longitude, matchedGeofence.centerLatitude, matchedGeofence.centerLongitude),
        workSessionId: workSession.id,
        deviceInfo: deviceInfo || null,
      });

      await createAuditLog({
        userId: session.user.id,
        action: 'ATTENDANCE_CLOCK_IN',
        entityType: 'work_session',
        entityId: workSession.id,
        details: {
          geofence: matchedGeofence.name,
          latitude,
          longitude,
          accuracyMeters,
          locationVerified: true,
        },
      });

      return NextResponse.json(
        { workSession, geofenceName: matchedGeofence.name, locationVerified: true },
        { status: 201 }
      );
    }

    if (action === 'CLOCK_OUT') {
      const active = await prisma.workSession.findFirst({
        where: { userId: session.user.id, endTime: null },
      });
      if (!active) {
        return NextResponse.json({ error: 'No active session found' }, { status: 400 });
      }

      const endTime = new Date();
      const durationMinutes = Math.round(
        (endTime.getTime() - new Date(active.startTime).getTime()) / 60000
      );

      const workSession = await prisma.workSession.update({
        where: { id: active.id },
        data: {
          endTime,
          duration: durationMinutes,
          clockOutLatitude: latitude,
          clockOutLongitude: longitude,
          clockOutAccuracyMeters: accuracyMeters,
          notes: notes
            ? active.notes
              ? `${active.notes} | ${notes}`
              : notes
            : active.notes,
        },
      });

      await logAttempt({
        userId: session.user.id,
        userName: session.user.name || 'User',
        action: 'CLOCK_OUT',
        latitude,
        longitude,
        accuracyMeters,
        result: 'SUCCESS',
        nearestGeofenceId: matchedGeofence.id,
        nearestDistanceM: haversineMeters(latitude, longitude, matchedGeofence.centerLatitude, matchedGeofence.centerLongitude),
        workSessionId: workSession.id,
        deviceInfo: deviceInfo || null,
      });

      await createAuditLog({
        userId: session.user.id,
        action: 'ATTENDANCE_CLOCK_OUT',
        entityType: 'work_session',
        entityId: workSession.id,
        details: {
          durationMinutes,
          geofence: matchedGeofence.name,
          latitude,
          longitude,
          accuracyMeters,
          locationVerified: true,
        },
      });

      return NextResponse.json({ workSession, durationMinutes, locationVerified: true });
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  } catch (error) {
    console.error('Error handling work session:', error);
    return NextResponse.json(
      { error: 'Failed to process attendance. Please try again.' },
      { status: 500 }
    );
  }
}

// ── Internal: write to AttendanceAttemptLog ──────────────────────────────────
async function logAttempt(params: {
  userId: string;
  userName: string;
  action: string;
  latitude: number | null;
  longitude: number | null;
  accuracyMeters: number | null;
  result: string;
  rejectionReason?: string | null;
  nearestGeofenceId?: string | null;
  nearestDistanceM?: number | null;
  workSessionId?: string | null;
  deviceInfo?: string | Record<string, unknown> | null;
}) {
  try {
    await prisma.attendanceAttemptLog.create({
      data: {
        userId: params.userId,
        userName: params.userName,
        action: params.action,
        latitude: params.latitude,
        longitude: params.longitude,
        accuracyMeters: params.accuracyMeters,
        result: params.result,
        rejectionReason: params.rejectionReason || null,
        nearestGeofenceId: params.nearestGeofenceId || null,
        nearestDistanceM: params.nearestDistanceM || null,
        workSessionId: params.workSessionId || null,
        deviceInfo: params.deviceInfo
          ? typeof params.deviceInfo === 'string'
            ? params.deviceInfo
            : JSON.stringify(params.deviceInfo)
          : null,
      },
    });
  } catch (e) {
    // Non-fatal — log failure should not block the main response
    console.error('Failed to write attendance attempt log:', e);
  }
}
