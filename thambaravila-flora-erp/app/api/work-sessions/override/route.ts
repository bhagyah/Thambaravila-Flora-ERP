import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth/config';
import { prisma } from '@/lib/prisma';
import { createAuditLog } from '@/lib/auth/audit';

// POST /api/work-sessions/override — IT/Owner manual correction of a WorkSession.
// Required when GPS failure prevented a legitimate check-in on a valid work day.
// The reason field is MANDATORY and logged to AuditLog for accountability.
// Nobody can edit another user's WorkSession without this endpoint.
export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const roleName = session.user.role.name;
  if (roleName !== 'Owner' && roleName !== 'IT/Admin') {
    return NextResponse.json(
      { error: 'Only IT/Admin or Owner can apply manual session overrides.' },
      { status: 403 }
    );
  }

  try {
    const body = await req.json();
    const { workSessionId, reason, startTime, endTime, notes } = body;

    if (!workSessionId || !reason || reason.trim().length < 10) {
      return NextResponse.json(
        { error: 'workSessionId and a reason (min 10 characters) are required.' },
        { status: 400 }
      );
    }

    const original = await prisma.workSession.findUnique({
      where: { id: workSessionId },
    });
    if (!original) {
      return NextResponse.json({ error: 'Work session not found.' }, { status: 404 });
    }

    // Compute updated duration if both times are provided
    let duration = original.duration;
    if (startTime && endTime) {
      const start = new Date(startTime);
      const end = new Date(endTime);
      duration = Math.round((end.getTime() - start.getTime()) / 60000);
    }

    const updated = await prisma.workSession.update({
      where: { id: workSessionId },
      data: {
        ...(startTime ? { startTime: new Date(startTime) } : {}),
        ...(endTime ? { endTime: new Date(endTime) } : {}),
        ...(duration != null ? { duration } : {}),
        ...(notes != null ? { notes } : {}),
      },
    });

    // Record the override with full before/after snapshot
    await prisma.workSessionOverride.create({
      data: {
        workSessionId,
        overriddenById: session.user.id,
        overriddenByName: session.user.name || 'IT/Admin',
        reason: reason.trim(),
        originalData: JSON.stringify(original),
        newData: JSON.stringify(updated),
      },
    });

    await createAuditLog({
      userId: session.user.id,
      action: 'WORK_SESSION_MANUAL_OVERRIDE',
      entityType: 'work_session',
      entityId: workSessionId,
      details: {
        reason: reason.trim(),
        targetUserId: original.userId,
        targetUserName: original.userName,
        changes: { startTime, endTime, notes },
      },
    });

    return NextResponse.json({
      workSession: updated,
      message: 'Session corrected and override logged.',
    });
  } catch (error) {
    console.error('Error applying session override:', error);
    return NextResponse.json(
      { error: 'Failed to apply override.' },
      { status: 500 }
    );
  }
}
