import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth/config';
import { prisma } from '@/lib/prisma';
import { createAuditLog } from '@/lib/auth/audit';

const DEFAULT_SCHEDULE = {
  id: 'default',
  workingDays: '1,2,3,4,5,6', // Mon–Sat
  workStartTime: '09:00',
  workEndTime: '17:00',
  graceMinutes: 15,
};

// GET /api/work-schedule — any authenticated user can read the schedule
export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    let config = await prisma.workScheduleConfig.findUnique({
      where: { id: 'default' },
    });

    // Auto-seed defaults on first access
    if (!config) {
      config = await prisma.workScheduleConfig.create({
        data: DEFAULT_SCHEDULE,
      });
    }

    // Compute derived values
    const days = config.workingDays.split(',').map(Number);
    const [startH, startM] = config.workStartTime.split(':').map(Number);
    const [endH, endM] = config.workEndTime.split(':').map(Number);
    const hoursPerDay = (endH * 60 + endM - startH * 60 - startM) / 60;

    return NextResponse.json({
      schedule: {
        ...config,
        workingDaysArray: days,
        hoursPerDay: Math.round(hoursPerDay * 10) / 10,
        daysPerWeek: days.length,
      },
    });
  } catch (error) {
    console.error('Error fetching work schedule:', error);
    return NextResponse.json({ error: 'Failed to fetch schedule.' }, { status: 500 });
  }
}

// PUT /api/work-schedule — Owner or IT/Admin only
export async function PUT(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const role = session.user.role.name;
  if (role !== 'Owner' && role !== 'IT/Admin') {
    return NextResponse.json(
      { error: 'Only Owner or IT/Admin can change the work schedule.' },
      { status: 403 }
    );
  }

  try {
    const body = await req.json();
    const { workingDays, workStartTime, workEndTime, graceMinutes } = body;

    // Validate working days array
    if (!Array.isArray(workingDays) || workingDays.length === 0) {
      return NextResponse.json(
        { error: 'At least one working day must be selected.' },
        { status: 400 }
      );
    }
    const validDays = workingDays.filter((d: number) => d >= 1 && d <= 7);

    // Validate times
    const timeRx = /^([01]\d|2[0-3]):[0-5]\d$/;
    if (!timeRx.test(workStartTime) || !timeRx.test(workEndTime)) {
      return NextResponse.json(
        { error: 'Invalid time format. Use HH:MM (24-hour).' },
        { status: 400 }
      );
    }

    const config = await prisma.workScheduleConfig.upsert({
      where: { id: 'default' },
      update: {
        workingDays: validDays.sort().join(','),
        workStartTime,
        workEndTime,
        graceMinutes: Number(graceMinutes) || 15,
        updatedById: session.user.id,
      },
      create: {
        id: 'default',
        workingDays: validDays.sort().join(','),
        workStartTime,
        workEndTime,
        graceMinutes: Number(graceMinutes) || 15,
        updatedById: session.user.id,
      },
    });

    await createAuditLog({
      userId: session.user.id,
      action: 'WORK_SCHEDULE_UPDATED',
      entityType: 'work_schedule',
      entityId: 'default',
      details: { workingDays: validDays, workStartTime, workEndTime, graceMinutes },
    });

    return NextResponse.json({ schedule: config, message: 'Work schedule updated.' });
  } catch (error) {
    console.error('Error updating work schedule:', error);
    return NextResponse.json({ error: 'Failed to update schedule.' }, { status: 500 });
  }
}
