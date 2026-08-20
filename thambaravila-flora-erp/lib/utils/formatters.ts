/**
 * Universal Currency Formatter for Sri Lankan Rupee (LKR)
 * Formats any cent or rupee numeric value into clean LKR representation.
 * - Thousands separated by commas (,)
 * - Decimal cents separated by dot (.)
 * 
 * @param val Number or numeric string (in cents or rupees)
 * @param isCents Optional boolean specifying if input is in cents (defaults to true for all DB fields)
 */
export function formatLKR(val: number | string | null | undefined, isCents: boolean = true): string {
  if (val === null || val === undefined || val === '') return 'LKR 0';

  const match = typeof val === 'string' ? val.match(/-?\d[\d,]*(?:\.\d+)?/) : null;
  const num = typeof val === 'string' ? (match ? Number(match[0].replace(/,/g, '')) : NaN) : val;
  if (isNaN(num) || num === 0) return 'LKR 0';

  // Convert cents to rupees if isCents is true (or if value is clearly in cents >= 1,000,000)
  const rupees = isCents ? num / 100 : num;

  const formatted = rupees.toLocaleString('en-US', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  });

  return `LKR ${formatted}`;
}
