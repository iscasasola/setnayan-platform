/**
 * 🛡 FAKE PROOF FIXES — the app half (owner 2026-11-23, specs DECISION_LOG b89e2420; the SQL half is pinned by
 * tests/db/fake-proof-counts-only-arms-length.db.test.ts).
 *
 * Fails if:
 *   B · Generous Giver stops asking for 5 different couples (the rule's words and its threshold move together);
 *   C · a booked review that does not count stops wearing the supplier's-own-client pill, or a counting one starts to;
 *       a service card quotes a review its own number leaves out; the shop page or the supplier sheet stops reading the
 *       PUBLIC review view (held reviews would publish, and the pill would never know);
 *   C · the owner's N stops being editable on Admin › Settings, or the field loses its "blank = not set" shape;
 *   D · the screener goes back to an after() task (the review was public and counted until it ran), or resolving a
 *       review flag stops re-rendering the shop's page.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

import { CARD_BADGES, CARD_BADGE_THRESHOLDS, passingCardBadges, type CardBadgeFacts } from './card-badges';
import { reviewIsOwnClient } from './reviews';
import { buildCardReviews } from './card-reviews';
import { stripComments } from './strip-comments';

const WEB = path.join(__dirname, '..');
const read = (rel: string) => fs.readFileSync(path.join(WEB, rel), 'utf8');
/** Comments out (the one shared stripper), so a guard never matches the note that explains a fix. */
const code = (src: string) => stripComments(src);

const card = (over: Partial<CardBadgeFacts>): CardBadgeFacts => ({
  id: 'c1',
  published: true,
  paid_bookings: 0,
  paid_couples: 0,
  paid_with_gift: 0,
  five_star_capped: 0,
  under_four: 0,
  couples_now: 0,
  couples_before: 0,
  inquiries: [],
  ...over,
});

test('B · Generous Giver needs 5 different couples — one account’s five gifted bookings are not enough', () => {
  assert.equal(CARD_BADGE_THRESHOLDS.generous_giver.couples, 5);
  assert.match(CARD_BADGES.generous_giver.rule, /from 5 different couples/);
  const now = Date.now();
  const oneCouple = card({ paid_bookings: 5, paid_couples: 1, paid_with_gift: 5 });
  const five = card({ paid_bookings: 5, paid_couples: 5, paid_with_gift: 5 });
  assert.ok(!passingCardBadges(oneCouple, true, now).includes('generous_giver'), 'B: one couple account earned Generous Giver');
  assert.ok(passingCardBadges(five, true, now).includes('generous_giver'));
  assert.ok(!passingCardBadges(card({ paid_bookings: 5, paid_couples: 1 }), true, now).includes('hot_booking'));
});

test('C · a booked review that does not count wears the supplier’s-own-client pill; a counting one does not', () => {
  assert.equal(reviewIsOwnClient({ via_vendor_import: false, booked_through_setnayan: true, counts_as_proof: false }), true);
  assert.equal(reviewIsOwnClient({ via_vendor_import: false, booked_through_setnayan: true, counts_as_proof: true }), false);
  assert.equal(reviewIsOwnClient({ via_vendor_import: true, booked_through_setnayan: true, counts_as_proof: true }), true);
  // A read that did not ask keeps the shipped behaviour.
  assert.equal(reviewIsOwnClient({ via_vendor_import: false, booked_through_setnayan: true }), false);
  // A review not booked through Setnayan wears no pill at all — unchanged.
  assert.equal(reviewIsOwnClient({ via_vendor_import: false, booked_through_setnayan: false, counts_as_proof: false }), false);
});

test('C · a service card never quotes a review its own number leaves out', () => {
  const out = buildCardReviews({
    serviceIds: ['s1'],
    hostStats: new Map([['s1', { count: 1, average: 5 }]]) as never,
    guestStats: null,
    hostReviews: [
      { review_id: 'newer', service_id: 's1', body: 'From the supplier’s own client.', created_at: '2026-11-20T00:00:00Z', couple_display_name: 'A', booked_through_setnayan: true, counts_as_proof: false },
      { review_id: 'older', service_id: 's1', body: 'Found them on Setnayan.', created_at: '2026-11-01T00:00:00Z', couple_display_name: 'B', booked_through_setnayan: true, counts_as_proof: true },
    ],
    guestRows: [],
    guestPhotoUrls: new Map(),
    readAllHref: '#reviews',
  });
  assert.equal(out.get('s1')?.hosts?.reviewId, 'older', 'C: the card quoted a review its trusted number does not count');
});

test('C + D · the public pages read the PUBLIC review view', () => {
  const page = code(read('app/v/[slug]/page.tsx'));
  const publicListReads = page.match(/fetchReviewsForVendorWithCouple\(admin,[^)]*publicOnly: true/g) ?? [];
  assert.equal(publicListReads.length, 1, 'the shop page’s review list must read publicOnly');
  assert.match(page, /fetchReviewForVendorWithCouple\(\s*admin,[\s\S]{0,200}\{ publicOnly: true \}/, 'the pinned review must read publicOnly');
  assert.match(page, /reviewIsOwnClient\(review\) \? \(\s*<VerifiedBookingPill/, 'the pill must come from reviewIsOwnClient');
  const sheet = code(read('lib/supplier-sheet-read.ts'));
  assert.match(sheet, /fetchReviewsForVendor\(admin, vendorProfileId, \{[^}]*publicOnly: true/, 'the supplier sheet must read publicOnly');
  const reviews = code(read('lib/reviews.ts'));
  assert.equal((reviews.match(/from\('vendor_reviews_public'\)/g) ?? []).length, 2, 'both public reads go through vendor_reviews_public');
});

test('C · the owner’s N is editable on Admin › Settings, blank = not set', () => {
  const action = code(read('app/admin/settings/actions.ts'));
  assert.match(action, /\['proof_real_guests_min', 'real-guests', 100000\]/);
  const form = code(read('app/admin/settings/_surfaces/settings-surface.tsx'));
  assert.match(form, /name="proof_real_guests_min"[\s\S]{0,300}placeholder="Not set"/);
  const settings = code(read('lib/platform-settings.ts'));
  assert.match(settings, /proofRealGuestsMin: n\(row\.proof_real_guests_min\)/);
});

test('D · the screener runs BEFORE the submit returns, and a resolved review flag re-renders the shop page', () => {
  const action = code(read('app/dashboard/[eventId]/vendors/[vendorId]/review/actions.ts'));
  assert.match(action, /await screenReviewForFraud\(createdReviewId\)/, 'D: the screener must be awaited in the submit');
  assert.doesNotMatch(action, /after\(async \(\) => \{\s*const \{ screenReviewForFraud \}/, 'D: the screener is back in an after() task');
  const resolve = code(read('app/admin/integrity-watch/actions.ts'));
  assert.match(resolve, /kind === 'review_fraud' && transitioned && transitioned\.length > 0\) \{\s*revalidateShopPage\(/);
});
