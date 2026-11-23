/**
 * 📏 THE STORAGE METER'S RECORDS ARE MEASURED ONCE A NIGHT, WITH NO SCHEDULER — AND THE METER SAYS HOW CURRENT THEY ARE.
 *
 * PR #8191 follow-up (Ship FIX-FIRST, 23 Nov):
 *   · the repo has no scheduler and prod's cron.job is EMPTY by decision, so the migration schedules nothing; the
 *     measure (`supplier_storage_measure_records(NULL)`) is a claimed periodic job on request traffic, once per
 *     Manila night from 03:00, catching up on the next request after a quiet night, never twice in one night;
 *   · a Records size never measured is not "0 KB", and an old one says how old it is
 *     (the honest-read pattern of lib/guests-read-is-honest.test.ts: the measurement must reach the render).
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

// The meter is written for the automatic JSX runtime; under the test runner's classic transform its JSX reads the
// global `React` (the same shim as the other render tests).
(globalThis as { React?: typeof React }).React = React;
import { stripComments } from './strip-comments';
import {
  RECORDS_STALE_AFTER_MS,
  recordsMeasure,
  recordsMeasureClaimGapMs,
  recordsMeasureWindowOpenedMs,
  type StorageBreakdownRead,
} from './supplier-storage';
import { PERIODIC_JOBS } from './periodic-job-registry';
import { StorageMeter } from '../app/vendor-dashboard/subscription/_components/storage-meter';

const HOUR = 3_600_000;
const MIN = 60_000;
const ROOT = join(__dirname, '..', '..', '..');

// ── The window ───────────────────────────────────────────────────────────────

test('the window opens at 03:00 Manila (19:00 UTC the day before) and lasts until the next 03:00', () => {
  const at = (iso: string) => recordsMeasureWindowOpenedMs(Date.parse(iso));
  assert.equal(new Date(at('2026-11-23T19:00:00Z')).toISOString(), '2026-11-23T19:00:00.000Z', '03:00 Manila opens it');
  assert.equal(new Date(at('2026-11-23T18:59:59Z')).toISOString(), '2026-11-22T19:00:00.000Z', '02:59 Manila is still last night');
  assert.equal(new Date(at('2026-11-24T10:00:00Z')).toISOString(), '2026-11-23T19:00:00.000Z', '18:00 Manila is the same night');
});

/**
 * The database's claim, exactly as `claim_periodic_job` decides it: `last_run_at < now() - p_min_gap`, strict, with
 * the gap sent in whole seconds (`claimPeriodicJob`: Math.round(ms / 1000)).
 */
function simulate(requestTimes: number[]): number[] {
  const runs: number[] = [];
  for (const t of requestTimes) {
    const last = runs.at(-1);
    const gapMs = Math.max(1, Math.round(recordsMeasureClaimGapMs(t) / 1000)) * 1000;
    if (last === undefined || last < t - gapMs) runs.push(t);
  }
  return runs;
}

test('a run at the very instant a window opens does not let a second run into that window', () => {
  const open = Date.parse('2026-11-23T19:00:00Z');
  const runs = simulate([open, open + 30_000, open + 61_000, open + 7 * MIN, open + 20 * HOUR]);
  assert.deepEqual(runs, [open]);
});

test('never twice in one night: a request every 7 minutes for three days runs it exactly once a night, just after 03:00', () => {
  const start = Date.parse('2026-11-22T12:00:00Z'); // 20:00 Manila
  const times = Array.from({ length: (72 * HOUR) / (7 * MIN) }, (_, i) => start + i * 7 * MIN);
  const runs = simulate(times);
  const nights = new Map<number, number>();
  for (const r of runs) nights.set(recordsMeasureWindowOpenedMs(r), (nights.get(recordsMeasureWindowOpenedMs(r)) ?? 0) + 1);
  for (const [open, n] of nights) assert.equal(n, 1, `the night of ${new Date(open).toISOString()} ran ${n} times`);
  // The first window (opened before the first request) runs on the first request; every later one within 7 min of 03:00.
  for (const r of runs.slice(1)) assert.ok(r - recordsMeasureWindowOpenedMs(r) < 7 * MIN, `ran ${(r - recordsMeasureWindowOpenedMs(r)) / MIN} min late`);
  assert.equal(runs.length, nights.size);
});

test('a quiet night catches up: no request from 03:00 to 20:00, and the 20:00 request runs it; the next 03:00 runs again', () => {
  const runs = simulate([
    Date.parse('2026-11-23T18:30:00Z'), // 02:30 Manila — last night's window
    Date.parse('2026-11-24T12:00:00Z'), // 20:00 Manila — first request of this night
    Date.parse('2026-11-24T12:05:00Z'),
    Date.parse('2026-11-24T19:01:00Z'), // 03:01 Manila the next night
  ]);
  assert.deepEqual(runs.map((r) => new Date(r).toISOString()), [
    '2026-11-23T18:30:00.000Z',
    '2026-11-24T12:00:00.000Z',
    '2026-11-24T19:01:00.000Z',
  ]);
});

// ── No scheduler, one claimed job ────────────────────────────────────────────

test('the migration schedules nothing: no pg_cron, no cron.job', () => {
  const sql = readFileSync(join(ROOT, 'supabase/migrations/20271360925434_supplier_storage_meter_counts_everything.sql'), 'utf8');
  const code = sql.replace(/--.*$/gm, '');
  assert.ok(code.includes('supplier_storage_measure_records'), 'read the wrong file: the measure is not in it');
  assert.doesNotMatch(code, /cron\.(schedule|unschedule|job)|pg_cron/i, 'the migration schedules a cron job — the repo has none');
});

test('the measure runs as ONE claimed job, for every shop, with the nightly window as its gap', () => {
  const src = stripComments(readFileSync(join(__dirname, 'supplier-storage-measure.server.ts'), 'utf8'));
  assert.match(src, /runClaimedJob\(\s*'supplier-storage-records',\s*recordsMeasureClaimGapMs\(nowMs\)/);
  assert.match(src, /rpc\('supplier_storage_measure_records',\s*\{\s*p_vendor_profile_id:\s*null\s*\}\)/);
  assert.match(src, /if \(error\) throw/, 'a failed measure must be recorded as a failed run, not as a quiet success');
  const job = PERIODIC_JOBS.find((j) => j.key === 'supplier-storage-records');
  assert.ok(job && job.reportsCount, 'the job is not catalogued (or records no count)');
});

// ── The meter is honest about how current Records are ───────────────────────

test('recordsMeasure: never · fresh · stale, in plain words', () => {
  const now = Date.parse('2026-11-24T12:00:00Z');
  assert.deepEqual(recordsMeasure(null, now), { state: 'never', words: 'Not measured yet' });
  assert.deepEqual(recordsMeasure('not a date', now), { state: 'never', words: 'Not measured yet' });
  const fresh = recordsMeasure(new Date(now - 5 * HOUR).toISOString(), now);
  assert.equal(fresh.state, 'fresh');
  assert.equal(fresh.words, 'Measured 5 hours ago');
  assert.equal(recordsMeasure(new Date(now - MIN).toISOString(), now).words, 'Measured 1 minute ago');
  const stale = recordsMeasure(new Date(now - 4 * 24 * HOUR).toISOString(), now);
  assert.equal(stale.state, 'stale');
  assert.equal(stale.words, 'Last measured 4 days ago');
  assert.equal(recordsMeasure(new Date(now - RECORDS_STALE_AFTER_MS + MIN).toISOString(), now).state, 'fresh');
});

const NOW = Date.parse('2026-11-24T12:00:00Z');
const read = (records: number, recordsMeasuredAt: string | null): StorageBreakdownRead => ({
  status: 'ok',
  breakdown: { photosVideo: 2.4e9, files: 180e6, records, room: 180e6, evidence: 40e6, recordsMeasuredAt },
});
const render = (r: StorageBreakdownRead) => renderToStaticMarkup(React.createElement(StorageMeter, { tier: 'solo', read: r, nowMs: NOW }));

test('never measured: Records reads "Not measured yet" — never 0 KB — and the used line says it is files only', () => {
  const html = render(read(0, null));
  assert.match(html, /data-plan-storage-measured="never"/);
  assert.match(html, /Files only so far — your records are not measured yet/);
  assert.match(html, /Records Not measured yet/, 'the bar’s label still calls the unmeasured Records a size');
  assert.doesNotMatch(html, /Records 0 KB/);
  assert.doesNotMatch(html, />0 KB</, 'a Records size nobody measured was drawn as 0 KB');
});

test('measured: the size, and how long ago; an old measure is flagged, never passed off as current', () => {
  const fresh = render(read(38e6, new Date(NOW - 5 * HOUR).toISOString()));
  assert.match(fresh, /data-plan-storage-measured="fresh"/);
  assert.match(fresh, /Records measured 5 hours ago/);
  assert.match(fresh, /38 MB/);
  const stale = render(read(38e6, new Date(NOW - 4 * 24 * HOUR).toISOString()));
  assert.match(stale, /data-plan-storage-measured="stale"/);
  assert.match(stale, /Records last measured 4 days ago/);
});

test('an unread breakdown is still "Couldn’t read" — not zeros, not "not measured"', () => {
  const html = render({ status: 'unread' });
  assert.match(html, /data-plan-storage="unread"/);
  assert.doesNotMatch(html, /Not measured yet|0 KB/);
});
