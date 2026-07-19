/**
 * Pure date helper for the anniversary heads-up (no `server-only` guard, so it's
 * unit-testable). Kept separate from daily-email-jobs.ts, which imports
 * 'server-only'.
 */

/** YYYY-MM-DD `days` after `iso`, staying on the Manila (UTC+8) civil calendar. */
export function addDaysToIso(iso: string, days: number): string {
  const base = new Date(`${iso}T00:00:00+08:00`);
  const shifted = new Date(base.getTime() + days * 24 * 60 * 60 * 1000);
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Manila',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(shifted);
}
