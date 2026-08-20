import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth/config';
import { prisma } from '@/lib/prisma';
import { createAuditLog } from '@/lib/auth/audit';
import { colomboDateKey, isMealOpen, mealAvailability, MealKey } from '@/lib/attendance/colombo-time';

const mealKeys: MealKey[] = ['breakfast', 'lunch', 'dinner'];

export async function PATCH(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (session.user.role.name !== 'Labour') return NextResponse.json({ error: 'Labour account required' }, { status: 403 });

  try {
    const body = await request.json();
    const today = colomboDateKey();
    const current = await prisma.dailyMealRequest.findUnique({ where: { userId_serviceDate: { userId: session.user.id, serviceDate: today } } });
    const changed = mealKeys.filter((meal) => typeof body[meal] === 'boolean' && body[meal] !== Boolean(current?.[meal]));
    if (!changed.length) return NextResponse.json({ mealRequest: current || { breakfast: false, lunch: false, dinner: false }, mealAvailability: mealAvailability() });

    const closed = changed.find((meal) => !isMealOpen(meal));
    if (closed) return NextResponse.json({ error: `${closed[0].toUpperCase()}${closed.slice(1)} request deadline has passed.` }, { status: 409 });

    const now = new Date();
    const data: Record<string, boolean | Date | null> = {};
    for (const meal of changed) {
      const selected = Boolean(body[meal]);
      data[meal] = selected;
      data[`${meal}RequestedAt`] = selected ? now : null;
    }
    const mealRequest = await prisma.dailyMealRequest.upsert({
      where: { userId_serviceDate: { userId: session.user.id, serviceDate: today } },
      create: { userId: session.user.id, userName: session.user.name, serviceDate: today, ...data },
      update: data,
    });
    await createAuditLog({ userId: session.user.id, action: 'DAILY_MEAL_REQUEST_UPDATED', entityType: 'daily_meal_request', entityId: mealRequest.id, details: { serviceDate: today, changed, breakfast: mealRequest.breakfast, lunch: mealRequest.lunch, dinner: mealRequest.dinner } });
    return NextResponse.json({ mealRequest, mealAvailability: mealAvailability() });
  } catch (error) {
    console.error('Meal request update failed:', error);
    return NextResponse.json({ error: 'Meal request could not be saved.' }, { status: 500 });
  }
}
