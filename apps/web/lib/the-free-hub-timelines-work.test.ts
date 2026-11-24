/**
 * 🕒 THE FREE HUB TIMELINES WORK (DECISION_LOG "Seven open calls settled" item 3 — the free rest, part 2 of 2;
 * controller OK 24 Nov): Pick-up times & routes · Itinerary · Serving times · Remembrance schedule · March cue sheet ·
 * Rehearsal & cues · Reveal cue (live timeline) and the Wellness plan (plan — dated sessions).
 *
 * Same shape as part 1: ONE table (`vendor_hub_tool_entries`), ONE reader (`readHubToolEntries`), ONE writer
 * (`hubToolEntry`) — no new table, no new action, no migration. Controller, 24 Nov:
 *   · a timeline row keeps the MINUTE OF THE DAY in `qty`, and ONE helper reads it — never the raw `qty` as a time;
 *   · the Wellness plan is dates and plain activity words only — no health or medical field;
 *   · Insured people list and Incident log stay held (the owner's privacy picks); Photo upload and Photo delivery wait
 *     for a later batch.
 * The tests EXECUTE the pure halves and read the source only for wiring a test cannot run without a database.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  dayQty,
  entryTemplateOf,
  hhmmOf,
  minuteQty,
  parseHubToolEntryOp,
  rowDay,
  rowDayNumber,
  rowMinute,
  runningOrder,
  type HubToolEntry,
} from './hub-tool-entries';
import { HUB_TOOL_LIBRARY } from './hub-tools';
import { DAY_OF_MODULES } from './vendor-dayof-modules';
import { dayOfModuleHref } from './vendor-dayof-module-href';

const TIMELINES = [
  'pick_up_times_and_routes',
  'itinerary',
  'serving_times',
  'remembrance_schedule',
  'march_cue_sheet',
  'rehearsal_and_cues',
  'reveal_cue',
] as const;
const EIGHT = [...TIMELINES, 'wellness_plan'] as const;
const HELD = ['insured_people_list', 'incident_log', 'photo_upload', 'photo_delivery'] as const;
const web = (p: string) => readFileSync(join(__dirname, '..', p), 'utf8');
const VIEW = 'app/vendor-dashboard/on-the-day/live/[eventId]/_components/hub-tools/hub-tool-panels-view.tsx';
const TOOLS = 'app/vendor-dashboard/on-the-day/live/[eventId]/_components/hub-tools/entry-tools.tsx';

const row = (id: string, qty: number, done = false): HubToolEntry => ({ id, label: id, note: '', done, qty });

test('the eight are shipped on their library templates; the four held tools stay held', () => {
  for (const key of EIGHT) {
    const t = HUB_TOOL_LIBRARY.find((x) => x.key === key);
    assert.ok(t, `${key} is not in the library`);
    assert.equal(t.shipped, true, `${key} is not marked shipped`);
    assert.equal(t.template, key === 'wellness_plan' ? 'plan' : 'live_timeline', `${key} is on the wrong template`);
  }
  for (const key of HELD) {
    assert.ok(!DAY_OF_MODULES.some((m) => (m.id as string) === key || m.hubTool === key), `${key} is held — no switch on the Hub`);
    assert.equal(parseHubToolEntryOp({ op: 'add', toolKey: key, label: 'x', qty: 600 }).ok, false, `${key} is held — the writer refuses it`);
  }
});

test('each of the eight is a day-of module any shop may switch on, drawn inline, on for nobody by family', () => {
  for (const key of EIGHT) {
    const m = DAY_OF_MODULES.find((x) => x.id === key);
    assert.ok(m, `${key} has no day-of module — a shipped tool nobody can switch on`);
    assert.equal(m.hubTool, key);
    assert.equal(m.alwaysAvailable, true, `${key}: categories suggest, never gate`);
    assert.deepEqual(m.defaultOnFor, [], `${key}: the category switches suggest it, not a family`);
    assert.equal(dayOfModuleHref(key, 'e1'), null, `${key} is drawn inline, never a link row`);
  }
});

test('ONE helper reads qty as a time: the minute of the day, the clock as typed — never midnight by accident', () => {
  assert.equal(minuteQty('14:05'), 845);
  assert.equal(minuteQty('00:00'), 0);
  assert.equal(minuteQty('23:59'), 1439);
  assert.equal(minuteQty('24:00'), null);
  assert.equal(minuteQty('7:5'), null);
  assert.equal(minuteQty('soon'), null);
  assert.equal(hhmmOf(845), '14:05');
  assert.equal(hhmmOf(0), '00:00');
  assert.equal(hhmmOf(1440), '', 'a number that is not a minute of the day reads as no time');
  assert.equal(rowMinute(1439), 1439);
  assert.equal(rowMinute(1440), null);
  assert.equal(rowMinute(-1), null);
  assert.equal(rowMinute(12.5), null);
  for (const hhmm of ['00:00', '06:30', '12:00', '18:45', '23:59']) assert.equal(hhmmOf(minuteQty(hhmm)), hhmm, hhmm);
});

test('…and as a day: the calendar day, no zone — a day that does not exist is refused', () => {
  const n = dayQty('2026-11-28');
  assert.ok(n !== null && n > 20000);
  assert.equal(rowDay(n), '2026-11-28');
  assert.equal(dayQty('2026-02-30'), null);
  assert.equal(dayQty('28/11/2026'), null);
  assert.equal(rowDay(-1), null);
  assert.equal(rowDayNumber(n!), n);
  for (const d of ['2024-02-29', '2026-01-01', '2026-12-31']) assert.equal(rowDay(dayQty(d)), d, d);
});

test('ONE home: the writer takes each timeline row WITH its time, the Wellness plan WITH its date and no note', () => {
  for (const key of TIMELINES) {
    assert.equal(entryTemplateOf(key), 'live_timeline', key);
    const ok = parseHubToolEntryOp({ op: 'add', toolKey: key, label: '  Bride  · Hotel → Church ', note: ' Car 1 ', qty: 840 });
    assert.ok(ok.ok && ok.op.op === 'add', `${key}: the writer refuses its rows`);
    if (ok.ok && ok.op.op === 'add') {
      assert.equal(ok.op.label, 'Bride · Hotel → Church');
      assert.equal(ok.op.note, 'Car 1');
      assert.equal(ok.op.qty, 840);
    }
    const none = parseHubToolEntryOp({ op: 'add', toolKey: key, label: 'x' });
    assert.deepEqual(none, { ok: false, error: 'Pick a time first.' }, `${key}: a row with no time is refused`);
    assert.equal(parseHubToolEntryOp({ op: 'add', toolKey: key, label: 'x', qty: 1440 }).ok, false, `${key}: not a minute of the day`);
  }
  assert.equal(entryTemplateOf('wellness_plan'), 'plan');
  const day = dayQty('2026-11-28')!;
  const w = parseHubToolEntryOp({ op: 'add', toolKey: 'wellness_plan', label: 'Pilates session', note: 'anything typed here', qty: day });
  assert.ok(w.ok && w.op.op === 'add');
  if (w.ok && w.op.op === 'add') {
    assert.equal(w.op.qty, day);
    assert.equal(w.op.note, null, 'dates and plain activity words only — no note, no health field');
  }
  assert.deepEqual(parseHubToolEntryOp({ op: 'add', toolKey: 'wellness_plan', label: 'Pilates' }), { ok: false, error: 'Pick a date first.' });
});

test('the timelines that run on the couple’s own program, and the seat plans, keep no rows here', () => {
  for (const key of ['run_of_show', 'floor_command', 'march', 'emcee_script', 'floor_plan', 'tables_and_seating']) {
    assert.equal(entryTemplateOf(key), null, `${key} is read, never typed into this table`);
    assert.equal(parseHubToolEntryOp({ op: 'add', toolKey: key, label: 'x', qty: 600 }).ok, false, key);
  }
});

test('RUNNING ORDER: rows by time, a tie in the order added, no time last; NOW is the first not done', () => {
  const rows = [row('c', 900), row('a', 600, true), row('none', 5000), row('b', 720), row('b2', 720)];
  const run = runningOrder(rows, rowMinute);
  assert.deepEqual(run.rows.map((r) => r.entry.id), ['a', 'b', 'b2', 'c', 'none']);
  assert.equal(run.nowId, 'b');
  assert.deepEqual(run.rows.filter((r) => r.now).map((r) => r.entry.id), ['b']);
  assert.equal(run.rows.find((r) => r.entry.id === 'none')?.when, null);
  assert.deepEqual([run.done, run.total], [1, 5]);
  const allDone = runningOrder([row('x', 1, true)], rowMinute);
  assert.equal(allDone.nowId, null, 'every row done → no NOW row');
  const plan = runningOrder([row('late', dayQty('2026-12-05')!), row('early', dayQty('2026-11-28')!)], rowDayNumber);
  assert.deepEqual(plan.rows.map((r) => r.entry.id), ['early', 'late']);
});

test('the view draws each by its template; the timeline’s Next › and Back are ticks; no raw qty is read as a time', () => {
  const view = web(VIEW);
  for (const key of EIGHT) {
    assert.match(view, new RegExp(`\\n  ${key}: \\{\\n    first: '`), `${key}: no add-box words`);
    assert.match(view, new RegExp(`\\n  ${key}: [A-Z][A-Za-z0-9]+,`), `${key}: no mark`);
  }
  assert.match(view, /template === 'live_timeline'\) \{\s*body = \(\s*<LiveTimelineTool/);
  assert.match(view, /template === 'plan'\) \{\s*body = \(\s*<DatedPlanTool/);
  assert.doesNotMatch(view.slice(view.indexOf('wellness_plan: {'), view.indexOf('},', view.indexOf('wellness_plan: {'))), /second:/, 'the Wellness plan asks no second line');

  const tools = web(TOOLS);
  const timed = tools.slice(tools.indexOf('export function LiveTimelineTool'));
  assert.match(timed, /onClick=\{\(\) => now && tick\(now, true\)\}/, 'Next › ticks the NOW row');
  assert.match(timed, /onClick=\{\(\) => lastDone && tick\(lastDone, false\)\}/, 'Back un-ticks the last done row');
  assert.match(timed, /const tick = \(row: HubToolEntry, done: boolean\) => patch\(row\.id, \{ done \}, \{ op: 'tick', done \}\);/);
  assert.match(timed, /runningOrder\(rows, rowMinute\)/);
  assert.match(timed, /runningOrder\(rows, rowDayNumber\)/);
  // Every `.qty` the two timed tools touch goes through a helper.
  const raw = [...timed.matchAll(/[\w)\]]\.qty\b/g)].map((m) => timed.slice(Math.max(0, m.index! - 8), m.index! + 6));
  assert.deepEqual(raw.filter((s) => !/(hhmmOf|rowDay)\(r\.qty/.test(s)), [], 'a raw qty read in the timed tools');
});
