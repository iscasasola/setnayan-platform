/**
 * THE SUPPLIER SHEET (owner 2026-10-07 · Suppliers PR2).
 *
 * Pressing a card opens the supplier in place — the page's shipped quick-view,
 * at every width, with their service card, what couples wrote and the events
 * they have completed. What must hold:
 *
 *   · nothing on it can name a guest, a couple or an event;
 *   · reviews that could not be read are not "no reviews";
 *   · it never claims a price the cards did not state;
 *   · a plain page load does not pay for a sheet nobody opened;
 *   · asking for a quote goes through the ONE inquiry path.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { stripComments } from '@/lib/strip-comments';
import {
  SHEET_REVIEW_LIMIT,
  sheetReviews,
  sheetSnapshot,
  sheetWork,
  sheetWorkHeading,
} from '@/lib/supplier-sheet';
import { PRICE_ON_REQUEST, type BenchServiceCard } from '@/lib/bench-service-card';
import type { ReviewRow, VendorCompletedEventRow } from '@/lib/reviews';

const CARD: BenchServiceCard = {
  name: 'Plated dinner · 150 guests',
  priceText: 'from ₱197,000',
  discountBadge: 'Early booking · 10% off',
  includesLine: 'Includes: Tasting for 4',
  notIncluded: ['transport'],
  givesSetnayanGift: true,
  coverUrl: 'https://cdn.example/cover.jpg',
};

test('the sheet’s service card is the row’s card, re-shaped — never re-priced', () => {
  const snap = sheetSnapshot(CARD, { categoryLabel: 'Catering', cardsRead: true, selfAdded: false });
  assert.deepEqual(snap, {
    name: CARD.name,
    priceText: CARD.priceText,
    discountBadge: CARD.discountBadge,
    includesLine: CARD.includesLine,
    notIncluded: CARD.notIncluded,
    hasExclusive: false,
    givesSetnayanGift: true,
    hasCover: true,
  });
  // A hidden-name card (empty name) is named by the category.
  assert.equal(sheetSnapshot({ ...CARD, name: '' }, { categoryLabel: 'Catering', cardsRead: true, selfAdded: false }).name, 'Catering');
});

test('🔑 with no card, a price is claimed only when the cards were read — and never for a supplier the couple added', () => {
  const read = sheetSnapshot(null, { categoryLabel: 'Catering', cardsRead: true, selfAdded: false });
  assert.equal(read.name, 'Catering');
  assert.equal(read.priceText, PRICE_ON_REQUEST);
  assert.equal(sheetSnapshot(null, { categoryLabel: 'Catering', cardsRead: false, selfAdded: false }).priceText, '', 'a failed read said "Price on request"');
  assert.equal(sheetSnapshot(null, { categoryLabel: 'Catering', cardsRead: true, selfAdded: true }).priceText, '', '"Price on request" for a supplier with nobody to request it from');
  // A shop that hides its price has a card with priceText null → on request.
  assert.equal(sheetSnapshot({ ...CARD, priceText: null }, { categoryLabel: 'Catering', cardsRead: true, selfAdded: false }).priceText, PRICE_ON_REQUEST);
});

const review = (over: Partial<ReviewRow>): ReviewRow => ({
  review_id: 'r1',
  public_id: 'S89R-0000000001',
  vendor_profile_id: 'vp',
  event_id: 'ev-secret',
  couple_user_id: 'couple-secret',
  rating_overall: 5,
  rating_communication: 5,
  rating_quality: 5,
  rating_value: 5,
  rating_on_time: 5,
  body: 'Guests still talk about the dessert bar.',
  vendor_reply: null,
  vendor_reply_at: null,
  created_at: '2025-12-14T08:00:00Z',
  booked_through_setnayan: true,
  via_vendor_import: false,
  ...over,
});

test('🔑 a review on the sheet is stars, month and words — nothing a name could ride in on', () => {
  const [r] = sheetReviews([review({})]);
  assert.ok(r);
  assert.deepEqual(Object.keys(r).sort(), ['id', 'month', 'stars', 'words']);
  assert.deepEqual(r, { id: 'r1', stars: 5, month: 'Dec 2025', words: 'Guests still talk about the dessert bar.' });
  assert.ok(!JSON.stringify(r).includes('secret'), 'the couple or the event crossed onto the sheet');
});

test('only reviews with words are listed, newest first, capped', () => {
  const rows = [
    review({ review_id: 'a', body: '   ' }),
    review({ review_id: 'b', body: null }),
    review({ review_id: 'c', body: 'On time.', rating_overall: 4.4 }),
    review({ review_id: 'd', body: 'Lovely.', rating_overall: 9 }),
    review({ review_id: 'e', body: 'Kind.', created_at: 'not a date' }),
    review({ review_id: 'f', body: 'Calm.' }),
  ];
  const out = sheetReviews(rows);
  assert.equal(out.length, SHEET_REVIEW_LIMIT);
  assert.deepEqual(out.map((r) => r.id), ['c', 'd', 'e']);
  assert.deepEqual(out.map((r) => r.stars), [4, 5, 5]);
  assert.equal(out[2]?.month, null, 'an unreadable date became a month');
});

test('🔑 their work is the KIND of event and the month — never its name', () => {
  const rows: VendorCompletedEventRow[] = [
    { vendor_profile_id: 'vp', vendor_id: 'v1', event_id: 'ev-secret', event_type: 'wedding', event_date: '2025-12-12', completed_at: '2025-12-13T00:00:00Z' },
    { vendor_profile_id: 'vp', vendor_id: 'v2', event_id: 'ev-secret-2', event_type: 'gender_reveal', event_date: null, completed_at: null },
  ];
  const out = sheetWork(rows);
  assert.deepEqual(out, [
    { id: 'v1', kind: 'Wedding', month: 'Dec 2025' },
    { id: 'v2', kind: 'Gender Reveal', month: null },
  ]);
  assert.ok(!JSON.stringify(out).includes('secret'));
  assert.equal(sheetWork(Array.from({ length: 9 }, (_, i) => ({ ...rows[0]!, vendor_id: `v${i}` }))).length, 6);
  assert.equal(sheetWorkHeading(1), 'Their work · 1 event through Setnayan · newest first');
  assert.equal(sheetWorkHeading(14), 'Their work · 14 events through Setnayan · newest first');
});

// ── the wiring ────────────────────────────────────────────────────────────
const WEB = join(import.meta.dirname, '..');
const read = (p: string) => stripComments(readFileSync(join(WEB, p), 'utf8'));
const PAGE = read('app/dashboard/[eventId]/vendors/page.tsx');
const VIEW = read('app/dashboard/[eventId]/vendors/_components/vendor-quickview-inspector.tsx');
const ACTIONS = read('app/dashboard/[eventId]/vendors/_components/supplier-sheet-actions.tsx');
const READER = read('lib/supplier-sheet-read.ts');

test('🔑 a card opens the sheet in place on a phone — only on the one-screen page', () => {
  assert.match(PAGE, /const sheetOn = isExploreReplanEnabled\(\);/);
  assert.match(PAGE, /mobileSheet=\{sheetOn\}/);
  assert.match(PAGE, /const sheetVendor = sheetOn \? \(inspectSelection\?\.vendor \?\? null\) : null;/);
  assert.match(PAGE, /sheet=\{\s*sheetVendor\s*\?\s*\{/, 'the pre-replan quick-view was handed the sheet');
});

test('🔑 the sheet’s reads run only while a sheet is open, for a supplier who is on Setnayan', () => {
  assert.match(
    PAGE,
    /sheetVendor\?\.marketplaceVendorId != null\s*\?\s*await readSupplierSheetProof\(supabase, sheetVendor\.marketplaceVendorId\)\s*:\s*null;/,
  );
  assert.equal((PAGE.match(/readSupplierSheetProof\(/g) ?? []).length, 1);
  // Not asked for (no account) is `undefined`; could-not-read is `null`. They differ.
  assert.match(PAGE, /reviews: sheetProof \? sheetProof\.reviews : undefined,/);
  assert.match(PAGE, /cardsRead: photoMaps\.serviceCardByVendorId !== null,/);
  assert.match(PAGE, /serviceCard: photoMaps\.serviceCardByVendorId\?\.\[sheetVendor\.vendorId\] \?\? null,/);
});

test('🔑 reviews that could not be read are null — and the sheet says so, never "no reviews"', () => {
  assert.match(READER, /\.catch\(\(err\) => \{[\s\S]*?return null;\s*\}\)/);
  assert.match(VIEW, /\{sheet && sheet\.reviews === null \? \([\s\S]*?Couldn’t load their reviews\./);
  assert.match(VIEW, /\{sheet && sheet\.reviews && sheet\.reviews\.length > 0 \? \(/);
  // The work reader is best-effort, so its section is printed only when it holds something.
  assert.match(VIEW, /\{sheet && sheet\.work && sheet\.work\.length > 0 \? \(/);
  assert.ok(!/No reviews|no reviews yet|0 events|No events/i.test(VIEW), 'the sheet states an absence it cannot know');
});

test('the service card on the sheet is the shipped face, with no mock button', () => {
  assert.equal((VIEW.match(/<ServiceCardFace\b/g) ?? []).length, 1);
  assert.match(VIEW, /<ServiceCardFace\s+snap=\{sheetSnapshot\(sheet\.serviceCard, \{/);
  assert.match(VIEW, /footer=\{null\}/);
  assert.match(VIEW, /coverUrl=\{sheet\.serviceCard\?\.coverUrl \?\? v\.photoUrl\}/);
});

test('every addition is behind `sheet` — the quick-view elsewhere is as it shipped', () => {
  const added = ['data-sheet-section="service-card"', 'Proof · why they fit', 'data-sheet-section="reviews"', 'data-sheet-section="work"', 'sheet.actions'];
  for (const a of added) {
    const at = VIEW.indexOf(a);
    assert.ok(at > 0, `${a} is gone`);
    const before = VIEW.slice(Math.max(0, at - 220), at);
    assert.match(before, /\{sheet(\?\.actions)? (\?|&&)|\{sheet\?\.actions \?/, `${a} is drawn without asking for the sheet`);
  }
  assert.match(VIEW, /\{sheet \? null : \(\s*<div className="flex h-32/, 'the hero image and the card’s cover are both drawn');
});

test('🔑 the sheet’s one verb is the conversation, through the ONE inquiry path', () => {
  // A thread → go to it. No thread → ask, by the couple's own pick id.
  assert.match(ACTIONS, /if \(threadId\) \{[\s\S]*?href=\{`\/dashboard\/\$\{eventId\}\/messages\/\$\{threadId\}`\}/);
  assert.match(ACTIONS, /if \(!canAsk\) return null;/);
  assert.match(ACTIONS, /<ContactShortlistVendorButton\s+eventId=\{eventId\}\s+vendorId=\{vendorId\}\s+label=\{ask\.label\}/);
  assert.ok(!/vendorProfileId/.test(ACTIONS), 'the sheet asks by profile id — that skips the pick the inquiry is filed under');
  assert.ok(!/<button\b/.test(ACTIONS), 'a hand-made button on the sheet');
  assert.equal((ACTIONS.match(/\bmain\b/g) ?? []).length, 2, 'one main verb per state (chat · ask)');
  // A booked supplier is not asked for a quote; one with no account cannot be.
  assert.match(PAGE, /canAsk=\{sheetVendor\.marketplaceVendorId != null && sheetVendor\.status !== 'locked'\}/);
});
