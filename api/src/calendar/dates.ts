export const DAY_MS = 86_400_000;

/**
 * Recurring dates are compared in a UTC-normalised space because Prisma
 * returns `@db.Date` columns as UTC midnight. Mixing local getters in here is
 * what makes birthdays drift by a day.
 */
export function startOfToday(): number {
  const now = new Date();
  return Date.UTC(now.getFullYear(), now.getMonth(), now.getDate());
}

/** Feb 29 lands on Feb 28 in common years. */
function clampedUtc(year: number, month: number, day: number): number {
  const ms = Date.UTC(year, month, day);
  if (new Date(ms).getUTCMonth() !== month) {
    return Date.UTC(year, month + 1, 0);
  }
  return ms;
}

export function nextOccurrence(source: Date, todayMs: number) {
  const month = source.getUTCMonth();
  const day = source.getUTCDate();
  const thisYear = new Date(todayMs).getUTCFullYear();

  let dateMs = clampedUtc(thisYear, month, day);
  if (dateMs < todayMs) dateMs = clampedUtc(thisYear + 1, month, day);

  return {
    dateMs,
    daysUntil: Math.round((dateMs - todayMs) / DAY_MS),
    years: new Date(dateMs).getUTCFullYear() - source.getUTCFullYear(),
  };
}

export function toIsoDate(ms: number): string {
  return new Date(ms).toISOString().slice(0, 10);
}
