const COLOMBO_OFFSET_MS = (5 * 60 + 30) * 60 * 1000;

export function colomboDateKey(date = new Date()) {
  return new Date(date.getTime() + COLOMBO_OFFSET_MS).toISOString().slice(0, 10);
}

export function colomboMonthStartKey(date = new Date()) {
  return `${colomboDateKey(date).slice(0, 7)}-01`;
}

export function parseColomboDate(value: string, endOfDay = false) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) throw new Error('Invalid date format.');
  const [year, month, day] = value.split('-').map(Number);
  const utcMidnight = Date.UTC(year, month - 1, day);
  const check = new Date(utcMidnight).toISOString().slice(0, 10);
  if (check !== value) throw new Error('Invalid date.');
  const start = utcMidnight - COLOMBO_OFFSET_MS;
  return new Date(endOfDay ? start + 24 * 60 * 60 * 1000 - 1 : start);
}

export function resolveColomboDateRange(fromValue?: string | null, toValue?: string | null) {
  const today = colomboDateKey();
  const from = fromValue || today;
  const to = toValue || from;
  const start = parseColomboDate(from);
  const end = parseColomboDate(to, true);
  if (start > end) throw new Error('Start date must be before end date.');
  return { from, to, start, end };
}
