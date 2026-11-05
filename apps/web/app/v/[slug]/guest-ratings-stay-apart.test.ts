/**
 * ⭐ GUESTS' RATINGS SHOW ON THE SHOP PAGE IN THEIR OWN SECTION — never merged into the couple reviews (owner
 * 2026-11-05: "separate"; supplier claim scanner slice 5).
 *
 *   1 · the read takes only what Setnayan PUBLISHED, never a skip, and selects no guest or event column;
 *   2 · the page mounts the section AFTER the couple reviews, and the couple reviews' numbers never read it;
 *   3 · the section draws nothing with none published or a failed read, and the guest's rating otherwise.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { stripComments } from '@/lib/strip-comments';
import { GuestRatingsSection } from './_components/guest-ratings-section';

(globalThis as unknown as { React: unknown }).React = React;

const read = (p: string) => stripComments(readFileSync(join(process.cwd(), p), 'utf8'));
const PAGE = read('app/v/[slug]/page.tsx');
const SERVER = read('lib/supplier-scan.server.ts');

test('1 · the read takes only published ratings, never a skip, and no guest or event column', () => {
  const start = SERVER.indexOf('export async function readPublishedGuestRatings');
  assert.ok(start >= 0, 'readPublishedGuestRatings is gone');
  const body = SERVER.slice(start, SERVER.indexOf('\n}\n', start));
  assert.match(body, /\.eq\('state', 'published'\)/, 'only what Setnayan published');
  assert.match(body, /\.eq\('skipped', false\)/, 'a skip is not a rating');
  assert.match(body, /\.eq\('vendor_profile_id', vendorProfileId\)/, 'only this shop’s ratings');
  const select = /\.from\('supplier_scan_reviews'\)\s*\.select\('([^']+)'\)/.exec(body);
  assert.ok(select, 'the ratings select is not a literal');
  for (const col of ['guest_id', 'event_id', 'moderated_by_user_id']) {
    assert.ok(!select[1]!.split(',').map((c) => c.trim()).includes(col), `the public read must not select ${col}`);
  }
});

test('2 · the section sits after the couple reviews, and the couple reviews never read it', () => {
  const reviews = PAGE.indexOf('<ReviewsSection');
  const guests = PAGE.indexOf('<GuestRatingsSection');
  assert.ok(reviews >= 0 && guests > reviews, 'Guest ratings must follow the couple reviews');
  assert.equal((PAGE.match(/<GuestRatingsSection\b/g) ?? []).length, 1, 'one section, once');
  const reviewsProps = PAGE.slice(reviews, PAGE.indexOf('/>', reviews));
  assert.ok(!/guestRatings/.test(reviewsProps), 'the couple reviews must not be handed the guests’ ratings');
  const hero = PAGE.slice(PAGE.indexOf('function ReviewHeroMetrics'), PAGE.indexOf('function ReviewRow'));
  assert.ok(!/guestRatings|GuestRatings/.test(hero), 'the couple reviews’ average must not mix in guests’ ratings');
});

test('3 · nothing with none published or a failed read; the rating and its line otherwise', () => {
  assert.equal(renderToStaticMarkup(React.createElement(GuestRatingsSection, { ratings: null, businessName: 'Lumina' })), '');
  assert.equal(
    renderToStaticMarkup(React.createElement(GuestRatingsSection, { ratings: { count: 0, average: 0, lines: [] }, businessName: 'Lumina' })),
    '',
  );
  const html = renderToStaticMarkup(
    React.createElement(GuestRatingsSection, {
      ratings: {
        count: 1234,
        average: 4.56,
        lines: [{ reviewId: 'r1', stars: 5, line: 'Loved the strip!', service: 'Photo booth', at: '2026-11-01T10:00:00Z' }],
      },
      businessName: 'Lumina',
    }),
  );
  assert.match(html, /Guest ratings/);
  assert.match(html, /4\.6/);
  assert.match(html, /1,234 guest ratings/);
  assert.match(html, /Loved the strip!/);
  assert.match(html, /Photo booth/);
});
