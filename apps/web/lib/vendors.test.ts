/**
 * Vendor name-reveal resolver (`resolveVendorDisplayName` / `isVendorNameRevealed`).
 * Run with `pnpm test:unit` (Node built-in test runner via tsx).
 *
 * Locks the owner "OPEN IT UP" decision (Vendor_Subscription_Ladder_2026-07-22
 * §3): a vendor's NAME is NEVER gated. A VERIFIED vendor's real business_name
 * reveals on EVERY tier from day 1 — the reveal is keyed on verification, NOT on
 * paid tier (a verified vendor on the free plan carries tier_state='free', since
 * verification never changes tier_state). Conversely an UNVERIFIED vendor never
 * reveals via this path, so surfaces that don't verification-gate at the query
 * layer can't leak an unverified real name.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { resolveVendorDisplayName, isVendorNameRevealed } from './vendors';

const BASE = {
  business_name: 'Aperture & Vine Studios',
  name_revealed_at: null,
  primary_canonical_service: 'photography',
  location_city: 'Cebu City',
  services: ['photography'] as string[],
  screen_name: 'Cebu City Wedding Photographer #4218',
};

// ── The "open it up" lock: verified name is never gated ─────────────────────

test('verified vendor reveals real business_name on the FREE plan, no chat reply', () => {
  // The common real-world case: verification_state='verified' + tier_state='free'
  // (verification never bumps tier_state) + name never revealed in chat.
  const name = resolveVendorDisplayName({
    ...BASE,
    is_verified: true,
    isPaidTier: false, // free tier → isTrueNameTier('free') === false
    name_revealed_at: null,
  });
  assert.equal(name, 'Aperture & Vine Studios');
  assert.equal(
    isVendorNameRevealed({ name_revealed_at: null, isPaidTier: false, is_verified: true, services: BASE.services }),
    true,
  );
});

test('UNVERIFIED vendor stays anonymized (placeholder) — no over-exposure', () => {
  // is_verified false + free tier + no reply → screen-name placeholder, NOT the
  // real business_name. This is the safety property that lets the de-gate ship
  // even on surfaces that don't verification-gate their query.
  const name = resolveVendorDisplayName({
    ...BASE,
    is_verified: false,
    isPaidTier: false,
    name_revealed_at: null,
  });
  assert.equal(name, BASE.screen_name);
  assert.equal(
    isVendorNameRevealed({ name_revealed_at: null, isPaidTier: false, is_verified: false, services: BASE.services }),
    false,
  );
});

test('unverified vendor still reveals once it has replied (name_revealed_at) — legacy path intact', () => {
  // The de-gate is ADDITIVE: it never removes the pre-existing reveal paths.
  const name = resolveVendorDisplayName({
    ...BASE,
    is_verified: false,
    isPaidTier: false,
    name_revealed_at: '2026-07-01T00:00:00Z',
  });
  assert.equal(name, 'Aperture & Vine Studios');
});

test('paid tier still reveals day-1 even when not flagged verified (belt-and-suspenders)', () => {
  const name = resolveVendorDisplayName({
    ...BASE,
    is_verified: false,
    isPaidTier: true,
    name_revealed_at: null,
  });
  assert.equal(name, 'Aperture & Vine Studios');
});

test('is_verified defaults to false when omitted (unverified callers unchanged)', () => {
  assert.equal(
    isVendorNameRevealed({ name_revealed_at: null, isPaidTier: false, services: BASE.services }),
    false,
  );
});

test('venue exemption still wins regardless of verification', () => {
  const name = resolveVendorDisplayName({
    ...BASE,
    services: ['venue'],
    is_verified: false,
    isPaidTier: false,
    name_revealed_at: null,
  });
  assert.equal(name, 'Aperture & Vine Studios');
});
