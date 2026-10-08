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
  SHEET_FAILED,
  SHEET_LOADING,
  sheetFits,
  sheetOthers,
  sheetPhotoRow,
  sheetPhotosHeading,
  sheetStateLine,
  sheetWork,
  sheetWorkHeading,
  type SupplierSheetData,
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

// ── part 2 · the pure pieces ───────────────────────────────────────────────
test('their photos are ONE row of three, the last carrying "+N" for the rest', () => {
  const urls = Array.from({ length: 14 }, (_, i) => `https://cdn.example/p${i}.jpg`);
  assert.deepEqual(sheetPhotoRow(urls), { shown: urls.slice(0, 3), more: 11 });
  assert.deepEqual(sheetPhotoRow(urls.slice(0, 2)), { shown: urls.slice(0, 2), more: 0 });
  assert.deepEqual(sheetPhotoRow(['', urls[0]!]), { shown: [urls[0]!], more: 0 }, 'an empty ref is not a photo');
  assert.equal(sheetPhotosHeading(1), 'Their photos · 1 photo');
  assert.equal(sheetPhotosHeading(1400), 'Their photos · 1,400 photos');
});

test('🔑 the rest of their portfolio: every OTHER category once, never the one on screen, never a guessed one', () => {
  const label: Record<string, string> = { catering: 'Catering', cake: 'Cake', stations: 'Stations' };
  const resolve = (c: string) => (c === 'buffet' ? { tile: 'catering', label: 'Catering' } : label[c] ? { tile: c, label: label[c]! } : null);
  assert.deepEqual(sheetOthers(['buffet', 'cake', 'cake', null, 'no-such-service', 'stations'], 'catering', resolve), [
    { tile: 'cake', label: 'Cake' },
    { tile: 'stations', label: 'Stations' },
  ]);
  assert.deepEqual(sheetOthers(['buffet'], 'catering', resolve), [], 'the category on screen is not "another" one');
});

test('where things stand, in the prototype’s words — one line, the furthest step wins', () => {
  const base = { booked: false, asked: false, quoteIn: false, inBuild: false, hasThread: false, selfAdded: false };
  assert.equal(sheetStateLine(base), 'Saved');
  assert.equal(sheetStateLine({ ...base, selfAdded: true }), 'Added by you');
  assert.equal(sheetStateLine({ ...base, hasThread: true }), 'Asked for a quote');
  assert.equal(sheetStateLine({ ...base, hasThread: true, inBuild: true }), 'In your build');
  assert.equal(sheetStateLine({ ...base, hasThread: true, inBuild: true, quoteIn: true }), 'Quote in');
  assert.equal(sheetStateLine({ ...base, hasThread: true, asked: true }), 'Asked to book · waiting for their yes');
  assert.equal(sheetStateLine({ ...base, hasThread: true, asked: true, booked: true }), 'Booked');
});

test('why they fit is the card’s own signals — absent facts draw nothing', () => {
  const none = { distanceKm: null, innerRadiusKm: null, outerRadiusKm: null, reachesVenue: null, serviceRadiusKm: null, budgetFit: null, budgetEstimated: false, dateFit: null };
  assert.deepEqual(sheetFits(none), []);
  assert.deepEqual(
    sheetFits({ ...none, budgetFit: 'over', budgetEstimated: true, dateFit: 'free' }).map((f) => [f.kind, f.tone, f.text]),
    [
      ['budget', 'warn', 'Over budget · est.'],
      ['date', 'ok', 'Free on your date'],
    ],
  );
});

test('🔑 what the one request returns has no field a couple’s or a guest’s name could ride in on', () => {
  const data: SupplierSheetData = { reviews: [], work: [], workTotal: 0, photos: null, others: null, following: null, sharePath: null };
  assert.deepEqual(Object.keys(data).sort(), ['following', 'others', 'photos', 'reviews', 'sharePath', 'work', 'workTotal']);
});

// ── the wiring ────────────────────────────────────────────────────────────
const WEB = join(import.meta.dirname, '..');
const read = (p: string) => stripComments(readFileSync(join(WEB, p), 'utf8'));
const PAGE = read('app/dashboard/[eventId]/vendors/page.tsx');
const VIEW = read('app/dashboard/[eventId]/vendors/_components/vendor-quickview-inspector.tsx');
const BENCH = read('app/dashboard/[eventId]/vendors/_components/shortlist-categories.tsx');
const SHEET = read('app/dashboard/[eventId]/vendors/_components/supplier-sheet.tsx');
const ACTION = read('app/dashboard/[eventId]/vendors/_actions/inline-more-row.ts');
const READER = read('lib/supplier-sheet-read.ts');
const count = (src: string, re: RegExp) => (src.match(re) ?? []).length;

test('🔑 opening a supplier never re-renders the Suppliers page on the server', () => {
  // The page reads nothing for the sheet and hands the inspector no sheet.
  assert.doesNotMatch(PAGE, /readSupplierSheet|supplier-sheet-read/, 'the page reads for the sheet again — every open is a full page render');
  assert.doesNotMatch(PAGE, /mobileSheet=/, 'a card opens the server-rendered panel again');
  assert.doesNotMatch(VIEW, /\bsheet\b\s*[?:=]/, 'the desktop quick-view grew the sheet back');
  // The sheet itself navigates nowhere to open, and never refreshes the route.
  assert.doesNotMatch(SHEET, /router\.refresh\(|revalidatePath|inspect=/);
  assert.doesNotMatch(BENCH, /sheetDoor\.open\([\s\S]{0,40}router\./);
});

test('🔑 the sheet is drawn from the pressed card, then asks ONE thing — once per supplier per visit', () => {
  // One caller of the loader, behind the in-flight and the visit caches.
  assert.equal(count(SHEET, /\bload\(/g), 1, 'the sheet asks more than one thing');
  assert.match(SHEET, /askOnce\(seenKey\(target\), \(\) => load\(profileId, target\.tile\)\)/);
  assert.match(SHEET, /SEEN\.set\(seenKey\(target\), res\);/, 'the answer is not kept for the visit');
  assert.match(SHEET, /if \(!onSetnayan \|\| SEEN\.has\(seenKey\(target\)\)\) return;/, 'a second look at the same supplier asks again');
  // A supplier the couple added themselves is not on Setnayan: no request at all.
  assert.match(SHEET, /const onSetnayan = target\.vendorProfileId != null;/);
  // The bench hands in the loader: the existing action, with `sheetFor`.
  assert.match(BENCH, /\(sheetStandIn\.current \?\? fetchInlineMoreRow\)\(\{ eventId, groupId: '', tile, sheetFor: vendorProfileId \}\)/);
});

test('🔑 that one request is five reads, one per table, together — and it is not a new server action', () => {
  assert.equal(count(READER, /await Promise\.all\(\[/g), 1, 'the sheet reads one after another');
  assert.equal(count(READER, /\.from\('vendor_profiles'\)/g), 1);
  assert.equal(count(READER, /\.from\('vendor_services'\)/g), 1);
  assert.equal(count(READER, /\.from\(/g), 2, 'a table is read twice, or a new table crept in');
  for (const reader of ['fetchReviewsForVendor(', 'fetchVendorCompletedEvents(', 'isFollowingVendor(']) {
    assert.equal(READER.split(reader).length - 1, 1, `${reader} runs more than once`);
  }
  // It rides `fetchInlineMoreRow` — and answers BEFORE anything is searched.
  assert.equal(count(ACTION, /^export async function /gm), 1, 'the sheet got its own server action (the ceiling is 1,225)');
  assert.ok(ACTION.indexOf('if (sheetFor) {') > 0 && ACTION.indexOf('if (sheetFor) {') < ACTION.indexOf('await searchCategoryVendors('));
  assert.match(ACTION, /if \(!user\) return \{ \.\.\.EMPTY, sheet: null \};/, 'a signed-out caller is answered');
});

test('🔑 a shop whose name is still withheld is not named by its photos or its address', () => {
  assert.match(READER, /isVendorNameRevealed\(\{/);
  assert.match(READER, /photos:\s*profile && revealed\s*\?/);
  assert.match(READER, /sharePath: profile && revealed && profile\.business_slug \? `\/v\/\$\{profile\.business_slug\}` : null,/);
  // …and the sheet offers Share only when there is a page to share.
  assert.match(SHEET, /\{data\?\.sharePath \? <ActionButton tone="neutral" icon=\{Share2\} label="Share"/);
});

test('🔑 while the request is out one line says so; a refusal says so with Retry — never an empty section', () => {
  assert.equal(SHEET_LOADING, 'Loading their reviews and photos…');
  assert.equal(SHEET_FAILED, 'Couldn’t load their reviews and photos.');
  assert.match(SHEET, /\{state === 'loading' \? \([\s\S]{0,160}\{SHEET_LOADING\}/);
  assert.match(SHEET, /\{state === 'failed' \? \([\s\S]{0,260}\{SHEET_FAILED\}[\s\S]{0,120}label="Retry" onClick=\{\(\) => ask\(\)\}/);
  assert.match(SHEET, /if \(!res\) return setState\('failed'\);/, 'a refused read is drawn as an empty sheet');
  assert.match(SHEET, /data && data\.reviews === null \?/, 'reviews that could not be read read as "none"');
  assert.match(READER, /console\.error\('\[supplier-sheet\] reviews read failed', err\);\s*return null;/);
});

test('🔑 Ask goes through the ONE inquiry path; Follow flips here and takes itself back when refused', () => {
  assert.match(SHEET, /const res = await contactShortlistVendor\(\{ eventId, vendorId: id \}\);/);
  assert.match(SHEET, /const saved = await saveVendorToPicks\(fd\);/, 'a supplier the couple never saved cannot be asked');
  assert.match(SHEET, /fd\.set\('tile', tile\);/, '"Ask about Cake" files them under the wrong category');
  assert.match(SHEET, /setFollowing\(next\);[^\n]*\n\s*setSaid\(null\);/);
  assert.match(SHEET, /if \(!res\.ok\) \{\s*setFollowing\(!next\);/, 'a refused follow still reads as followed');
  assert.match(SHEET, /next \? await followVendor\(target\.vendorProfileId!\) : await unfollowVendor\(target\.vendorProfileId!\)/);
});

test('the sheet is lazy — not part of the page’s first JavaScript — and both kinds of card open it', () => {
  assert.match(BENCH, /const SupplierSheet = dynamic\(\(\) => import\('\.\/supplier-sheet'\), \{ ssr: false \}\);/);
  assert.doesNotMatch(BENCH, /^import (?!type)[^\n]*from '\.\/supplier-sheet';/m, 'a static import puts the sheet in the first bundle');
  assert.equal(count(BENCH, /sheetDoor\.open\(\{/g), 2, 'one of the two cards (yours · More to compare) no longer opens the sheet');
  assert.match(BENCH, /<SheetDoorCtx\.Provider value=\{replan \? sheetDoor : null\}>/, 'the sheet opens off the one-screen page');
  assert.match(BENCH, /nameWithheld: row\.nameAnonymized,/);
});

test('🔑 "More to compare" asks the marketplace ONCE per category per visit', () => {
  assert.match(BENCH, /const kept = MORE_SEEN\.get\(seenKey\);\s*if \(kept\) \{/);
  assert.match(BENCH, /MORE_SEEN\.set\(seenKey, res\);/);
  const failed = BENCH.slice(BENCH.indexOf('setMoreError(INLINE_MORE_FAILED)') - 400, BENCH.indexOf('setMoreError(INLINE_MORE_FAILED)'));
  assert.doesNotMatch(failed, /MORE_SEEN\.set/, 'a failed read is remembered as the answer');
});
