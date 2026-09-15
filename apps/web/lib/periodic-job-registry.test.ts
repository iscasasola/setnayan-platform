/**
 * GUARD — A JOB THAT CLAIMED AND NEVER CLOSED MUST NOT READ AS A SUCCESS.
 *
 * THE DEFECT THIS PINS (measured in production 2026-09-15). `cron_job_runs` had
 * exactly two columns — `job_key`, `last_run_at` — and `claim_periodic_job()`
 * stamped `last_run_at` at the instant of the CLAIM, BEFORE the job body ran in
 * the app. Every wrapper then ran the body inside a catch that swallowed the
 * failure. So a retention sweep that threw left a FRESH timestamp and did not
 * retry for a full week, and **a silently failing deletion job and a working one
 * were byte-identical from every record we keep.** `/privacy` promises, under
 * RA 10173, that face data goes at 3 months, full-res at 6, chat at 5 years.
 *
 * This file executes the reading of a run. Every assertion below is over a row
 * CONSTRUCTED HERE — none of it depends on what production happens to contain,
 * so none of it can pass vacuously.
 *
 * ⛔ TWO RULES THIS FILE ENFORCES BY REFUSING TO TEST THEM ANY OTHER WAY:
 *   1. There is NO freshness check, here or anywhere. Jobs fire on page traffic,
 *      not a timer, and several are correctly quiet for long stretches. On
 *      2026-09-15 an HOURLY job had been silent for ten days and twenty-one
 *      hours and was perfectly healthy — unvisited page, empty table. A check
 *      that cries wolf on correct behaviour teaches everyone to ignore it.
 *   2. `rows_affected = 0` is a HEALTHY, COMPLETE result and must never render
 *      like a failure or an absence.
 *
 * 🛡 MUTATION-CHECKED. Each assertion was broken on purpose and the RED count
 * recorded before this file was trusted; the mutations are the cheap off-switches
 * a future edit would actually reach for — `ok` defaulting to true, a claim that
 * never closes classified as fine, 0 collapsed to null.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  PERIODIC_JOBS,
  PERIODIC_JOB_KEYS,
  RETENTION_JOB_KEYS,
  RUN_STALL_GRACE_MS,
  classifyJobRun,
  classifyAllJobs,
  normalizeRowsAffected,
  type JobRunRow,
} from './periodic-job-registry';

const NOW = Date.parse('2026-09-15T12:00:00Z');
const ago = (ms: number) => new Date(NOW - ms).toISOString();
const MIN = 60_000;
const DAY = 24 * 60 * MIN;

function row(over: Partial<JobRunRow> = {}): JobRunRow {
  return {
    job_key: 'retention-sweep',
    last_run_at: ago(DAY),
    started_at: ago(DAY),
    finished_at: ago(DAY - MIN),
    ok: true,
    rows_affected: 0,
    error: null,
    ...over,
  };
}

// ── The catalog itself ──────────────────────────────────────────────────────

test('ANCHOR — the catalog is populated and every key is unique', () => {
  assert.ok(PERIODIC_JOBS.length >= 20, `only ${PERIODIC_JOBS.length} jobs in the catalog`);
  assert.equal(new Set(PERIODIC_JOB_KEYS).size, PERIODIC_JOB_KEYS.length, 'duplicate job key');
  assert.ok(RETENTION_JOB_KEYS.length >= 6, 'the retention promises went missing from the catalog');
});

test('every retention job reports a count — "deleted nothing" is the answer a filing asks for', () => {
  for (const key of RETENTION_JOB_KEYS) {
    const job = PERIODIC_JOBS.find((j) => j.key === key)!;
    assert.equal(
      job.reportsCount,
      true,
      `${key} deletes personal data on a clock /privacy prints, but declares no count. ` +
        `"We deleted 0 because nothing was due" and "we never found out" must not be the same row.`,
    );
  }
});

// ── 0 is not null ───────────────────────────────────────────────────────────

test('a run that touched nothing records 0, NOT null', () => {
  assert.equal(normalizeRowsAffected(0), 0, 'zero collapsed to null — the defect, one level up');
  assert.equal(normalizeRowsAffected(7), 7);
  assert.equal(normalizeRowsAffected(undefined), null, 'a job with no count must record null');
  assert.equal(normalizeRowsAffected(null), null);
  assert.equal(normalizeRowsAffected(Number.NaN), null);
  assert.equal(normalizeRowsAffected('3'), null, 'a string is not a count');
  assert.equal(normalizeRowsAffected(2.9), 2, 'a fraction of a record is not a record');
});

test('a completed zero-row run reads as a SUCCESS, and says so in words', () => {
  const v = classifyJobRun('retention-sweep', row({ rows_affected: 0 }), NOW);
  assert.equal(v.state, 'ok');
  assert.equal(v.needsAttention, false, 'a job with nothing to do must not summon the owner');
  assert.match(
    v.summary,
    /nothing was due/i,
    'the zero-row wording stopped saying WHY it is zero; "0" alone reads as a shrug',
  );
  assert.doesNotMatch(v.summary, /fail|error|problem/i);
});

// ── claimed ⇒ closed, the whole property ────────────────────────────────────

test('claimed and NEVER CLOSED is its own state, and it asks for attention', () => {
  const v = classifyJobRun(
    'retention-sweep',
    row({ started_at: ago(3 * DAY), finished_at: null, ok: null, rows_affected: null }),
    NOW,
  );
  assert.equal(
    v.state,
    'never-finished',
    'a job that claimed the window and never reported back classified as something benign — ' +
      'that is EXACTLY the state the old two-column table could not express',
  );
  assert.equal(v.needsAttention, true);
  assert.match(v.summary, /NEVER FINISHED/);
});

test('an unclosed run is NOT the same as a completed zero-row run', () => {
  const unfinished = classifyJobRun(
    'retention-sweep',
    row({ finished_at: null, ok: null, rows_affected: null, started_at: ago(3 * DAY) }),
    NOW,
  );
  const emptyButDone = classifyJobRun('retention-sweep', row({ rows_affected: 0 }), NOW);
  assert.notEqual(
    unfinished.state,
    emptyButDone.state,
    'the two states this whole change exists to separate collapsed back into one',
  );
  assert.notEqual(unfinished.needsAttention, emptyButDone.needsAttention);
});

test('a run still inside the stall grace is "running", not an alarm', () => {
  const v = classifyJobRun(
    'retention-sweep',
    row({ started_at: ago(RUN_STALL_GRACE_MS - MIN), finished_at: null, ok: null }),
    NOW,
  );
  assert.equal(v.state, 'running');
  assert.equal(v.needsAttention, false);
});

test('one minute past the grace, the same row becomes never-finished', () => {
  const v = classifyJobRun(
    'retention-sweep',
    row({ started_at: ago(RUN_STALL_GRACE_MS + MIN), finished_at: null, ok: null }),
    NOW,
  );
  assert.equal(v.state, 'never-finished');
});

test('a recorded failure is a failure, and carries its message', () => {
  const v = classifyJobRun(
    'retention-sweep',
    row({ ok: false, rows_affected: null, error: 'purge_expired_chat failed: permission denied' }),
    NOW,
  );
  assert.equal(v.state, 'failed');
  assert.equal(v.needsAttention, true);
  assert.match(v.summary, /permission denied/, 'the message the old catch threw away is the point');
});

// ── legacy rows: unknown, not fine, not broken ──────────────────────────────

test('a row written before outcomes existed says UNKNOWN — it does not invent evidence', () => {
  const v = classifyJobRun(
    'face-data-retention',
    row({ started_at: null, finished_at: null, ok: null, rows_affected: null }),
    NOW,
  );
  assert.equal(v.state, 'no-outcome-recorded');
  assert.equal(v.needsAttention, false, 'a legacy row is not a live incident');
  assert.match(v.summary, /unknown, not failed/i);
  assert.doesNotMatch(
    v.summary,
    /finished cleanly|successful|ran and finished/i,
    'a row with no outcome must never be reported as a success',
  );
});

// ── no freshness rule, ever ────────────────────────────────────────────────

test('A JOB QUIET FOR ELEVEN DAYS WITH A CLEAN LAST RUN IS NOT AN ALARM', () => {
  /*
    The live example, measured 2026-09-15: `samahan-story-sweep` has an HOURLY
    gap and had last run ten days and twenty-one hours earlier. Nothing was
    wrong — its only caller is one Samahan community page, nobody had opened
    one, and the table held zero rows. If this ever goes red, a freshness rule
    has crept in and will now cry wolf on every correctly-idle job.
  */
  const v = classifyJobRun(
    'samahan-story-sweep',
    row({
      job_key: 'samahan-story-sweep',
      last_run_at: ago(11 * DAY),
      started_at: ago(11 * DAY),
      finished_at: ago(11 * DAY - MIN),
      ok: true,
      rows_affected: 0,
    }),
    NOW,
  );
  assert.equal(v.state, 'ok', 'a correctly idle job was flagged — that is the alarm nobody reads');
  assert.equal(v.needsAttention, false);
});

test('classifyJobRun cannot see a cadence, so it cannot compare one to the clock', () => {
  // A one-argument-shape check: the signature takes (key, row, nowMs) and
  // nothing else. Growing a gap parameter is how a freshness rule gets in.
  assert.equal(
    classifyJobRun.length,
    3,
    'classifyJobRun grew a parameter. If it is the job gap, the next edit compares it to now().',
  );
});

// ── the whole board ─────────────────────────────────────────────────────────

test('a job with no row at all is reported as "no run yet", not as a failure', () => {
  const v = classifyJobRun('photo-delivery-drain', undefined, NOW);
  assert.equal(v.state, 'never-claimed');
  assert.equal(v.needsAttention, false);
});

test('classifyAllJobs covers every catalogued job even when the table is empty', () => {
  const all = classifyAllJobs([], NOW);
  assert.equal(all.length, PERIODIC_JOBS.length);
  assert.deepEqual(
    all.map((v) => v.key).sort(),
    [...PERIODIC_JOB_KEYS].sort(),
    'a job in the catalog rendered nothing at all — an absent row must still get a line',
  );
  assert.equal(
    all.filter((v) => v.needsAttention).length,
    0,
    'an empty ledger raised alarms; a fresh database is not an incident',
  );
});

test('one broken job on a board of healthy ones is still surfaced', () => {
  const rows: JobRunRow[] = PERIODIC_JOB_KEYS.map((k) =>
    row({
      job_key: k,
      ...(k === 'face-data-retention'
        ? { started_at: ago(2 * DAY), finished_at: null, ok: null, rows_affected: null }
        : {}),
    }),
  );
  const flagged = classifyAllJobs(rows, NOW).filter((v) => v.needsAttention);
  assert.deepEqual(
    flagged.map((v) => v.key),
    ['face-data-retention'],
    'exactly one job was left unclosed and the board did not single it out',
  );
});
