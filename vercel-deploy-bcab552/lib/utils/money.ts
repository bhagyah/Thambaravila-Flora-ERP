function readNumericAmount(value: unknown): number {
  if (typeof value === 'number') {
    return value;
  }

  if (typeof value !== 'string') {
    return NaN;
  }

  const match = value.replace(/\s+/g, ' ').match(/-?\d[\d,]*(?:\.\d+)?/);
  if (!match) {
    return NaN;
  }

  return Number(match[0].replace(/,/g, ''));
}

export function parseLkrToCents(value: unknown): number | null {
  const amount = readNumericAmount(value);

  if (!Number.isFinite(amount) || amount <= 0 || amount > Number.MAX_SAFE_INTEGER / 100) {
    return null;
  }

  return Math.round(amount * 100);
}
