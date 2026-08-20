import { prisma } from '../lib/prisma';
import { colomboDateKey, colomboDayBounds, isMealOpen, mealAvailability } from '../lib/attendance/colombo-time';
import { requiresTwoFactorForRole } from '../lib/auth/two-factor-policy';

function assert(condition: unknown, message: string) {
  if (!condition) throw new Error(message);
}

async function main() {
  assert(colomboDateKey(new Date('2026-08-04T18:40:00.000Z')) === '2026-08-05', 'Colombo day rollover failed');
  const bounds = colomboDayBounds('2026-08-04');
  assert(bounds.start.toISOString() === '2026-08-03T18:30:00.000Z', 'Colombo day start failed');
  assert(bounds.end.toISOString() === '2026-08-04T18:30:00.000Z', 'Colombo day end failed');
  assert(isMealOpen('breakfast', new Date('2026-08-04T04:29:00.000Z')), 'Breakfast should be open before 10 AM');
  assert(!isMealOpen('breakfast', new Date('2026-08-04T04:30:00.000Z')), 'Breakfast should close at 10 AM');
  assert(isMealOpen('lunch', new Date('2026-08-04T09:29:00.000Z')), 'Lunch should be open before 3 PM');
  assert(!isMealOpen('lunch', new Date('2026-08-04T09:30:00.000Z')), 'Lunch should close at 3 PM');
  assert(isMealOpen('dinner', new Date('2026-08-04T15:29:00.000Z')), 'Dinner should be open before 9 PM');
  assert(!isMealOpen('dinner', new Date('2026-08-04T15:30:00.000Z')), 'Dinner should close at 9 PM');
  assert(requiresTwoFactorForRole('Labour') === false, 'Labour should not require 2FA setup');
  assert(requiresTwoFactorForRole('Owner') === true, 'Owner 2FA policy changed unexpectedly');
  const role = await prisma.role.findUnique({ where: { name: 'Labour' } });
  assert(role?.isSystem && role.canBeEdited === false, 'Labour role is not protected');
  const availability = mealAvailability(new Date('2026-08-04T05:00:00.000Z'));
  assert(!availability.breakfast.open && availability.lunch.open && availability.dinner.open, 'Meal availability summary failed');
  console.log(JSON.stringify({ roleId: role!.id, colomboBounds: bounds, cutoffsPassed: true, passed: true }));
}

main().finally(() => prisma.$disconnect());
