/**
 * manila-stamp.ts — an admin timestamp ("Nov 14, 2026, 12:30 AM") in MANILA time, never the raw UTC slice (admin walk 13 Nov 2026, F-A-11:
 * Insights printed `2026-11-13 08:15 UTC` and UTC days). Pure; a value that is not a date is returned as given.
 */
const DAY: Intl.DateTimeFormatOptions = { year: 'numeric', month: 'short', day: 'numeric', timeZone: 'Asia/Manila' };
const STAMP: Intl.DateTimeFormatOptions = { ...DAY, hour: 'numeric', minute: '2-digit' };

function parse(iso: string): Date | null {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? null : d;
}

/** "Nov 13, 2026" — the Manila day of an instant. */
export function manilaDayLabel(iso: string): string {
  const d = parse(iso);
  return d ? d.toLocaleDateString('en-PH', DAY) : iso;
}

/** "Nov 13, 2026, 4:15 PM" — an instant on Manila's clock. */
export function manilaStampLabel(iso: string): string {
  const d = parse(iso);
  return d ? d.toLocaleString('en-PH', STAMP) : iso;
}
