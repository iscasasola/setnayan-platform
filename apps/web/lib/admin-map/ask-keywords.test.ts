/**
 * 🗝 THE OWNER'S SENTENCES LAND ON THEIR FIRST ROW (ASK-KW / ASK-BRAIN, owner 14 Nov 2026).
 *
 * Every assertion runs the SHIPPED box (`rankPalette`, the function `admin-command-palette.tsx` calls) over the box's
 * own destinations — the price row is built by the same `priceRowFor` the layout's row reader uses. No scorer copy.
 *
 * Measured on `origin/main` before this change (the ranker alone):
 *   "add a new service in the catalog" → Pricing · no job
 *   "create a new promo"               → Categories (Discount codes 3rd) · only job "Create free window"
 *   "change a pricelist"               → "pricelist" an UNKNOWN word · Pax changes first
 *   "change the price of live watch"   → Pricing (the Live Watch row 2nd)
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { ADMIN_JOBS } from './admin-jobs.generated';
import { ADMIN_ROUTES } from './admin-routes.generated';
import { ASK_EXAMPLES, ASK_PLACES, ASK_VERBS, recommendationLine } from './ask-keywords';
import { learnPick, rankPalette } from './palette-rank';
import { priceRowFor } from './sku-anchor';
import { stripComments } from '@/lib/strip-comments';
import { ADMIN_TABS } from '@/lib/admin/admin-tabs';
import { buildDestinations } from '@/app/admin/_components/admin-destinations';

const HERE = dirname(fileURLToPath(import.meta.url));
const WEB = join(HERE, '..', '..');

const LIVE_WATCH = priceRowFor({ service_code: 'LIVE_STUDIO', title: 'Live Watch', is_active: true });
const ALL = buildDestinations([LIVE_WATCH]);
const box = (q: string, learned: Parameters<typeof rankPalette>[4] = []) =>
  rankPalette(ALL, q, ADMIN_JOBS, ADMIN_ROUTES, learned);

/** The owner's four sentences → what the FIRST row must say and open. */
const PINNED: ReadonlyArray<{ q: string; line: RegExp; href: string; job: string | null }> = [
  { q: 'add a new service in the catalog', line: /^Add a service → .*Categories/, href: '/admin/categories', job: 'createCanonicalLeaf' },
  { q: 'create a new promo', line: /^Create a promo code → .*Discount codes/, href: '/admin/studio?tab=discount-codes', job: 'createDiscountCode' },
  { q: 'change a pricelist', line: /^Change a price → .*Pricing/, href: '/admin/pricing?tab=pricing', job: null },
  { q: 'change the price of live watch', line: /^Change the price of Live Watch → .*Pricing/, href: LIVE_WATCH.href, job: null },
];

for (const pin of PINNED) {
  test(`"${pin.q}" → its first row`, () => {
    const r = box(pin.q);
    assert.ok(r.recommendation, `"${pin.q}" offers no recommended action`);
    assert.match(recommendationLine(r.recommendation), pin.line);
    assert.equal(r.firstHref, pin.href, `"${pin.q}" opens ${r.firstHref}`);
    assert.equal(r.recommendation.job?.name ?? null, pin.job);
    // Then the page, straight after the recommendation.
    assert.equal(r.hits[0]?.href, r.recommendation.page.href, 'the page does not follow its recommendation');
  });
}

test('"pricelist" is never a word no page has', () => {
  assert.deepEqual(box('change a pricelist').unknown, []);
  assert.deepEqual(box('palitan presyo').unknown, [], 'Taglish the table understands was called unknown');
});

test('every advertised example ("What can I ask?") is one of the pinned sentences', () => {
  const pinned = new Set(PINNED.map((p) => p.q));
  for (const ex of ASK_EXAMPLES) assert.ok(pinned.has(ex), `the box advertises "${ex}" and nothing pins it`);
});

test('the table only sends the owner to doors that exist', () => {
  const views = new Set(ADMIN_TABS.flatMap((t) => [...t.views, ...t.settings].map((v) => v.href)));
  for (const place of ASK_PLACES) {
    const isDest = ALL.some((d) => d.href === place.href && d.source !== 'row');
    assert.ok(isDest || (place.view && views.has(place.href)), `${place.key}: ${place.href} is not a page the box offers`);
    for (const job of Object.values(place.job ?? {})) {
      assert.ok(ADMIN_JOBS.some((j) => j.name === job), `${place.key}: job ${job} is not in the checklist`);
    }
  }
  const seen = new Map<string, string>();
  for (const place of ASK_PLACES) {
    for (const n of place.nouns) {
      assert.ok(!seen.has(n), `"${n}" names both ${seen.get(n)} and ${place.key}`);
      assert.ok(!ASK_VERBS[n], `"${n}" is both a verb and a noun`);
      seen.set(n, place.key);
    }
  }
});

test('the noun nearest the verb wins, not the table order', () => {
  assert.equal(box('add a new category on the taxonomy service').recommendation?.place?.key, 'catalogue');
  assert.equal(box('add a new service in the catalog').recommendation?.place?.key, 'service');
});

test('a page named outright beats the table page for its noun', () => {
  assert.equal(box('open price bands').firstHref, '/admin/pricing?tab=price-bands');
});

test('🧠 a phrase the admin picked before is ranked first, marked, and a stray pick does not erase a habit', () => {
  const learned = [{ phrase: 'create a new promo', href: '/admin/launch-offer', label: 'Launch offer', timesUsed: 3 }];
  const r = box('create a new promo', learned);
  assert.equal(r.firstHref, '/admin/launch-offer', 'the remembered pick is not first');
  assert.equal(r.learned?.href, '/admin/launch-offer');
  assert.equal(r.hits[0]?.href, '/admin/launch-offer');
  // Most-used wins on the one row the table keeps per phrase.
  assert.deepEqual(learnPick(null, '/a'), { href: '/a', timesUsed: 1, replaced: true });
  assert.deepEqual(learnPick({ href: '/a', timesUsed: 2 }, '/a'), { href: '/a', timesUsed: 3, replaced: false });
  assert.deepEqual(learnPick({ href: '/a', timesUsed: 3 }, '/b'), { href: '/a', timesUsed: 2, replaced: false });
  assert.deepEqual(learnPick({ href: '/a', timesUsed: 1 }, '/b'), { href: '/b', timesUsed: 1, replaced: true });
  // A remembered place the box no longer offers is not put first.
  assert.equal(box('create a new promo', [{ ...learned[0]!, href: '/admin/gone' }]).learned, null);
});

test('⛔ the box only navigates or prepares — the recommendation path calls no action but the memory', () => {
  const palette = stripComments(readFileSync(join(WEB, 'app/admin/_components/admin-command-palette.tsx'), 'utf8'));
  const at = palette.indexOf('const activateRecommendation = useCallback(');
  assert.ok(at > 0, 'the recommendation handler moved — re-pin this');
  const body = palette.slice(at, palette.indexOf('}, [rec, teach, openJobAsk, close, router]);', at));
  const calls = [...body.matchAll(/\b([a-zA-Z_.]+)\(/g)].map((m) => m[1]).filter((c) => c !== 'useCallback');
  assert.deepEqual(
    [...new Set(calls)].sort(),
    ['close', 'jobPrefillIsRead', 'openJobAsk', 'router.push', 'teach'].sort(),
    'the recommended row does something beyond opening a page, preparing a form or remembering the pick',
  );
  // And the memory write is the existing admin-gated door, never a new one.
  const actions = readFileSync(join(WEB, 'app/admin/_components/ask-actions.ts'), 'utf8');
  assert.equal((actions.match(/^export async function /gm) ?? []).length, 1, 'a second server action appeared');
});
