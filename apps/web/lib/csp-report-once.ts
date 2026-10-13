/**
 * csp-report-once.ts — ONE DATABASE WRITE PER BLOCK, NOT PER REPORT
 * (2026-10-13, guest-load fix). Pure: the route hands it its memory and clock.
 *
 * 🧯 WHY. A browser sends a CSP report for EVERY asset a page loads that the
 * watching policy would block — so one page view of a page with a blocked font
 * or image is a burst of ~50 identical reports. Production wrote 3,545 of them
 * a day, one `record_csp_violation` call each, in bursts of ~50 that held the
 * free database's connection slots for ~6 s (2026-10-12 14:40:47) — the same
 * slots a guest's invitation was waiting for.
 *
 * WHAT IS KEPT. What the reports are FOR (the admin's "Browser blocks" list) is
 * WHICH rule, WHICH source, WHICH page — and every one of those still lands:
 * the first report of each (directive, origin, route shape) a server sees
 * writes, and repeats of it on that server within RECORD_WINDOW_MS are not
 * written. So `hits` now counts "seen, at most once per server per window",
 * and the admin note says so. A block that keeps happening keeps appearing,
 * once per window.
 *
 * The memory is bounded (MAX_REMEMBERED keys): past it, it is cleared — the
 * safe direction, which writes a few more rows, never fewer.
 */
export const RECORD_WINDOW_MS = 10 * 60_000;
export const MAX_REMEMBERED = 500;

/** Should this report be written? Records the write when it says yes. */
export function shouldRecordCspReport(seen: Map<string, number>, key: string, now: number): boolean {
  const last = seen.get(key);
  if (last !== undefined && now - last < RECORD_WINDOW_MS && now >= last) return false;
  if (seen.size >= MAX_REMEMBERED) seen.clear();
  seen.set(key, now);
  return true;
}

/** The identity of a block — the same three things the counter row is keyed by. */
export function cspReportKey(summary: { directive: string; blockedOrigin: string; path: string }): string {
  return JSON.stringify([summary.directive, summary.blockedOrigin, summary.path]);
}
