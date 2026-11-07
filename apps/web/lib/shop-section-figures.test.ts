/**
 * 📌 Shop's figures, section by section (v13 S5) — `lib/shop-section-figures.ts`. Each figure is a door (an href), and a
 * figure the page could not read is `null` → "—", never 0 (`reads-are-honest`).
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { analyticsFigures, changeWord, detailsFigures, galleryFigures, pageFigures, promoteFigures } from './shop-section-figures';

test('Details — verified · documents in · details done', () => {
  const f = detailsFigures({ verified: false, docsIn: 1, docsTotal: 4, done: 4, of: 6 });
  assert.deepEqual(f.map((x) => [x.key, x.value]), [
    ['verified', 'Not yet'],
    ['docs', '1/4'],
    ['done', '4/6'],
  ]);
  assert.ok(f.every((x) => x.hot), 'what waits on the shop is the brand colour');
  assert.ok(detailsFigures({ verified: true, docsIn: 4, docsTotal: 4, done: 6, of: 6 }).every((x) => !x.hot));
});

test('Page — opened · reviews · rating; no reviews = "New", an unread count = "—"', () => {
  assert.deepEqual(pageFigures({ views30: 86, reviewCount: 12, rating: 4.86 }).map((x) => x.value), ['86', '12', '4.9']);
  assert.deepEqual(pageFigures({ views30: 0, reviewCount: 0, rating: 0 }).map((x) => x.value), ['0', '0', 'New']);
  assert.deepEqual(pageFigures({ views30: null, reviewCount: null, rating: null }).map((x) => x.value), [null, null, null]);
});

test('Gallery — photos · videos · credits left; an unread wallet is "—", never 0 credits', () => {
  assert.deepEqual(galleryFigures({ photos: 48, videos: 7, credits: 38 }).map((x) => x.value), ['48', '7', '38']);
  assert.equal(galleryFigures({ photos: 1, videos: 1, credits: null })[2]!.value, null);
  assert.equal(galleryFigures({ photos: 1, videos: 1, credits: null })[0]!.word, 'photo');
});

test('Promote — the gift stock, one figure; an unread stock is "—", never 0 gift credits', () => {
  assert.deepEqual(promoteFigures({ giftCredits: 1200 }).map((x) => [x.key, x.value, x.word]), [['gifts', '1,200', 'gift credits']]);
  assert.equal(promoteFigures({ giftCredits: 1 })[0]!.word, 'gift credit');
  assert.equal(promoteFigures({ giftCredits: 0 })[0]!.value, '0');
  assert.equal(promoteFigures({ giftCredits: null })[0]!.value, null);
  assert.equal(promoteFigures({ giftCredits: 5 })[0]!.href, '/vendor-dashboard/shop/promote#gifts', 'the figure is not a door to the gifts');
});

test('Analytics — opened · asked · booked with the change against the 30 days before', () => {
  const f = analyticsFigures({ views: 86, inquiries: 9, booked: 3 }, { views: 77, inquiries: 9, booked: 4 });
  // 📈 The change is its own line under the word (`PinDoor change`, "Analytics, growing" 6 Nov 2026) — it was glued on
  // as "opened · +9", which truncated the third figure at 390 px.
  assert.deepEqual(f.map((x) => [x.value, x.word, x.change]), [
    ['86', 'opened', '+9'],
    ['9', 'asked', 'same'],
    ['3', 'booked', '−1'],
  ]);
  // Before unread → the numbers stand alone (never a fake "+86"); now unread → "—" on all three.
  const alone = analyticsFigures({ views: 1, inquiries: 2, booked: 3 }, null);
  assert.deepEqual(alone.map((x) => x.word), ['opened', 'asked', 'booked']);
  assert.deepEqual(alone.map((x) => 'change' in x), [false, false, false]);
  assert.deepEqual(analyticsFigures(null, null).map((x) => x.value), [null, null, null]);
  // 📈 The headline numbers COUNT in the pinned row (owner call, 6 Nov 2026) — a read carries its raw count; an unread
  // figure carries none, so "—" is drawn as text and never counts up from a made-up 0.
  assert.deepEqual(f.map((x) => x.count), [86, 9, 3]);
  assert.deepEqual(analyticsFigures(null, null).map((x) => 'count' in x), [false, false, false]);
  assert.equal(changeWord(5, null), null);
});

test('every figure is a door', () => {
  const all = [
    ...detailsFigures({ verified: true, docsIn: 1, docsTotal: 1, done: 1, of: 1 }),
    ...pageFigures({ views30: 1, reviewCount: 1, rating: 5 }),
    ...galleryFigures({ photos: 1, videos: 1, credits: 1 }),
    ...analyticsFigures(null, null),
  ];
  for (const x of all) assert.match(x.href, /^\/vendor-dashboard\//, `${x.key} goes nowhere`);
});
