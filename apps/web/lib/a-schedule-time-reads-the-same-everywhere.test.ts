/**
 * ⏱ ONE SCHEDULE TIME, ONE STRING — on every screen that shows it.
 *
 * ── WHAT A STORED SCHEDULE TIME IS ─────────────────────────────────────────
 * `event_schedule_blocks.start_at` holds the VENUE'S WALL CLOCK written into a
 * UTC column: a 1:30 PM arrival is `…T13:30:00Z`. It is not an instant. The
 * digits ARE the answer, so every display surface must read them back
 * unchanged — `formatWallClock` (lib/schedule-datetime-local.ts) for a bare
 * time, `formatBlockTime` / `formatBlockTimeRange` (lib/schedule.ts) with a
 * date. The one thing a screen must never do is format the stored value in a
 * real timezone: in Asia/Manila that adds eight hours a SECOND time.
 *
 * ── WHY THIS FILE EXISTS (2026-09-27) ──────────────────────────────────────
 * The couple's Schedule said "Guests arrive · 1:30 PM", their guest page said
 * 1:30 PM, and the Event Hub Maker's "Run of show" tile said **9:30 PM** — it
 * formatted the stored value in the event's timezone. The supplier's day-of
 * run of day and the emcee script did the same, and the couple's Home "what's
 * next" printed the lifted instant in the server's zone ("5:30 AM"). Each
 * screen was internally consistent; only side by side were they wrong.
 *
 * The template that seeds a schedule also used LOCAL setters (`setHours`), so
 * the digits it stored depended on the machine that ran it — right on Vercel
 * (UTC) by accident, eight hours off anywhere else.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';

import { buildTemplateInsertRows, getScheduleTemplate } from './schedule-templates';
import { formatWallClock, fromDatetimeLocalValue } from './schedule-datetime-local';
import { formatBlockTime, formatBlockTimeRange, formatViewerTime, DEFAULT_EVENT_TZ } from './schedule';
import { stripComments } from './strip-comments';

const ZONES = ['UTC', 'Asia/Manila', 'America/New_York', 'Pacific/Kiritimati'];

function underTz<T>(tz: string, fn: () => T): T {
  const before = process.env.TZ;
  process.env.TZ = tz;
  try {
    return fn();
  } finally {
    if (before === undefined) delete process.env.TZ;
    else process.env.TZ = before;
  }
}

/** ICU puts a narrow no-break space before AM/PM on newer builds. */
const norm = (s: string | null) => (s ?? "").replace(/\s+/gu, " ").trim();

// cale-ice's own row, as prod stores it today.
const GUESTS_ARRIVE = '2026-12-18T13:30:00+00:00';

// ── Writes ──────────────────────────────────────────────────────────────────

test('the template writes the wall clock it names, on any machine', () => {
  const tpl = getScheduleTemplate('wedding_classic_full_day');
  assert.ok(tpl, 'the classic template exists');
  for (const tz of ZONES) {
    const rows = underTz(tz, () => buildTemplateInsertRows(tpl, '2026-12-18'));
    const arrive = rows.find((r) => r.label === 'Guests arrive');
    assert.equal(arrive?.start_at, '2026-12-18T13:30:00.000Z', `template 13:30 stored wrong under TZ=${tz}`);
    assert.equal(arrive?.end_at, '2026-12-18T14:00:00.000Z', `template end stored wrong under TZ=${tz}`);
  }
});

test('an edit of "1:30 PM" saves the same value the template wrote', () => {
  for (const tz of ZONES) {
    assert.equal(
      underTz(tz, () => fromDatetimeLocalValue('2026-12-18T13:30')),
      '2026-12-18T13:30:00.000Z',
      `edit saved the wrong value under TZ=${tz}`,
    );
  }
});

// ── Reads ───────────────────────────────────────────────────────────────────

test('dashboard, guest page and Maker tile print the same time for the same row', () => {
  for (const tz of ZONES) {
    underTz(tz, () => {
      const maker = norm(formatWallClock(GUESTS_ARRIVE)); // Maker "Run of show" tile, supplier run of day, emcee script
      const guestPass = norm(formatBlockTimeRange(GUESTS_ARRIVE, null)); // guest pass + programme fallback
      const dashboard = norm(formatBlockTime(GUESTS_ARRIVE)); // couple's Schedule (dated)
      assert.equal(maker, '1:30 PM', `Maker tile under TZ=${tz}`);
      assert.equal(guestPass, maker, `guest page disagrees with the Maker tile under TZ=${tz}`);
      assert.ok(dashboard.endsWith(maker), `dashboard "${dashboard}" disagrees under TZ=${tz}`);
    });
  }
  // The guest page's "YOUR TIME" line, for a guest whose phone is at the venue.
  const viewer = underTz('Asia/Manila', () => formatViewerTime(GUESTS_ARRIVE, DEFAULT_EVENT_TZ));
  assert.equal(norm(viewer), '1:30 PM', 'a Manila guest reads the couple\'s own 1:30 PM');
});

// ── The guard ───────────────────────────────────────────────────────────────
//
// PROPERTY: in a file that handles schedule times, a clock-time format call
// (`toLocaleTimeString`, or any `toLocaleString` / `Intl.DateTimeFormat` whose
// options carry `hour`) must read the stored digits — `timeZone: 'UTC'` — or go
// through `formatWallClock` / `formatBlockTime`. Re-zoning is the defect.
//
// The exemptions below format REAL instants (photo captures, a capture window,
// appointments) or ARE the deliberate lift (`formatViewerTime`). Each is pinned
// by COUNT, so a new re-zoning call in the same file still fails.

const EXEMPT: Record<string, { count: number; why: string }> = {
  'app/[slug]/_components/editorial/data.ts': { count: 1, why: "a photo capture's real instant, in Manila" },
  'lib/alaala-chapters.ts': { count: 1, why: 'venue parts of real capture instants' },
  'lib/papic-window.ts': { count: 1, why: 'the capture window closes at a real instant' },
  'lib/schedule.ts': { count: 2, why: 'the tz maths itself, and formatViewerTime — the lift into the viewer\'s zone' },
  'lib/upcoming-items.ts': { count: 1, why: 'appointments carry real timestamps, not schedule wall clocks' },
};

const SCHEDULE_TIME = /\b(start_at|end_at|startAt|endAt|startIso|endIso)\b/;
const FORMAT_CALL = /(toLocaleTimeString|toLocaleString|DateTimeFormat)\s*\(([^)]*)\)/gs;

/** Clock-time format calls that do not read the stored digits. */
function reZoningCalls(src: string): number {
  const s = stripComments(src);
  if (!SCHEDULE_TIME.test(s)) return 0;
  let n = 0;
  for (const m of s.matchAll(FORMAT_CALL)) {
    const [, fn, args = ''] = m;
    if (fn !== 'toLocaleTimeString' && !/\bhour\s*:/.test(args)) continue;
    if (/timeZone\s*:\s*['"]UTC['"]/.test(args)) continue;
    n += 1;
  }
  return n;
}

function sourceFiles(root: string): string[] {
  const out: string[] = [];
  const walk = (dir: string) => {
    for (const e of readdirSync(dir, { withFileTypes: true })) {
      if (e.name === 'node_modules' || e.name === '.next') continue;
      const p = path.join(dir, e.name);
      if (e.isDirectory()) walk(p);
      else if (/\.tsx?$/.test(e.name) && !/\.test\.tsx?$/.test(e.name)) out.push(p);
    }
  };
  for (const d of ['app', 'lib', 'components']) walk(path.join(root, d));
  return out;
}

test('no screen re-zones a stored schedule time', () => {
  const root = path.resolve(__dirname, '..');
  const files = sourceFiles(root);
  assert.ok(files.length > 500, `the scan found only ${files.length} files — it is not looking at the app`);
  const offenders: string[] = [];
  const seen = new Set<string>();
  for (const abs of files) {
    const rel = path.relative(root, abs).split(path.sep).join('/');
    const n = reZoningCalls(readFileSync(abs, 'utf8'));
    const allowed = EXEMPT[rel]?.count ?? 0;
    if (EXEMPT[rel]) seen.add(rel);
    if (n !== allowed) offenders.push(`${rel}: ${n} re-zoning call(s), ${allowed} allowed`);
  }
  assert.deepEqual(
    offenders,
    [],
    'A schedule time is the venue wall clock in a UTC column. Show it with formatWallClock / ' +
      "formatBlockTime, or pass timeZone: 'UTC'. If the value is a REAL instant, add the file to " +
      'EXEMPT with the reason.',
  );
  assert.deepEqual([...seen].sort(), Object.keys(EXEMPT).sort(), 'an EXEMPT entry names a file that no longer exists');
});

test('the guard can see the defect it was written for', () => {
  // The Maker tile's old line, verbatim in shape.
  const bad = `const t = new Date(firstBlock.start_at).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', timeZone: eventTz });`;
  assert.equal(reZoningCalls(bad), 1);
  const bare = `const t = new Date(b.start_at).toLocaleTimeString('en-PH', { hour: 'numeric', minute: '2-digit' });`;
  assert.equal(reZoningCalls(bare), 1);
  const good = `const t = new Date(b.start_at).toLocaleTimeString('en-PH', { hour: 'numeric', timeZone: 'UTC' });`;
  assert.equal(reZoningCalls(good), 0);
  const commented = `// b.start_at: the obvious toLocaleTimeString(x, { hour: 'numeric' }) is wrong`;
  assert.equal(reZoningCalls(commented), 0);
});
