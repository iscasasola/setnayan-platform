/**
 * receipt-months.ts — the Manila calendar month for the admin receipt ledger
 * (A8·A-7, A8·A-22). BIR reconciliation runs on the Philippine month, so a
 * receipt issued at 07:30 Manila on the 1st belongs to THAT month, even though
 * it is still the previous month in UTC (the server clock on Vercel).
 *
 * The Philippines keeps no daylight saving, so the offset is fixed at +08:00.
 * Pure: no clock, no I/O, so the boundary cases are unit-tested.
 */

const MANILA_OFFSET_MS = 8 * 60 * 60 * 1000;
const BUCKET = /^(\d{4})-(\d{2})$/;

/** 'YYYY-MM' of the Manila month an instant falls in. */
export function manilaMonthBucket(iso: string | number | Date): string {
  const d = new Date(new Date(iso).getTime() + MANILA_OFFSET_MS);
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
}

/** The [start, end) instants of a Manila month, as ISO strings; null for a malformed bucket. */
export function manilaMonthRange(bucket: string): { start: string; end: string } | null {
  const m = BUCKET.exec(bucket);
  if (!m) return null;
  const year = Number(m[1]);
  const month = Number(m[2]);
  if (month < 1 || month > 12) return null;
  const start = Date.UTC(year, month - 1, 1) - MANILA_OFFSET_MS;
  const end = Date.UTC(year, month, 1) - MANILA_OFFSET_MS;
  return { start: new Date(start).toISOString(), end: new Date(end).toISOString() };
}

/** "November 2026" for a bucket — the bucket's own month, never shifted by the server's zone. */
export function manilaMonthLabel(bucket: string): string {
  const m = BUCKET.exec(bucket);
  if (!m) return bucket;
  return new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, 1)).toLocaleString('en-PH', {
    timeZone: 'UTC',
    year: 'numeric',
    month: 'long',
  });
}

/**
 * Every Manila month from the oldest receipt to now, newest first — the month
 * picker's options (A8·A-22). Built from the oldest issue date, not from the
 * rows on screen, so picking a month never hides the others.
 */
export function manilaMonthsSince(oldestIso: string, now: Date = new Date()): string[] {
  const out: string[] = [];
  const last = manilaMonthBucket(now);
  let cur = manilaMonthBucket(oldestIso);
  if (cur > last) return [last];
  for (let guard = 0; guard < 1200; guard++) {
    out.push(cur);
    if (cur === last) break;
    const [y, mo] = cur.split('-').map(Number) as [number, number];
    cur = mo === 12 ? `${y + 1}-01` : `${y}-${String(mo + 1).padStart(2, '0')}`;
  }
  return out.reverse();
}
