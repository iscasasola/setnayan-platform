/**
 * vendor-card-layout.test.ts — the shop share card v2's rules (DECISION_LOG 2026-11-21 "SHOP SHARE CARD v2 — APPROVED
 * TO BUILD"; drawing `prototypes/shop_share_card_2026-11-21/shop_share_card_v2_fable.html`), run.
 */
import test from 'node:test';
import assert from 'node:assert/strict';

import type { PrintBadge } from '@/lib/print-badges-v84';
import {
  BADGE_ROW,
  OG_WIDTH,
  TEXT_COLUMN,
  badgeRowLefts,
  morePillWidth,
  nameSize,
  vendorCardBadgeRow,
  vendorCardLookToken,
  vendorCardProof,
  vendorCardProofWords,
  vendorCardStatus,
  vendorCardTopLine,
} from './vendor-card-layout';

const VERIFIED: PrintBadge = { kind: 'verified', key: 'verified', label: 'Setnayan Verified' };
const PARTNER: PrintBadge = { kind: 'seal', key: 'verified_partner', label: 'Verified Partner', year: 2026 };
const TOP10: PrintBadge = { kind: 'seal', key: 'top10', label: 'Top 10 Supplier', year: 2026 };
const CHOICE: PrintBadge = { kind: 'seal', key: 'clients_choice', label: "Clients' Choice", year: 2026 };
const tier = (key: string, n: number): PrintBadge =>
  ({ kind: 'tier', key, label: `${key} (${n})`, family: 'calendar', tier: n }) as unknown as PrintBadge;

// ── Top line + seal by status ──────────────────────────────────────────────────────────────────────────────────

test('not verified → "A SETNAYAN SHOP" and no seal; verified → "SETNAYAN VERIFIED"; partner → "SETNAYAN VERIFIED PARTNER"', () => {
  assert.equal(vendorCardStatus({ isDemo: false, badges: [TOP10] }), 'shop');
  assert.equal(vendorCardStatus({ isDemo: false, badges: [VERIFIED, TOP10] }), 'verified');
  assert.equal(vendorCardStatus({ isDemo: false, badges: [PARTNER, TOP10] }), 'partner');
  assert.equal(vendorCardTopLine('shop'), 'A SETNAYAN SHOP');
  assert.equal(vendorCardTopLine('verified'), 'SETNAYAN VERIFIED');
  assert.equal(vendorCardTopLine('partner'), 'SETNAYAN VERIFIED PARTNER');
});

test('the Partner seal replaces Verified — never both', () => {
  assert.equal(vendorCardStatus({ isDemo: false, badges: [PARTNER, VERIFIED] }), 'partner');
});

test('a demo shop wears no seal and says (DEMO ONLY) on the top line, as today', () => {
  assert.equal(vendorCardStatus({ isDemo: true, badges: [VERIFIED] }), 'shop');
  assert.equal(vendorCardTopLine('shop', '(DEMO ONLY)'), 'A SETNAYAN SHOP · (DEMO ONLY)');
});

// ── The proof line ─────────────────────────────────────────────────────────────────────────────────────────────

test('full proof: ★ 4.8 · 38 reviews · 120 events', () => {
  const p = vendorCardProof({ starsShown: true, trusted: { trusted_avg_rating: 4.84, trusted_review_count: 38 }, completedEvents: 120 });
  assert.equal(vendorCardProofWords(p), '4.8 · 38 reviews · 120 events');
  assert.equal(p.rating, '4.8');
});

test('no reviews yet → the stars and count are left out, events stay', () => {
  const p = vendorCardProof({ starsShown: true, trusted: { trusted_avg_rating: 0, trusted_review_count: 0 }, completedEvents: 120 });
  assert.equal(vendorCardProofWords(p), '120 events');
  assert.equal(p.rating, null);
});

test('new shop, no proof yet → no proof line at all, never "0 reviews" or "0 events"', () => {
  const p = vendorCardProof({ starsShown: true, trusted: { trusted_avg_rating: 0, trusted_review_count: 0 }, completedEvents: 0 });
  assert.equal(vendorCardProofWords(p), null);
});

test('a read that failed is left out, never shown as 0', () => {
  const p = vendorCardProof({ starsShown: true, trusted: null, completedEvents: null });
  assert.equal(vendorCardProofWords(p), null);
});

test('the page’s star gate closed (not verified, or the plan does not count stars) → no stars, events still show', () => {
  const p = vendorCardProof({ starsShown: false, trusted: { trusted_avg_rating: 4.8, trusted_review_count: 38 }, completedEvents: 3 });
  assert.equal(vendorCardProofWords(p), '3 events');
});

test('one review, one event read in the singular', () => {
  const p = vendorCardProof({ starsShown: true, trusted: { trusted_avg_rating: 5, trusted_review_count: 1 }, completedEvents: 1 });
  assert.equal(vendorCardProofWords(p), '5.0 · 1 review · 1 event');
});

// ── The badge row ──────────────────────────────────────────────────────────────────────────────────────────────

test('Verified and Verified Partner never sit in the row (they are on the logo)', () => {
  const { shown, more } = vendorCardBadgeRow([PARTNER, VERIFIED, TOP10, tier('completed_bookings', 3)]);
  assert.deepEqual(
    shown.map((b) => b.key),
    ['top10', 'completed_bookings'],
  );
  assert.equal(more, 0);
});

test('seals first (the print order is kept), at most four, then "+N"', () => {
  const list = [TOP10, CHOICE, tier('a', 1), tier('b', 2), tier('c', 3), tier('d', 4), tier('e', 5), tier('f', 1)];
  const { shown, more } = vendorCardBadgeRow(list);
  assert.equal(shown.length, BADGE_ROW.max);
  assert.deepEqual(shown.slice(0, 2).map((b) => b.key), ['top10', 'clients_choice']);
  assert.equal(more, 4);
});

test('no badges → no row; one badge → alone, centred', () => {
  assert.deepEqual(vendorCardBadgeRow([VERIFIED]), { shown: [], more: 0 });
  assert.deepEqual(badgeRowLefts(0, 0), []);
  assert.deepEqual(badgeRowLefts(1, 0), [OG_WIDTH / 2 - BADGE_ROW.medal / 2]);
});

test('the row is centred on the card, the "+N" pill included', () => {
  const lefts = badgeRowLefts(4, 4);
  const width = 4 * BADGE_ROW.medal + 4 * BADGE_ROW.gap + morePillWidth(4);
  assert.equal(lefts[0], Math.round(OG_WIDTH / 2 - width / 2));
  assert.equal(lefts[1]! - lefts[0]!, BADGE_ROW.medal + BADGE_ROW.gap);
});

test('everything that matters sits in the middle square (some chat apps cut one from the card)', () => {
  const square = { left: (OG_WIDTH - 630) / 2, right: (OG_WIDTH + 630) / 2 };
  assert.ok(TEXT_COLUMN.left >= square.left && OG_WIDTH - TEXT_COLUMN.right <= square.right);
  const lefts = badgeRowLefts(4, 99);
  assert.ok(lefts[0]! >= square.left, 'the widest row (four + "+99") stays inside the square');
});

// ── The name and the address ───────────────────────────────────────────────────────────────────────────────────

test('the drawing’s 66 px name; a long one steps down and is cut on a word', () => {
  assert.equal(nameSize('Liwanag Lights & Sound').fontSize, 66);
  assert.ok(nameSize('Liwanag Lights and Sound Events Production House').fontSize < 66);
  const long = nameSize('The Very Long Name Of A Lights And Sound Company From Quezon City Philippines');
  assert.ok(long.text.endsWith('…'));
});

test('the look token moves with the card edition and with the logo', () => {
  const a = vendorCardLookToken({ logoRef: 'r2://setnayan-media/a.png' });
  assert.equal(a, vendorCardLookToken({ logoRef: 'r2://setnayan-media/a.png' }), 'stable for the same look');
  assert.notEqual(a, vendorCardLookToken({ logoRef: 'r2://setnayan-media/b.png' }), 'a new logo is a new address');
  assert.match(a, /^[0-9a-z]+$/);
});
