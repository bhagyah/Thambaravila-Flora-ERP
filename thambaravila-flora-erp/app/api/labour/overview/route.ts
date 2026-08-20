import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth/config';
import { prisma } from '@/lib/prisma';
import { colomboDateKey, colomboDayBounds, colomboMonthBounds, colomboTimeLabel, mealAvailability } from '@/lib/attendance/colombo-time';

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (session.user.role.name !== 'Labour') return NextResponse.json({ error: 'Labour account required' }, { status: 403 });

  const today = colomboDateKey();
  const day = colomboDayBounds(today);
  const month = colomboMonthBounds(today);
  const [todaySession, activeSession, monthSessions, mealRequest] = await Promise.all([
    prisma.workSession.findFirst({ where: { userId: session.user.id, startTime: { gte: day.start, lt: day.end } }, orderBy: { startTime: 'desc' } }),
    prisma.workSession.findFirst({ where: { userId: session.user.id, endTime: null }, include: { geofence: { select: { name: true } } } }),
    prisma.workSession.findMany({ where: { userId: session.user.id, startTime: { gte: month.start, lt: month.end } }, orderBy: { startTime: 'desc' } }),
    prisma.dailyMealRequest.findUnique({ where: { userId_serviceDate: { userId: session.user.id, serviceDate: today } } }),
  ]);

  const totalMinutes = monthSessions.reduce((sum, item) => sum + (item.duration || 0), 0);
  const presentDays = new Set(monthSessions.map((item) => colomboDateKey(item.startTime))).size;
  return NextResponse.json({
    today,
    serverTime: new Date().toISOString(),
    serverTimeLabel: colomboTimeLabel(),
    activeSession,
    todaySession,
    mealRequest: mealRequest || { breakfast: false, lunch: false, dinner: false },
    mealAvailability: mealAvailability(),
    month: {
      presentDays,
      totalMinutes,
      totalHours: Math.round((totalMinutes / 60) * 100) / 100,
      sessions: monthSessions.map((item) => ({ id: item.id, startTime: item.startTime, endTime: item.endTime, duration: item.duration, locationVerified: item.locationVerified })),
    },
  });
}
