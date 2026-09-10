/**
 * Vendor cohort deals resolve PER VENDOR, statelessly, and stay dark behind
 * PROMO_FREE_WINDOWS_ENABLED.
 *
 * Owner rulings 2026-09-05: "all vendors" means all VERIFIED vendors; the
 * second cohort is "any vendor who registers and submits documents on X-X".
 * The window says who gets in; deal_length_days says how long each keeps it.
 *
 * Run: cd apps/web && npx tsx --test lib/promo-free-windows.test.ts
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  applyVendorTierPromotion,
  coupleWindowCoversEvent,
  getPromotedVendorTierFor,
  isSkuFreeForCouplesNow,
  promoFreeSkusForCouples,
  resolveVendorDealTier,
  vendorDealEndsAt,
  vendorDealWindowsFor,
  vendorQualifiedAt,
  vendorTierOfSku,
  isVendorDealAudience,
  type PromoFreeWindow,
  type VendorDealFacts,
} from './promo-free-windows';

const DAY = 86_400_000;
const T0 = Date.parse('2026-10-01T00:00:00Z');
const iso = (ms: number) => new Date(ms).toISOString();

function win(over: Partial<PromoFreeWindow> = {}): PromoFreeWindow {
  return {
    promo_window_id: 'w-' + Math.random().toString(36).slice(2, 8),
    title: 'Pro on us',
    blurb: null,
    covered_service_keys: ['pro_vendor_monthly'],
    audience_type: 'all_vendors',
    promoted_vendor_tier: 'pro',
    starts_at: iso(T0),
    ends_at: iso(T0 + 30 * DAY),
    show_banner: true,
    deal_length_days: null,
    event_date_from: null,
    event_date_to: null,
    ...over,
  };
}

const verifiedBefore: VendorDealFacts = {
  verification_state: 'verified',
  created_at: iso(T0 - 100 * DAY),
  last_verified_at: iso(T0 - 90 * DAY),
};
const pending: VendorDealFacts = {
  verification_state: 'pending_review',
  created_at: iso(T0 + 2 * DAY),
  last_verified_at: null,
};
const newInWindow: VendorDealFacts = {
  verification_state: 'verified',
  created_at: iso(T0 + 2 * DAY),
  last_verified_at: iso(T0 + 5 * DAY),
};

// ── all_vendors = VERIFIED vendors only ─────────────────────────────────────

test('all_vendors: a pending vendor gets nothing from a live window', () => {
  assert.equal(resolveVendorDealTier([win()], pending, T0 + 10 * DAY), null);
});

test('all_vendors: an unverified, demoted or rejected vendor gets nothing either', () => {
  for (const st of ['unverified', 'demoted', 'rejected', null, undefined, 'weird']) {
    assert.equal(
      resolveVendorDealTier([win()], { ...verifiedBefore, verification_state: st }, T0 + 10 * DAY),
      null,
      `state=${String(st)}`,
    );
  }
});

test('all_vendors: a verified vendor gets the tier while the window is live', () => {
  assert.equal(resolveVendorDealTier([win()], verifiedBefore, T0 + 10 * DAY), 'pro');
  assert.equal(resolveVendorDealTier([win()], verifiedBefore, T0 - 1), null, 'not yet open');
  assert.equal(resolveVendorDealTier([win()], verifiedBefore, T0 + 30 * DAY), null, 'closed');
});

test('all_vendors: verified DURING the window qualifies at approval, not at window start', () => {
  const w = win();
  const q = vendorQualifiedAt(w, newInWindow);
  assert.equal(q, T0 + 5 * DAY);
  assert.equal(resolveVendorDealTier([w], newInWindow, T0 + 3 * DAY), null, 'not approved yet');
  assert.equal(resolveVendorDealTier([w], newInWindow, T0 + 6 * DAY), 'pro');
});

test('all_vendors: verified AFTER the window closed never qualifies', () => {
  const late: VendorDealFacts = { ...newInWindow, last_verified_at: iso(T0 + 40 * DAY) };
  assert.equal(vendorQualifiedAt(win(), late), null);
});

test('all_vendors: a legacy verified row with no approval timestamp counts as approved before the window', () => {
  const legacy: VendorDealFacts = { verification_state: 'verified', created_at: null, last_verified_at: null };
  assert.equal(vendorQualifiedAt(win(), legacy), T0);
});

// ── new_verified_vendors = sign-up AND approval both inside the window ──────

const cohort = () => win({ audience_type: 'new_verified_vendors', promoted_vendor_tier: 'solo' });

test('new_verified_vendors: registers + verified inside the window → the tier', () => {
  assert.equal(vendorQualifiedAt(cohort(), newInWindow), T0 + 5 * DAY);
  assert.equal(resolveVendorDealTier([cohort()], newInWindow, T0 + 6 * DAY), 'solo');
});

test('new_verified_vendors: a vendor who registered BEFORE the window is not new — nothing', () => {
  const oldSignup: VendorDealFacts = { ...newInWindow, created_at: iso(T0 - 1) };
  assert.equal(vendorQualifiedAt(cohort(), oldSignup), null);
});

test('new_verified_vendors: registered inside but approved after the window — nothing', () => {
  const lateApproval: VendorDealFacts = { ...newInWindow, last_verified_at: iso(T0 + 30 * DAY) };
  assert.equal(vendorQualifiedAt(cohort(), lateApproval), null);
});

test('new_verified_vendors: pending (registered, documents in, not yet approved) — nothing', () => {
  assert.equal(vendorQualifiedAt(cohort(), pending), null);
  assert.equal(resolveVendorDealTier([cohort()], pending, T0 + 10 * DAY), null);
});

test('new_verified_vendors: a long-verified vendor is not in the cohort', () => {
  assert.equal(vendorQualifiedAt(cohort(), verifiedBefore), null);
});

// ── deal length is a SEPARATE control from the window ───────────────────────

test('deal length counts from qualification, so it can outlive the window', () => {
  const w = cohort();
  w.deal_length_days = 28;
  const lastDay: VendorDealFacts = {
    verification_state: 'verified',
    created_at: iso(T0 + 29 * DAY),
    last_verified_at: iso(T0 + 29 * DAY + 3600_000),
  };
  const q = vendorQualifiedAt(w, lastDay)!;
  assert.equal(vendorDealEndsAt(w, q), q + 28 * DAY);
  // 10 days after the window closed, they still hold it …
  assert.equal(resolveVendorDealTier([w], lastDay, T0 + 40 * DAY), 'solo');
  // … and lose it on day 28 from qualification.
  assert.equal(resolveVendorDealTier([w], lastDay, q + 28 * DAY), null);
});

test('no deal length → the deal ends when the window ends, for everyone', () => {
  const w = cohort();
  const q = vendorQualifiedAt(w, newInWindow)!;
  assert.equal(vendorDealEndsAt(w, q), T0 + 30 * DAY);
  assert.equal(resolveVendorDealTier([w], newInWindow, T0 + 30 * DAY), null);
});

test('deal length can also be SHORTER than the window', () => {
  const w = win({ deal_length_days: 7 });
  assert.equal(resolveVendorDealTier([w], verifiedBefore, T0 + 6 * DAY), 'pro');
  assert.equal(resolveVendorDealTier([w], verifiedBefore, T0 + 8 * DAY), null);
});

// ── stacking / promotion rules ──────────────────────────────────────────────

test('two live deals → the higher tier wins; never a downgrade of the real tier', () => {
  const solo = win({ promoted_vendor_tier: 'solo' });
  const ent = win({ promoted_vendor_tier: 'enterprise' });
  assert.equal(resolveVendorDealTier([solo, ent], verifiedBefore, T0 + DAY), 'enterprise');
  assert.equal(applyVendorTierPromotion('pro', 'solo'), 'pro');
  assert.equal(applyVendorTierPromotion('free', 'solo'), 'solo');
  assert.equal(applyVendorTierPromotion('pro', null), 'pro');
});

test('couple and segment windows promote no vendor', () => {
  const couple = win({ audience_type: 'all_couples', promoted_vendor_tier: null });
  const seg = win({ audience_type: 'segment' });
  assert.equal(vendorDealWindowsFor([couple, seg], verifiedBefore, T0 + DAY).length, 0);
});

test('vendorTierOfSku reads only the plan rows of vendor_billing_catalog', () => {
  assert.equal(vendorTierOfSku('solo_vendor_monthly'), 'solo');
  assert.equal(vendorTierOfSku('pro_vendor_annual'), 'pro');
  assert.equal(vendorTierOfSku('enterprise_vendor_monthly'), 'enterprise');
  for (const addon of [
    'vendor_photo_challenge',
    'vendor_3d_booth',
    'vendor_deep_search',
    'vendor_extra_seat',
    'vendor_additional_branch',
    'vendor_papic_portfolio_pack',
    'vendor_custom_base',
    'vendor_token_pack_10',
  ]) {
    assert.equal(vendorTierOfSku(addon), null, addon);
  }
  assert.equal(isVendorDealAudience('all_vendors'), true);
  assert.equal(isVendorDealAudience('new_verified_vendors'), true);
  assert.equal(isVendorDealAudience('all_couples'), false);
  assert.equal(isVendorDealAudience('segment'), false);
});

// ── PROVABLY INERT while the flag is off ────────────────────────────────────

test('flag off: a live cohort window grants NOTHING to a vendor who qualifies, and is never even read', async () => {
  const prev = process.env.PROMO_FREE_WINDOWS_ENABLED;
  delete process.env.PROMO_FREE_WINDOWS_ENABLED;
  try {
    let reads = 0;
    const live = cohort();
    live.starts_at = iso(Date.now() - 10 * DAY);
    live.ends_at = iso(Date.now() + 20 * DAY);
    const qualifies: VendorDealFacts = {
      verification_state: 'verified',
      created_at: iso(Date.now() - 5 * DAY),
      last_verified_at: iso(Date.now() - 2 * DAY),
    };
    // Sanity: the pure resolver WOULD grant it — so a null below is the flag.
    assert.equal(resolveVendorDealTier([live], qualifies), 'solo');
    const tier = await getPromotedVendorTierFor(qualifies, async () => {
      reads += 1;
      return [live];
    });
    assert.equal(tier, null);
    assert.equal(reads, 0, 'the window store must not be consulted while the flag is off');
  } finally {
    if (prev === undefined) delete process.env.PROMO_FREE_WINDOWS_ENABLED;
    else process.env.PROMO_FREE_WINDOWS_ENABLED = prev;
  }
});

test('flag on: the same vendor gets the tier through the same path', async () => {
  const prev = process.env.PROMO_FREE_WINDOWS_ENABLED;
  process.env.PROMO_FREE_WINDOWS_ENABLED = 'true';
  try {
    const live = cohort();
    live.starts_at = iso(Date.now() - 10 * DAY);
    live.ends_at = iso(Date.now() + 20 * DAY);
    const qualifies: VendorDealFacts = {
      verification_state: 'verified',
      created_at: iso(Date.now() - 5 * DAY),
      last_verified_at: iso(Date.now() - 2 * DAY),
    };
    assert.equal(await getPromotedVendorTierFor(qualifies, async () => [live]), 'solo');
    assert.equal(await getPromotedVendorTierFor(pending, async () => [live]), null);
  } finally {
    if (prev === undefined) delete process.env.PROMO_FREE_WINDOWS_ENABLED;
    else process.env.PROMO_FREE_WINDOWS_ENABLED = prev;
  }
});

// ── G5: coupleWindowCoversEvent — event-date-range filter on all_couples ────
//
// (a) "an event for a specific date/range" and (c) "for any event" from the
// owner's ask, both resolved by ONE pure predicate over already-fetched
// facts, mirroring vendorQualifiedAt's shape on the couple side.

test('coupleWindowCoversEvent: no filter (both bounds null) → true for ANY date, including null/undefined — this is (c)', () => {
  const w = win({ event_date_from: null, event_date_to: null });
  assert.equal(coupleWindowCoversEvent(w, '2026-12-25'), true);
  assert.equal(coupleWindowCoversEvent(w, null), true);
  assert.equal(coupleWindowCoversEvent(w, undefined), true);
});

test('coupleWindowCoversEvent: a filter is set but the event has no locked date → FALSE, never assumed included', () => {
  const fromOnly = win({ event_date_from: '2026-12-01', event_date_to: null });
  const toOnly = win({ event_date_from: null, event_date_to: '2026-12-31' });
  const range = win({ event_date_from: '2026-12-01', event_date_to: '2026-12-31' });
  for (const w of [fromOnly, toOnly, range]) {
    assert.equal(coupleWindowCoversEvent(w, null), false);
    assert.equal(coupleWindowCoversEvent(w, undefined), false);
    assert.equal(coupleWindowCoversEvent(w, ''), false);
  }
});

test('coupleWindowCoversEvent: a range bound is inclusive at both ends, and excludes just outside', () => {
  const w = win({ event_date_from: '2026-12-01', event_date_to: '2026-12-31' });
  assert.equal(coupleWindowCoversEvent(w, '2026-11-30'), false, 'day before start');
  assert.equal(coupleWindowCoversEvent(w, '2026-12-01'), true, 'exactly at start — inclusive');
  assert.equal(coupleWindowCoversEvent(w, '2026-12-15'), true, 'inside');
  assert.equal(coupleWindowCoversEvent(w, '2026-12-31'), true, 'exactly at end — inclusive');
  assert.equal(coupleWindowCoversEvent(w, '2027-01-01'), false, 'day after end');
});

test('coupleWindowCoversEvent: an open-ended lower bound only (event_date_to null) covers everything from that day on', () => {
  const w = win({ event_date_from: '2026-12-01', event_date_to: null });
  assert.equal(coupleWindowCoversEvent(w, '2026-11-30'), false);
  assert.equal(coupleWindowCoversEvent(w, '2026-12-01'), true);
  assert.equal(coupleWindowCoversEvent(w, '2099-01-01'), true);
});

test('coupleWindowCoversEvent: an open-ended upper bound only (event_date_from null) covers everything up to that day', () => {
  const w = win({ event_date_from: null, event_date_to: '2026-12-31' });
  assert.equal(coupleWindowCoversEvent(w, '2000-01-01'), true);
  assert.equal(coupleWindowCoversEvent(w, '2026-12-31'), true);
  assert.equal(coupleWindowCoversEvent(w, '2027-01-01'), false);
});

test('coupleWindowCoversEvent: from === to is (a) "a specific single date"', () => {
  const w = win({ event_date_from: '2026-12-25', event_date_to: '2026-12-25' });
  assert.equal(coupleWindowCoversEvent(w, '2026-12-24'), false);
  assert.equal(coupleWindowCoversEvent(w, '2026-12-25'), true);
  assert.equal(coupleWindowCoversEvent(w, '2026-12-26'), false);
});

test('coupleWindowCoversEvent: defensive against a stray time component on either side', () => {
  const w = win({ event_date_from: '2026-12-01', event_date_to: '2026-12-31' });
  assert.equal(coupleWindowCoversEvent(w, '2026-12-15T00:00:00.000Z'), true);
  const wWithTime = win({
    event_date_from: '2026-12-01T00:00:00.000Z',
    event_date_to: '2026-12-31T00:00:00.000Z',
  });
  assert.equal(coupleWindowCoversEvent(wWithTime, '2026-12-15'), true);
});

// ── PROVABLY INERT while the flag is off (couple side) ──────────────────────

test('flag off: a live event-dated couple window frees NOTHING, for a matching event or any event', async () => {
  const prev = process.env.PROMO_FREE_WINDOWS_ENABLED;
  delete process.env.PROMO_FREE_WINDOWS_ENABLED;
  try {
    // Sanity: the pure predicate WOULD cover this event — so an empty result
    // below is the flag, not a bug in coupleWindowCoversEvent.
    const w = win({
      audience_type: 'all_couples',
      promoted_vendor_tier: null,
      covered_service_keys: ['PAPIC_ONE_50'],
      starts_at: iso(Date.now() - DAY),
      ends_at: iso(Date.now() + DAY),
      event_date_from: '2026-12-01',
      event_date_to: '2026-12-31',
    });
    assert.equal(coupleWindowCoversEvent(w, '2026-12-15'), true);

    // getLiveCoupleFreeWindows short-circuits to [] before touching the DB
    // while the flag is off, so isSkuFreeForCouplesNow / promoFreeSkusForCouples
    // need no injected fetch here — the flag guard runs first regardless.
    assert.equal(await isSkuFreeForCouplesNow('PAPIC_ONE_50', '2026-12-15'), false);
    assert.equal(await isSkuFreeForCouplesNow('PAPIC_ONE_50', null), false);
    assert.equal((await promoFreeSkusForCouples('2026-12-15')).size, 0);
    assert.equal((await promoFreeSkusForCouples(null)).size, 0);
  } finally {
    if (prev === undefined) delete process.env.PROMO_FREE_WINDOWS_ENABLED;
    else process.env.PROMO_FREE_WINDOWS_ENABLED = prev;
  }
});
