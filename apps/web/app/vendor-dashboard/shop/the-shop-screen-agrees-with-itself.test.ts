/**
 * 🔒 THE SHOP SCREEN AGREES WITH ITSELF (supplier walk on production, shop "SetnaProd", 13 Nov 2026).
 *
 * Measured on prod for SetnaProd: `vendor_profile_views` 127 in 30 days · `chat_threads` 1 in 30 days ·
 * `vendor_reviews` 3 rows, all `booked_through_setnayan = false` → `vendor_trusted_review_stats` 0 ·
 * `vendor_activity_stats.review_count` 3 · `vendor_public_completed_events_stats` 0. The page said:
 *
 *   1 · "Opened 0 … 127 couples opened your page" and "Asked 0 … 1 couple asked" — the card's big figure was a HELD
 *       zero (`HeldCount` inside a card not yet seen prints 0) in the server HTML, a hidden tab and the a11y tree, beside
 *       the card's own true line. Pinned by rendering the carousel on the server: every figure is the true count.
 *   2 · "4.2 ★ · 3 reviews" (the Analytics card, off `vendor_activity_stats` — every review) and "No reviews yet" (the
 *       Rating badge, off the trusted stat). The card now reads the trusted stat — the cover's, the badge's and the
 *       public page's — through `trustedRating`.
 *
 * "0 events" on the cover is TRUE (events finished on Setnayan = 0) and was left as it is.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { stripComments } from '@/lib/strip-comments';
import { trustedRating } from '@/lib/business-doing';

(globalThis as unknown as { React: unknown }).React = React;
/* The carousel imports CSS — stubbed, as `lib/a-held-carousel-card-stays-put.test.ts` does. */
{
  const Mod = require('node:module');
  Mod._extensions['.css'] = (m: { exports: unknown }) => {
    m.exports = new Proxy({}, { get: (_t, k) => (k === '__esModule' ? false : String(k)) });
  };
}

const SECTION = stripComments(readFileSync(join(__dirname, '../performance/_components/one-analytics-section.tsx'), 'utf8'));

test('1 · an unseen count card prints its TRUE figure, never a held 0 beside its own line', async () => {
  const { AnalyticsCarousel } = await import('../performance/_components/analytics-carousel');
  const html = renderToStaticMarkup(
    React.createElement(AnalyticsCarousel, {
      locked: {
        progress: 'Papers 2 of 4',
        totals: { '30': { views: 127, inquiries: 1, quotes: 1, booked: 0 }, '12': { views: 374, inquiries: 1, quotes: 1, booked: 0 } },
      },
    }),
  );
  const figure = (word: string) => {
    const m = html.match(new RegExp(`data-analytics-figure="${word}"[^>]*>([\\s\\S]*?)<small>`));
    assert.ok(m, `no ${word} figure rendered`);
    return m![1]!.replace(/<[^>]+>/g, '').trim();
  };
  assert.equal(figure('opened'), '127', 'Opened prints a held number, not the 127 its line says');
  assert.equal(figure('asked'), '1', 'Asked prints a held number, not the 1 its line says');
  assert.equal(figure('booked'), '0');
  assert.match(html, /127 couples opened your page in the last 30 days\./);
  assert.match(html, /1 couple asked in the last 30 days\./);
});

test('2 · the reviews card says what the badge says — the trusted stat, one source', () => {
  // SetnaProd: 3 reviews, none trusted → the card says what the Rating badge says.
  assert.deepEqual(trustedRating({ trusted_avg_rating: 0, trusted_review_count: 0 }), { line: 'No reviews yet', avg: null, count: 0 });
  assert.deepEqual(trustedRating({ trusted_avg_rating: 4.5, trusted_review_count: 2 }), { line: '4.5 ★ · 2 reviews', avg: 4.5, count: 2 });
  // A refused read is said, never "No reviews yet".
  assert.equal(trustedRating(null).line, 'Couldn’t load');
  // The section feeds the card from the badge facts' trusted stat — not from `vendor_activity_stats`.
  assert.match(SECTION, /trustedRating\(badgeFacts \? badgeFacts\.trusted : null\)/);
  assert.match(SECTION, /rating: repRating\.line,\s*ratingAvg: repRating\.avg,\s*ratingCount: repRating\.count,/);
  assert.doesNotMatch(SECTION, /ratingAvg: statsRow|ratingCount: Number\(statsRow|ratingLine\(statsRead\)/, 'the card reads every review again');
});
