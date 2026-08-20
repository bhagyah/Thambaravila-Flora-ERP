import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth/config';
import { prisma } from '@/lib/prisma';

function startOfDay(d: Date) {
  const r = new Date(d); r.setHours(0, 0, 0, 0); return r;
}
function endOfDay(d: Date) {
  const r = new Date(d); r.setHours(23, 59, 59, 999); return r;
}

/**
 * Count how many working days (per schedule) fall within [from, to].
 * workingDayNums: array of ISO weekday numbers 1=Mon…7=Sun
 */
function countWorkingDaysInRange(from: Date, to: Date, workingDayNums: number[]): number {
  let count = 0;
  const cursor = new Date(from);
  cursor.setHours(0, 0, 0, 0);
  while (cursor <= to) {
    // JS getDay(): 0=Sun,1=Mon…6=Sat → convert to ISO 1=Mon…7=Sun
    const isoDay = cursor.getDay() === 0 ? 7 : cursor.getDay();
    if (workingDayNums.includes(isoDay)) count++;
    cursor.setDate(cursor.getDate() + 1);
  }
  return count;
}

// GET /api/attendance?range=today|week|month|year|custom&from=ISO&to=ISO
export async function GET(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const role = session.user.role.name;
  const canViewTeamAttendance = role === 'Owner' || role === 'Accountant' || role === 'IT/Admin';

  const { searchParams } = new URL(req.url);
  const range = searchParams.get('range') || 'today';
  const fromParam = searchParams.get('from');
  const toParam = searchParams.get('to');

  const now = new Date();
  let fromDate: Date;
  let toDate: Date;

  switch (range) {
    case 'today':
      fromDate = startOfDay(now);
      toDate = endOfDay(now);
      break;
    case 'week': {
      const d = new Date(now);
      const day = d.getDay();
      const diff = d.getDate() - day + (day === 0 ? -6 : 1);
      fromDate = startOfDay(new Date(d.setDate(diff)));
      toDate = endOfDay(new Date());
      break;
    }
    case 'month':
      fromDate = startOfDay(new Date(now.getFullYear(), now.getMonth(), 1));
      toDate = endOfDay(new Date(now.getFullYear(), now.getMonth() + 1, 0));
      break;
    case 'year':
      fromDate = startOfDay(new Date(now.getFullYear(), 0, 1));
      toDate = endOfDay(new Date(now.getFullYear(), 11, 31));
      break;
    case 'custom':
      if (!fromParam || !toParam) {
        return NextResponse.json({ error: 'from and to required for custom range.' }, { status: 400 });
      }
      fromDate = startOfDay(new Date(fromParam));
      toDate = endOfDay(new Date(toParam));
      break;
    default:
      fromDate = startOfDay(now);
      toDate = endOfDay(now);
  }

  try {
    // ── Load work schedule ───────────────────────────────────────────────────
    let scheduleConfig = await prisma.workScheduleConfig.findUnique({
      where: { id: 'default' },
    });
    if (!scheduleConfig) {
      scheduleConfig = await prisma.workScheduleConfig.create({
        data: {
          id: 'default',
          workingDays: '1,2,3,4,5,6',
          workStartTime: '09:00',
          workEndTime: '17:00',
          graceMinutes: 15,
        },
      });
    }

    const workingDayNums = scheduleConfig.workingDays.split(',').map(Number);
    const [startH, startM] = scheduleConfig.workStartTime.split(':').map(Number);
    const [endH, endM] = scheduleConfig.workEndTime.split(':').map(Number);
    const hoursPerDay = (endH * 60 + endM - startH * 60 - startM) / 60;

    // ── Expected working days in the date range ──────────────────────────────
    const expectedWorkingDays = countWorkingDaysInRange(fromDate, toDate, workingDayNums);
    const expectedHoursPerStaff = expectedWorkingDays * hoursPerDay;

    // ── Fetch sessions ───────────────────────────────────────────────────────
    const sessions = await prisma.workSession.findMany({
      where: {
        startTime: { gte: fromDate, lte: toDate },
        ...(canViewTeamAttendance ? {} : { userId: session.user.id }),
      },
      include: { geofence: { select: { name: true, zoneType: true, isMain: true } } },
      orderBy: { startTime: 'desc' },
    });

    // ── Fetch all active users ───────────────────────────────────────────────
    const allUsers = await prisma.user.findMany({
      where: {
        isActive: true,
        ...(canViewTeamAttendance ? {} : { id: session.user.id }),
      },
      select: {
        id: true,
        name: true,
        email: true,
        role: { select: { name: true } },
      },
    });

    // ── Group sessions by date (YYYY-MM-DD) per user ─────────────────────────
    type DayEntry = { date: string; sessions: typeof sessions };
    const byUser: Record<string, {
      userId: string;
      userName: string;
      roleName: string;
      email: string;
      sessions: typeof sessions;
      totalMinutes: number;
      wfhMinutes: number;
      wfhSessionsCount: number;
      onSiteMinutes: number;
      daysPresent: Set<string>;
      verifiedCount: number;
      dailyMinutes: Record<string, number>;
      lateCount: number;
    }> = {};

    for (const s of sessions) {
      const isSessionWfh = Boolean(s.isWfh || s.workMode === 'WFH' || s.geofence?.zoneType === 'WFH');

      if (!byUser[s.userId]) {
        const user = allUsers.find((u) => u.id === s.userId);
        byUser[s.userId] = {
          userId: s.userId,
          userName: s.userName,
          roleName: user?.role.name || 'Staff',
          email: user?.email || '',
          sessions: [],
          totalMinutes: 0,
          wfhMinutes: 0,
          wfhSessionsCount: 0,
          onSiteMinutes: 0,
          daysPresent: new Set(),
          verifiedCount: 0,
          dailyMinutes: {},
          lateCount: 0,
        };
      }

      const rec = byUser[s.userId];
      rec.sessions.push(s);
      const dur = s.duration || 0;
      rec.totalMinutes += dur;

      if (isSessionWfh) {
        rec.wfhMinutes += dur;
        rec.wfhSessionsCount++;
      } else {
        rec.onSiteMinutes += dur;
      }

      const dateKey = new Date(s.startTime).toISOString().slice(0, 10);
      rec.daysPresent.add(dateKey);
      rec.dailyMinutes[dateKey] = (rec.dailyMinutes[dateKey] || 0) + dur;

      if (s.locationVerified) rec.verifiedCount++;

      // Late check: was clock-in after (workStart + graceMinutes)?
      const clockIn = new Date(s.startTime);
      const graceMs = scheduleConfig.graceMinutes * 60 * 1000;
      const scheduledStart = new Date(clockIn);
      scheduledStart.setHours(startH, startM, 0, 0);
      if (clockIn.getTime() > scheduledStart.getTime() + graceMs) {
        rec.lateCount++;
      }
    }

    // ── Build per-staff summary ──────────────────────────────────────────────
    const staffSummary = allUsers.map((user) => {
      const rec = byUser[user.id];

      const actualMinutes = rec?.totalMinutes || 0;
      const actualHours = Math.round((actualMinutes / 60) * 10) / 10;
      const wfhMinutes = rec?.wfhMinutes || 0;
      const wfhHours = Math.round((wfhMinutes / 60) * 10) / 10;
      const onSiteMinutes = rec?.onSiteMinutes || 0;
      const onSiteHours = Math.round((onSiteMinutes / 60) * 10) / 10;

      const daysPresent = rec ? rec.daysPresent.size : 0;
      const daysAbsent = Math.max(0, expectedWorkingDays - daysPresent);
      const compliancePct =
        expectedHoursPerStaff > 0
          ? Math.min(100, Math.round((actualMinutes / (expectedHoursPerStaff * 60)) * 100))
          : 0;
      const overtimeMinutes = Math.max(0, actualMinutes - Math.round(expectedHoursPerStaff * 60));
      const undertimeMinutes = Math.max(0, Math.round(expectedHoursPerStaff * 60) - actualMinutes);

      // Build daily breakdown array
      const dailyBreakdown = rec
        ? Object.entries(rec.dailyMinutes)
            .sort(([a], [b]) => a.localeCompare(b))
            .map(([date, mins]) => ({
              date,
              minutes: mins,
              hours: Math.round((mins / 60) * 10) / 10,
              expectedHours: hoursPerDay,
              compliancePct: Math.min(100, Math.round((mins / (hoursPerDay * 60)) * 100)),
            }))
        : [];

      return {
        userId: user.id,
        userName: user.name,
        email: user.email,
        roleName: user.role.name,
        // Totals
        sessionsCount: rec?.sessions.length || 0,
        totalMinutes: actualMinutes,
        totalHours: actualHours,
        wfhMinutes,
        wfhHours,
        wfhSessionsCount: rec?.wfhSessionsCount || 0,
        onSiteMinutes,
        onSiteHours,
        // Days
        daysPresent,
        daysAbsent,
        expectedWorkingDays,
        // Compliance
        compliancePct,
        overtimeMinutes,
        undertimeMinutes,
        lateCount: rec?.lateCount || 0,
        verifiedCount: rec?.verifiedCount || 0,
        // Breakdowns
        dailyBreakdown,
        sessions: (rec?.sessions || []).map((s) => {
          const isSessionWfh = Boolean(s.isWfh || s.workMode === 'WFH' || s.geofence?.zoneType === 'WFH');
          return {
            id: s.id,
            startTime: s.startTime,
            endTime: s.endTime,
            duration: s.duration,
            locationVerified: s.locationVerified,
            isWfh: isSessionWfh,
            workMode: isSessionWfh ? 'WFH' : 'ON_SITE',
            geofenceName: s.geofence?.name || null,
            zoneType: s.geofence?.zoneType || (isSessionWfh ? 'WFH' : 'MAIN'),
            clockInAccuracyMeters: s.clockInAccuracyMeters,
          };
        }),
      };
    });

    // ── Overall stats ────────────────────────────────────────────────────────
    const totalSessions = sessions.length;
    const totalVerified = sessions.filter((s) => s.locationVerified).length;
    const totalMinutesAll = sessions.reduce((sum, s) => sum + (s.duration || 0), 0);
    const totalWfhMinutes = sessions
      .filter((s) => s.isWfh || s.workMode === 'WFH' || s.geofence?.zoneType === 'WFH')
      .reduce((sum, s) => sum + (s.duration || 0), 0);
    const totalWfhSessions = sessions.filter((s) => s.isWfh || s.workMode === 'WFH' || s.geofence?.zoneType === 'WFH').length;
    const totalOnSiteMinutes = Math.max(0, totalMinutesAll - totalWfhMinutes);

    const staffPresent = Object.keys(byUser).length;

    return NextResponse.json({
      range,
      fromDate: fromDate.toISOString(),
      toDate: toDate.toISOString(),
      schedule: {
        workingDays: workingDayNums,
        workStartTime: scheduleConfig.workStartTime,
        workEndTime: scheduleConfig.workEndTime,
        graceMinutes: scheduleConfig.graceMinutes,
        hoursPerDay,
        expectedWorkingDays,
      },
      stats: {
        totalSessions,
        totalVerified,
        totalMinutesAll,
        totalHoursAll: Math.round((totalMinutesAll / 60) * 10) / 10,
        totalWfhMinutes,
        totalWfhHours: Math.round((totalWfhMinutes / 60) * 10) / 10,
        totalWfhSessions,
        totalOnSiteMinutes,
        totalOnSiteHours: Math.round((totalOnSiteMinutes / 60) * 10) / 10,
        totalOnSiteSessions: totalSessions - totalWfhSessions,
        staffPresent,
        staffAbsent: allUsers.length - staffPresent,
        totalStaff: allUsers.length,
        expectedWorkingDays,
        attendanceRate:
          allUsers.length > 0
            ? Math.round((staffPresent / allUsers.length) * 100)
            : 0,
      },
      staffSummary,
    });
  } catch (error) {
    console.error('Error fetching attendance:', error);
    return NextResponse.json({ error: 'Failed to fetch attendance data.' }, { status: 500 });
  }
}
