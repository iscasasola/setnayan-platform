import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { stripComments } from './strip-comments';
import { PERIODIC_JOBS, findPeriodicJob } from './periodic-job-registry';

/**
 * The property: something actually runs the Google-grant refresh.
 *
 * ─── MEASURED ON PRODUCTION 2026-09-18 ───────────────────────────────────
 *   oauth_grants                2 rows · 2 refresh tokens · 2 access EXPIRED
 *                               (2026-07-10 and 2026-08-31)
 *   live_studio_channel_grants  3 rows · 3 refresh tokens · 3 access EXPIRED
 *                               (all 2026-09-02)
 *   every refresh_token matched '1//%' — Google PLAINTEXT
 *
 * The worker existed the whole time, in `app/api/cron/oauth-refresh/route.ts`,
 * carrying its own `TODO(0011): wire the actual cron schedule`.
 *
 * 🔑 THAT SCHEDULE WAS NEVER COMING. `vercel.json` carries `"crons": []` and
 * `cron.job` is empty — every periodic job in this repo rides request traffic
 * through `claim_periodic_job`, deliberately. A route waiting for a cron was
 * waiting for a mechanism the project had decided not to have. Checking
 * REGISTRY MEMBERSHIP is therefore the first question about any job here, not
 * "is there a schedule".
 */

const HERE = dirname(fileURLToPath(import.meta.url));
const WEB = resolve(HERE, '..');
const read = (rel: string) => stripComments(readFileSync(join(WEB, rel), 'utf8'));

test('the refresh is a REGISTERED job, not a route waiting for a cron', () => {
  const job = findPeriodicJob('oauth-refresh');
  assert.ok(
    job,
    'oauth-refresh left the registry. Nothing else in this repo schedules ' +
      'anything, so removing it means the Google grants stop being renewed — ' +
      'silently, with a route that still exists and still looks like the answer.',
  );
  assert.equal(job!.kind, 'operational');
  assert.equal(job!.reportsCount, true, 'the run must record how many it renewed');
  // A Google access token lives one hour. A wider gap means a live broadcast
  // can meet a dead token between sweeps.
  assert.ok(
    job!.gapMs <= 60 * 60 * 1000,
    `gap is ${job!.gapMs}ms — wider than a Google access token's own lifetime`,
  );
});

test('there is ONE cadence, and the wrapper reads it rather than restating it', () => {
  // 🔴 A GAP IN MY OWN FIRST GUARD, found by sabotage. I asserted the registry
  // row's gapMs and nothing else, so widening the separate constant the wrapper
  // handed to `runClaimedJob` — the load-bearing one — stayed green while the
  // registry went on advertising hourly. The fix is not a test that two numbers
  // agree; it is deleting the second number.
  //
  // (The wrapper is `server-only`, so this reads its source. That is the
  // trade-off named in lib/oauth-refresh-sweep.ts: what can be got wrong lives
  // where a test can EXECUTE it, and what is left is asserted by shape.)
  const wrapper = read('lib/oauth-refresh-job.ts');
  assert.match(
    wrapper,
    /findPeriodicJob\('oauth-refresh'\)\?\.gapMs/,
    'the wrapper stopped reading the cadence from the registry. A second ' +
      'number for one cadence is free to drift, and /admin publishes the ' +
      'registry one — so it would advertise a schedule nothing runs on.',
  );
  assert.equal(
    (wrapper.match(/60 \* 60 \* 1000/g) ?? []).length,
    1,
    'more than one literal hour in the wrapper — the fallback is the only one ' +
      'allowed, and it exists for a deleted row, not as a second policy',
  );
});

test('something claims it, and the home page actually calls that', () => {
  const wrapper = read('lib/oauth-refresh-job.ts');
  assert.match(
    wrapper,
    /runClaimedJob\('oauth-refresh'/,
    'the wrapper no longer claims the job — it would run on every request or ' +
      'not at all',
  );
  const home = read('app/page.tsx');
  assert.match(
    home,
    /after\(\(\) => maybeRunOAuthRefresh\(\)/,
    'the home page stopped carrying the refresh. With no scheduler, an ' +
      'unmounted job is a job that never runs.',
  );
});

test('the sweep is still the thing that SEALS a token', () => {
  // The vault shipped 2026-09-13 and had encrypted zero production rows,
  // because this sweep is its only writer and the sweep had never run. If it
  // stops sealing, the vault goes back to zero without anything failing.
  const sweep = read('lib/oauth-refresh-sweep.ts');
  assert.match(sweep, /sealToken\(/, 'the sweep stopped sealing the refreshed token');
  assert.match(sweep, /openStoredToken\(/, 'the sweep stopped opening stored tokens');
  // Both grant families, not just the one that was easiest to reach.
  assert.match(sweep, /from\('oauth_grants'\)/);
  assert.match(sweep, /refreshPoolChannelGrants\(/, 'the Live Studio pool channels dropped out');
});

test('moving the body out did not open the route', () => {
  const route = read('app/api/cron/oauth-refresh/route.ts');
  assert.match(route, /OAUTH_REFRESH_CRON_SECRET/, 'the route lost its secret');
  assert.match(route, /status: 401/, 'the route stopped refusing a bad secret');
  assert.match(route, /runOAuthRefreshSweep\(/, 'the route no longer does the work');
});

test('the registry stayed tight — one job added, none lost', () => {
  // A floor, because a registry that silently shrank is how a sweep stops
  // running with every test green.
  assert.ok(
    PERIODIC_JOBS.length >= 23,
    `only ${PERIODIC_JOBS.length} periodic jobs — the registry shrank`,
  );
  const keys = PERIODIC_JOBS.map((j) => j.key);
  assert.equal(new Set(keys).size, keys.length, 'a duplicate job key');
});
