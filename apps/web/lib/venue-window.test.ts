/**
 * venue-window.test.ts — 🔒 THE VENUE WINDOW, AND BACKSTAGE INSIDE IT APPLIES AT ONCE (Unichat part F).
 *
 * Owner 2026-11-20 (DECISION_LOG "A supplier sets its own BACKSTAGE moments without the host's OK"): a supplier's own
 * backstage moment INSIDE the venue's ingress → egress window applies at once; anything guests see, and any backstage
 * time OUTSIDE the window, still waits. Auto-agree (Off by default) is unchanged.
 *
 *   1 · the window is the chapter's own four shipped facts, read as one span — never invented on a side the venue
 *       gave no time for;
 *   2 · the verdict: at once · guests see · outside · no window;
 *   3 · the server's rule on a written request (new · adjust · never a delete, never a host's ask, never a moment
 *       guests see being moved backstage);
 *   4 · the settle: with Auto-agree OFF only an exact `true` from the backstage reader applies — unread / thrown waits;
 *   5 · the wiring: the settle reads the ROWS with the service role, and the screen draws the bar and says the verdict.
 *
 * Make `backstageVerdict` return 'at_once' for the Event section and test 2 fails; drop the `!== true` guard in
 * `settleSupplierRequest` and test 4 fails.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { stripComments } from '@/lib/strip-comments';
import { settleSupplierRequest } from '@/lib/supplier-schedule';
import {
  axisEndWords,
  axisPercent,
  backstageAppliesAtOnce,
  backstageVerdict,
  insideWindow,
  venueWindowOf,
  venueWindowWords,
  windowAxis,
  windowSetByWords,
  hostsWindowWords,
  windowBands,
  type WindowChapter,
} from '@/lib/venue-window';

const WEB = join(__dirname, '..');
const read = (rel: string) => stripComments(readFileSync(join(WEB, rel), 'utf8'));
const T = (hhmm: string, day = '2026-12-18') => `${day}T${hhmm}:00.000Z`;

/** The drawing's venue: setup from 12:00 PM · event 4:00–9:30 PM · out by 11:00 PM. */
const FERNWOOD: WindowChapter = { start_at: T('16:00'), end_at: T('21:30'), time_tba: false, ingress_minutes_before: 240, egress_minutes_after: 420 };
const NO_HOURS: WindowChapter = { start_at: T('16:00'), end_at: T('21:30'), time_tba: false, ingress_minutes_before: null, egress_minutes_after: null };

test('1 · the window is the chapter’s own hours, in the drawing’s words', () => {
  const w = venueWindowOf(FERNWOOD)!;
  assert.deepEqual([w.open, w.start, w.end, w.close], [T('12:00'), T('16:00'), T('21:30'), T('23:00')]);
  assert.equal(venueWindowWords(w), 'Setup from 12:00 PM · Event 4:00–9:30 PM · Out by 11:00 PM');
  assert.equal(venueWindowOf({ ...FERNWOOD, time_tba: true }), null, 'a Time-TBA chapter drew a window');
  assert.equal(venueWindowOf({ ...FERNWOOD, start_at: null }), null);
  const bare = venueWindowOf(NO_HOURS)!;
  assert.equal(bare.hasIngress || bare.hasEgress, false);
  assert.equal(venueWindowWords(bare), 'Event 4:00–9:30 PM', 'a setup or pack-up time was invented');
  assert.equal(venueWindowWords(venueWindowOf({ ...NO_HOURS, start_at: T('11:00'), end_at: T('14:00') })!), 'Event 11:00 AM – 2:00 PM', 'across noon each clock keeps its own AM/PM');
});

test('1 · the bar: three bands in order, inside 0–100, ends in words', () => {
  const w = venueWindowOf(FERNWOOD)!;
  const axis = windowAxis(w);
  // The drawing's fixed ruler: 10 AM … midnight, whatever the hours (ruled 20 Nov).
  assert.equal(axisEndWords(axis.lo), '10 AM');
  assert.equal(axisEndWords(axis.hi), 'midnight');
  assert.deepEqual(windowAxis(w, [T('08:00'), T('23:30')]), axis, 'a moment moved the fixed axis');
  const early = venueWindowOf({ ...FERNWOOD, start_at: T('09:00'), end_at: T('11:00'), ingress_minutes_before: 150, egress_minutes_after: null })!;
  assert.equal(axisEndWords(windowAxis(early).lo), '6 AM', 'a window before 10 AM was cut off');
  const bands = windowBands(w, axis);
  assert.deepEqual(bands.map((b) => b.kind), ['ingress', 'event', 'egress']);
  for (const b of bands) assert.ok(b.left >= 0 && b.width > 0 && b.left + b.width <= 100.0001, `band ${b.kind} off the bar`);
  assert.ok(Math.abs(bands[0]!.left + bands[0]!.width - bands[1]!.left) < 0.001, 'setup and event do not meet');
  assert.ok(axisPercent(axis, T('12:00')) < axisPercent(axis, T('16:00')));
  assert.deepEqual(windowBands(venueWindowOf(NO_HOURS)!, windowAxis(venueWindowOf(NO_HOURS)!)).map((b) => b.kind), ['event']);
});

test('2 · the verdict for a supplier’s own moment', () => {
  assert.equal(backstageVerdict(FERNWOOD, T('12:00'), T('12:30')), 'at_once', 'crew call at the venue’s opening');
  assert.equal(backstageVerdict(FERNWOOD, T('15:30'), T('16:00')), 'at_once', 'sound check before the event');
  assert.equal(backstageVerdict(FERNWOOD, T('22:00'), T('22:30')), 'at_once', 'pull-out inside egress');
  assert.equal(backstageVerdict(FERNWOOD, T('16:00'), T('16:30')), 'guests_see', 'a moment at the event’s start is the programme');
  assert.equal(backstageVerdict(FERNWOOD, T('19:00'), null), 'guests_see');
  assert.equal(backstageVerdict(FERNWOOD, T('11:30'), T('12:00')), 'outside', 'before the venue opens');
  assert.equal(backstageVerdict(FERNWOOD, T('22:45'), T('23:30')), 'outside', 'it ends after everybody must be out');
  assert.equal(backstageVerdict(FERNWOOD, T('23:30'), null), 'outside');
  assert.equal(backstageVerdict(NO_HOURS, T('15:00'), null), 'outside', 'no setup time set is no setup window to be inside');
  assert.equal(backstageVerdict(NO_HOURS, T('22:00'), null), 'outside');
  assert.equal(backstageVerdict({ ...FERNWOOD, time_tba: true }, T('12:00'), null), 'no_window');
  assert.equal(backstageVerdict(FERNWOOD, null), 'no_window');
  assert.equal(insideWindow(venueWindowOf(FERNWOOD)!, T('12:00')), true);
});

test('3 · the server’s rule on a written request', () => {
  const req = (over: Partial<Parameters<typeof backstageAppliesAtOnce>[0]['request']>) => ({
    kind: 'new',
    direction: 'to_host',
    proposed_start_at: T('12:00'),
    proposed_end_at: T('12:30'),
    ...over,
  });
  assert.equal(backstageAppliesAtOnce({ request: req({}), chapter: FERNWOOD }), true);
  assert.equal(backstageAppliesAtOnce({ request: req({ proposed_start_at: T('17:00'), proposed_end_at: T('17:30') }), chapter: FERNWOOD }), false, 'a moment guests see went straight in');
  assert.equal(backstageAppliesAtOnce({ request: req({ proposed_start_at: T('10:00'), proposed_end_at: T('10:30') }), chapter: FERNWOOD }), false, 'outside the hours went straight in');
  assert.equal(backstageAppliesAtOnce({ request: req({ proposed_start_at: null, proposed_end_at: null }), chapter: FERNWOOD }), false, 'a new moment with no time went straight in');
  assert.equal(backstageAppliesAtOnce({ request: req({}), chapter: null }), false);
  assert.equal(backstageAppliesAtOnce({ request: req({ kind: 'remove' }), chapter: FERNWOOD, current: { start_at: T('12:00'), end_at: T('12:30') } }), false, 'a delete went straight in');
  assert.equal(backstageAppliesAtOnce({ request: req({ kind: 'hours' }), chapter: FERNWOOD }), false);
  assert.equal(backstageAppliesAtOnce({ request: req({ direction: 'to_supplier', kind: 'adjust' }), chapter: FERNWOOD, current: { start_at: T('12:00'), end_at: null } }), false, 'a host’s ask applied itself');

  const sound = { start_at: T('15:30'), end_at: T('16:00') };
  assert.equal(backstageAppliesAtOnce({ request: req({ kind: 'adjust', proposed_start_at: T('15:00'), proposed_end_at: T('15:30') }), chapter: FERNWOOD, current: sound }), true);
  assert.equal(backstageAppliesAtOnce({ request: req({ kind: 'adjust', proposed_start_at: null, proposed_end_at: null }), chapter: FERNWOOD, current: sound }), true, 'a crew or name change on a backstage moment waits');
  assert.equal(backstageAppliesAtOnce({ request: req({ kind: 'adjust', proposed_start_at: T('16:30'), proposed_end_at: T('17:00') }), chapter: FERNWOOD, current: sound }), false, 'backstage moved INTO the programme went straight in');
  assert.equal(
    backstageAppliesAtOnce({ request: req({ kind: 'adjust', proposed_start_at: T('15:00'), proposed_end_at: T('15:30') }), chapter: FERNWOOD, current: { start_at: T('17:00'), end_at: T('17:30') } }),
    false,
    'a moment guests see was moved backstage without the host',
  );
  assert.equal(backstageAppliesAtOnce({ request: req({ kind: 'adjust' }), chapter: FERNWOOD, current: null }), false, 'an adjust of a moment that could not be read went straight in');
});

test('4 · Auto-agree OFF: only an exact true from the backstage reader applies', async () => {
  let calls = 0;
  const apply = async () => {
    calls += 1;
    return 'applied' as const;
  };
  const off = async () => false;
  assert.equal(await settleSupplierRequest(off, apply, async () => true), 'applied');
  assert.equal(calls, 1);
  assert.equal(await settleSupplierRequest(off, apply, async () => false), 'waits');
  assert.equal(await settleSupplierRequest(off, apply, async () => null), 'waits');
  assert.equal(
    await settleSupplierRequest(off, apply, async () => {
      throw new Error('read refused');
    }),
    'waits',
  );
  assert.equal(await settleSupplierRequest(off, apply), 'waits');
  assert.equal(await settleSupplierRequest(async () => null, apply, async () => false), 'waits');
  assert.equal(calls, 1, 'an unread or refused backstage check let a change in');
  // Auto-agree ON is the host's own choice: the backstage reader is not even asked.
  let asked = 0;
  assert.equal(
    await settleSupplierRequest(async () => true, apply, async () => {
      asked += 1;
      return false;
    }),
    'applied',
  );
  assert.equal(asked, 0);
});

test('5 · the wiring: rows decide on the server; the screen draws the bar and says the verdict', () => {
  const decide = read('lib/schedule-suggestion-decide.server.ts');
  const settleFn = decide.slice(decide.indexOf('export async function settleAfterAsking'));
  assert.match(settleFn, /readBackstageInWindow\(admin, eventId, suggestionId\)/, 'the backstage rule is not read by the settle');
  const reader = decide.slice(decide.indexOf('async function readBackstageInWindow'));
  // Since the finish build the DATABASE decides (`schedule_request_goes_in_at_once`, held by
  // tests/db/backstage-in-the-window-goes-in-at-once.db.test.ts); the server asks it and a refused read waits.
  assert.match(reader, /admin\.rpc\('schedule_request_goes_in_at_once', \{ p_suggestion_id: suggestionId \}\)/, 'the settle no longer asks the database for the verdict');
  assert.match(reader, /if \(error\) \{[\s\S]*?return false;/, 'a refused verdict could let the change in');
  assert.match(reader, /return data === true;/, 'anything but a plain yes could let the change in');

  const action = read('app/vendor-dashboard/clients/[eventId]/actions.ts');
  assert.match(action, /if \(why\.backstage\) \{[\s\S]*?backstageSetLine\([\s\S]*?return \{ ok: true, outcome \};/, 'a backstage set does not post its quiet line');
  const backstageBranch = action.slice(action.indexOf('if (why.backstage) {'));
  assert.doesNotMatch(backstageBranch.slice(0, backstageBranch.indexOf('return { ok: true, outcome };')), /notifyScheduleRequest\(/, 'the quiet line sends the emailed request notice');

  const view = read('app/vendor-dashboard/clients/[eventId]/_components/supplier-schedule.tsx');
  assert.match(view, /<ChapterWindow c=\{c\} \/>/, 'the chapter does not draw its venue window');
  assert.match(view, /<VenueWindowBar window=\{venueWin\} live=\{startIso\}/, 'the moment sheet does not show the typed time on the bar');
  assert.match(view, /atOnce \? 'Set my moment' : 'Ask the host'/, 'the sheet does not say which of the two will happen');
  assert.match(view, /data-outside-venue-hours/, 'a moment outside the hours is not marked');
});

test('5 · who set the window: the venue by name, confirmed by the hosts — never a blank name', () => {
  assert.equal(windowSetByWords('Fernwood Gardens'), 'Set by Fernwood Gardens · confirmed by the hosts');
  assert.equal(windowSetByWords(undefined), 'Set by the venue · confirmed by the hosts', 'an unread name was drawn blank');
  assert.equal(windowSetByWords(null), 'Set by the hosts');
});

test('6 · the hosts read who set it AND who changes it (drawing, hosts side)', () => {
  assert.equal(
    hostsWindowWords('Fernwood Gardens'),
    'Set by Fernwood Gardens · confirmed by the hosts. Fernwood Gardens sets these on its card; you confirm on the event Schedule.',
  );
  assert.equal(hostsWindowWords(undefined), 'Set by the venue · confirmed by the hosts. The venue sets these on its card; you confirm on the event Schedule.');
  assert.equal(hostsWindowWords(null), 'Set by the hosts', 'a chapter the hosts hold grew a venue sentence');
});
