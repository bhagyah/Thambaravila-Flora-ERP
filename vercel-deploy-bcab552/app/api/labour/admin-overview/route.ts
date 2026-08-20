import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth/config';
import { prisma } from '@/lib/prisma';
import { colomboDateKey, colomboDayBounds } from '@/lib/attendance/colombo-time';

const allowedRoles = new Set(['Owner', 'Accountant', 'IT/Admin']);

export async function GET(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!allowedRoles.has(session.user.role.name)) return NextResponse.json({ error: 'Access denied' }, { status: 403 });

  const requestedDate = new URL(request.url).searchParams.get('date') || colomboDateKey();
  let bounds;
  try { bounds = colomboDayBounds(requestedDate); } catch { return NextResponse.json({ error: 'Invalid date' }, { status: 400 }); }

  const labourers = await prisma.user.findMany({ where: { isActive: true, role: { name: 'Labour' } }, select: { id: true, name: true, email: true }, orderBy: { name: 'asc' } });
  const labourIds = labourers.map((item) => item.id);
  const [labourSessions, meals] = await Promise.all([
    prisma.workSession.findMany({ where: { userId: { in: labourIds }, startTime: { gte: bounds.start, lt: bounds.end } }, orderBy: { startTime: 'asc' } }),
    prisma.dailyMealRequest.findMany({ where: { userId: { in: labourIds }, serviceDate: requestedDate }, orderBy: { userName: 'asc' } }),
  ]);
  const mealByUser = new Map(meals.map((item) => [item.userId, item]));
  const sessionByUser = new Map(labourSessions.map((item) => [item.userId, item]));
  const members = labourers.map((user) => {
    const workSession = sessionByUser.get(user.id) || null;
    const meal = mealByUser.get(user.id);
    const liveMinutes = workSession ? (workSession.duration ?? Math.max(0, Math.floor((Date.now() - workSession.startTime.getTime()) / 60000))) : 0;
    return {
      ...user,
      attendance: workSession ? { id: workSession.id, startTime: workSession.startTime, endTime: workSession.endTime, duration: workSession.duration, liveMinutes, locationVerified: workSession.locationVerified } : null,
      meals: { breakfast: Boolean(meal?.breakfast), lunch: Boolean(meal?.lunch), dinner: Boolean(meal?.dinner) },
    };
  });
  return NextResponse.json({
    date: requestedDate,
    generatedAt: new Date().toISOString(),
    stats: {
      totalLabourers: labourers.length,
      present: members.filter((item) => item.attendance).length,
      clockedIn: members.filter((item) => item.attendance && !item.attendance.endTime).length,
      clockedOut: members.filter((item) => item.attendance?.endTime).length,
      totalMinutes: members.reduce((sum, item) => sum + (item.attendance?.liveMinutes || 0), 0),
      breakfast: members.filter((item) => item.meals.breakfast).length,
      lunch: members.filter((item) => item.meals.lunch).length,
      dinner: members.filter((item) => item.meals.dinner).length,
    },
    mealApplicants: {
      breakfast: members.filter((item) => item.meals.breakfast).map((item) => item.name),
      lunch: members.filter((item) => item.meals.lunch).map((item) => item.name),
      dinner: members.filter((item) => item.meals.dinner).map((item) => item.name),
    },
    members,
  });
}
