/**
 * Regression guard for the Help corpus price-drift fix (2026-07-05).
 *
 * Help article bodies render at /help and /help/[slug] and are serialized
 * verbatim into FAQPage + Article JSON-LD that AI answer engines and Google
 * quote directly. Prices are admin-managed (platform_retail_catalog_v2 + the
 * vendor billing catalog) and drift, so NO peso figure, per-cycle rate, or
 * frozen live launch date may be hardcoded into a body — a stale number here
 * is invisible until a user acts on it. Bodies point at setnayan.com/pricing
 * (couple SKUs) or the vendor billing hub (vendor tiers) instead.
 *
 * Run: `pnpm test:unit`  (CI: the "unit tests" step).
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { HELP_TOPICS, ALL_HELP_ARTICLES } from './help';

const ALL_BODIES = ALL_HELP_ARTICLES.map(({ article }) => article.body).join(
  '\n',
);

test('no article body hardcodes a peso figure', () => {
  for (const { article } of ALL_HELP_ARTICLES) {
    // ₱ / PHP prefix, or a "P1,499"-style comma-grouped peso amount.
    const match = article.body.match(/₱|\bPHP\b|\bP\d{1,3},\d{3}\b/);
    assert.equal(
      match,
      null,
      `Article "${article.slug}" hardcodes a price (${match?.[0]}). ` +
        `Prices are admin-managed — point at setnayan.com/pricing instead.`,
    );
  }
});

test('the retired vendor ladder figures never reappear', () => {
  // The pre-reprice ladder was Pro ₱6,000 / Enterprise ₱10,000 per 28d.
  // These exact stale numbers must never re-enter the corpus.
  for (const stale of ['6,000', '10,000', '100,000']) {
    assert.equal(
      ALL_BODIES.includes(stale),
      false,
      `Retired/stale figure "${stale}" reappeared in the help corpus.`,
    );
  }
});

test('no article body hardcodes a frozen ISO launch date', () => {
  // e.g. "2026-06-01" pilot / "2026-12-01" public launch — these go stale.
  for (const { article } of ALL_HELP_ARTICLES) {
    const match = article.body.match(/\b20\d{2}-\d{2}-\d{2}\b/);
    assert.equal(
      match,
      null,
      `Article "${article.slug}" hardcodes a frozen date (${match?.[0]}). ` +
        `Generalize it — no frozen live dates in evergreen help copy.`,
    );
  }
});

test('corpus is non-empty (guards against an accidental wipe)', () => {
  assert.ok(HELP_TOPICS.length > 0);
  assert.ok(ALL_HELP_ARTICLES.length > 20);
});
