const COLOMBO_OFFSET_MINUTES = 330;
const MINUTE_MS = 60_000;
const DAY_MS = 24 * 60 * MINUTE_MS;

export type MealKey = 'breakfast' | 'lunch' | 'dinner';

export const MEAL_CUTOFFS: Record<MealKey, { label: string; hour: number; minute: number }> = {
  breakfast: { label: '10:00 AM', hour: 10, minute: 0 },
  lunch: { label: '3:00 PM', hour: 15, minute: 0 },
  dinner: { label: '9:00 PM', hour: 21, minute: 0 },
};

function shiftedColombo(date: Date) {
  return new Date(date.getTime() + COLOMBO_OFFSET_MINUTES * MINUTE_MS);
}

export function colomboDateKey(date = new Date()) {
  return shiftedColombo(date).toISOString().slice(0, 10);
}

export function colomboTimeLabel(date = new Date()) {
  return new Intl.DateTimeFormat('en-LK', {
    timeZone: 'Asia/Colombo',
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(date);
}

export function colomboDayBounds(dateKey = colomboDateKey()) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateKey)) throw new Error('Invalid date');
  const [year, month, day] = dateKey.split('-').map(Number);
  const start = new Date(Date.UTC(year, month - 1, day) - COLOMBO_OFFSET_MINUTES * MINUTE_MS);
  return { start, end: new Date(start.getTime() + DAY_MS) };
}

export function colomboMonthBounds(dateKey = colomboDateKey()) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateKey)) throw new Error('Invalid date');
  const [year, month] = dateKey.split('-').map(Number);
  const start = new Date(Date.UTC(year, month - 1, 1) - COLOMBO_OFFSET_MINUTES * MINUTE_MS);
  const end = new Date(Date.UTC(year, month, 1) - COLOMBO_OFFSET_MINUTES * MINUTE_MS);
  return { start, end };
}

export function isMealOpen(meal: MealKey, now = new Date(), serviceDate = colomboDateKey(now)) {
  if (serviceDate !== colomboDateKey(now)) return false;
  const shifted = shiftedColombo(now);
  const minutes = shifted.getUTCHours() * 60 + shifted.getUTCMinutes();
  const cutoff = MEAL_CUTOFFS[meal];
  return minutes < cutoff.hour * 60 + cutoff.minute;
}

export function mealAvailability(now = new Date(), serviceDate = colomboDateKey(now)) {
  return {
    breakfast: { open: isMealOpen('breakfast', now, serviceDate), cutoff: MEAL_CUTOFFS.breakfast.label },
    lunch: { open: isMealOpen('lunch', now, serviceDate), cutoff: MEAL_CUTOFFS.lunch.label },
    dinner: { open: isMealOpen('dinner', now, serviceDate), cutoff: MEAL_CUTOFFS.dinner.label },
  };
}
