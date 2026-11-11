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
import { createRequire } from 'node:module';

import { timelineIcsEvents } from './supplier-timeline-ics';
import { selectSchedulePreviewBlocks, type ScheduleBlockRow } from './schedule';
import { earliestTaggedBlock } from './coordinator-broadcasts';
import { scheduleDoc } from './schedule-pdf';
import { TIME_TBA } from './schedule-chapters';
import { deriveState, deriveTriggerState } from '../app/dashboard/[eventId]/_components/day-of-mode/whats-happening-card';
import { locatePosition } from '../app/dashboard/[eventId]/_components/day-of-mode/banner';
import { upNext } from '../app/dashboard/[eventId]/_components/day-of-mode/live-schedule-card';
import { blockTime } from './print-pieces';
import { blocksWithDraftedCeremony, ceremonyTimeBox } from './ceremony-time';
import { computeRetimePatches } from './schedule-ros';
// The ONE chapter engine's day split (lib/papic-chapters.ts, 2026-11-01 "groupIntoChapters (two copies → one)").
import { chapterDays as groupIntoChapters } from './papic-chapters';
import { guestsArriveSource, guestsMoments } from './guests-arrive';

/* `server-only` shim (the pattern of a-dark-look-keeps-its-words.test.ts) — so the REAL Maker ceremony door is measured. */
type CjsModuleCtor = {
  _resolveFilename: (request: string, ...rest: unknown[]) => string;
  _cache: Record<string, unknown>;
  new (id: string): { filename: string; loaded: boolean; exports: unknown; paths: string[] };
};
const CjsModule = (createRequire(__filename)('node:module') as { Module: CjsModuleCtor }).Module;
const SERVER_ONLY_STUB = path.join(process.cwd(), '__server_only_stub_tba_never_midnight__.js');
{
  const stub = new CjsModule(SERVER_ONLY_STUB);
  stub.filename = SERVER_ONLY_STUB;
  stub.loaded = true;
  stub.exports = {};
  stub.paths = [];
  CjsModule._cache[SERVER_ONLY_STUB] = stub;
  const original = CjsModule._resolveFilename;
  CjsModule._resolveFilename = function (request: string, ...rest: unknown[]) {
    if (request === 'server-only') return SERVER_ONLY_STUB;
    return original.call(this, request, ...rest);
  };
}
const { readLiveCeremony, readLiveCeremonyTime, placeCeremonyBlock } = require('./ceremony-time.server') as typeof import('./ceremony-time.server');

const DAY = '2026-12-12';
const WEB_ROOT = path.resolve(__dirname, '..');
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

/* ── 1b. the Maker's ceremony-time box (controller 2026-11-02, follow-up to #7158) ──────────────────────────────── */

/** A Supabase stand-in for `event_schedule_blocks`: reads return `rows`; every write is recorded and answered with one row. */
function fakeSchedule(rows: Array<Record<string, unknown>>) {
  const writes: Array<{ op: 'update' | 'insert'; payload: Record<string, unknown> }> = [];
  const chain = (result: () => unknown): unknown =>
    new Proxy(() => undefined, {
      get(_t, key) {
        if (key === 'then') return (res: (v: unknown) => unknown) => res(result());
        return () => chain(result);
      },
    });
  const supabase = {
    from: () => ({
      select: () => chain(() => ({ data: rows, error: null })),
      update: (payload: Record<string, unknown>) => {
        writes.push({ op: 'update', payload });
        return chain(() => ({ data: [{ block_id: 'x' }], error: null }));
      },
      insert: (payload: Record<string, unknown>) => {
        writes.push({ op: 'insert', payload });
        return chain(() => ({ data: [{ block_id: 'x' }], error: null }));
      },
    }),
  };
  return { supabase: supabase as never, writes };
}

const tbaCeremony = { block_id: 'c', block_type: 'ceremony', start_at: `${DAY}T00:00:00+00:00`, end_at: null, parent_block_id: null, time_tba: true };

test("the Maker's ceremony-time box reads a TBA ceremony as \"Time TBA\" with an EMPTY box — never 00:00", async () => {
  const { supabase } = fakeSchedule([tbaCeremony]);
  assert.deepEqual(await readLiveCeremony(supabase, 'e'), { time: null, tba: true });
  assert.equal(await readLiveCeremonyTime(supabase, 'e'), null);
  // The box: TBA and empty while nothing is drafted; a typed (drafted) time is shown as typed.
  assert.deepEqual(ceremonyTimeBox(undefined, { time: null, tba: true }), { time: null, tba: true });
  assert.deepEqual(ceremonyTimeBox('15:00', { time: null, tba: true }), { time: '15:00', tba: false });
  // The editor is handed the TBA and says it (wiring, load → parts → editor).
  const load = fs.readFileSync(path.join(WEB_ROOT, 'app/dashboard/[eventId]/launch/_components/details-your-event-load.tsx'), 'utf8');
  assert.match(load, /ceremonyTimeBox\(/);
  const editor = fs.readFileSync(path.join(WEB_ROOT, 'app/dashboard/[eventId]/launch/_components/details-your-event.tsx'), 'utf8');
  assert.match(editor, /<CeremonyTimeEditor[^>]*\btba=\{ceremonyTba\}/);
  assert.match(editor, /tba && !time \? [^:]*\{TIME_TBA\}/);
});

test('Apply NEVER writes 00:00 for a TBA ceremony; a typed time is written and clears time_tba', async () => {
  // The date moved, no time typed: nothing is written (the whole-Schedule move is moveScheduleWithDate's job).
  const quiet = fakeSchedule([tbaCeremony]);
  assert.deepEqual(await placeCeremonyBlock({ supabase: quiet.supabase, eventId: 'e', day: '2026-12-19', time: null, fromDay: DAY }), { ok: true, wrote: 'none' });
  assert.deepEqual(quiet.writes, []);
  // A typed time: the ceremony takes it and stops being TBA — and the placeholder is never kept.
  const typed = fakeSchedule([tbaCeremony]);
  assert.deepEqual(await placeCeremonyBlock({ supabase: typed.supabase, eventId: 'e', day: DAY, time: '15:00' }), { ok: true, wrote: 'moved' });
  assert.equal(typed.writes.length, 1, JSON.stringify(typed.writes));
  const w = typed.writes[0]!.payload;
  assert.equal(w.time_tba, false);
  assert.match(String(w.start_at), /T15:00/);
  assert.equal(w.end_at, null);
  // A typed 00:00 on a TBA ceremony is a real midnight the host chose — it still clears the flag (a write, not a no-op).
  const midnight = fakeSchedule([tbaCeremony]);
  await placeCeremonyBlock({ supabase: midnight.supabase, eventId: 'e', day: DAY, time: '00:00' });
  assert.equal(midnight.writes[0]?.payload.time_tba, false);
  // The preview lays a typed time over it the same way.
  const shown = blocksWithDraftedCeremony([{ ...tbaCeremony, label: 'Ceremony' }], '15:00', DAY);
  assert.equal(blockTime(shown[0]!), '3:00 PM');
});

test('a TBA chapter prints "Time TBA" where a ceremony/reception time is read (Details › Ceremony row), never 12:00 AM', () => {
  assert.equal(blockTime({ ...tba, block_type: 'reception', parent_block_id: null }), TIME_TBA);
  assert.equal(blockTime({ ...tbaCeremony }), TIME_TBA);
  assert.equal(blockTime(prep), '8:00 AM');
});

/* ── 1c. the on-the-day and photo screens #7158 left (floor retime · Memories' photo windows · mood board) ────────── */

test('the floor command (and every bulk retime) never shifts a TBA chapter, and cannot shift FROM one', () => {
  const rows = [tba, prep, rites].map((b, i) => ({ ...b, parent_block_id: null, sort_order: i }));
  // From the TBA chapter: nothing — "+15" would have turned its placeholder into 12:15 AM and dragged the day along.
  assert.deepEqual(computeRetimePatches(rows, 'tba', 15), []);
  // From a timed chapter: the timed ones move; the TBA chapter is never in the span (also with a negative shift).
  assert.deepEqual(computeRetimePatches(rows, 'prep', 15).map((p) => p.block_id), ['prep', 'rites']);
  assert.ok(!computeRetimePatches(rows, 'prep', -15).some((p) => p.block_id === 'tba'));
  // The floor's +N became "Change the schedule" (owner 2026-11-04); both its doors (floor + crew phone) write through
  // `lib/change-the-schedule.server.ts`, so that is where the TBA chapter is refused — and said.
  const floor = fs.readFileSync(path.join(WEB_ROOT, 'lib/change-the-schedule.server.ts'), 'utf8');
  assert.match(floor, /isTimeTba\(fromTop\)/, 'the floor says why a TBA chapter cannot be delayed from');
  assert.match(floor, /\.filter\(\(b\) => !isTimeTba\(b\)\)/, 'a move from a timed part carries a TBA chapter along');
});

test("Memories' photo windows leave a TBA chapter out — it never claims the photos from midnight on", () => {
  const frames = [
    { id: 'early', capturedAt: `${DAY}T01:30:00+08:00` },
    { id: 'hmu', capturedAt: `${DAY}T08:30:00+08:00` },
  ];
  const blocks = [
    { blockId: 'tba', label: 'Reception', startAt: tba.start_at, endAt: null, timeTba: true },
    { blockId: 'prep', label: 'Hair & makeup', startAt: prep.start_at, endAt: prep.end_at },
  ];
  const chapters = groupIntoChapters({ frames, blocks, tz: 'Asia/Manila' }).days.flatMap((d) => d.chapters);
  assert.ok(!chapters.some((c) => c.key === 'tba'), JSON.stringify(chapters.map((c) => [c.key, c.frames.map((f) => f.id)])));
  assert.deepEqual(chapters.find((c) => c.key === 'prep')?.frames.map((f) => f.id), ['hmu']);
  // A TBA chapter that REALLY ran has real instants — those still make its window.
  const ran = groupIntoChapters({
    frames,
    blocks: [{ ...blocks[0]!, actualStartAt: `${DAY}T01:00:00+08:00`, actualEndAt: `${DAY}T02:00:00+08:00` }, blocks[1]!],
    tz: 'Asia/Manila',
  }).days.flatMap((d) => d.chapters);
  assert.deepEqual(ran.find((c) => c.key === 'tba')?.frames.map((f) => f.id), ['early']);
  // Both photo readers hand the flag over.
  for (const rel of ['app/dashboard/(account)/library/_components/memories-segment.tsx', 'lib/event-memories.server.ts']) {
    assert.match(fs.readFileSync(path.join(WEB_ROOT, rel), 'utf8'), /timeTba: b\.time_tba === true/, rel);
  }
});

test("the mood board's guests' time never reads a TBA chapter (\"Guests arrive 12:00 AM\")", () => {
  const row = (b: { block_id: string; label: string; start_at: string; end_at: string | null; time_tba: boolean }, extra: Record<string, unknown> = {}) => ({
    block_id: b.block_id, label: b.label, block_type: 'pre_ceremony', start_at: b.start_at, end_at: b.end_at, is_public: true, sort_order: 0, parent_block_id: null, audience: null, time_tba: b.time_tba, ...extra,
  });
  // Even a public-looking TBA row (the database refuses one) is never the guests' first moment.
  const blocks = [row(tba), row(rites, { block_type: 'ceremony' })];
  assert.deepEqual(guestsMoments(blocks).map((b) => b.block_id), ['rites']);
  assert.equal(guestsArriveSource(blocks)?.moment.block_id, 'rites');
  const editor = fs.readFileSync(path.join(WEB_ROOT, 'app/dashboard/[eventId]/studio/mood-board/_components/mood-board-editor.tsx'), 'utf8');
  assert.match(editor, /time_tba: b\.time_tba === true/, 'the mood board hands the flag to the guests\' time');
});

/* ── 2. every reader of start_at knows the flag ─────────────────────────────────────────────────────────────────── */

const WEB = path.resolve(__dirname, '..');

/** file → why it may read `start_at` without the flag. Every line is a reason, never a shrug. */
const ALLOWED: Record<string, string> = {
  'app/admin/events/[eventId]/page.tsx':
    "Admin › Suppliers' schedule names each supplier's chapters (Where); start_at only orders the names — no clock is drawn",
  'app/api/live/run-of-show/[eventId]/route.ts':
    "guests' live lines only — fenced by onlyWhatGuestsMaySee a few lines down; the database refuses a public TBA chapter",
  'app/dashboard/[eventId]/schedule/actions.ts': "the Schedule's own write door — #7151 set TBA there; it draws nothing",
  'app/dashboard/[eventId]/schedule/activity-picks-actions.ts': 'placement maths for a new emcee pick; it draws nothing',
  'lib/activity.ts': 'the activity feed reads created_at; start_at is selected and never drawn',
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

/* ── 3. every caller of fetchScheduleBlocks knows the flag ──────────────────────────────────────────────────────────
   `fetchScheduleBlocks` hands back every row, Time-TBA chapters included (its select carries `time_tba`), so the scan
   above passes it — and the placeholder midnight reaches whoever calls it. #7158 found three such callers by hand (the
   floor retime, Memories' photo windows, the mood board). This holds every caller: it reads the flag, or says why. */

/** file → why it may call `fetchScheduleBlocks` without reading the flag itself. */
const FETCH_ALLOWED: Record<string, string> = {
  'app/dashboard/[eventId]/_actions/day-of-broadcast.ts':
    'call times only, through deriveVendorCallTimes → earliestTaggedBlock, which skips a TBA chapter (tested above)',
  'app/api/schedule/[eventId]/export/route.ts': 'hands the rows to scheduleDoc, which prints "Time TBA" (tested above)',
  'app/dashboard/[eventId]/details/page.tsx':
    'its Ceremony/Reception rows read blockTime, which says "Time TBA"; Guests arrive reads guestsArriveSource, fenced (both tested above)',
  'lib/event-preload.ts':
    'copies whole rows (time_tba included) into the offline event-day cache and draws nothing; the offline readers are NOT audited here — flagged in the PR',
};

test('every caller of fetchScheduleBlocks reads time_tba, or says why it need not', () => {
  const callers = [...sources(path.join(WEB, 'app')), ...sources(path.join(WEB, 'lib'))]
    .map((abs) => ({ file: path.relative(WEB, abs).split(path.sep).join('/'), src: fs.readFileSync(abs, 'utf8') }))
    .filter((f) => /\bfetchScheduleBlocks\(/.test(f.src) && f.file !== 'lib/schedule.ts');
  assert.ok(callers.length >= 10, `the scan found only ${callers.length} callers — it has stopped seeing the code`);
  const knows = /time_tba|timeTba|isTimeTba\(|onlyTimedBlocks\(/;
  const blind = callers.filter((f) => !knows.test(f.src) && !(f.file in FETCH_ALLOWED)).map((f) => f.file);
  assert.deepEqual(blind, [], `these call fetchScheduleBlocks and never ask whether a chapter's time is TBA:\n${blind.join('\n')}`);
  const stale = Object.keys(FETCH_ALLOWED).filter((f) => !callers.some((c) => c.file === f && !knows.test(c.src)));
  assert.deepEqual(stale, [], `remove these FETCH_ALLOWED lines — the caller is gone or now reads the flag: ${stale.join(', ')}`);
});
