/**
 * ⏳ A SOLO PLAN IS ASKED TO LAPSE — Lane G · Step 0 rows 14–15 (Build 5 plan, 2026-11-10).
 *
 * SetnaProd's Solo gift ended 19 Oct 2026 and still read `tier_state='solo'` on 10 Nov; its Plan page printed
 * "You are on Solo · until Oct 19, 2026". Root cause, measured on prod (read-only): the SQL sweep
 * `sweep_vendor_tier_expiry` DOES lapse Solo (since 20271286893359) and `authenticated` may call it — but its
 * only caller, the vendor-dashboard layout, fired it only for an inline `['pro', 'enterprise']`. The database
 * knew; nobody asked it.
 *
 * Held here:
 *   1. `LAPSING_TIERS` equals the tier list inside the LATEST migration defining the sweep (both places it is
 *      written: the FOR UPDATE probe and the UPDATE);
 *   2. the layout asks `tierMayLapse(...)` and carries no inline tier list next to the sweep call;
 *   3. the Plan screen ends a run-out plan BEFORE it reads the plan it draws;
 *   4. the pure helpers.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

import { stripComments } from './strip-comments';
import { LAPSING_TIERS, tierHasLapsed, tierMayLapse } from './vendor-tier-lapse';

const WEB = join(__dirname, '..');
const MIGRATIONS = join(WEB, '..', '..', 'supabase', 'migrations');

function latestSweepBody(): { file: string; body: string } {
  const re = /CREATE\s+OR\s+REPLACE\s+FUNCTION\s+public\.sweep_vendor_tier_expiry\s*\(/i;
  const files = readdirSync(MIGRATIONS)
    .filter((f) => f.endsWith('.sql'))
    .sort()
    .filter((f) => re.test(readFileSync(join(MIGRATIONS, f), 'utf8')));
  const file = files.at(-1)!;
  const sql = readFileSync(join(MIGRATIONS, file), 'utf8');
  const start = sql.search(re);
  const open = sql.indexOf('$function$', start);
  const close = sql.indexOf('$function$', open + 10);
  return { file, body: sql.slice(open, close) };
}

test('1 · LAPSING_TIERS is the SQL sweep’s own tier list', () => {
  const { file, body } = latestSweepBody();
  const lists = [...body.matchAll(/tier_state\s+IN\s*\(([^)]*)\)/gi)].map((m) =>
    m[1]!.split(',').map((t) => t.trim().replace(/^'|'$/g, '')).sort(),
  );
  assert.ok(lists.length >= 2, `${file}: expected the lapse's tier list in the probe and the UPDATE`);
  for (const l of lists) assert.deepEqual(l, [...LAPSING_TIERS].sort(), `${file}: tier list drifted from LAPSING_TIERS`);
});

test('2 · the dashboard layout asks tierMayLapse before the sweep — no inline tier list', () => {
  const src = stripComments(readFileSync(join(WEB, 'app/vendor-dashboard/layout.tsx'), 'utf8'));
  const call = src.indexOf("rpc('sweep_vendor_tier_expiry'");
  assert.ok(call > 0, 'the layout must still fire the lapse sweep');
  const gate = src.slice(Math.max(0, call - 600), call);
  assert.match(gate, /tierMayLapse\(/, 'the sweep must be gated by tierMayLapse');
  assert.doesNotMatch(gate, /\[\s*'(?:solo|pro|enterprise)'/, 'no inline tier list beside the sweep call');
});

test('3 · the Plan screen ends a run-out plan before it reads the plan it draws', () => {
  const src = stripComments(
    readFileSync(join(WEB, 'app/vendor-dashboard/subscription/_components/plan-screen.tsx'), 'utf8'),
  );
  const lapsed = src.indexOf('tierHasLapsed(tierRow');
  const sweep = src.indexOf("rpc('sweep_vendor_tier_expiry'", lapsed);
  const firstUse = src.indexOf('asVendorTier(');
  assert.ok(lapsed > 0 && sweep > lapsed, 'plan-screen must ask tierHasLapsed and then call the sweep');
  assert.ok(sweep < firstUse, 'the sweep must run before the tier is read for display');
});

test('4 · tierMayLapse / tierHasLapsed', () => {
  for (const t of ['solo', 'pro', 'enterprise']) assert.equal(tierMayLapse(t), true, t);
  for (const t of ['free', 'verified', 'custom', null, undefined, '']) assert.equal(tierMayLapse(t), false, String(t));
  const now = Date.parse('2026-11-10T00:00:00Z');
  assert.equal(tierHasLapsed({ tier_state: 'solo', tier_expires_at: '2026-10-19T13:13:12Z' }, now), true, 'SetnaProd');
  assert.equal(tierHasLapsed({ tier_state: 'solo', tier_expires_at: '2027-07-30T07:52:09Z' }, now), false);
  assert.equal(tierHasLapsed({ tier_state: 'solo', tier_expires_at: null }, now), false, 'open-ended comp');
  assert.equal(tierHasLapsed({ tier_state: 'verified', tier_expires_at: '2026-10-19T00:00:00Z' }, now), false);
  assert.equal(tierHasLapsed({ tier_state: 'pro', tier_expires_at: 'garbage' }, now), false);
  assert.equal(tierHasLapsed(null, now), false);
});
