import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth/config';
import { prisma } from '@/lib/prisma';
import { createAuditLog } from '@/lib/auth/audit';

function isPrivileged(roleName: string) {
  return roleName === 'Owner' || roleName === 'IT/Admin';
}

// GET /api/geofences — List all geofences (all authenticated roles)
// Active zones are needed by every client to display zone names after check-in.
export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const geofences = await prisma.geofence.findMany({
      orderBy: [{ isMain: 'desc' }, { isActive: 'desc' }, { createdAt: 'desc' }],
      select: {
        id: true,
        name: true,
        centerLatitude: true,
        centerLongitude: true,
        radiusMeters: true,
        isActive: true,
        isMain: true,
        zoneType: true,
        allowedRoles: true,
        createdById: true,
        createdAt: true,
        updatedAt: true,
        _count: { select: { workSessions: true } },
      },
    });

    return NextResponse.json({ geofences });
  } catch (error) {
    console.error('Error fetching geofences:', error);
    return NextResponse.json({ error: 'Failed to fetch geofences' }, { status: 500 });
  }
}

// POST /api/geofences — Create a new geofence (IT/Owner only)
export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  if (!isPrivileged(session.user.role.name)) {
    return NextResponse.json(
      { error: 'Only IT/Admin or Owner can create geofences.' },
      { status: 403 }
    );
  }

  try {
    const body = await req.json();
    const { name, centerLatitude, centerLongitude, radiusMeters, isMain, zoneType, allowedRoles } = body;

    if (!name || centerLatitude == null || centerLongitude == null || !radiusMeters) {
      return NextResponse.json(
        { error: 'name, centerLatitude, centerLongitude, and radiusMeters are required.' },
        { status: 400 }
      );
    }
    if (radiusMeters < 10 || radiusMeters > 50000) {
      return NextResponse.json(
        { error: 'radiusMeters must be between 10 and 50,000 metres.' },
        { status: 400 }
      );
    }

    const type = zoneType === 'WFH' ? 'WFH' : (isMain || zoneType === 'MAIN' ? 'MAIN' : 'ON_SITE');
    const mainFlag = type === 'MAIN' || Boolean(isMain);

    // If marked as Main, unmark other main zones
    if (mainFlag) {
      await prisma.geofence.updateMany({
        where: { isMain: true },
        data: { isMain: false },
      });
    }

    const rolesString = Array.isArray(allowedRoles)
      ? allowedRoles.join(',')
      : (typeof allowedRoles === 'string' ? allowedRoles : null);

    const geofence = await prisma.geofence.create({
      data: {
        name: name.trim(),
        centerLatitude: Number(centerLatitude),
        centerLongitude: Number(centerLongitude),
        radiusMeters: Math.round(Number(radiusMeters)),
        isActive: true,
        isMain: mainFlag,
        zoneType: type,
        allowedRoles: type === 'MAIN' ? null : rolesString,
        createdById: session.user.id,
      },
    });

    await createAuditLog({
      userId: session.user.id,
      action: 'GEOFENCE_CREATED',
      entityType: 'geofence',
      entityId: geofence.id,
      details: {
        name: geofence.name,
        centerLatitude: geofence.centerLatitude,
        centerLongitude: geofence.centerLongitude,
        radiusMeters: geofence.radiusMeters,
        isMain: geofence.isMain,
        zoneType: geofence.zoneType,
        allowedRoles: geofence.allowedRoles,
      },
    });

    return NextResponse.json({ geofence }, { status: 201 });
  } catch (error) {
    console.error('Error creating geofence:', error);
    return NextResponse.json({ error: 'Failed to create geofence.' }, { status: 500 });
  }
}
