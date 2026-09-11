/**
 * Guards the FILE SET for "a shop with no reviews shows 'New', never '☆ 0.0
 * · 0'" (owner ruling 2026-09-11, seen on the bench "more" row's Saysay
 * card).
 *
 * Root cause: `vendor_market_stats.avg_rating_overall` is
 * `COALESCE(..., 0)` at the database layer — it is NEVER NULL — so a
 * display site that guarded only `rating != null` (or `rating ?? null`)
 * let a brand-new shop's 0 straight through as if it were a real average,
 * and paired it with `reviewCount` (also a real 0, not null) to print
 * "☆ 0.0 · 0". The single root fix is in
 * app/dashboard/[eventId]/vendors/_actions/category-search.ts, which now
 * nulls the rating at the source for both its readers (the category-search
 * overlay and the bench "more" row). Every OTHER surface below either
 * already null-guarded the rating (`rating > 0 ? rating : null`, upstream)
 * or now does — this test's job is to make sure every one of them renders
 * the shop page's own "New to Setnayan" line instead of silently hiding
 * or (the old bug) printing the fake average.
 *
 * This test is a structural guard, not a full render test (several of
 * these are React Server/Client Components with async data fetching that
 * doesn't fit node:test in isolation): it reads each fixed file's SOURCE
 * (comments stripped, via the repo's one shared stripper) and asserts the
 * exact literal copy is imported and referenced. Combined with
 * lib/reviews.test.ts's unit coverage of `isNewToSetnayan` and
 * `NEW_TO_SETNAYAN_LABEL`, that is enough to prove the fix is wired, not
 * merely typed correctly.
 *
 * NOT touched here (explicitly out of scope, see the 2026-09-11 brief):
 *   - app/v/[slug]/page.tsx — the shop page's OWN header already hides its
 *     rating chip entirely when there are no reviews (never rendered a fake
 *     0.0), so nothing there needed fixing; its empty-reviews BLOCK further
 *     down is F2's to own.
 *
 * Run: `pnpm test:unit` (globs lib/**\/*.test.ts + app/**\/*.test.ts, tsx --test).
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { stripComments } from './strip-comments';
import { NEW_TO_SETNAYAN_LABEL } from './reviews';

const read = (rel: string) => stripComments(readFileSync(join(process.cwd(), rel), 'utf8'));

/** Every surface a couple sees a shop's star + average + count on, fixed to
 * show NEW_TO_SETNAYAN_LABEL for a 0-review shop. */
const FIXED_SURFACES = [
  // The bench "more" row + bench inline marketplace-search results, and the
  // main shortlisted-vendor bench card.
  'app/dashboard/[eventId]/vendors/_components/shortlist-categories.tsx',
  // The category search overlay ("Find" from a bench category).
  'app/dashboard/[eventId]/vendors/_components/category-search-overlay.tsx',
  // The Plan & Budget accordion's vendor cards + its compare sheet.
  'app/dashboard/[eventId]/vendors/_components/plan-budget-accordion.tsx',
  // The desktop quick-view inspector opened from a bench card.
  'app/dashboard/[eventId]/vendors/_components/vendor-quickview-inspector.tsx',
  // The marketplace/explore card (used by /explore's main grid + search).
  'app/(shell)/explore/_components/vendor-card.tsx',
  // The /explore comparison table.
  'app/(shell)/explore/compare/page.tsx',
  // The folder preview cards on /explore.
  'app/(shell)/explore/_components/folder-vendors-section.tsx',
  // The pre-signup guided tour's vendor cards (real vendor_market_stats data).
  'app/tour/vendors/_components/tour-shortlist.tsx',
];

for (const rel of FIXED_SURFACES) {
  test(`${rel} shows "${NEW_TO_SETNAYAN_LABEL}" for a 0-review shop`, () => {
    const src = read(rel);
    const importsLabel =
      /NEW_TO_SETNAYAN_LABEL/.test(src) || new RegExp(NEW_TO_SETNAYAN_LABEL).test(src);
    assert.ok(
      importsLabel,
      `${rel} must import/use NEW_TO_SETNAYAN_LABEL (or the literal copy) from '@/lib/reviews'`,
    );
    assert.match(
      src,
      /from ['"]@\/lib\/reviews['"]/,
      `${rel} must import from '@/lib/reviews'`,
    );
  });
}

test('category-search.ts nulls a 0 rating at the shared source (root fix)', () => {
  const src = read('app/dashboard/[eventId]/vendors/_actions/category-search.ts');
  // The old bug: `rating: r.avg_rating_overall ?? null,` — only replaces
  // null/undefined, so a real 0 (every 0-review shop, per the view's
  // COALESCE) sailed straight through as a "real" rating.
  assert.doesNotMatch(
    src,
    /rating:\s*r\.avg_rating_overall\s*\?\?\s*null\s*,/,
    'must not null-coalesce avg_rating_overall directly — 0 is a real value from the view, not a missing one',
  );
  assert.match(
    src,
    /r\.avg_rating_overall\s*>\s*0/,
    'must positively guard avg_rating_overall > 0 before treating it as a real rating',
  );
});

test('NEW_TO_SETNAYAN_LABEL matches the shop page hero copy verbatim', () => {
  const shopPage = read('app/v/[slug]/page.tsx');
  assert.ok(
    shopPage.includes(NEW_TO_SETNAYAN_LABEL),
    'lib/reviews.ts NEW_TO_SETNAYAN_LABEL must be the exact string the shop page itself uses',
  );
});
