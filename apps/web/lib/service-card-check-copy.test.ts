/**
 * What the supplier reads when a card waits for a quick check (approved prototype, frame 1 · Delta 1).
 * Three properties, not phrasings: no accusing word, never another shop's name, the reasons are the row's.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { heldBoxHeading, quotedList, reasonsFromDetail, supplierReasonLines } from './service-card-check-copy';
import type { CardReason } from './service-card-checks';

const ALL: CardReason[] = [
  { code: 'photo', matches: [{ imageFlagPublicId: 'S89N-1', hamming: 4, which: 'cover' }] },
  { code: 'price', pricePhp: 499, basis: 'per_pax', lowPhp: 900, medianPhp: 1200, highPhp: 2000, sampleN: 9, region: 'ncr', bucket: '__all__', tolerance: 0.3 },
  { code: 'service', filed: 'barong_tagalog', filedLabel: 'Barong Tagalog', matched: 'catering', matchedLabel: 'Catering', words: ['catering'], ownWords: [] },
  { code: 'words', hits: ['guaranteed', '#1'] },
  { code: 'check_unavailable', checks: ['price'] },
];

test('the supplier is never accused — no flag · fraud · scam · violation in any line', () => {
  const text = [
    ...supplierReasonLines(ALL, { serviceLabel: 'Catering' }).flatMap((l) => [l.title, l.line]),
    ...Object.values(heldBoxHeading({ reasons: ALL, afterReject: false })),
    ...Object.values(heldBoxHeading({ reasons: [], afterReject: true })),
  ].join(' ');
  assert.doesNotMatch(text, /\b(flag|flagged|fraud|scam|violation)\b/i);
});

test('a photo match says "another shop" — the copy has no way to name which', () => {
  const [photo] = supplierReasonLines([ALL[0]!], { serviceLabel: 'Catering' });
  assert.equal(photo?.title, 'The cover photo also appears on another shop');
  const [show] = supplierReasonLines([{ code: 'photo', matches: [{ imageFlagPublicId: 'x', hamming: 2, which: 'showcase' }] }], { serviceLabel: 'x' });
  assert.match(show?.title ?? '', /another shop$/);
});

test('the price line says BELOW (the only direction checked) and names the basis', () => {
  const [p] = supplierReasonLines([ALL[1]!], { serviceLabel: 'Catering' });
  assert.equal(p?.title, '₱499 per guest is far below what Catering usually costs here');
});

test('the drawn words: claim words quoted and joined, service mismatch both names', () => {
  assert.equal(quotedList(['guaranteed', '#1']), '“Guaranteed” and “#1”');
  assert.equal(quotedList(['a', 'b', 'c']), '“A”, “B” and “C”');
  const lines = supplierReasonLines([ALL[2]!, ALL[3]!], { serviceLabel: 'x' });
  assert.equal(lines[0]?.title, 'The name reads like Catering, but the card is filed under Barong Tagalog');
  assert.equal(lines[1]?.title, '“Guaranteed” and “#1” can’t be shown on a card');
});

test('the heading: "waiting for a quick check", counts only what the supplier can fix; "we’ll look again" after a reject', () => {
  const h = heldBoxHeading({ reasons: ALL, afterReject: false });
  assert.equal(h.headline, 'Saved · waiting for a quick check');
  assert.match(h.intro, /^Four things to look at\./);
  assert.equal(heldBoxHeading({ reasons: [ALL[3]!], afterReject: false }).intro.startsWith('One thing to look at. Fix it'), true);
  assert.equal(heldBoxHeading({ reasons: [], afterReject: true }).headline, 'Saved · we’ll look again');
});

test('reasons are parsed from the flag row defensively', () => {
  assert.deepEqual(reasonsFromDetail(null), []);
  assert.deepEqual(reasonsFromDetail({ reasons: 'x' }), []);
  assert.deepEqual(reasonsFromDetail({ reasons: [{ code: 'words', hits: ['official'] }, { code: 'nope' }, null] }), [
    { code: 'words', hits: ['official'] },
  ]);
});
