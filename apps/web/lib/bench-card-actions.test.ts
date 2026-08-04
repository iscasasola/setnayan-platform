/**
 * Unit suite for the three-action bench card (Explore Replan slice D).
 *
 * Two pure pieces carry every decision the card makes:
 *   • `hasLiveInquiry` — THE predicate shared with `/v/[slug]` (spec §12.1 §5).
 *   • `resolveBenchCardActions` — which of Add-to-build / Inquire / Lock render.
 * Plus `railEndIsAddAnother`, the rail-end "＋ Add another {tile}" rule.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { hasLiveInquiry } from './shortlist-taxonomy';
import {
  railEndIsAddAnother,
  resolveBenchCardActions,
  type BenchCardVendor,
} from './bench-card-actions';
import { HARD_SINGLE_PICK_GROUPS } from './wedding-plan-groups';

function vendor(p: Partial<BenchCardVendor> = {}): BenchCardVendor {
  return {
    status: 'considering',
    marketplaceVendorId: 'vp-1',
    threadId: null,
    inquiryStatus: null,
    planGroupId: 'catering',
    priceBasisPhp: 50_000,
    ...p,
  };
}

// ── hasLiveInquiry — the shared predicate ──────────────────────────────────

test('hasLiveInquiry: a declined thread is NOT a live inquiry', () => {
  assert.equal(hasLiveInquiry({ threadId: 't-1', inquiryStatus: 'declined' }), false);
});

test('hasLiveInquiry: pending and accepted threads ARE live', () => {
  assert.equal(hasLiveInquiry({ threadId: 't-1', inquiryStatus: 'pending' }), true);
  assert.equal(hasLiveInquiry({ threadId: 't-1', inquiryStatus: 'accepted' }), true);
});

test('hasLiveInquiry: no thread id is never live, whatever the status says', () => {
  assert.equal(hasLiveInquiry({ threadId: null, inquiryStatus: 'accepted' }), false);
  assert.equal(hasLiveInquiry({ threadId: null, inquiryStatus: null }), false);
});

test('hasLiveInquiry: a thread with an unknown status still counts (only declined is closed)', () => {
  // 'displaced' / 'withdrawn' / 'expired' exist in the DB enum. They keep a
  // readable thread, so the card links to it rather than opening a second one.
  assert.equal(hasLiveInquiry({ threadId: 't-1', inquiryStatus: 'displaced' }), true);
});

// ── the flag ───────────────────────────────────────────────────────────────

test('flag OFF: no actions at all — the card renders exactly as pre-replan', () => {
  const a = resolveBenchCardActions({ enabled: false, vendor: vendor(), inBuild: false });
  assert.deepEqual(a, { build: null, inquiry: null, lockGroupId: null });
});

// ── the build leg ──────────────────────────────────────────────────────────

test('a priced, unpinned candidate gets "Add to build"', () => {
  const a = resolveBenchCardActions({ enabled: true, vendor: vendor(), inBuild: false });
  assert.deepEqual(a.build, { kind: 'add' });
});

test('a pinned candidate flips to the in-build state', () => {
  const a = resolveBenchCardActions({ enabled: true, vendor: vendor(), inBuild: true });
  assert.deepEqual(a.build, { kind: 'in_build' });
});

test('no price signal anywhere → the note, never a pin that lands ₱0 in the budget', () => {
  const a = resolveBenchCardActions({
    enabled: true,
    vendor: vendor({ priceBasisPhp: null }),
    inBuild: false,
  });
  assert.deepEqual(a.build, { kind: 'needs_price' });
});

test('an already-pinned vendor keeps the in-build state even with no price', () => {
  // The pin already exists; hiding its Remove behind a price check would strand it.
  const a = resolveBenchCardActions({
    enabled: true,
    vendor: vendor({ priceBasisPhp: null }),
    inBuild: true,
  });
  assert.deepEqual(a.build, { kind: 'in_build' });
});

test('an unbucketable category hides BOTH build and lock (the #3466 class of bug)', () => {
  const a = resolveBenchCardActions({
    enabled: true,
    vendor: vendor({ planGroupId: null }),
    inBuild: false,
  });
  assert.equal(a.build, null);
  assert.equal(a.lockGroupId, null);
});

// ── the inquiry leg ────────────────────────────────────────────────────────

test('marketplace-linked with no thread → "Inquire"', () => {
  const a = resolveBenchCardActions({ enabled: true, vendor: vendor(), inBuild: false });
  assert.deepEqual(a.inquiry, { kind: 'inquire' });
});

test('marketplace-linked with a live thread → "Check inquiry", carrying the thread id', () => {
  const a = resolveBenchCardActions({
    enabled: true,
    vendor: vendor({ threadId: 't-9', inquiryStatus: 'pending' }),
    inBuild: false,
  });
  assert.deepEqual(a.inquiry, { kind: 'check', threadId: 't-9' });
});

test('a DECLINED thread falls back to "Inquire" — the bench and /v/[slug] now agree', () => {
  const a = resolveBenchCardActions({
    enabled: true,
    vendor: vendor({ threadId: 't-9', inquiryStatus: 'declined' }),
    inBuild: false,
  });
  assert.deepEqual(a.inquiry, { kind: 'inquire' });
});

test('a status with no thread id falls back to "Inquire", never a link to /messages', () => {
  const a = resolveBenchCardActions({
    enabled: true,
    vendor: vendor({ threadId: null, inquiryStatus: 'pending' }),
    inBuild: false,
  });
  assert.deepEqual(a.inquiry, { kind: 'inquire' });
});

test('an off-platform pick gets NO inquiry button — it would dead-end', () => {
  const a = resolveBenchCardActions({
    enabled: true,
    vendor: vendor({ marketplaceVendorId: null }),
    inBuild: false,
  });
  assert.equal(a.inquiry, null);
});

test('a LINKED manual add IS messageable — the gate is the profile id, not a source guess', () => {
  const a = resolveBenchCardActions({
    enabled: true,
    // Manually added by the couple, but NewManualVendorModal's LINKED mode
    // wrote a real marketplace_vendor_id.
    vendor: vendor({ marketplaceVendorId: 'vp-linked' }),
    inBuild: false,
  });
  assert.deepEqual(a.inquiry, { kind: 'inquire' });
});

test('an off-platform pick KEEPS build + lock (it locks via the Lock-Free path)', () => {
  const a = resolveBenchCardActions({
    enabled: true,
    vendor: vendor({ marketplaceVendorId: null }),
    inBuild: false,
  });
  assert.deepEqual(a.build, { kind: 'add' });
  assert.equal(a.lockGroupId, 'catering');
});

// ── locked cards ───────────────────────────────────────────────────────────

test('a locked vendor shows none of the three — "★ Chosen" is the whole state', () => {
  const a = resolveBenchCardActions({
    enabled: true,
    vendor: vendor({ status: 'locked', threadId: 't-1', inquiryStatus: 'accepted' }),
    inBuild: true,
  });
  assert.deepEqual(a, { build: null, inquiry: null, lockGroupId: null });
});

// ── the rail end ───────────────────────────────────────────────────────────

test('rail end: no lock yet → "Find more", not "Add another"', () => {
  assert.equal(
    railEndIsAddAnother({ enabled: true, lockedCount: 0, planGroupId: 'catering' }),
    false,
  );
});

test('rail end: a locked multi-pick category invites a second pick', () => {
  assert.equal(
    railEndIsAddAnother({ enabled: true, lockedCount: 1, planGroupId: 'catering' }),
    true,
  );
});

test('rail end: every hard-single group stays at "Find more" once locked', () => {
  for (const g of HARD_SINGLE_PICK_GROUPS) {
    assert.equal(
      railEndIsAddAnother({ enabled: true, lockedCount: 1, planGroupId: g }),
      false,
      `${g} must never invite a second pick`,
    );
  }
});

test('rail end: unresolvable group and flag OFF both stay at "Find more"', () => {
  assert.equal(railEndIsAddAnother({ enabled: true, lockedCount: 2, planGroupId: null }), false);
  assert.equal(
    railEndIsAddAnother({ enabled: false, lockedCount: 2, planGroupId: 'catering' }),
    false,
  );
});

// ── SOFT schedule clash (Explore Replan PR-G1 · spec §6 decision #12) ───────

test('schedule clash: Add-to-build and Lock stand down, and the reason names the candidate', () => {
  const a = resolveBenchCardActions({
    enabled: true,
    vendor: vendor({ buildFit: 'clash', buildClashWith: 'Alta Vista' }),
    inBuild: false,
  });
  assert.deepEqual(a.build, { kind: 'schedule_clash', clashWith: 'Alta Vista' });
  assert.equal(a.lockGroupId, null, 'a clashing card must not offer Lock');
});

test('schedule clash: the INQUIRE leg survives — "Ask anyway" is the whole point of a SOFT tier', () => {
  const a = resolveBenchCardActions({
    enabled: true,
    vendor: vendor({ buildFit: 'clash', buildClashWith: 'Alta Vista' }),
    inBuild: false,
  });
  assert.deepEqual(a.inquiry, { kind: 'inquire' });

  const withThread = resolveBenchCardActions({
    enabled: true,
    vendor: vendor({ buildFit: 'clash', threadId: 't-9', inquiryStatus: 'pending' }),
    inBuild: false,
  });
  assert.deepEqual(withThread.inquiry, { kind: 'check', threadId: 't-9' });
});

test('schedule clash: a nameless clash still withholds the actions, without inventing a culprit', () => {
  const a = resolveBenchCardActions({
    enabled: true,
    vendor: vendor({ buildFit: 'clash', buildClashWith: null }),
    inBuild: false,
  });
  assert.deepEqual(a.build, { kind: 'schedule_clash', clashWith: null });
});

test('schedule clash: a vendor ALREADY in the build is exempt — it helped define the window', () => {
  const a = resolveBenchCardActions({
    enabled: true,
    vendor: vendor({ buildFit: 'clash', buildClashWith: 'Alta Vista' }),
    inBuild: true,
  });
  assert.deepEqual(a.build, { kind: 'in_build' }, 'the Remove control that FIXES the clash must survive');
  assert.equal(a.lockGroupId, 'catering');
});

test("schedule clash: 'fits' and no verdict at all behave identically to pre-G1", () => {
  const base = resolveBenchCardActions({ enabled: true, vendor: vendor(), inBuild: false });
  for (const buildFit of ['fits', null, undefined] as const) {
    const a = resolveBenchCardActions({ enabled: true, vendor: vendor({ buildFit }), inBuild: false });
    assert.deepEqual(a, base, `buildFit=${String(buildFit)} must not change the card`);
  }
});

test('schedule clash: flag OFF ignores the verdict entirely', () => {
  const a = resolveBenchCardActions({
    enabled: false,
    vendor: vendor({ buildFit: 'clash', buildClashWith: 'Alta Vista' }),
    inBuild: false,
  });
  assert.deepEqual(a, { build: null, inquiry: null, lockGroupId: null });
});
