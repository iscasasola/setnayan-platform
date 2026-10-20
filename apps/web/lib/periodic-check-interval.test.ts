/**
 * periodic-check-interval.test.ts — HOW OFTEN AN INSTANCE ASKS WHETHER A JOB IS
 * DUE FOLLOWS THE JOB'S OWN GAP (2026-10-20, fewer-reads).
 *
 * `claimPeriodicJob` (lib/periodic-jobs.ts) used to ask the database about every
 * key every five minutes per warm instance — ~5,500 `rpc/claim_periodic_job` a
 * day on prod's gateway, almost all answering "not yet". The rule now lives in
 * the pure registry (`periodicCheckIntervalMs`), and this file holds it over
 * EVERY key in `PERIODIC_JOBS`:
 *
 *   1 · a job whose gap is under 30 min keeps the old five-minute cadence;
 *   2 · a job whose gap is a day or a week is asked at most hourly and at least
 *       every 30 min — never once a gap, never every five minutes;
 *   3 · no job is ever asked about more rarely than a sixth of its gap, nor more
 *       often than every five minutes;
 *   4 · the runner actually USES the rule with the gap it was handed — not a
 *       fixed constant — and does not touch the gap it passes to the database.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import {
  DAILY_GAP_MS,
  PERIODIC_CHECK_CEILING_MS,
  PERIODIC_CHECK_FLOOR_MS,
  PERIODIC_JOBS,
  WEEKLY_GAP_MS,
  periodicCheckIntervalMs,
} from './periodic-job-registry';
import { stripComments } from './strip-comments';

const MIN = 60 * 1000;

test('the registry has its jobs (not a stub that checks nothing)', () => {
  assert.ok(PERIODIC_JOBS.length >= 20, `only ${PERIODIC_JOBS.length} jobs in the registry`);
});

for (const job of PERIODIC_JOBS) {
  test(`${job.key} (gap ${Math.round(job.gapMs / MIN)} min) is asked about on its own cadence`, () => {
    const every = periodicCheckIntervalMs(job.gapMs);
    assert.ok(every >= PERIODIC_CHECK_FLOOR_MS, `${job.key} is asked every ${every / MIN} min — faster than the old five`);
    if (job.gapMs < 30 * MIN) {
      assert.equal(every, 5 * MIN, `${job.key} has a gap under 30 min and must keep its five-minute cadence`);
      return;
    }
    assert.ok(every <= job.gapMs / 6, `${job.key} is asked every ${every / MIN} min — later than a sixth of its gap`);
    assert.ok(every <= PERIODIC_CHECK_CEILING_MS, `${job.key} is asked every ${every / MIN} min — rarer than hourly`);
    if (job.gapMs >= DAILY_GAP_MS) {
      assert.ok(
        every >= 30 * MIN && every <= 60 * MIN,
        `${job.key} is a daily/weekly job asked every ${every / MIN} min — it must be every 30–60 min`,
      );
    }
  });
}

test('the edges of the rule', () => {
  assert.equal(periodicCheckIntervalMs(10 * MIN), 5 * MIN);
  assert.equal(periodicCheckIntervalMs(29 * MIN), 5 * MIN);
  assert.equal(periodicCheckIntervalMs(30 * MIN), 5 * MIN);
  assert.equal(periodicCheckIntervalMs(60 * MIN), 10 * MIN);
  assert.equal(periodicCheckIntervalMs(6 * 60 * MIN), 60 * MIN);
  assert.equal(periodicCheckIntervalMs(DAILY_GAP_MS), 60 * MIN);
  assert.equal(periodicCheckIntervalMs(WEEKLY_GAP_MS), 60 * MIN);
  // A nonsense gap never makes an instance ask faster than before.
  assert.equal(periodicCheckIntervalMs(Number.NaN), 5 * MIN);
  assert.equal(periodicCheckIntervalMs(0), 5 * MIN);
});

test('the runner asks on the rule, with the gap it was handed', () => {
  const src = stripComments(readFileSync(join(__dirname, 'periodic-jobs.ts'), 'utf8'));
  const claim = src.slice(src.indexOf('export async function claimPeriodicJob'), src.indexOf('export async function finishPeriodicJob'));
  assert.ok(claim.length > 200, 'claimPeriodicJob was not found');
  assert.match(
    claim,
    /<\s*periodicCheckIntervalMs\(\s*minGapMs\s*\)/,
    'claimPeriodicJob no longer throttles on periodicCheckIntervalMs(minGapMs)',
  );
  assert.doesNotMatch(claim, /<\s*[A-Z_]*THROTTLE_MS\b/, 'claimPeriodicJob went back to one fixed throttle for every job');
  // The gap the database judges by is still the job's own gap, untouched.
  assert.match(claim, /Math\.round\(\s*minGapMs\s*\/\s*1000\s*\)/, 'the gap sent to claim_periodic_job changed');
});
