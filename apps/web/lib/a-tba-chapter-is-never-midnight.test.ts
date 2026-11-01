/**
 * ⏰ A TIME-TBA CHAPTER IS NEVER 12:00 AM (plan SCHEDULE_CHAPTERS_BUILD_PLAN_2026-11-01 §2 "Blank start = Time TBA",
 * §3 "Chapter time TBA = no call time"; migration 20271300482585).
 *
 * A TBA chapter keeps its DAY in `start_at` at 00:00 and sets `time_tba`. That midnight is a placeholder. A reader that
 * does not know the flag draws the chapter at 12:00 AM, makes it "now" at midnight, or hands a supplier a 12:00 AM call
 * time. Two halves:
 *
 *   1. BEHAVIOUR — the three readers named when the flag shipped (the supplier .ics, Home's now/next, booked call times)
 *      plus the Schedule PDF, fed a TBA chapter, never produce a midnight clock and never rank it by time.
 *   2. EVERY READER — a source scan of every `event_schedule_blocks` read of `start_at` under app/ and lib/. Each one must
 *      read `time_tba`, fence it out (`onlyTimedBlocks`), be a guests' read (`onlyWhatGuestsMaySee` / `is_public` — the
 *      database refuses a public TBA chapter), or carry a reasoned line in ALLOWED below. A new reader that does none of
 *      these fails here, with its file and line.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

import { timelineIcsEvents } from './supplier-timeline-ics';
import { selectSchedulePreviewBlocks, type ScheduleBlockRow } from './schedule';
import { earliestTaggedBlock } from './coordinator-broadcasts';
import { scheduleDoc } from './schedule-pdf';
import { TIME_TBA } from './schedule-chapters';
import { deriveState, deriveTriggerState } from '../app/dashboard/[eventId]/_components/day-of-mode/whats-happening-card';
import { locatePosition } from '../app/dashboard/[eventId]/_components/day-of-mode/banner';
import { upNext } from '../app/dashboard/[eventId]/_components/day-of-mode/live-schedule-card';

const DAY = '2026-12-12';
/** A TBA chapter on the day: its stored start is the placeholder midnight. */
const tba = { block_id: 'tba', label: 'Reception', start_at: `${DAY}T00:00:00+00:00`, end_at: null, location: 'Seda', time_tba: true };
const prep = { block_id: 'prep', label: 'Hair & makeup', start_at: `${DAY}T08:00:00+00:00`, end_at: `${DAY}T10:00:00+00:00`, location: 'Seda', time_tba: false };
const rites = { block_id: 'rites', label: 'Ceremony', start_at: `${DAY}T14:00:00+00:00`, end_at: `${DAY}T15:00:00+00:00`, location: 'San Vicente', time_tba: false };
/** The venue's wall clock, as `venueNowMs` hands it back: wall-clock digits in a UTC instant. */
const wall = (hhmm: string) => Date.parse(`${DAY}T${hhmm}:00Z`);

const MIDNIGHT = /12:00\s*AM|00:00|T0000/i;

test('the supplier .ics writes a TBA chapter as an all-day item "… · Time TBA", never a 00:00 time', () => {
  const lines = timelineIcsEvents([tba, prep], '20261101T000000Z');
  const ev = lines.slice(0, lines.indexOf('END:VEVENT') + 1);
  assert.ok(ev.includes('DTSTART;VALUE=DATE:20261212'), ev.join('\n'));
  assert.ok(ev.includes('DTEND;VALUE=DATE:20261213'), ev.join('\n'));
  assert.ok(ev.includes(`SUMMARY:Reception · ${TIME_TBA}`), ev.join('\n'));
  assert.ok(!ev.some((l) => l.startsWith('DTSTART;TZID=')), 'a TBA chapter must not be a timed VEVENT');
  assert.ok(!ev.some((l) => /T0000/.test(l) && !l.startsWith('DTSTAMP')), ev.join('\n'));
  // The timed moment is untouched.
  assert.ok(lines.includes('DTSTART;TZID=Asia/Manila:20261212T080000'), lines.join('\n'));
});

test("Home's schedule preview never ranks a TBA chapter by time — listed after the timed chapters, on the day too", () => {
  const rows = [tba, prep, rites].map((b, i) => ({ ...b, parent_block_id: null, sort_order: i }) as unknown as ScheduleBlockRow);
  // The night before: the TBA chapter's midnight must not put it first.
  const before = selectSchedulePreviewBlocks(rows, new Date(Date.parse(`${DAY}T00:00:00+08:00`) - 3_600_000));
  assert.deepEqual(before.display.map((b) => b.block_id), ['prep', 'rites', 'tba']);
  // On the day at 09:00 Manila: the TBA chapter has not "passed" at midnight — it is still listed.
  const during = selectSchedulePreviewBlocks(rows, new Date(`${DAY}T09:00:00+08:00`));
  assert.ok(during.display.some((b) => b.block_id === 'tba'), 'the TBA chapter dropped out at its placeholder midnight');
  assert.equal(during.display.at(-1)?.block_id, 'tba');
});

test("Home's day-of now/next: a TBA chapter is never \"now\" and never \"next\"; Up next lists it as Time TBA", () => {
  const blocks = [tba, prep, rites];
  // 00:10 — the placeholder midnight would make the TBA chapter "now" (30 minutes with no end).
  const s = deriveState(blocks, wall('00:10'));
  assert.equal(s.kind, 'between');
  assert.equal(s.kind === 'between' ? s.nextBlock.block_id : null, 'prep');
  const p = locatePosition(blocks, wall('00:10'));
  assert.equal(p.current, null);
  assert.equal(p.next?.block_id, 'prep');
  // The night before — the TBA chapter is not "next" at 12:00 AM.
  const eve = Date.parse(`2026-12-11T23:00:00Z`);
  assert.equal(locatePosition(blocks, eve).next?.block_id, 'prep');
  const e = deriveState(blocks, eve);
  assert.equal(e.kind === 'between' ? e.nextBlock.block_id : null, 'prep');
  // A host pointer on the TBA chapter is not "now" either.
  const live = deriveTriggerState([{ ...tba, run_state: 'live' as const }, { ...prep, run_state: 'upcoming' as const }], true);
  assert.notEqual(live?.kind === 'active' ? live.block.block_id : null, 'tba');
  // Up next: timed rows by time, the TBA chapter after them, unranked.
  const u = upNext(blocks, wall('00:10'));
  assert.deepEqual(u.timed.map((b) => b.block_id), ['prep', 'rites']);
  assert.deepEqual(u.tba.map((b) => b.block_id), ['tba']);
});

test('a supplier tagged on a TBA chapter has no call time from it (plan §3) — never 12:00 AM', () => {
  const meta = new Map([
    ['tba', { responsible_party: null, responsible_vendor_ids: ['v1', 'v2'] }],
    ['prep', { responsible_party: null, responsible_vendor_ids: ['v1'] }],
  ]);
  assert.equal(earliestTaggedBlock([tba, prep], meta, 'v1')?.block_id, 'prep');
  assert.equal(earliestTaggedBlock([tba, prep], meta, 'v2'), null);
});

test('the Schedule PDF prints a TBA chapter as "Time TBA", never 12:00 AM', () => {
  const doc = scheduleDoc({
    eventName: 'M & J',
    eventDate: null,
    blocks: [{ ...tba, parent_block_id: null }, { ...prep, parent_block_id: null }],
    who: new Map(),
    supplierIds: new Map(),
    generatedAt: new Date('2026-11-01T00:00:00Z'),
  });
  const reception = doc.sections.find((s) => s.title === 'Reception');
  assert.ok(reception, 'the TBA chapter is on the page');
  assert.ok(reception.aside?.includes(TIME_TBA), String(reception.aside));
  assert.doesNotMatch(JSON.stringify(reception), MIDNIGHT);
});

/* ── 2. every reader of start_at knows the flag ─────────────────────────────────────────────────────────────────── */

const WEB = path.resolve(__dirname, '..');

/** file → why it may read `start_at` without the flag. Every line is a reason, never a shrug. */
const ALLOWED: Record<string, string> = {
  'app/api/live/run-of-show/[eventId]/route.ts':
    "guests' live lines only — fenced by onlyWhatGuestsMaySee a few lines down; the database refuses a public TBA chapter",
  'lib/print-set.server.ts': "prints only what guests may see (printProgram filters is_public); a TBA chapter is never public",
  'app/dashboard/[eventId]/schedule/actions.ts': "the Schedule's own write door — #7151 set TBA there; it draws nothing",
  'app/dashboard/[eventId]/schedule/activity-picks-actions.ts': 'placement maths for a new emcee pick; it draws nothing',
  'lib/activity.ts': 'the activity feed reads created_at; start_at is selected and never drawn',
  'lib/ceremony-time.server.ts':
    "the Maker's ceremony-time door WRITES through this read — a TBA ceremony here is a write-path decision, flagged in PR",
};

function sources(dir: string, out: string[] = []): string[] {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) {
      if (e.name === 'node_modules' || e.name === '.next' || e.name === 'dev') continue;
      sources(p, out);
    } else if (/\.tsx?$/.test(e.name) && !/\.test\.tsx?$/.test(e.name)) out.push(p);
  }
  return out;
}

/** Every `event_schedule_blocks` read that SELECTS `start_at`, with the text around it. */
function startAtReads(): Array<{ file: string; line: number; around: string; cols: string }> {
  const found: Array<{ file: string; line: number; around: string; cols: string }> = [];
  for (const abs of [...sources(path.join(WEB, 'app')), ...sources(path.join(WEB, 'lib'))]) {
    const src = fs.readFileSync(abs, 'utf8');
    const file = path.relative(WEB, abs).split(path.sep).join('/');
    const needle = "from('event_schedule_blocks')";
    for (let i = src.indexOf(needle); i !== -1; i = src.indexOf(needle, i + 1)) {
      const nextFrom = src.indexOf(".from('", i + needle.length);
      const tail = src.slice(i, Math.min(i + 900, nextFrom === -1 ? Infinity : nextFrom));
      const sel = /\.select\(\s*([^)]*)\)/.exec(tail);
      if (!sel) continue; // a write that asks nothing back
      let cols = sel[1] ?? '';
      const constName = /^([A-Z_]+)\b/.exec(cols.trim())?.[1];
      if (constName) cols = new RegExp(`const ${constName}\\s*=\\s*'([^']*)'`).exec(src)?.[1] ?? cols;
      if (/^'\*'/.test(cols.trim())) cols = '*';
      if (!/start_at|\*/.test(cols)) continue;
      const selEnd = i + sel.index + sel[0].length;
      found.push({
        file,
        line: src.slice(0, i).split('\n').length,
        around: src.slice(Math.max(0, i - 400), selEnd + 300) + cols,
        cols,
      });
    }
  }
  return found;
}

test('every read of a schedule block\'s start_at reads time_tba, fences TBA out, is a guests\' read, or says why', () => {
  const reads = startAtReads();
  assert.ok(reads.length >= 20, `the scan found only ${reads.length} reads — it has stopped seeing the code`);
  const knows = /time_tba|onlyTimedBlocks\(|onlyWhatGuestsMaySee\(|\.eq\('is_public', true\)/;
  const blind = reads.filter((r) => !knows.test(r.around) && !(r.file in ALLOWED)).map((r) => `${r.file}:${r.line}`);
  assert.deepEqual(blind, [], `these read start_at and would draw a TBA chapter at 12:00 AM:\n${blind.join('\n')}`);
  // An allowance whose reader is gone is removed, never kept "just in case".
  const stale = Object.keys(ALLOWED).filter((f) => !reads.some((r) => r.file === f));
  assert.deepEqual(stale, [], `remove these ALLOWED lines, their reads are gone: ${stale.join(', ')}`);
});
