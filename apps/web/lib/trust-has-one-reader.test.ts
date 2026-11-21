/**
 * 🤝 TRUST HAS ONE READER — owner 21 Nov 2026, specs DECISION_LOG "A SHOP SHOWS AS YOUR TRUSTED SHOP ONLY AFTER ONE
 * COMPLETED, PAID BOOKING" and "TRUSTED SHOPS RANK HIGHER IN SEARCH".
 *
 * "Trusted by" on the shop page, the supplier's Partners list and the search / Explore / Find trust key all answer ONE
 * question — which shops trust this one AND qualify — and it is answered ONCE: the SQL function `shop_qualified_trust`
 * (migration 20271356577600), read only through `lib/vendor-trusted-by.ts`. Two mechanisms that disagree about the same
 * fact each pass their own suite (platform CLAUDE.md RULE 0 · 8), so this file fails when a second derivation appears:
 *
 *   1 · only lib/vendor-trusted-by.ts calls the trust RPCs;
 *   2 · the three surfaces read trust through it (and the shop page through fetchTrustedByVendors only);
 *   3 · no NEW file reads `vendor_partnerships` — each existing reader is named below with what it reads it for;
 *   4 · the trust step is defined once (lib/trust-rank.ts) and each ordering uses that comparator;
 *   5 · trust is read only for rows that already fit, and Find's date down-rank still runs after it;
 *   6 · nothing bought or granted by a plan feeds the reader (ruling (4), the 16 Nov "No one can pay to rank above you");
 *   7 · the step curve is diminishing (doubling) and more trust ranks higher among equal fits; a refused read moves nobody.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { stripComments } from '@/lib/strip-comments';
import { compareTrust, trustStep } from '@/lib/trust-rank';

const WEB = join(dirname(fileURLToPath(import.meta.url)), '..');
const REPO = join(WEB, '..', '..');
const read = (rel: string) => readFileSync(join(WEB, rel), 'utf8');
const code = (rel: string) => stripComments(read(rel));

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    if (name === 'node_modules' || name === '.next') continue;
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (/\.(ts|tsx)$/.test(name) && !/\.test\.(ts|tsx)$/.test(name)) out.push(relative(WEB, p));
  }
  return out;
}
const SOURCES = [...walk(join(WEB, 'app')), ...walk(join(WEB, 'lib'))].sort();

const READER = 'lib/vendor-trusted-by.ts';

test('1 · only lib/vendor-trusted-by.ts calls the trust RPCs', () => {
  const callers = SOURCES.filter((f) =>
    /rpc\(\s*['"`](shop_qualified_trust|shop_qualified_trust_counts|shop_completed_paid_booking_counts)['"`]|QUALIFIED_TRUST(_COUNTS)?_RPC\b/.test(
      code(f),
    ),
  );
  assert.deepEqual(callers, [READER], `a second caller of the trust reader: ${callers.join(', ')}`);
});

test('2 · each surface reads trust through the one reader', () => {
  const page = code('app/v/[slug]/page.tsx');
  assert.equal((page.match(/fetchTrustedByVendors\(/g) ?? []).length, 1, 'the shop page reads Trusted by once');
  assert.doesNotMatch(page, /vendor_partnerships|shop_worked_with_counts/, 'the shop page derives no trust of its own');
  assert.match(code('app/vendor-dashboard/partnerships/page.tsx'), /fetchQualifiedTrustedIds\(createAdminClient\(\), myId\)/);
  for (const f of [
    'app/(shell)/explore/_lib/marketplace-view.tsx',
    'app/dashboard/[eventId]/vendors/_actions/category-search.ts',
    'app/dashboard/[eventId]/vendors/_actions/bench-marketplace-search.ts',
  ]) {
    assert.match(code(f), /fetchQualifiedTrustCounts\(/, `${f} reads the trust count from the one reader`);
  }
  const reader = code(READER);
  assert.doesNotMatch(reader, /\.from\(\s*['"]vendor_partnerships['"]\s*\)/, 'the reader itself reads the SQL, not the table');
});

/** Every file that may read `vendor_partnerships` directly, and why — none of them derives trust. */
const PARTNERSHIP_TABLE_READERS: Record<string, string> = {
  'app/(shell)/explore/_lib/marketplace-view.tsx': 'the couple-relative partnership BADGE on a card (PR #6), not trust',
  'app/admin/vendor-partnerships/actions.ts': 'admin moderation writes',
  'app/admin/vendor-partnerships/page.tsx': 'admin moderation list',
  'app/vendor-dashboard/partnerships/actions.ts': 'propose / accept / withdraw writes',
  'app/vendor-dashboard/partnerships/page.tsx': 'the shop’s own links (the inbox); trust comes from the reader',
  'app/vendor-dashboard/performance/_components/one-analytics-section.tsx': 'the shop’s own link count',
  'lib/badge-earned.server.ts': 'the Trusted-by / Invites badges (15–16 Nov counting rules)',
  'lib/supplier-invite.server.ts': 'the Invites record (brought_new_shop)',
};

test('3 · no new file reads vendor_partnerships (a second trust derivation starts there)', () => {
  const readers = SOURCES.filter((f) => /\.from\(\s*['"]vendor_partnerships['"]\s*\)/.test(code(f)));
  const unexpected = readers.filter((f) => !(f in PARTNERSHIP_TABLE_READERS));
  assert.deepEqual(
    unexpected,
    [],
    'A new reader of vendor_partnerships. If it shows or counts TRUST, read lib/vendor-trusted-by.ts instead; ' +
      'otherwise add it to PARTNERSHIP_TABLE_READERS with one line saying what it reads the table for.',
  );
  const stale = Object.keys(PARTNERSHIP_TABLE_READERS).filter((f) => !readers.includes(f));
  assert.deepEqual(stale, [], 'a listed reader no longer reads the table — remove its line');
});

test('4 · the trust step is defined once, and every ordering uses that comparator right after fit', () => {
  const definers = SOURCES.filter((f) => /function\s+(trustStep|compareTrust)\b/.test(code(f)));
  assert.deepEqual(definers, ['lib/trust-rank.ts']);
  const explore = code('app/(shell)/explore/_lib/marketplace-view.tsx');
  // The always-run pass: depth (the couple's own) → TRUST → partnership priority → quality.
  assert.match(explore, /if \(depthDiff !== 0\) return depthDiff;\s*const trustDiff = compareTrust\(trustCounts,/);
  // The default sort (`most_reviews`) and `highest_rated`: TRUST first, then the merit keys.
  assert.match(explore, /visible = \[\.\.\.visible\]\.sort\(\(a, b\) => \{\s*const trustDiff = compareTrust\(trustCounts,[\s\S]{0,2000}?if \(filters\.sort === 'highest_rated'\)/);
  // A lens: depth → TRUST → lens score.
  assert.match(explore, /if \(depth !== 0\) return depth;\s*const trustDiff = compareTrust\(trustCounts,[\s\S]{0,1000}?scoreOf\.get/);
  const find = code('app/dashboard/[eventId]/vendors/_actions/category-search.ts');
  // Each rung: its fit keys (depth, the couple's facets) → TRUST → the rung's own keys.
  assert.match(find, /b\._depth - a\._depth \|\|\s*\(facetSelected \? b\._facetMatch - a\._facetMatch : 0\) \|\|\s*byTrust\(a, b\) \|\|\s*b\._adRank/);
  assert.match(find, /\(facetSelected \? b\._facetMatch - a\._facetMatch : 0\) \|\|\s*byTrust\(a, b\) \|\|\s*b\._reviews - a\._reviews/);
  assert.match(find, /return b\._facetMatch - a\._facetMatch;\s*\}\s*const trustDiff = byTrust\(a, b\);\s*if \(trustDiff !== 0\) return trustDiff;\s*if \(smartSort/);
  const bench = code('app/dashboard/[eventId]/vendors/_actions/bench-marketplace-search.ts');
  assert.match(bench, /\.sort\(\(a, b\) => compareTrust\(trustCounts, a\.vendor_profile_id, b\.vendor_profile_id\)\)\s*\.slice\(0, MAX_RESULTS\)/);
});

test('5 · trust is read only for rows that already fit; it never adds a row; the date down-rank runs after it', () => {
  const explore = code('app/(shell)/explore/_lib/marketplace-view.tsx');
  assert.match(explore, /fetchQualifiedTrustCounts\(createAdminClient\(\), visibleVendorIds\)/, 'only the cards on the page');
  const find = code('app/dashboard/[eventId]/vendors/_actions/category-search.ts');
  assert.match(find, /fetchQualifiedTrustCounts\(\s*admin,\s*recs\.map\(\(r\) => r\.vendor_profile_id\),?\s*\)/, 'only the fit-gated recs');
  const trustAt = find.indexOf('byTrust(a, b)');
  const dateAt = find.indexOf('...ordered.filter((s) => !s.serviceDateAvailable)');
  assert.ok(trustAt > 0 && dateAt > trustAt, 'busy-on-the-date shops still sink below every free one, trusted or not');
  const bench = code('app/dashboard/[eventId]/vendors/_actions/bench-marketplace-search.ts');
  assert.match(bench, /fetchQualifiedTrustCounts\(\s*admin,\s*inScope\.map/, 'only the rows that matched the words');
});

test('6 · nothing bought or granted by a plan feeds trust (16 Nov: "No one can pay to rank above you")', () => {
  const sql = readFileSync(
    join(REPO, 'supabase/migrations/20271356577600_trusted_shops_qualify_after_a_completed_paid_booking.sql'),
    'utf8',
  )
    .split('\n')
    .filter((l) => !l.trim().startsWith('--'))
    .join('\n');
  for (const bought of ['tier_state', 'vendor_subscriptions', 'vendor_active_ads', 'ad_rank', 'booking_fee_charges', 'plan_']) {
    assert.ok(!sql.includes(bought), `the trust SQL must not read ${bought}`);
  }
  // The reader's trust half (the two exported reads) and the step: no tier, plan, ad or subscription. (Further down,
  // fetchTrustedByVendors reads tier_state only to decide whether a NAME may be shown — never who counts.)
  const reader = code(READER);
  const trustHalf = reader.slice(reader.indexOf('QUALIFIED_TRUST_RPC ='), reader.indexOf('async function fetchTrustedByVendors'));
  assert.ok(trustHalf.length > 200, 'the trust half of the reader was found');
  for (const [f, src] of [
    [READER, trustHalf],
    ['lib/trust-rank.ts', code('lib/trust-rank.ts')],
  ] as const) {
    assert.doesNotMatch(src, /tier_state|isTrueNameTier\(|ad_rank|subscription|plan/i, `${f} reads nothing bought`);
  }
});

test('7 · more trust ranks higher among equal fits, with diminishing returns; a refused read moves nobody', () => {
  assert.deepEqual([0, 1, 2, 3, 4, 7, 8, 15, 16].map(trustStep), [0, 1, 2, 2, 3, 3, 4, 4, 5]);
  assert.equal(trustStep(null), 0);
  assert.equal(trustStep(-3), 0);
  const counts = new Map([
    ['many', 9],
    ['some', 4],
    ['two', 2],
    ['three', 3],
    ['one', 1],
  ]);
  // Equal fits, shipped order alphabetical: trust reorders them, stable within a step.
  const fits = ['new', 'one', 'some', 'many', 'three', 'two'];
  const ordered = [...fits].sort((a, b) => compareTrust(counts, a, b));
  assert.deepEqual(ordered, ['many', 'some', 'three', 'two', 'one', 'new']);
  // Diminishing: 2 and 3 share a step, so the chain's next key (here, the shipped order) decides.
  assert.equal(compareTrust(counts, 'two', 'three'), 0);
  // A refused read (null): the shipped order is unchanged.
  assert.deepEqual([...fits].sort((a, b) => compareTrust(null, a, b)), fits);
});

test('7b · a non-fit shop is never lifted: trust only reorders the rows it is given', () => {
  // A shop that does not fit is not in the rows the ordering receives, however much trust it has.
  const counts = new Map([['far-away-but-trusted', 64]]);
  const fitting = ['a', 'b', 'c'];
  const ordered = [...fitting].sort((x, y) => compareTrust(counts, x, y));
  assert.deepEqual(ordered, fitting);
  assert.ok(!ordered.includes('far-away-but-trusted'));
  // And Find's down-rank of a shop busy on the date runs after trust: a busy, trusted shop stays below a free one.
  const busy = new Set(['trusted-busy']);
  const rows = ['plain-free', 'trusted-busy'].sort((x, y) => compareTrust(new Map([['trusted-busy', 9]]), x, y));
  const afterDate = [...rows.filter((r) => !busy.has(r)), ...rows.filter((r) => busy.has(r))];
  assert.deepEqual(afterDate, ['plain-free', 'trusted-busy']);
});
