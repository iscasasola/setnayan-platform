/**
 * Save-the-Date view counter — shared helpers (iteration 0024).
 *
 * A privacy-first, UNIQUE-PER-DAY counter. There is NO per-device data in the
 * database (events_std_views is a plain day→count rollup); "unique per day" is
 * enforced entirely by a first-party httpOnly cookie that remembers which days
 * a device already counted each event. No PII (RA 10173). The couple's own
 * visits are excluded upstream (the beacon is gated off for authed hosts) and
 * only Save-the-Date-phase loads are counted (re-checked server-side).
 */

/** The dedup cookie: a small JSON map `{ "<slug>": "YYYY-MM-DD" }` of the last
 *  day this device counted each event. httpOnly — only the /api/std/view route
 *  reads/writes it; the client never needs it. */
export const STD_VIEW_COOKIE = 'sv';

/** Cap the cookie so a device that browses many couples' pages stays small. */
const MAX_ENTRIES = 50;

/** YYYY-MM-DD in Asia/Manila — day buckets match the PH-first audience (and the
 *  couple's `event_date`, also a Manila-local DATE), so "per day" is their day. */
export function manilaToday(): string {
  // 'en-CA' formats as YYYY-MM-DD; the timeZone pins the day boundary to Manila.
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Manila' }).format(new Date());
}

/** Parse the dedup cookie value into a {slug: 'YYYY-MM-DD'} map (defensive). */
export function parseStdViewCookie(raw: string | undefined): Record<string, string> {
  if (!raw) return {};
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {};
    const out: Record<string, string> = {};
    for (const [k, v] of Object.entries(parsed as Record<string, unknown>)) {
      if (typeof v === 'string') out[k] = v;
    }
    return out;
  } catch {
    return {};
  }
}

/** Mark `slug` as counted on `today`, moving it to the end (most-recent) and
 *  pruning to the newest MAX_ENTRIES so the cookie stays well under the 4KB cap. */
export function serializeStdViewCookie(map: Record<string, string>, slug: string, today: string): string {
  delete map[slug];
  map[slug] = today;
  const entries = Object.entries(map);
  const pruned = entries.length > MAX_ENTRIES ? entries.slice(entries.length - MAX_ENTRIES) : entries;
  return JSON.stringify(Object.fromEntries(pruned));
}

/** Roll a list of (view_date, views) rows up into the numbers a surface shows:
 *  all-time total, today, and the trailing 7 days (inclusive of today). */
export function summarizeStdViews(
  rows: Array<{ view_date: string; views: number }>,
  today: string,
): { total: number; today: number; last7: number } {
  // today − 6 days, as YYYY-MM-DD, compared lexically (safe for ISO dates).
  const t = new Date(`${today}T00:00:00Z`);
  t.setUTCDate(t.getUTCDate() - 6);
  const weekStart = t.toISOString().slice(0, 10);
  let total = 0;
  let todayCount = 0;
  let last7 = 0;
  for (const r of rows) {
    const v = Number(r.views) || 0;
    total += v;
    if (r.view_date === today) todayCount += v;
    if (r.view_date >= weekStart) last7 += v;
  }
  return { total, today: todayCount, last7 };
}
