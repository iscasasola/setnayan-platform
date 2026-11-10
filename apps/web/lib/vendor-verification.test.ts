/**
 * Guard suite for the vendor-verification FEE presentation helpers
 * (Entity Map & Hardcode Audit 2026-07-04, Violation #1).
 *
 * These pin the pure "0 means Free" rule and the "<name> — <fee>" label
 * builder so a repricing (verification went free via the 20260702 migration)
 * can never re-introduce a hardcoded ₱1,500 / ₱2,500 fee in a label. The fee
 * itself is resolved from `service_catalog` at runtime — not tested here (it's
 * an async DB read), but the SKU key space it reads is locked below.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { SupabaseClient } from '@supabase/supabase-js';
import {
  APPLICATION_TYPES,
  APPLICATION_TYPE_NAME,
  APPLICATION_TYPE_SKU,
  applicationTypeLabel,
  feeLabelForCentavos,
  isBookableVerificationState,
  isMarketplaceVendorBookable,
  marketplaceVendorBookingRefusal,
  VERIFICATION_STATES,
} from './vendor-verification';

test('feeLabelForCentavos renders ₱0 (and anything ≤ 0) as "Free"', () => {
  assert.equal(feeLabelForCentavos(0), 'Free');
  assert.equal(feeLabelForCentavos(-1), 'Free');
  assert.equal(feeLabelForCentavos(-150000), 'Free');
});

test('feeLabelForCentavos renders a positive fee as the peso string', () => {
  assert.equal(feeLabelForCentavos(150000), '₱1,500');
  assert.equal(feeLabelForCentavos(250000), '₱2,500');
  assert.equal(feeLabelForCentavos(99), '₱0.99');
});

test('feeLabelForCentavos treats non-finite input as Free', () => {
  assert.equal(feeLabelForCentavos(Number.NaN), 'Free');
  assert.equal(feeLabelForCentavos(Number.POSITIVE_INFINITY), 'Free');
});

test('applicationTypeLabel builds "<name> — Free" when the resolved fee is 0', () => {
  // This is the post-retirement state: verification is free, so every type
  // labels as "… — Free" — no stale ₱ amount anywhere.
  assert.equal(applicationTypeLabel('initial', 0), 'Initial — Free');
  assert.equal(applicationTypeLabel('annual_renewal', 0), 'Annual renewal — Free');
  assert.equal(applicationTypeLabel('post_demotion', 0), 'Post-demotion — Free');
});

test('applicationTypeLabel reflects a non-zero resolved fee (repricing-safe)', () => {
  // If the catalog were ever re-priced to charge again, the label follows it —
  // the point of resolving the fee from the DB instead of hardcoding it.
  assert.equal(
    applicationTypeLabel('annual_renewal', 150000),
    'Annual renewal — ₱1,500',
  );
  assert.equal(
    applicationTypeLabel('post_demotion', 250000),
    'Post-demotion — ₱2,500',
  );
});

test('every application type has a name and a catalog SKU (lock-step key space)', () => {
  for (const t of APPLICATION_TYPES) {
    assert.equal(
      typeof APPLICATION_TYPE_NAME[t],
      'string',
      `${t} must have a display name`,
    );
    assert.ok(
      APPLICATION_TYPE_NAME[t].length > 0,
      `${t} name must be non-empty`,
    );
    assert.equal(
      typeof APPLICATION_TYPE_SKU[t],
      'string',
      `${t} must map to a service_catalog SKU`,
    );
  }
});

test('APPLICATION_TYPE_SKU maps to the canonical seeded sku_codes', () => {
  // Locked to 20260516000000 + 20260516050000 seeds. Changing these is a
  // migration, so this guards against a silent drift of the key space the fee
  // resolver reads.
  assert.equal(APPLICATION_TYPE_SKU.initial, 'vendor_verification_initial');
  assert.equal(
    APPLICATION_TYPE_SKU.annual_renewal,
    'verification_annual_renewal',
  );
  assert.equal(
    APPLICATION_TYPE_SKU.post_demotion,
    'verification_reverification',
  );
});

// ---------------------------------------------------------------------------
// Booking-requires-verified gate (owner 2026-07-24) — the app-side half of the
// rule the DB trigger enforce_booking_requires_verified_vendor also enforces.
// ---------------------------------------------------------------------------

test('isBookableVerificationState: ONLY "verified" is bookable', () => {
  assert.equal(isBookableVerificationState('verified'), true);
  for (const s of VERIFICATION_STATES) {
    if (s === 'verified') continue;
    assert.equal(
      isBookableVerificationState(s),
      false,
      `${s} must NOT be bookable`,
    );
  }
});

/** Minimal supabase-client stub: one vendor_profiles row lookup by id. */
function stubClient(
  row: Record<string, unknown> | null,
  opts: { error?: boolean } = {},
): SupabaseClient {
  return {
    from() {
      return {
        select(cols: string) {
          // A stub that ignores the select would let a call site drop a gate
          // column and stay green — return only what was asked for.
          const asked = cols.split(',').map((c) => c.trim());
          const picked = row ? Object.fromEntries(asked.filter((c) => c in row).map((c) => [c, row[c]])) : null;
          return {
            eq() {
              return {
                async maybeSingle() {
                  return opts.error
                    ? { data: null, error: { message: 'boom' } }
                    : { data: picked, error: null };
                },
              };
            },
          };
        },
      };
    },
  } as unknown as SupabaseClient;
}

/** A verified, listed, clean shop — the only bookable shape. */
const LIVE = {
  verification_state: 'verified',
  public_visibility: 'verified',
  fraud_suspended_at: null,
  fraud_banned_at: null,
};

test('isMarketplaceVendorBookable: true only for a verified, listed, clean profile', async () => {
  assert.equal(await isMarketplaceVendorBookable(stubClient(LIVE), 'vp-1'), true);
});

test('isMarketplaceVendorBookable: false for every non-verified state', async () => {
  for (const s of ['unverified', 'pending_review', 'demoted', 'rejected']) {
    assert.equal(
      await isMarketplaceVendorBookable(
        stubClient({ ...LIVE, verification_state: s }),
        'vp-1',
      ),
      false,
      `${s} must resolve NOT bookable`,
    );
  }
});

// 🔴 Lane G item 1 (audit C1, 2026-11-10): admin hide, fraud suspend and fraud
// ban all leave verification_state = 'verified'. Each must still refuse.
test('isMarketplaceVendorBookable: an admin-hidden / archived verified shop is NOT bookable', async () => {
  for (const v of ['hidden', 'archived', 'coming_soon']) {
    assert.equal(
      await marketplaceVendorBookingRefusal(stubClient({ ...LIVE, public_visibility: v }), 'vp-1'),
      'not_listed',
      `public_visibility=${v} must refuse`,
    );
  }
});

test('isMarketplaceVendorBookable: a fraud-suspended verified shop is NOT bookable', async () => {
  const row = { ...LIVE, fraud_suspended_at: '2026-11-10T00:00:00Z' };
  assert.equal(await isMarketplaceVendorBookable(stubClient(row), 'vp-1'), false);
  assert.equal(await marketplaceVendorBookingRefusal(stubClient(row), 'vp-1'), 'suspended');
});

test('isMarketplaceVendorBookable: a fraud-banned verified shop is NOT bookable', async () => {
  const row = { ...LIVE, fraud_suspended_at: '2026-11-10T00:00:00Z', fraud_banned_at: '2026-11-10T00:00:00Z' };
  assert.equal(await isMarketplaceVendorBookable(stubClient(row), 'vp-1'), false);
  assert.equal(await marketplaceVendorBookingRefusal(stubClient(row), 'vp-1'), 'banned');
});

test('isMarketplaceVendorBookable: a select that drops a gate column fails CLOSED', async () => {
  // Only verification_state present (the pre-fix select) → not bookable.
  assert.equal(
    await isMarketplaceVendorBookable(stubClient({ verification_state: 'verified' }), 'vp-1'),
    false,
  );
});

test('isMarketplaceVendorBookable: fail-closed on a missing row or a read error', async () => {
  assert.equal(await isMarketplaceVendorBookable(stubClient(null), 'vp-x'), false);
  assert.equal(
    await isMarketplaceVendorBookable(
      stubClient(LIVE, { error: true }),
      'vp-x',
    ),
    false,
  );
  // Unknown / garbage state → parseVerificationState → 'unverified' → false.
  assert.equal(
    await isMarketplaceVendorBookable(
      stubClient({ ...LIVE, verification_state: 'weird' }),
      'vp-x',
    ),
    false,
  );
});
