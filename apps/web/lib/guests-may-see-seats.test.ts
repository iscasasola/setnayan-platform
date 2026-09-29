/**
 * 🪑 SEATS SHOW ON THE DAY — owner, 2026-09-30, verbatim: "seatplan will show
 * on the date of the event".
 *
 *   1. THE RULE (`guestsMaySeeSeats`): before the day + switch off → hidden;
 *      before the day + "Show guests their seats early" on → shown; on/after
 *      the day (Manila) → shown regardless; a month/year date never opens.
 *   2. THE SWEEP: every guest-facing reader goes through the helper — no file
 *      outside the couple's own dashboard reads `published_at` off
 *      `event_floor_plan` by itself, and the named readers all call it.
 *   3. THE SQL TWIN: the migration's `guests_may_see_seats()` encodes the same
 *      rule, and the three guest seat functions ask it.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { stripComments } from './strip-comments';
import { guestsMaySeeSeats, seatDayHasCome } from './guests-may-see-seats';
import { arrivalDestinationWords } from './invite-destination';

const WEB = join(__dirname, '..');
const REPO = join(WEB, '..', '..');
const src = (p: string) => readFileSync(join(WEB, p), 'utf8');

// The event is on Friday 18 December 2026 (Manila). Manila is UTC+8.
const EVENT = { eventDate: '2026-12-18', eventDatePrecision: 'day' } as const;
const DAY_BEFORE_2359 = new Date('2026-12-17T15:59:59Z'); // 23:59:59 Manila, the 17th
const DAY_0000 = new Date('2026-12-17T16:00:00Z'); // 00:00 Manila, the 18th
const DAY_AFTER = new Date('2026-12-20T04:00:00Z');
const WEEK_BEFORE = new Date('2026-12-11T04:00:00Z');

// ── 1 · the rule ────────────────────────────────────────────────────────────

test('before the day + switch off → hidden', () => {
  assert.equal(guestsMaySeeSeats({ ...EVENT, shownEarlyAt: null }, WEEK_BEFORE), false);
  assert.equal(guestsMaySeeSeats({ ...EVENT, shownEarlyAt: null }, DAY_BEFORE_2359), false, 'one second before midnight Manila');
});

test('before the day + "Show guests their seats early" on → shown', () => {
  assert.equal(guestsMaySeeSeats({ ...EVENT, shownEarlyAt: '2026-12-01T00:00:00Z' }, WEEK_BEFORE), true);
});

test('on the day (from 00:00 Manila) and after → shown regardless of the switch', () => {
  for (const now of [DAY_0000, DAY_AFTER]) {
    assert.equal(guestsMaySeeSeats({ ...EVENT, shownEarlyAt: null }, now), true);
    assert.equal(guestsMaySeeSeats({ ...EVENT, shownEarlyAt: '2026-12-01T00:00:00Z' }, now), true);
  }
});

test('a multi-day event opens on its FIRST day (events.event_date)', () => {
  // A 18–20 Dec celebration: event_date is the 18th, so the 18th opens it.
  assert.equal(seatDayHasCome('2026-12-18', 'day', DAY_0000), true);
});

test('a date known only to the month or year never opens by itself; no date never opens', () => {
  for (const p of ['month', 'year', null, undefined]) {
    assert.equal(guestsMaySeeSeats({ eventDate: '2026-12-18', eventDatePrecision: p, shownEarlyAt: null }, DAY_AFTER), false, `precision=${p}`);
  }
  assert.equal(guestsMaySeeSeats({ eventDate: null, eventDatePrecision: 'day', shownEarlyAt: null }, DAY_AFTER), false);
  assert.equal(guestsMaySeeSeats({ eventDate: 'soon', eventDatePrecision: 'day', shownEarlyAt: null }, DAY_AFTER), false);
});

// ── 2 · the sweep: every reader goes through the helper ─────────────────────

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    if (name === 'node_modules' || name === '.next') continue;
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (/\.(ts|tsx)$/.test(name) && !/\.test\.tsx?$/.test(name)) out.push(p);
  }
  return out;
}

// The couple's OWN seat-plan screens read the switch's state to draw it — that
// is the switch, not a guest seeing seats. Everything else must ask the helper.
const COUPLE_SIDE = /^app\/dashboard\//;
const HELPER = 'lib/guests-may-see-seats.ts';

test('no guest-facing file reads the floor plan’s published_at by itself', () => {
  const offenders: string[] = [];
  for (const abs of [...walk(join(WEB, 'app')), ...walk(join(WEB, 'lib'))]) {
    const rel = relative(WEB, abs).split('\\').join('/');
    if (rel === HELPER || COUPLE_SIDE.test(rel)) continue;
    const code = stripComments(readFileSync(abs, 'utf8'));
    if (/from\(\s*['"]event_floor_plan['"]\s*\)[\s\S]{0,160}?published_at/.test(code)) offenders.push(rel);
  }
  assert.deepEqual(offenders, [], 'read it through guestsMaySeeSeatsFor (lib/guests-may-see-seats.ts)');
});

test('the retired published-only reader is gone, not merely uncalled', () => {
  for (const abs of [...walk(join(WEB, 'app')), ...walk(join(WEB, 'lib'))]) {
    assert.ok(!/\beventSeatingPublished\b/.test(stripComments(readFileSync(abs, 'utf8'))), relative(WEB, abs));
  }
});

// Every guest-facing seat reader, each asking the one rule.
const READERS = [
  'app/[slug]/find-seat/page.tsx',
  'app/[slug]/seat/page.tsx',
  'app/[slug]/find-my-table/page.tsx',
  'app/[slug]/hub/page.tsx',
  'app/[slug]/_lib/loaders.ts',
  'app/[slug]/_lib/your-own-day.server.ts',
  'lib/pass-card.server.ts',
  'lib/print-set.server.ts',
  'lib/guest-reminder-emails.ts',
  'app/vendor-dashboard/on-the-day/live/[eventId]/_components/floor-command/floor-command.tsx',
];

test('every guest-facing seat reader asks guestsMaySeeSeatsFor', () => {
  for (const f of READERS) {
    assert.match(stripComments(src(f)), /\bguestsMaySeeSeatsFor\(/, `${f} must ask the one seat rule`);
  }
});

test('the hub card’s table label is read only behind the rule (loaders.ts)', () => {
  const code = stripComments(src('app/[slug]/_lib/loaders.ts'));
  assert.match(code, /if \(doorway\.seatingPublished\) try \{\s*const \{ data: assignmentRow \} = await admin\s*\.from\('event_seat_assignments'\)/);
});

test('the hub seat tile names the table only behind the rule (hub/page.tsx)', () => {
  const code = stripComments(src('app/[slug]/hub/page.tsx'));
  assert.match(code, /const seatLabel = seatingPublished \? tableLabel : null;/);
  const tile = code.slice(code.indexOf("'You’ve arrived'") - 800, code.indexOf("'You’ve arrived'") + 800);
  assert.ok(!/\btableLabel\b/.test(tile), 'the tile reads seatLabel, never the raw tableLabel');
});

test('a reminder email names the table only behind the rule', () => {
  const code = stripComments(src('lib/guest-reminder-emails.ts'));
  assert.match(code, /tableLabel: seatsOpen \?/);
});

// ── 2b · no door to "not yet" (owner, 2026-09-30: "seat plan is only on the day")
// Every link on the guest pages into a seat room — /find-seat, /find-my-table,
// /seat, and the <SeatDoorLine> — must sit behind the one rule, so a guest
// never gets a door that opens onto "your seat shows on the day". The gates it
// may sit behind are all derived from `guestsMaySeeSeatsFor`:
//   seatPassActive · seatingPublished (doorway facts) · seatsOpen (hub card)
//   · seatLabel (hub tile) · venueWalkHref (everything-else rows) · a
//   tableLabel the loader only reads behind the rule.
const SEAT_DOOR = /\/(?:find-seat|find-my-table|seat)[`'"?]|<SeatDoorLine\b/g;
const DOOR_GATES = /\b(?:seatPassActive|seatingPublished|seatsOpen|seatLabel|venueWalkHref)\b|\btableLabel \?/;
const SEAT_ROOMS = /^app\/\[slug\]\/(?:find-seat|find-my-table|seat)\//;

test('every guest-page door into a seat room sits behind the one rule', () => {
  const ungated: string[] = [];
  for (const abs of walk(join(WEB, 'app', '[slug]'))) {
    const rel = relative(WEB, abs).split('\\').join('/');
    if (SEAT_ROOMS.test(rel) || rel.endsWith('/seat-door-line.tsx')) continue;
    const code = stripComments(readFileSync(abs, 'utf8'));
    for (const m of code.matchAll(SEAT_DOOR)) {
      const before = code.slice(Math.max(0, m.index! - 700), m.index!);
      // A redirect / revalidate / route table entry is not a door a guest taps.
      const line = code.slice(code.lastIndexOf('\n', m.index!) + 1, code.indexOf('\n', m.index!));
      if (/redirect\(|revalidatePath\(|next=|callbackUrl|pathname/.test(line)) continue;
      if (!DOOR_GATES.test(before)) ungated.push(`${rel}: ${line.trim().slice(0, 90)}`);
    }
  }
  assert.deepEqual(ungated, [], 'gate the door on the seat rule (guestsMaySeeSeatsFor) — never link to a "not yet" page');
});

test('the public landing’s "Find your seat" pill asks the rule (site-body.tsx)', () => {
  const code = stripComments(src('app/[slug]/_components/site-body.tsx'));
  assert.match(code, /\{insideAllowed && doorwayFacts\?\.seatingSurfaceEnabled && doorwayFacts\?\.seatingPublished \? \(\s*<div className="mt-8 text-center">\s*<Link\s*href=\{`\/\$\{event\.slug\}\/find-seat`\}/);
  assert.match(code, /\{seatPassActive && !isMakerCanvas \? \(\s*<SeatDoorLine/, 'the Details seat line (data-seat-door)');
});

test('the everything-else "Find my table" row opens only with the rule (everything-else-rows.ts + site-nav.ts)', () => {
  const rows = stripComments(src('app/[slug]/_lib/everything-else-rows.ts'));
  assert.match(rows, /if \(input\.venueWalkHref\) \{\s*rows\.push\(\{\s*key: 'find-my-table'/, 'the row sits behind venueWalkHref');
  const nav = stripComments(src('app/[slug]/_lib/site-nav.ts'));
  assert.match(nav, /const venueWalk =\s*input\.seatingSurfaceEnabled && input\.seatingPublished/, 'venueWalkHref is the seat rule');
  const loaders = stripComments(src('app/[slug]/_lib/loaders.ts'));
  assert.match(loaders, /seatingSurfaceEnabled \? guestsMaySeeSeatsFor\(admin, eventId\)/, 'seatingPublished IS guestsMaySeeSeatsFor');
});

test('the 3D room says "find your seat" only once the rule opens it (venue/page.tsx)', () => {
  const page = stripComments(src('app/[slug]/venue/page.tsx'));
  const gate = page.indexOf('if (!scene.published) {');
  const mount = page.indexOf('<GuestVenueLoader');
  assert.ok(gate > 0 && mount > gate, 'the unopened room returns before the 3D (and its "find your seat" line) mounts');
  assert.match(page.slice(gate, mount), /return \(/);
});

test('no arrival words promise "your seat" before the day — only the day-of door does', () => {
  for (const d of ['save_the_date', 'invitation', 'story'] as const) {
    assert.doesNotMatch(arrivalDestinationWords(d).blurb, /your seat/i, `${d} promises a seat before the day`);
  }
  assert.match(arrivalDestinationWords('day_of').blurb, /your seat/, 'on the day the seat IS there');
});

test('the Maker’s Seat plan is DONE when arranged, never when guests can see it (controller 2026-09-30)', () => {
  const md = stripComments(src('app/dashboard/[eventId]/launch/_components/maker-details.tsx'));
  const row = md.slice(md.indexOf('function seatPlanRow('));
  assert.match(row, /done: n === null \? undefined : n > 0,/);
  assert.doesNotMatch(row.slice(0, 1500), /done: seatPlan\?\.open/);
  const flow = stripComments(src('lib/details-guided-flow.ts'));
  assert.match(flow, /case 'seating':\s*return f\.seatPlanArranged \?\? undefined;/);
  const progress = stripComments(src('app/dashboard/[eventId]/launch/_components/details-guided-progress.ts'));
  assert.ok(!/guestsMaySeeSeats/.test(progress), 'the guided plan must not read visibility for "done"');
});

// ── 3 · the SQL twin ────────────────────────────────────────────────────────

const MIGRATIONS = join(REPO, 'supabase', 'migrations');
const latestDefining = (fn: string) =>
  readdirSync(MIGRATIONS)
    .filter((f) => f.endsWith('.sql'))
    .sort()
    .filter((f) => new RegExp(`function[^(]*\\b${fn}\\s*\\(`, 'i').test(readFileSync(join(MIGRATIONS, f), 'utf8')))
    .pop()!;

test('the SQL rule is the same rule: Manila day, day precision, or the early switch', () => {
  const f = latestDefining('guests_may_see_seats');
  assert.ok(f, 'public.guests_may_see_seats() exists');
  const sql = readFileSync(join(MIGRATIONS, f), 'utf8');
  const at = sql.indexOf('FUNCTION public.guests_may_see_seats');
  const body = sql.slice(at, sql.indexOf('$$;', at)).replace(/--[^\n]*/g, '');
  assert.match(body, /event_date_precision = 'day'/);
  assert.match(body, /e\.event_date <= \(now\(\) AT TIME ZONE 'Asia\/Manila'\)::date/);
  assert.match(body, /fp\.published_at IS NOT NULL/);
  assert.match(body, /\)\s*OR EXISTS/, 'the day OR the switch — never AND');
});

test('the guest seat functions ask the SQL rule, not published_at', () => {
  for (const fn of ['public_venue_scene', 'public_seat_lookup', 'coordinator_seat_by_guest_qr']) {
    const f = latestDefining(fn);
    const sql = readFileSync(join(MIGRATIONS, f), 'utf8');
    const a = sql.search(new RegExp(`CREATE OR REPLACE FUNCTION public\\.${fn}\\s*\\(`, 'i'));
    const body = sql.slice(a, sql.indexOf('COMMENT ON FUNCTION', a) > a ? sql.indexOf('COMMENT ON FUNCTION', a) : undefined);
    assert.match(body, /public\.guests_may_see_seats\(/, `${fn} (${f}) asks the one rule`);
    const fpPublished = body.replace(/--[^\n]*/g, '').match(/fp\.published_at/g) ?? [];
    assert.equal(fpPublished.length, 0, `${fn} must not read event_floor_plan.published_at by itself`);
  }
});
