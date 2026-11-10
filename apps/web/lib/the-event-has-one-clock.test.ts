/**
 * ⏱ THE EVENT HUB HAS ONE CLOCK (owner ruling, 10 Nov 2026).
 *
 * The public Event Hub keeps its stages (Save the Date · Invitation · The Day · Post Event) inside one link, and every
 * part follows ONE clock: `eventClock` in `lib/event-clock.ts`. Before it the code had two stage resolvers beside about
 * eight ad-hoc date rules that disagreed — noon-the-day-before windows, midnight-Manila desks, phones anchoring a date
 * on their own midnight, a bare date parsed as midnight UTC.
 *
 * § 1 holds the rulings as behaviour (06:00 → 06:00 the morning after the LAST day, venue time, by default; the
 *     couple may move both; the date moves the stage; the pin stays and offers "Back to automatic"; Manila when there
 *     is no venue).
 * § 2 holds the readers that were moved: they agree with the clock at every boundary.
 * § 3 is the GUARD — it fails if a page or module computes the event day itself instead of asking the one function.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

import {
  getDayOfPhase,
  getMenuLifecyclePhase,
  isEventDayActive,
  theDayCalendarDay,
  theDayWindow,
  THE_DAY_CLOSES_DEFAULT_MIN,
  THE_DAY_OPENS_DEFAULT_MIN,
  VENUE_TZ_FALLBACK,
} from './day-of-mode';
import { DEFAULT_EVENT_TZ } from './schedule';
import { getLifecyclePhase } from './invitation-widgets';
import {
  clockCode,
  clockPartOpen,
  clockRowOf,
  eventClock,
  theDayInstantsOf,
  theDayIsOpenAt,
} from './event-clock';
import { CLOCK_PARTS, STAGE_CLOCK_PARTS, stagesOfClockPart } from './stage-scenes';
import { resolveWallMode } from './live-wall-logic';
import { isDayOfOpen } from './guest-journey';
import { phTodayIso, hasDayToday } from './vendor-day-picker';
import { formatHubViewKey, parseHubViewKey } from './hub-view-key';

const MANILA = 'Asia/Manila';
const at = (iso: string) => Date.parse(iso);
/** 2026-12-12 in Manila (UTC+8): 06:00 local = 2026-12-11T22:00Z; 06:00 the morning after = 2026-12-12T22:00Z. */
const DAY = '2026-12-12';
const OPENS = '2026-12-11T22:00:00Z';
const CLOSES = '2026-12-12T22:00:00Z';
const before = (iso: string) => new Date(at(iso) - 1).toISOString();
const clockAt = (iso: string, extra: Parameters<typeof eventClock>[0]['event'] = { event_date: DAY }) =>
  eventClock({ event: extra, tz: MANILA, nowMs: at(iso) });

// ── § 1 · THE RULINGS ────────────────────────────────────────────────────────────────────────────────────────────

test('§1 · ruling 1+2 — The Day opens at 06:00 on the day and closes at 06:00 the morning after, venue time', () => {
  assert.equal(THE_DAY_OPENS_DEFAULT_MIN, 360);
  assert.equal(THE_DAY_CLOSES_DEFAULT_MIN, 360);
  const w = theDayWindow(DAY, MANILA);
  assert.equal(w.opensMs, at(OPENS));
  assert.equal(w.closesMs, at(CLOSES));
  assert.equal(clockAt(before(OPENS)).theDayOpen, false, '05:59:59 on the day — not yet');
  assert.equal(clockAt(OPENS).theDayOpen, true, '06:00 on the day — open');
  assert.equal(clockAt(before(CLOSES)).theDayOpen, true, '05:59:59 the morning after — still open (the after-party)');
  assert.equal(clockAt(CLOSES).theDayOpen, false, '06:00 the morning after — closed');
  // The stage, the dashboard menu and the day-of phase flip on the SAME instants.
  assert.deepEqual([clockAt(before(OPENS)).automatic, clockAt(OPENS).automatic], ['rsvp', 'event']);
  assert.deepEqual([clockAt(before(CLOSES)).automatic, clockAt(CLOSES).automatic], ['event', 'editorial']);
  assert.deepEqual([clockAt(before(OPENS)).menu, clockAt(OPENS).menu, clockAt(CLOSES).menu], ['plan', 'dayof', 'after']);
  assert.deepEqual([clockAt(before(OPENS)).day, clockAt(OPENS).day, clockAt(CLOSES).day], ['pre', 'live', 'post']);
});

test('§1 · ruling 2 — the LAST day: a two-day celebration stays open until 06:00 after its second day', () => {
  const two = { event_date: DAY, event_end_date: '2026-12-13' };
  assert.equal(clockAt('2026-12-13T12:00:00Z', two).theDayOpen, true, 'day two, evening');
  assert.equal(clockAt('2026-12-13T21:59:59Z', two).theDayOpen, true, '05:59 after day two');
  assert.equal(clockAt('2026-12-13T22:00:00Z', two).theDayOpen, false, '06:00 after day two');
  assert.equal(getDayOfPhase(DAY, MANILA, at('2026-12-13T12:00:00Z'), '2026-12-13'), 'live');
});

test('§1 · the couple can move both instants (rulings 1 and 2: "changeable")', () => {
  const hours = { opensAtMin: 15 * 60, closesAtMin: 2 * 60 }; // 15:00 on the day → 02:00 the morning after
  const c = (iso: string) => eventClock({ event: { event_date: DAY }, tz: MANILA, nowMs: at(iso), hours });
  assert.equal(c('2026-12-12T06:59:59Z').theDayOpen, false, '14:59 Manila');
  assert.equal(c('2026-12-12T07:00:00Z').theDayOpen, true, '15:00 Manila');
  assert.equal(c('2026-12-12T17:59:59Z').theDayOpen, true, '01:59 the morning after');
  assert.equal(c('2026-12-12T18:00:00Z').theDayOpen, false, '02:00 the morning after');
  // A bad stored hour never moves anything.
  const junk = theDayWindow(DAY, MANILA, null, { opensAtMin: 99_999, closesAtMin: -5 });
  assert.deepEqual(junk, theDayWindow(DAY, MANILA));
});

test('§1 · ruling 3 — the date moves the stage; a pin wins and offers "Back to automatic"', () => {
  const pinned = { event_date: DAY, launch_mode: 'manual', manual_phase: 'save_the_date' };
  const c = clockAt(OPENS, pinned);
  assert.equal(c.automatic, 'event');
  assert.equal(c.pinned, 'save_the_date');
  assert.equal(c.stage, 'save_the_date');
  assert.equal(c.backToAutomatic, true);
  assert.equal(clockAt(OPENS).backToAutomatic, false, 'no pin → nothing to go back to');
  assert.equal(eventClock({ event: pinned, tz: MANILA, nowMs: at(OPENS), phasesEnabled: false }).pinned, null, 'no stages → no pin');
  // The live parts follow the DATE, never the pin: pinning The Day early opens no check-in.
  const early = clockAt('2026-11-01T00:00:00Z', { event_date: DAY, launch_mode: 'manual', manual_phase: 'event' });
  assert.equal(early.stage, 'event');
  assert.equal(clockPartOpen(early, 'check_in'), false);
});

test('§1 · ruling 5 — the zone is the venue’s; Manila when there is none, never the runtime’s', () => {
  assert.equal(VENUE_TZ_FALLBACK, DEFAULT_EVENT_TZ);
  assert.equal(eventClock({ event: { event_date: DAY }, nowMs: at(OPENS) }).tz, MANILA);
  // No zone given → Manila (the runtime of this test may be UTC; the answer must not follow it).
  assert.equal(getDayOfPhase(DAY, undefined, at(OPENS)), 'live');
  assert.equal(getDayOfPhase(DAY, undefined, at(before(OPENS))), 'pre');
  // A venue in New York opens at 06:00 New York (UTC−5 in December = 11:00Z).
  const ny = (iso: string) => eventClock({ event: { event_date: DAY }, tz: 'America/New_York', nowMs: at(iso) }).theDayOpen;
  assert.equal(ny('2026-12-12T10:59:59Z'), false);
  assert.equal(ny('2026-12-12T11:00:00Z'), true);
});

test('§1 · the part-by-stage table: every live part belongs to a stage, and The Day opens the day’s parts', () => {
  for (const part of CLOCK_PARTS) assert.ok(stagesOfClockPart(part).length > 0, `${part} is on no stage`);
  for (const part of ['hub', 'live_tab', 'seats', 'song_requests', 'live_wall', 'check_in', 'supplier_today'] as const) {
    assert.deepEqual(stagesOfClockPart(part), ['event'], `${part} is The Day's`);
    assert.equal(clockPartOpen(clockAt(OPENS), part), true);
    assert.equal(clockPartOpen(clockAt(CLOSES), part), false);
  }
  assert.deepEqual(stagesOfClockPart('memories'), ['event', 'editorial']);
  assert.deepEqual(STAGE_CLOCK_PARTS.editorial, ['memories', 'post_event_card']);
});

// ── § 2 · THE READERS THAT WERE MOVED AGREE WITH IT ─────────────────────────────────────────────────────────────

test('§2 · every reader answers from the same two instants', () => {
  const probes = [before(OPENS), OPENS, '2026-12-12T15:00:00Z', before(CLOSES), CLOSES];
  for (const iso of probes) {
    const c = clockAt(iso);
    const now = at(iso);
    assert.equal(isEventDayActive(DAY, MANILA, now), c.theDayOpen, `isEventDayActive @ ${iso}`);
    assert.equal(getMenuLifecyclePhase(DAY, null, MANILA, now) === 'dayof', c.theDayOpen, `menu @ ${iso}`);
    assert.equal(getLifecyclePhase(DAY, MANILA, null, now, null) === 'event', c.theDayOpen, `stage @ ${iso}`);
    assert.equal(theDayIsOpenAt(theDayInstantsOf(c), now), c.theDayOpen, `client instants @ ${iso}`);
    assert.equal(isDayOfOpen(theDayInstantsOf(c), new Date(now)), c.theDayOpen, `isDayOfOpen @ ${iso}`);
    assert.equal(theDayIsOpenAt(DAY, now), c.theDayOpen, `a bare date is read on Manila @ ${iso}`);
    // The supplier's "today" desk: the booked day is today exactly while its The Day is open.
    assert.equal(hasDayToday([{ bookedDate: DAY }], phTodayIso(now)), c.theDayOpen, `supplier today @ ${iso}`);
    assert.equal(theDayCalendarDay(MANILA, now) === DAY, c.theDayOpen, `theDayCalendarDay @ ${iso}`);
  }
});

test('§2 · the wall: after the recap it is the archive, never "coming soon" again', () => {
  const week = clockAt('2026-12-20T00:00:00Z');
  assert.equal(week.day, 'inactive');
  assert.equal(resolveWallMode(null, week.day, week.menu === 'after'), 'archive');
  const month = clockAt('2026-11-01T00:00:00Z');
  assert.equal(resolveWallMode(null, month.day, month.menu === 'after'), 'coming_soon');
  assert.equal(resolveWallMode(null, clockAt(OPENS).day, false), 'live');
  assert.equal(resolveWallMode(null, clockAt(CLOSES).day, true), 'recap');
  assert.equal(resolveWallMode('live', week.day, true), 'live', "the couple's override still wins");
});

test('§2 · the Event Hub cache key carries the clock, so a stage flip names a new copy (no cron)', () => {
  const k = (iso: string) =>
    formatHubViewKey({ rev: '9', clock: clockCode(clockAt(iso)), viewer: { kind: 'anonymous' }, ua: null, tab: null, bust: null });
  assert.notEqual(k(before(OPENS)), k(OPENS), 'The Day opening changes the key');
  assert.notEqual(k(before(CLOSES)), k(CLOSES), 'The Day closing changes the key');
  assert.equal(k('2026-12-12T03:00:00Z'), k('2026-12-12T09:00:00Z'), 'within one stage the key holds still');
  assert.equal(parseHubViewKey(k(OPENS))?.clock, 'el');
  assert.equal(parseHubViewKey('v1.7.a.-.-.-')?.clock, null, 'an old key still parses');
  assert.equal(parseHubViewKey('v2.7.zz.a.-.-.-'), null, 'a clock code that is not one does not');
});

test('§2 · a loosely typed row feeds the clock without casts', () => {
  const r = clockRowOf({ event_date: DAY, venue_latitude: '14.6', venue_longitude: 121, launch_mode: 7 });
  assert.equal(r.event_date, DAY);
  assert.equal(r.venue_latitude, 14.6);
  assert.equal(r.venue_longitude, 121);
  assert.equal(r.launch_mode, null);
  assert.equal(clockRowOf(null).event_date, null);
});

// ── § 3 · THE GUARD: NOBODY COMPUTES THE EVENT DAY THEMSELVES ──────────────────────────────────────────────────

const WEB = join(__dirname, '..');
/** The clock's own modules — the only places the arithmetic may live. */
const CLOCK_HOME = new Set([
  'lib/day-of-mode.ts',
  'lib/lifecycle-stage.ts',
  'lib/event-clock.ts',
  'lib/event-clock.server.ts',
  'lib/vendor-day-picker.ts',
]);

function sources(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    if (name === 'node_modules' || name === '.next' || name.startsWith('.')) continue;
    const full = join(dir, name);
    if (statSync(full).isDirectory()) sources(full, out);
    else if (/\.(ts|tsx)$/.test(name) && !/\.test\.tsx?$/.test(name) && !name.endsWith('.d.ts')) out.push(full);
  }
  return out;
}

/** Code with comments blanked (line numbers kept), so a docblock that NAMES an old rule is not a reader of it. */
function code(src: string): string {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ' '))
    .replace(/(^|[^:'"`\\])\/\/[^\n]*/g, (m, p: string) => p + ' '.repeat(m.length - p.length));
}

/** Each rule: a shape of "computing the event day yourself", and why it is wrong. */
const RULES: Array<{ name: string; re: RegExp }> = [
  {
    // `getDayOfPhase(date)` / `isEventDayActive(date)` with no zone — the runtime's clock (UTC on a server, the phone's
    // own in a browser). Ask `eventClock` / `eventClockNow`, or hand a client `theDayFor(event)`.
    name: 'a day-of window asked with no venue zone',
    re: /\b(?:getDayOfPhase|isEventDayActive|isInDayOfWindow)\(\s*[^,()]*(?:\([^()]*\))?[^,()]*\)/g,
  },
  {
    // `getMenuLifecyclePhase(date, cleared)` — two arguments, no zone.
    name: 'the menu phase asked with no venue zone',
    re: /\bgetMenuLifecyclePhase\(\s*[^,()]*(?:\([^()]*\))?[^,()]*,\s*[^,()]*(?:\([^()]*\))?[^,()]*\)/g,
  },
  {
    // `events.timezone` fed to the clock — it defaults to Manila for every row and was never the venue's.
    name: '`events.timezone` handed to a lifecycle resolver',
    re: /\b(?:getMenuLifecyclePhase|getDayOfPhase|getLifecyclePhase|isEventDayActive)\([^;]*?\.timezone\b/g,
  },
  {
    // "Is it the day?" as `event_date === today-in-Manila` — midnight to midnight, not The Day.
    name: 'the event date compared with a midnight "today"',
    re: /event_?[dD]ate[^;\n]{0,80}===\s*(?:phTodayIso|manilaToday|manilaTodayIso|manilaTodayISO)\(|(?:phTodayIso|manilaToday|manilaTodayIso|manilaTodayISO)\(\)\s*===\s*[^;\n]{0,40}event_?[dD]ate/g,
  },
  {
    // `new Date(event_date).getTime() < Date.now()` — a bare date parsed as midnight UTC, compared with now.
    name: 'an event date parsed as an instant and compared with now',
    re: /new Date\(\s*[\w.?!]*event_?[dD]ate[^)]*\)\.getTime\(\)\s*[<>]=?\s*Date\.now\(\)|Date\.now\(\)\s*[<>]=?\s*new Date\(\s*[\w.?!]*event_?[dD]ate/g,
  },
];

/**
 * Readers left on purpose, each with its reason. ⚠ A line here is a decision, not an escape hatch: it names the file,
 * the rule, and why the one clock is not the question that file asks.
 */
const LEFT_ON_PURPOSE: ReadonlyArray<{ file: string; rule: string; why: string }> = [];

test('§3 · no page or module computes the event day itself — every reader asks the one clock', () => {
  const hits: string[] = [];
  for (const full of [...sources(join(WEB, 'app')), ...sources(join(WEB, 'lib')), ...sources(join(WEB, 'components'))]) {
    const rel = relative(WEB, full).split('\\').join('/');
    if (CLOCK_HOME.has(rel)) continue;
    const src = code(readFileSync(full, 'utf8'));
    for (const rule of RULES) {
      if (LEFT_ON_PURPOSE.some((l) => l.file === rel && l.rule === rule.name)) continue;
      for (const m of src.matchAll(rule.re)) {
        const line = src.slice(0, m.index).split('\n').length;
        hits.push(`${rel}:${line} — ${rule.name}: ${m[0].replace(/\s+/g, ' ').slice(0, 90)}`);
      }
    }
  }
  assert.deepEqual(hits, [], 'Ask `eventClock` (lib/event-clock.ts) — never the event day yourself:\n' + hits.join('\n'));
});

test('§3 · the guard bites on every shape it names', () => {
  const bad = [
    "getDayOfPhase(event.event_date)",
    "isEventDayActive(eventDate!)",
    "getMenuLifecyclePhase(eventDate, null)",
    "getMenuLifecyclePhase(d, c, ev.timezone ?? undefined, undefined, e)",
    "eventRow?.event_date === phTodayIso()",
    "new Date(event.event_date).getTime() < Date.now()",
  ];
  for (const b of bad) assert.ok(RULES.some((r) => new RegExp(r.re.source).test(b)), `the guard misses: ${b}`);
  const good = [
    "getDayOfPhase(event.event_date, venueTz)",
    "getDayOfPhase(event.event_date, venueTz, undefined, event.event_end_date ?? null)",
    "getMenuLifecyclePhase(eventDate, null, tz, nowMs, end)",
    "eventClockOf(event).menu",
  ];
  for (const g of good) assert.ok(!RULES.some((r) => new RegExp(r.re.source).test(g)), `the guard bites a good call: ${g}`);
});
