import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth/config';
import { prisma } from '@/lib/prisma';
import { createAuditLog } from '@/lib/auth/audit';

function isPrivileged(roleName: string) {
  return roleName === 'Owner' || roleName === 'IT/Admin';
}

// PATCH /api/geofences/[id] — Edit name, radius, or active toggle (IT/Owner only)
export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  // Next.js 15: params must be awaited before accessing properties
  const { id } = await params;

  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  if (!isPrivileged(session.user.role.name)) {
    return NextResponse.json(
      { error: 'Only IT/Admin or Owner can edit geofences.' },
      { status: 403 }
    );
  }

  try {
    const body = await req.json();
    const { name, centerLatitude, centerLongitude, radiusMeters, isActive, isMain, zoneType, allowedRoles } = body;

    const existing = await prisma.geofence.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: 'Geofence not found.' }, { status: 404 });
    }

    let nextIsMain: boolean | undefined = undefined;
    let nextZoneType: string | undefined = undefined;
    let nextAllowedRoles: string | null | undefined = undefined;

    if (isMain != null || zoneType != null) {
      const type = zoneType != null ? zoneType : (isMain ? 'MAIN' : existing.zoneType);
      const isMainFlag = isMain != null ? Boolean(isMain) : type === 'MAIN';
      nextIsMain = isMainFlag;
      nextZoneType = type;

      if (isMainFlag) {
        // Unmark other main zones
        await prisma.geofence.updateMany({
          where: { isMain: true, id: { not: id } },
          data: { isMain: false },
        });
        nextAllowedRoles = null;
      }
    }

    if (allowedRoles !== undefined && !nextIsMain) {
      nextAllowedRoles = Array.isArray(allowedRoles)
        ? allowedRoles.join(',')
        : (typeof allowedRoles === 'string' ? allowedRoles : null);
    }

    const updated = await prisma.geofence.update({
      where: { id },
      data: {
        ...(name != null ? { name: name.trim() } : {}),
        ...(centerLatitude != null ? { centerLatitude: Number(centerLatitude) } : {}),
        ...(centerLongitude != null ? { centerLongitude: Number(centerLongitude) } : {}),
        ...(radiusMeters != null ? { radiusMeters: Math.round(Number(radiusMeters)) } : {}),
        ...(isActive != null ? { isActive: Boolean(isActive) } : {}),
        ...(nextIsMain !== undefined ? { isMain: nextIsMain } : {}),
        ...(nextZoneType !== undefined ? { zoneType: nextZoneType } : {}),
        ...(nextAllowedRoles !== undefined ? { allowedRoles: nextAllowedRoles } : {}),
      },
    });

    await createAuditLog({
      userId: session.user.id,
      action: isActive != null
        ? `GEOFENCE_${isActive ? 'ACTIVATED' : 'DEACTIVATED'}`
        : 'GEOFENCE_UPDATED',
      entityType: 'geofence',
      entityId: id,
      details: { changes: body, geofenceName: updated.name },
    });

    return NextResponse.json({ geofence: updated });
  } catch (error) {
    console.error('Error updating geofence:', error);
    return NextResponse.json({ error: 'Failed to update geofence.' }, { status: 500 });
  }
}

// DELETE /api/geofences/[id] — Soft-delete (deactivate) a geofence (IT/Owner only)
// We do not hard-delete because existing WorkSession records reference this geofence.
export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  // Next.js 15: params must be awaited before accessing properties
  const { id } = await params;

  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  if (!isPrivileged(session.user.role.name)) {
    return NextResponse.json(
      { error: 'Only IT/Admin or Owner can deactivate geofences.' },
      { status: 403 }
    );
  }

  try {
    const geofence = await prisma.geofence.update({
      where: { id },
      data: { isActive: false },
    });

    await createAuditLog({
      userId: session.user.id,
      action: 'GEOFENCE_DEACTIVATED',
      entityType: 'geofence',
      entityId: id,
      details: { geofenceName: geofence.name },
    });

    return NextResponse.json({ message: `Geofence "${geofence.name}" deactivated.` });
  } catch (error) {
    console.error('Error deactivating geofence:', error);
    return NextResponse.json({ error: 'Failed to deactivate geofence.' }, { status: 500 });
  }
}
