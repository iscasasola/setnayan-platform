/**
 * the-price-meter-refills-itself.test.ts — CTRL-B3 build 5.
 *
 * `market_price_bands` was **0 rows in production**, written only by
 * `recompute_market_price_bands()` whose only caller was a human pressing
 * Recompute on `/admin/pricing`. Every supplier's Price-Position Meter has been
 * empty since it shipped.
 *
 * 🔑 AN EMPTY BENCHMARK DOES NOT LOOK BROKEN — it looks like "not enough peer
 * data yet", which a supplier believes. The funnel half of the same page
 * carries a comment saying exactly that about its own table.
 *
 * 🛡 Mutation-checked; every sabotage verified to apply.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { stripComments } from '@/lib/strip-comments';
import { PERIODIC_JOBS, PRICE_BAND_REFILL_GAP_MS } from '@/lib/periodic-job-registry';

const HERE = dirname(fileURLToPath(import.meta.url));
const WEB = join(HERE, '..');
const readCode = (rel: string) => stripComments(readFileSync(join(WEB, rel), 'utf8'));
const count = (s: string, re: RegExp) => (s.match(new RegExp(re.source, 'g')) ?? []).length;

const KEY = 'market-price-band-refill';

// SABOTAGE: remove the registry entry → RED.
test('the refill is a registered job, with a gap a human did not have to remember', () => {
  const job = PERIODIC_JOBS.find((j) => j.key === KEY);
  assert.ok(job, `${KEY} is not in PERIODIC_JOBS — an unregistered job is invisible to the admin jobs desk`);
  assert.equal(job.gapMs, PRICE_BAND_REFILL_GAP_MS);
  assert.ok(job.gapMs >= 60 * 60 * 1000, 'bands move with the catalogue, not the hour — a tight gap is wasted work');
  assert.ok(job.gapMs <= 24 * 60 * 60 * 1000, 'longer than a day and the meter is stale for most of it');
  assert.equal(job.reportsCount, true, 'the run must report how many bands it wrote, or a no-op reads as a success');
});

// SABOTAGE: return 0 instead of throwing on an RPC error → RED.
test('a refused recompute THROWS — it never reports a healthy zero', () => {
  const src = readCode('lib/price-band-refill.server.ts');
  // 🪤 `stripComments` REPLACES A COMMENT WITH WHITESPACE, IT DOES NOT REMOVE
  // THE SPACE. The three-line comment between the log and the throw becomes
  // ~200 blank characters, so a {0,300} window fell short and this assertion
  // failed against code that is correct. Widened, and the window is now sized
  // to the branch rather than to how the source happens to be commented.
  assert.match(
    src,
    /if \(error\)[\s\S]{0,800}throw new Error/,
    'a refused recompute that returned 0 is indistinguishable from a healthy run over an empty catalogue, and the meter would stay empty with the registry reporting success',
  );
  assert.match(
    src,
    /runClaimedJob\('market-price-band-refill'/,
    'it must go through claim_periodic_job — this repo has no scheduler, deliberately',
  );
  assert.equal(
    count(src, /setInterval|setTimeout|cron/i),
    0,
    'no scheduler: the established shape is a claimed job fired from after() on a page staff already load',
  );
});

// SABOTAGE: drop one of the two mounts → RED.
test('it is mounted on BOTH layouts, because the meter belongs to suppliers', () => {
  for (const layout of ['app/admin/layout.tsx', 'app/vendor-dashboard/layout.tsx']) {
    const src = readCode(layout);
    assert.equal(
      count(src, /after\(\(\) => maybeRefillPriceBands\(\)/),
      1,
      `${layout}: an admin-only mount would make a SUPPLIER-facing meter wait for an admin page view — production is pre-launch-quiet`,
    );
  }
});

// SABOTAGE: have the registry import the server-only module → RED.
test('the registry does not drag `server-only` into everything that reads it', () => {
  const reg = readCode('lib/periodic-job-registry.ts');
  assert.equal(
    count(reg, /price-band-refill\.server/),
    0,
    'the gap constant is declared IN the registry and imported BY the server module — the other direction pulls `server-only` into every consumer of this registry',
  );
  assert.match(reg, /export const PRICE_BAND_REFILL_GAP_MS/, 'and it must actually be declared here');
});
