/**
 * Unit suite for the honest same-date demand count (lib/same-date-demand.ts).
 *
 * Every case below is stated as the DEFECT it locks out. Explore_Replan §15.3
 * blocked "In demand right now" on exactly two grounds — it counted saves
 * instead of inquiries, and it had no small-N floor — and the owner approved
 * the lens only in the form that fixes both. These tests are what "fixed"
 * means.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  MIN_DEMAND_COUPLE_COUNT,
  allHoldingEventIds,
  countInquiringCouples,
  groupHoldsByVendor,
  inquiryPairKey,
  type SameDateHold,
} from './same-date-demand';

const V = 'vendor-profile-1';

function holds(...eventIds: string[]): SameDateHold[] {
  return eventIds.map((eventId) => ({ marketplaceVendorId: V, eventId }));
}

function inquiries(...eventIds: string[]): Set<string> {
  return new Set(eventIds.map((e) => inquiryPairKey(e, V)));
}

test('the floor is 3 — the owner ruling is "don\'t show a 1"', () => {
  assert.equal(MIN_DEMAND_COUPLE_COUNT, 3);
});

// ── Rule 1 · INQUIRIES, NOT SAVES ───────────────────────────────────────────

test('a saved-but-never-contacted vendor contributes ZERO', () => {
  // Five other couples have this vendor at status='considering'. NONE of them
  // ever opened a thread — every one of them merely bookmarked. Under the old
  // save-count this rendered "5 also eyeing your date"; the honest count is 0.
  const grouped = groupHoldsByVendor(holds('e1', 'e2', 'e3', 'e4', 'e5'));
  const out = countInquiringCouples(grouped, new Set());
  assert.equal(out.get(V), undefined, 'saves must not manufacture demand');
  assert.equal(out.size, 0);
});

test('only the couples who actually inquired are counted', () => {
  // Six holders, three of whom inquired → 3, not 6.
  const grouped = groupHoldsByVendor(holds('e1', 'e2', 'e3', 'e4', 'e5', 'e6'));
  const out = countInquiringCouples(grouped, inquiries('e1', 'e3', 'e5'));
  assert.equal(out.get(V), 3);
});

test('an inquiry to a DIFFERENT vendor never counts toward this one', () => {
  const grouped = groupHoldsByVendor(holds('e1', 'e2', 'e3'));
  const wrongVendor = new Set([
    inquiryPairKey('e1', 'other-vendor'),
    inquiryPairKey('e2', 'other-vendor'),
    inquiryPairKey('e3', 'other-vendor'),
  ]);
  assert.equal(countInquiringCouples(grouped, wrongVendor).get(V), undefined);
});

test("an inquiry from a couple who is not holding on this date does not count", () => {
  // Only e1/e2 hold on the couple's date; e9 inquired but holds a different
  // date, so it was never in the hold set and cannot be counted.
  const grouped = groupHoldsByVendor(holds('e1', 'e2'));
  const out = countInquiringCouples(grouped, inquiries('e1', 'e2', 'e9'));
  assert.equal(out.get(V), undefined, '2 inquiring holders is still below the floor');
});

// ── Rule 2 · MIN-N FLOOR ────────────────────────────────────────────────────

test('n = 1 renders nothing', () => {
  const grouped = groupHoldsByVendor(holds('e1', 'e2', 'e3'));
  assert.equal(countInquiringCouples(grouped, inquiries('e1')).get(V), undefined);
});

test('n = 2 renders nothing — the floor is not "more than one", it is three', () => {
  const grouped = groupHoldsByVendor(holds('e1', 'e2', 'e3'));
  const out = countInquiringCouples(grouped, inquiries('e1', 'e2'));
  assert.equal(out.get(V), undefined);
  assert.equal(out.size, 0, 'a below-floor vendor is ABSENT, not present-with-0');
});

test('n = 3 is the first count that ships', () => {
  const grouped = groupHoldsByVendor(holds('e1', 'e2', 'e3'));
  assert.equal(countInquiringCouples(grouped, inquiries('e1', 'e2', 'e3')).get(V), 3);
});

test('the floor is applied per vendor, not across the page', () => {
  const grouped = groupHoldsByVendor([
    { marketplaceVendorId: 'a', eventId: 'e1' },
    { marketplaceVendorId: 'a', eventId: 'e2' },
    { marketplaceVendorId: 'b', eventId: 'e1' },
    { marketplaceVendorId: 'b', eventId: 'e2' },
    { marketplaceVendorId: 'b', eventId: 'e3' },
  ]);
  const out = countInquiringCouples(
    grouped,
    new Set([
      inquiryPairKey('e1', 'a'),
      inquiryPairKey('e2', 'a'),
      inquiryPairKey('e1', 'b'),
      inquiryPairKey('e2', 'b'),
      inquiryPairKey('e3', 'b'),
    ]),
  );
  assert.equal(out.get('a'), undefined, 'vendor a has 2 → suppressed');
  assert.equal(out.get('b'), 3, 'vendor b has 3 → shown');
});

// ── Grouping hygiene ────────────────────────────────────────────────────────

test('one couple holding the same vendor twice is still ONE couple', () => {
  // A vendor picked under two categories writes two event_vendors rows for the
  // same event. Deduping by event_id is what stops that reading as 2 couples.
  const grouped = groupHoldsByVendor(holds('e1', 'e1', 'e2', 'e2', 'e3', 'e3'));
  assert.equal(grouped.get(V)?.size, 3);
  assert.equal(countInquiringCouples(grouped, inquiries('e1', 'e2', 'e3')).get(V), 3);
});

test('off-platform (manual) picks carry no vendor id and are skipped entirely', () => {
  const grouped = groupHoldsByVendor([
    { marketplaceVendorId: null, eventId: 'e1' },
    { marketplaceVendorId: null, eventId: 'e2' },
    { marketplaceVendorId: null, eventId: 'e3' },
  ]);
  assert.equal(grouped.size, 0);
  assert.equal(allHoldingEventIds([{ marketplaceVendorId: null, eventId: 'e1' }]).length, 0);
});

test('allHoldingEventIds returns each event once — it bounds the thread read', () => {
  const ids = allHoldingEventIds(holds('e1', 'e1', 'e2'));
  assert.deepEqual([...ids].sort(), ['e1', 'e2']);
});

test('no holds at all → an empty map, never a fabricated number', () => {
  assert.equal(countInquiringCouples(groupHoldsByVendor([]), new Set()).size, 0);
});
