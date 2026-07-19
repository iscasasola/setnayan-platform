/**
 * Guards for the vendor-favorites subscription gate (lib/vendor-favorite-gate).
 *
 * Two layers:
 *   1. a truth-table over the pure predicate `vendorHoldsActivePaidSub` and the
 *      activation flag, and
 *   2. a SOURCE-SCAN guard (same shape as `llms-price-drift.test.ts`) asserting
 *      every Library favorites-display loader routes its vendor ids through the
 *      gate — so a new favorites surface can never silently skip it and leak a
 *      lapsed vendor's favorite. Both fail `pnpm test:unit` in CI.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

import {
  vendorHoldsActivePaidSub,
  favoritesSubscriptionGateEnabled,
} from './vendor-favorite-gate';

const HERE = dirname(fileURLToPath(import.meta.url));
const FUTURE = new Date(Date.now() + 86_400_000).toISOString();
const PAST = new Date(Date.now() - 86_400_000).toISOString();

// ---------------------------------------------------------------------------
// Predicate truth table
// ---------------------------------------------------------------------------

test('paid tiers with a live (or null) expiry are favoritable', () => {
  for (const tier of ['solo', 'pro', 'enterprise', 'custom']) {
    assert.equal(
      vendorHoldsActivePaidSub({ tier_state: tier, tier_expires_at: FUTURE }),
      true,
      `${tier} + future expiry should be favoritable`,
    );
    assert.equal(
      vendorHoldsActivePaidSub({ tier_state: tier, tier_expires_at: null }),
      true,
      `${tier} + null expiry (never expires, e.g. comp) should be favoritable`,
    );
  }
});

test('free tiers are never favoritable', () => {
  for (const tier of ['free', 'verified', null, '', 'garbage']) {
    assert.equal(
      vendorHoldsActivePaidSub({ tier_state: tier, tier_expires_at: FUTURE }),
      false,
      `tier=${JSON.stringify(tier)} is a free tier and must not be favoritable`,
    );
  }
});

test('a lapsed paid tier (expiry in the past) is NOT favoritable', () => {
  // Lapse is login-driven, so a past-due vendor can still carry a paid
  // tier_state until the sweep runs — the expiry check is what hides them now.
  for (const tier of ['solo', 'pro', 'enterprise', 'custom']) {
    assert.equal(
      vendorHoldsActivePaidSub({ tier_state: tier, tier_expires_at: PAST }),
      false,
      `${tier} with an elapsed expiry must be hidden immediately`,
    );
  }
});

test('activation flag defaults OFF and only "true" enables it', () => {
  const prev = process.env.VENDOR_FAVORITES_SUBSCRIPTION_GATE;
  try {
    delete process.env.VENDOR_FAVORITES_SUBSCRIPTION_GATE;
    assert.equal(favoritesSubscriptionGateEnabled(), false, 'unset → OFF');
    process.env.VENDOR_FAVORITES_SUBSCRIPTION_GATE = 'true';
    assert.equal(favoritesSubscriptionGateEnabled(), true, "'true' → ON");
    process.env.VENDOR_FAVORITES_SUBSCRIPTION_GATE = '1';
    assert.equal(favoritesSubscriptionGateEnabled(), false, "'1' must NOT enable");
  } finally {
    if (prev === undefined) delete process.env.VENDOR_FAVORITES_SUBSCRIPTION_GATE;
    else process.env.VENDOR_FAVORITES_SUBSCRIPTION_GATE = prev;
  }
});

// ---------------------------------------------------------------------------
// Source-scan guard: every Library favorites loader must gate
// ---------------------------------------------------------------------------

// The couple/coordinator favorites-DISPLAY loaders. Each reads a favorites
// table (event_vendors picks / guest_saved_vendors) and renders vendor cards,
// so each MUST filter through the subscription gate. If you add a new favorites
// surface, add it here AND wire the gate — do not remove entries to make CI pass.
const FAVORITE_DISPLAY_LOADERS = [
  join(HERE, '..', 'app', 'dashboard', '(account)', 'library', '_data', 'saved-vendors.ts'),
  join(HERE, '..', 'app', 'dashboard', '(account)', 'library', '_data', 'attended-vendors.ts'),
];

test('every Library favorites loader routes through the subscription gate', () => {
  for (const path of FAVORITE_DISPLAY_LOADERS) {
    const src = readFileSync(path, 'utf8');
    assert.ok(
      src.includes('filterFavoritableVendorIds'),
      `${path} renders saved vendors but does not call filterFavoritableVendorIds. ` +
        `Every couple/coordinator favorites-display loader MUST run its vendor ids ` +
        `through the subscription gate (lib/vendor-favorite-gate) so a lapsed vendor's ` +
        `favorite is hidden. Wire the gate, or — only if this file is genuinely not a ` +
        `favorites-display surface — update FAVORITE_DISPLAY_LOADERS deliberately.`,
    );
  }
});
