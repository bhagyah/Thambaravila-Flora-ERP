/**
 * Utility for parsing and auto-extracting Birthday & Gender from Sri Lankan NIC numbers.
 * Supports both Sri Lankan NIC Formats:
 * 1. Old Format: 9 digits + 1 letter ('V' or 'X') -> e.g. 952451234V (10 chars)
 * 2. New Format: 12 digits -> e.g. 199524501234 (12 chars)
 */

export interface ParsedNIC {
  isValid: boolean;
  year?: number;
  month?: number; // 1-12
  day?: number;   // 1-31
  dateOfBirth?: string; // Format: YYYY-MM-DD
  formattedDob?: string; // Format: DD/MM/YYYY
  gender?: 'Male' | 'Female';
  format?: 'Old (10-char)' | 'New (12-digit)';
  error?: string;
}

export function parseSriLankanNIC(nic: string): ParsedNIC {
  if (!nic) {
    return { isValid: false, error: 'NIC number is empty' };
  }

  const clean = nic.trim().toUpperCase();
  let year: number;
  let dayOfYear: number;
  let format: 'Old (10-char)' | 'New (12-digit)';

  // Regex patterns
  const oldNicRegex = /^([0-9]{2})([0-9]{3})[0-9]{4}[VX]$/;
  const newNicRegex = /^([0-9]{4})([0-9]{3})[0-9]{5}$/;

  if (oldNicRegex.test(clean)) {
    format = 'Old (10-char)';
    const match = clean.match(oldNicRegex)!;
    year = 1900 + parseInt(match[1], 10);
    dayOfYear = parseInt(match[2], 10);
  } else if (newNicRegex.test(clean)) {
    format = 'New (12-digit)';
    const match = clean.match(newNicRegex)!;
    year = parseInt(match[1], 10);
    dayOfYear = parseInt(match[2], 10);
  } else {
    return { isValid: false, error: 'Enter a valid 10-char (e.g. 952451234V) or 12-digit NIC' };
  }

  // Determine Gender (In SL NIC, females have 500 added to day of year)
  let gender: 'Male' | 'Female' = 'Male';
  if (dayOfYear > 500) {
    gender = 'Female';
    dayOfYear -= 500;
  }

  if (dayOfYear < 1 || dayOfYear > 366) {
    return { isValid: false, error: 'Invalid day of year code in NIC' };
  }

  // Month days mapping for 366-day leap year calculation standard in SL NICs
  const monthDays = [
    { month: 1, name: 'Jan', days: 31 },
    { month: 2, name: 'Feb', days: 29 },
    { month: 3, name: 'Mar', days: 31 },
    { month: 4, name: 'Apr', days: 30 },
    { month: 5, name: 'May', days: 31 },
    { month: 6, name: 'Jun', days: 30 },
    { month: 7, name: 'Jul', days: 31 },
    { month: 8, name: 'Aug', days: 31 },
    { month: 9, name: 'Sep', days: 30 },
    { month: 10, name: 'Oct', days: 31 },
    { month: 11, name: 'Nov', days: 30 },
    { month: 12, name: 'Dec', days: 31 },
  ];

  let currentDays = dayOfYear;
  let month = 1;
  let day = 1;

  for (const m of monthDays) {
    if (currentDays <= m.days) {
      month = m.month;
      day = currentDays;
      break;
    }
    currentDays -= m.days;
  }

  const mm = String(month).padStart(2, '0');
  const dd = String(day).padStart(2, '0');
  const dateOfBirth = `${year}-${mm}-${dd}`;
  const formattedDob = `${dd}/${mm}/${year}`;

  return {
    isValid: true,
    year,
    month,
    day,
    dateOfBirth,
    formattedDob,
    gender,
    format,
  };
}
