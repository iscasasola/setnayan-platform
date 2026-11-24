/**
 * 🤝 TRUST HAS ONE READER — owner 21 Nov 2026 (specs DECISION_LOG "TRUST NEEDS ONE COMPLETED, PAID EVENT THE TWO SHOPS
 * SERVED TOGETHER", "TRUSTED SHOPS RANK HIGHER IN SEARCH", "PARTNERSHIPS — INVITE A SUPPLIER … (drawing v7)"):
 * *"one reader feeds every count"*, so a badge, "Trusted by" and search never disagree.
 *
 *   1 · only lib/vendor-trusted-by.ts calls the database reader (`shop_trust`, `shop_trust_counts`);
 *   2 · every surface reads trust through it — Trusted by, the Partners list, the Invites badge, and the three searches;
 *   3 · nobody starts a new direct `vendor_partnerships` read (a second way to work trust out);
 *   4 · in each search chain trust sits right after fit, and a sort the couple picked stays theirs;
 *   5 · no strength number lives in code: the step comes from the owner's admin setting, read in the database;
 *   6 · the database: "served together" is narrowed in its ONE definition, both bookings must count, and nothing bought
 *       or granted by a plan feeds trust;
 *   7 · "Waiting for your first event together" is said on the shop's own Partnerships page only;
 *   8 · compareTrust: the higher step first, the same step falls through, a refused read moves nobody.
 *
 * Run: npx tsx --test lib/trust-has-one-reader.test.ts
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, dirname, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

import { stripComments } from './strip-comments';
import { compareTrust } from './trust-rank';

const WEB = join(dirname(fileURLToPath(import.meta.url)), '..');
const ROOT = join(WEB, '..', '..');
const read = (rel: string) => readFileSync(join(WEB, rel), 'utf8');
const code = (rel: string) => stripComments(read(rel));
const MIGRATION = readFileSync(
  join(ROOT, 'supabase', 'migrations', '20271361607663_trust_needs_one_completed_paid_event_served_together.sql'),
  'utf8',
);

/** Every non-test source file under the web app (no node_modules, no .next). */
function sources(): string[] {
  const out: string[] = [];
  const walk = (dir: string) => {
    for (const name of readdirSync(dir)) {
      if (name === 'node_modules' || name === '.next' || name.startsWith('.')) continue;
      const full = join(dir, name);
      if (statSync(full).isDirectory()) walk(full);
      else if (/\.(ts|tsx)$/.test(name) && !/\.test\.tsx?$/.test(name) && !full.includes(`${'/'}tests${'/'}`)) {
        out.push(relative(WEB, full));
      }
    }
  };
  for (const top of ['app', 'lib', 'components']) walk(join(WEB, top));
  return out;
}

const SEARCH = {
  explore: 'app/(shell)/explore/_lib/marketplace-view.tsx',
  find: 'app/dashboard/[eventId]/vendors/_actions/category-search.ts',
  box: 'app/dashboard/[eventId]/vendors/_actions/bench-marketplace-search.ts',
} as const;

test('1 · only lib/vendor-trusted-by.ts calls the database reader', () => {
  const callers = sources().filter((f) => /rpc\(\s*'shop_trust(_counts)?'/.test(code(f)));
  assert.deepEqual(callers, ['lib/vendor-trusted-by.ts']);
  const reader = code('lib/vendor-trusted-by.ts');
  assert.match(reader, /rpc\('shop_trust', \{ p_vendor_profile_ids: ids \}\)/);
  assert.match(reader, /rpc\('shop_trust_counts', \{ p_vendor_profile_ids: ids \}\)/);
  // The old per-surface derivations are gone from the reader.
  assert.doesNotMatch(reader, /from\('vendor_partnerships'\)/, 'Trusted by works trust out a second way');
  assert.doesNotMatch(reader, /shop_worked_with_counts/, 'a shop served with but never partnered is not trusted');
});

test('2 · every surface reads trust through the one reader', () => {
  assert.match(code('app/v/[slug]/page.tsx'), /fetchTrustedByVendors\(admin, vendor\.vendor_profile_id\)/);
  assert.match(code('app/vendor-dashboard/partnerships/page.tsx'), /fetchShopTrust\(createAdminClient\(\), \[myId\]\)/);
  assert.match(code('lib/supplier-invite.server.ts'), /fetchShopTrust\(admin, \[vendorProfileId\]\)/, 'the Invites badge');
  for (const f of Object.values(SEARCH)) {
    const src = code(f);
    assert.match(src, /fetchTrustSearchSteps\(/, `${f} reads the trust step`);
    assert.match(src, /compareTrust\(/, `${f} sorts by it`);
  }
});

test('3 · no new direct vendor_partnerships reader', () => {
  const readers = sources()
    .filter((f) => /from\('vendor_partnerships'\)/.test(code(f)))
    .sort();
  assert.deepEqual(readers, [
    'app/(shell)/explore/_lib/marketplace-view.tsx', // the partnership BADGE on a card (its kind), not trust
    'app/admin/vendor-partnerships/actions.ts',
    'app/admin/vendor-partnerships/page.tsx',
    'app/vendor-dashboard/partnerships/actions.ts', // the writes
    'app/vendor-dashboard/partnerships/page.tsx', // the rows themselves; their status comes from fetchShopTrust
    'app/vendor-dashboard/performance/_components/one-analytics-section.tsx',
    'lib/badge-earned.server.ts', // which shops to re-check, not a count
    'lib/supplier-invite.server.ts', // "N joined through your link", not trust
  ]);
});

test('4 · trust sits right after fit in every chain; a sort the couple picked stays theirs', () => {
  const explore = code(SEARCH.explore);
  // The relevance pass: depth (the couple's own fit), then trust, then partnership priority.
  assert.match(
    explore,
    /if \(depthDiff !== 0\) return depthDiff;\s*const trustDiff = compareTrust\(trustSteps, a\.vendor_profile_id, b\.vendor_profile_id\);\s*if \(trustDiff !== 0\) return trustDiff;\s*const partDiff/,
  );
  // Highest rated (picked): rating, volume, then trust only as a tie-break.
  assert.match(explore, /const v = reviewsOf\(b\) - reviewsOf\(a\);[\s\S]{0,80}if \(v !== 0\) return v;\s*return compareTrust\(/);
  // Most reviews (the default): trust first.
  assert.match(explore, /const t = compareTrust\(trustSteps[^)]*\);\s*if \(t !== 0\) return t;\s*const c = reviewsOf\(b\) - reviewsOf\(a\);/);
  // A lens (picked): its score, then trust.
  assert.match(explore, /\(scoreOf\.get\(b\.vendor_profile_id\) \?\? 0\) - \(scoreOf\.get\(a\.vendor_profile_id\) \?\? 0\) \|\|\s*compareTrust\(/);
  // A refused read moves nobody.
  assert.match(explore, /const trustSteps = trustRead === TRUSTED_BY_UNREADABLE \? null : trustRead;/);

  const find = code(SEARCH.find);
  assert.match(find, /b\._depth - a\._depth \|\|\s*\(facetSelected \? b\._facetMatch - a\._facetMatch : 0\) \|\|\s*byTrust\(a, b\) \|\|\s*b\._adRank/);
  assert.match(find, /\(facetSelected \? b\._facetMatch - a\._facetMatch : 0\) \|\|\s*byTrust\(a, b\) \|\|\s*b\._reviews - a\._reviews/);
  assert.match(find, /return b\._facetMatch - a\._facetMatch;\s*\}\s*const trustDiff = byTrust\(a, b\);/);
  // Trust is read for the rows that already passed every fit gate — never a new candidate list.
  assert.match(find, /fetchTrustSearchSteps\(\s*admin,\s*recs\.map\(\(r\) => r\.vendor_profile_id\),?\s*\)/);

  const box = code(SEARCH.box);
  assert.match(box, /const inScope = [\s\S]{0,140}shopInEventScope\(scope, r\.vendor_profile_id\)\);/);
  assert.match(box, /\[\.\.\.inScope\]\s*\.sort\(\(a, b\) => compareTrust\(trustSteps, a\.vendor_profile_id, b\.vendor_profile_id\)\)\s*\.slice\(0, MAX_RESULTS\)/);
});

test('5 · no strength number lives in code — the step is the owner\'s admin setting', () => {
  const rank = code('lib/trust-rank.ts');
  assert.doesNotMatch(rank, /Math\.(log|log2|pow|sqrt)|\*\*/, 'a curve is worked out in code');
  assert.doesNotMatch(rank, /\b[1-9]\d*\b/, 'a number in the comparator');
  assert.match(MIGRATION, /ADD COLUMN IF NOT EXISTS trust_search_step INTEGER;/);
  assert.doesNotMatch(MIGRATION, /UPDATE public\.platform_settings/, 'the owner\'s number is left blank, never seeded');
  assert.match(MIGRATION, /WHEN \(SELECT base FROM s\) IS NULL OR c\.counted < 1 THEN 0/, 'blank → nobody is lifted');
  assert.match(code('app/admin/settings/actions.ts'), /trust_search_step: n,/);
  assert.match(read('app/admin/settings/_surfaces/settings-surface.tsx'), /name="trust_search_step"/);
});

test('6 · the database: one definition narrowed, both bookings count, nothing bought feeds trust', () => {
  const together = MIGRATION.slice(
    MIGRATION.indexOf('CREATE OR REPLACE FUNCTION public.vendor_served_together_rows'),
    MIGRATION.indexOf('COMMENT ON FUNCTION public.vendor_served_together_rows'),
  );
  assert.match(together, /booking_counts_for_trust\(mine\.vendor_id\)/);
  assert.match(together, /booking_counts_for_trust\(theirs\.vendor_id\)/);
  const reader = MIGRATION.slice(
    MIGRATION.indexOf('CREATE OR REPLACE FUNCTION public.shop_trust('),
    MIGRATION.indexOf('COMMENT ON FUNCTION public.shop_trust('),
  );
  assert.match(reader, /public\.vendor_served_together_rows\(m\.me\)/, 'trust reads the ONE served-together definition');
  for (const bought of ['tier_state', 'vendor_active_ads', 'boost', 'subscription', 'plan_code']) {
    assert.ok(!reader.includes(bought), `trust reads ${bought}`);
  }
  const counts = MIGRATION.slice(MIGRATION.indexOf('CREATE OR REPLACE FUNCTION public.shop_trust_counts'));
  assert.match(counts, /FROM public\.shop_trust\(p_vendor_profile_ids\) t/, 'the counts come FROM the one reader');
  const booking = MIGRATION.slice(
    MIGRATION.indexOf('CREATE OR REPLACE FUNCTION public.booking_counts_for_trust'),
    MIGRATION.indexOf('COMMENT ON FUNCTION public.booking_counts_for_trust'),
  );
  for (const rule of ['event_vendor_refunds', "delete_request_state", 'is_sample', 'is_internal', 'event_vendor_payments', 'vendor_event_proof_route']) {
    assert.ok(booking.includes(rule), `a booking that counts must check ${rule}`);
  }
  for (const fn of ['shop_trust(uuid[])', 'shop_trust_counts(uuid[])', 'booking_counts_for_trust(uuid)']) {
    assert.ok(MIGRATION.includes(`REVOKE ALL ON FUNCTION public.${fn} FROM PUBLIC, anon, authenticated;`), `${fn} is server-only`);
  }
});

test('7 · "Waiting for your first event together" is said on the shop\'s own Partnerships page only', () => {
  const said = sources().filter((f) => code(f).includes('Waiting for your first event together'));
  assert.deepEqual(said, ['app/vendor-dashboard/partnerships/page.tsx']);
  const page = code('app/vendor-dashboard/partnerships/page.tsx');
  assert.match(page, /trusted === false\s*\?\s*WAITING_FOR_FIRST_EVENT/);
  assert.match(page, /trusted === true \? \(/, 'the Trusted tag shows only when the reader said so');
  assert.match(page, /We couldn&rsquo;t check which partners are trusted right now/, 'a refused read says so');
});

test('8 · compareTrust: the higher step first, the same step falls through, a refused read moves nobody', () => {
  const steps = new Map([
    ['a', 3],
    ['b', 1],
    ['c', 1],
  ]);
  assert.ok(compareTrust(steps, 'a', 'b') < 0, 'a (step 3) before b (step 1)');
  assert.ok(compareTrust(steps, 'b', 'a') > 0);
  assert.equal(compareTrust(steps, 'b', 'c'), 0, 'the same step → the chain\'s next key');
  assert.ok(compareTrust(steps, 'b', 'zzz') < 0, 'a shop with no trust sits after one with some');
  assert.equal(compareTrust(null, 'a', 'b'), 0, 'refused → the order stays as it was');
  // Sorting never adds or drops a row.
  const rows = ['b', 'zzz', 'a', 'c'];
  const sorted = [...rows].sort((x, y) => compareTrust(steps, x, y));
  assert.deepEqual(sorted, ['a', 'b', 'c', 'zzz']);
  assert.equal(sorted.length, rows.length);
});
