/**
 * s41c-supplier-batch-c-reads-are-honest.test.ts — S41c batch 3/4, SUPPLIER
 * tier of `result-dropped-silently` (S26's orphan baseline, PR #5625 / #5680
 * "both-ends" class): a Supabase call whose `error` was read only as an
 * if/else condition that records nothing.
 *
 * ── Why every site in this batch is shape 1 (log-only), not shape 2 ─────────
 * None of the 17 sites here feed a render where a refused read is currently
 * indistinguishable on screen from a genuine empty/zero/"none yet" state seen
 * by a supplier — each is an internal helper, a background job, or a read that
 * already degrades to a documented, deliberate fallback (a catalog price
 * default, a "not verified" gate default, a safe-high usage count, etc.). The
 * fix is the safe, always-correct improvement: the discarded `error` is now
 * actually READ and left as a `console.error('[supabase-error] …')` trace at
 * the point it used to vanish. Behaviour (the return value on error) is
 * UNCHANGED — only the reason is no longer silent.
 *
 * These tests pin two things per site: (1) the fallback value on a refused
 * read is unchanged, and (2) the refusal is actually logged — and, for a
 * couple of sites, that a GENUINE non-error read does NOT spuriously log.
 * The closing source-scan proves each NAMED log call-site individually (a
 * slid guard can pass a bare "at least one" check while missing every other
 * site in a file), with a per-file FLOOR rather than an exact total: this
 * broke `main` once and PRs three times (2026-09-19) whenever a legitimate
 * new, distinct log site was added to one of these files, because the old
 * assertion was `assert.equal(n, expected)` on the file's total occurrence
 * count of the bare `[supabase-error]` marker. Deleting a named site still
 * fails — its own anchor's count drops to 0 — but adding a new one no longer
 * does.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { SupabaseClient } from '@supabase/supabase-js';

import { isPersistableCanonicalService } from '@/lib/requirements-capture';
import { findSameDayVendors } from '@/lib/same-day-vendors';
import { fetchDayOfOverride, fetchSongRequestsPaused } from '@/lib/vendor-dayof-config';
import { fetchVerifiedLock } from '@/lib/vendor-corrections';
import { countDeepSearchUsesSince } from '@/lib/vendor-deep-search-addon';
import { getSetnayanFeePct, SETNAYAN_PAY_FEE_PCT } from '@/lib/vendor-earnings';
import { stripComments } from '@/lib/strip-comments';

/** Minimal thenable query builder — every chained filter returns itself, and
 * `maybeSingle()` resolves the same way a plain `await` on the chain would. */
function stubClient(result: Record<string, unknown>): SupabaseClient {
  const builder: Record<string, unknown> = {};
  for (const m of ['from', 'select', 'eq', 'neq', 'not', 'in', 'order', 'limit', 'gte', 'maybeSingle']) {
    builder[m] = () => builder;
  }
  builder.then = (resolve: (v: unknown) => unknown) => Promise.resolve(result).then(resolve);
  return builder as unknown as SupabaseClient;
}

const REFUSED = { data: null, error: { code: '42501', message: 'permission denied for table' } };

/** Run `fn`, capturing every `console.error` call instead of printing it, so
 * a green run stays clean while still proving the log actually fired. */
async function captureConsoleError<T>(fn: () => Promise<T>): Promise<{ result: T; calls: unknown[][] }> {
  const orig = console.error;
  const calls: unknown[][] = [];
  console.error = (...args: unknown[]) => {
    calls.push(args);
  };
  try {
    const result = await fn();
    return { result, calls };
  } finally {
    console.error = orig;
  }
}

// ── requirements-capture.ts · canonical_service_schemas.select ──────────────

test('requirements-capture: a REFUSED read stays `false`, and is now logged', async () => {
  const { result, calls } = await captureConsoleError(() =>
    isPersistableCanonicalService(stubClient(REFUSED), 'photography'),
  );
  assert.equal(result, false);
  assert.equal(calls.length, 1);
  assert.match(String(calls[0]![0]), /\[supabase-error\] lib\/requirements-capture\.ts · from:canonical_service_schemas\.select/);
});

test('requirements-capture: a genuine hit does NOT spuriously log', async () => {
  const { result, calls } = await captureConsoleError(() =>
    isPersistableCanonicalService(
      stubClient({ data: { canonical_service: 'photography' }, error: null }),
      'photography',
    ),
  );
  assert.equal(result, true);
  assert.equal(calls.length, 0);
});

// ── same-day-vendors.ts · vendor_profiles.select ─────────────────────────────

test('same-day-vendors: a REFUSED read stays `[]`, and is now logged', async () => {
  const { result, calls } = await captureConsoleError(() =>
    findSameDayVendors(stubClient(REFUSED), { lat: null, lng: null, region: null }),
  );
  assert.deepEqual(result, []);
  assert.equal(calls.length, 1);
  assert.match(String(calls[0]![0]), /\[supabase-error\] lib\/same-day-vendors\.ts · from:vendor_profiles\.select/);
});

// ── vendor-dayof-config.ts · vendor_dayof_configs.select (2 call sites) ─────

test('vendor-dayof-config: fetchDayOfOverride on a REFUSED read stays `null`, and is now logged', async () => {
  const { result, calls } = await captureConsoleError(() =>
    fetchDayOfOverride(stubClient(REFUSED), 'vp_1', 'ev_1'),
  );
  assert.equal(result, null);
  assert.equal(calls.length, 1);
  assert.match(String(calls[0]![0]), /\[supabase-error\] lib\/vendor-dayof-config\.ts · from:vendor_dayof_configs\.select/);
});

test('vendor-dayof-config: fetchSongRequestsPaused on a REFUSED read stays `false` (flowing), and is now logged', async () => {
  const { result, calls } = await captureConsoleError(() =>
    fetchSongRequestsPaused(stubClient(REFUSED), 'vp_1', 'ev_1'),
  );
  assert.equal(result, false);
  assert.equal(calls.length, 1);
  assert.match(String(calls[0]![0]), /\[supabase-error\] lib\/vendor-dayof-config\.ts · from:vendor_dayof_configs\.select/);
});

// ── vendor-corrections.ts · vendor_profiles.select ───────────────────────────

test('vendor-corrections: fetchVerifiedLock on a REFUSED read stays `false` (fails closed to "not locked"), and is now logged', async () => {
  const { result, calls } = await captureConsoleError(() =>
    fetchVerifiedLock(stubClient(REFUSED), 'u_1'),
  );
  assert.equal(result, false);
  assert.equal(calls.length, 1);
  assert.match(String(calls[0]![0]), /\[supabase-error\] lib\/vendor-corrections\.ts · from:vendor_profiles\.select/);
});

// ── vendor-deep-search-addon.ts · vendor_deep_search_uses.select ───────────

test('vendor-deep-search-addon: countDeepSearchUsesSince on a REFUSED read stays the SAFE-HIGH 1 (fails toward charging), and is now logged', async () => {
  const { result, calls } = await captureConsoleError(() =>
    countDeepSearchUsesSince(stubClient(REFUSED), 'vp_1', '2026-08-01T00:00:00.000Z'),
  );
  assert.equal(result, 1);
  assert.equal(calls.length, 1);
  assert.match(
    String(calls[0]![0]),
    /\[supabase-error\] lib\/vendor-deep-search-addon\.ts · from:vendor_deep_search_uses\.select/,
  );
});

// ── vendor-earnings.ts · platform_settings.select ────────────────────────────
// ⚠ Known overlap: open PR #5680 also touches lib/vendor-earnings.ts, but not
// this read (verified via `gh pr diff 5680 -- apps/web/lib/vendor-earnings.ts`
// — no `platform_settings` match). See the PR body for the note either merge
// order needs.

test('vendor-earnings: getSetnayanFeePct on a REFUSED read stays the SETNAYAN_PAY_FEE_PCT fallback, and is now logged', async () => {
  const { result, calls } = await captureConsoleError(() =>
    getSetnayanFeePct(stubClient(REFUSED)),
  );
  assert.equal(result, SETNAYAN_PAY_FEE_PCT);
  assert.equal(calls.length, 1);
  assert.match(String(calls[0]![0]), /\[supabase-error\] lib\/vendor-earnings\.ts · from:platform_settings\.select/);
});

// ── source-scan: every NAMED log site, individually anchored, with a
//    per-file FLOOR ──────────────────────────────────────────────────────────
// A file-level "at least one" check can pass while missing a second call site
// in the same file (vendor-counts.ts and vendor-dayof-config.ts each have 2;
// vendor-microsite.ts has 2). So every site the S26/S41c baseline named is
// anchored by its own greppable call-site label (not a bare per-file total),
// and each anchor's count is a FLOOR (>= current count), never an exact
// match — this pinned an exact total per file until 2026-09-19, when it broke
// `main` once and PRs three times as legitimate new, distinct log sites were
// added to these same files. A floor still catches a deletion (that named
// site's own count drops below its floor); it just stops catching an
// unrelated addition as if it were a regression.

const WEB = join(dirname(fileURLToPath(import.meta.url)), '..');
const src = (rel: string) => stripComments(readFileSync(join(WEB, rel), 'utf8'));

function countOccurrences(hay: string, needle: string): number {
  let n = 0;
  for (let i = hay.indexOf(needle); i !== -1; i = hay.indexOf(needle, i + needle.length)) n += 1;
  return n;
}

const LOG_SITE_FLOORS: { file: string; sites: { label: string; floor: number }[] }[] = [
  { file: 'lib/requirements-capture.ts', sites: [
    { label: '[supabase-error] lib/requirements-capture.ts · from:canonical_service_schemas.select', floor: 1 },
  ] },
  { file: 'lib/same-day-vendors.ts', sites: [
    { label: '[supabase-error] lib/same-day-vendors.ts · from:vendor_profiles.select', floor: 1 },
  ] },
  { file: 'lib/service-merge-forward-db.ts', sites: [
    { label: '[supabase-error] lib/service-merge-forward-db.ts · from:canonical_service_taxonomy.select', floor: 1 },
  ] },
  { file: 'lib/service-trade-aliases-db.ts', sites: [
    { label: '[supabase-error] lib/service-trade-aliases-db.ts · from:canonical_service_aliases.select', floor: 1 },
  ] },
  { file: 'lib/stage-notes-recipients.ts', sites: [
    { label: '[supabase-error] lib/stage-notes-recipients.ts · from:vendor_services.select', floor: 1 },
  ] },
  { file: 'lib/supplier-night-before-email.ts', sites: [
    { label: '[supabase-error] lib/supplier-night-before-email.ts · from:events.select', floor: 1 },
    { label: '[supabase-error] lib/supplier-night-before-email.ts · from:event_vendors.select', floor: 1 },
    { label: '[supabase-error] lib/supplier-night-before-email.ts · from:supplier_night_before_email_log.insert', floor: 1 },
  ] },
  { file: 'lib/trusted-circle-recs.ts', sites: [
    { label: '[supabase-error] lib/trusted-circle-recs.ts · rpc:trusted_circle_vendor_signal', floor: 1 },
  ] },
  { file: 'lib/vendor-branches.ts', sites: [
    { label: '[supabase-error] vendor-branches: branch fee (using fallback)', floor: 1 },
    { label: '[supabase-error] lib/vendor-branches.ts · from:vendor_branches.select', floor: 1 },
  ] },
  { file: 'lib/vendor-card-copy.ts', sites: [
    { label: '[supabase-error] lib/vendor-card-copy.ts · from:vendor_services.select', floor: 1 },
  ] },
  { file: 'lib/vendor-corrections.ts', sites: [
    { label: '[supabase-error] lib/vendor-corrections.ts · from:vendor_profiles.select', floor: 1 },
  ] },
  { file: 'lib/vendor-counts.ts', sites: [
    // Both call sites emit the identical string — anchored as one label with a floor of 2.
    { label: '[supabase-error] lib/vendor-counts.ts · from:vendor_profiles.select', floor: 2 },
  ] },
  { file: 'lib/vendor-dayof-config.ts', sites: [
    // Both call sites (fetchDayOfOverride + fetchSongRequestsPaused) emit the identical string.
    { label: '[supabase-error] lib/vendor-dayof-config.ts · from:vendor_dayof_configs.select', floor: 2 },
  ] },
  { file: 'lib/vendor-deep-search-addon.ts', sites: [
    { label: '[supabase-error] vendor-deep-search-addon: price (using fallback)', floor: 1 },
    { label: '[supabase-error] lib/vendor-deep-search-addon.ts · from:vendor_deep_search_uses.select', floor: 1 },
  ] },
  { file: 'lib/vendor-earnings.ts', sites: [
    { label: '[supabase-error] lib/vendor-earnings.ts · from:platform_settings.select', floor: 1 },
  ] },
  { file: 'lib/vendor-first-steps.server.ts', sites: [
    { label: '[supabase-error] lib/vendor-first-steps.server.ts · from:vendor_services.select', floor: 1 },
    { label: '[supabase-error] lib/vendor-first-steps.server.ts · from:event_vendors.select', floor: 1 },
  ] },
  { file: 'lib/vendor-microsite.ts', sites: [
    // The trailing quote disambiguates the plain select from the "(videos)" one below.
    { label: "[supabase-error] lib/vendor-microsite.ts · from:vendor_profiles.select'", floor: 1 },
    { label: '[supabase-error] lib/vendor-microsite.ts · from:vendor_profiles.select (videos)', floor: 1 },
  ] },
];

for (const { file, sites } of LOG_SITE_FLOORS) {
  const totalFloor = sites.reduce((sum, s) => sum + s.floor, 0);
  test(`source-scan: ${file} keeps every named [supabase-error] log site (floor, not exact)`, () => {
    const text = src(file);
    for (const { label, floor } of sites) {
      const n = countOccurrences(text, label);
      assert.ok(
        n >= floor,
        `expected at least ${floor} occurrence(s) of ${JSON.stringify(label)} in ${file}, found ${n}`,
      );
    }
    // Aggregate floor as a backstop against a wholesale rewrite that keeps
    // some labels' exact text but removes others not individually listed
    // above — allowed to grow (a new, distinct site), never to shrink.
    const totalNow = countOccurrences(text, '[supabase-error]');
    console.log(`# ${file}: ${totalNow} log site(s) (floor ${totalFloor})`);
    assert.ok(
      totalNow >= totalFloor,
      `expected at least ${totalFloor} '[supabase-error]' occurrences in ${file}, found ${totalNow}`,
    );
  });
}

test('source-scan: lib/upcoming-items.ts no longer reads vendor_meetings (PR #5655, carried by the orphan-drops bundle #5697, dropped the table and its read)', () => {
  const s = src('lib/upcoming-items.ts');
  // This batch deliberately left the read alone because #5655 was deleting it.
  // #5655 has now landed via the bundle, so the stronger claim holds: the read
  // is GONE (the table was dropped), not merely "untouched".
  assert.doesNotMatch(s, /from\(\s*['"]vendor_meetings['"]\s*\)/, 'the dropped vendor_meetings table must not be read');
});

test('source-scan: the night-before email lock-insert only logs a GENUINE refusal, never the expected duplicate-claim (23505)', () => {
  const s = src('lib/supplier-night-before-email.ts');
  assert.equal(
    countOccurrences(s, "lockErr.code !== '23505'"),
    1,
    'the unique-violation (already sent) case must stay silent — only an unexpected error should log',
  );
});
