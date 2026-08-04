import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  vendorAddonActivationAllowed,
  vendorAddonActivationBlockedReason,
} from './vendor-addon-activation-gate';

/**
 * The S2 activation gate (lib/sku-activation.ts) decides whether a PAID vendor
 * add-on order provisions its entitlement when an admin approves the payment.
 *
 * The invariant these tests exist to protect: **the tier floor may lift, the
 * verification requirement never does.** Get that backwards and either a vendor
 * pays and receives nothing (tier floor too high) or an unverified shop
 * provisions a paid feature (verification relaxed).
 */

const base = { minTier: 'pro' as const, verification: 'verified' };

// ── the regression this module was extracted for ────────────────────────────
// #3692/#3697 (Papic) and #3699 (3D Plan Ads) opened their BUY paths to every
// tier, but activation still demanded Pro+. A verified Free vendor — the COMMON
// shape, since verification never sets tier_state — would pay and get nothing.

test('REGRESSION: verified Free vendor, tier floor lifted → activation ALLOWED', () => {
  assert.equal(
    vendorAddonActivationAllowed({ ...base, tier: 'free', allTiersAllowed: true }),
    true,
  );
  assert.equal(
    vendorAddonActivationAllowed({ ...base, tier: 'solo', allTiersAllowed: true }),
    true,
  );
});

test('REGRESSION: verified Free vendor, floor NOT lifted → still blocked (today)', () => {
  assert.equal(
    vendorAddonActivationAllowed({ ...base, tier: 'free', allTiersAllowed: false }),
    false,
  );
  // Omitted must equal explicit false — the flag-OFF path is byte-identical.
  assert.equal(vendorAddonActivationAllowed({ ...base, tier: 'free' }), false);
});

// ── verification NEVER relaxes, on any tier, with the floor lifted ──────────

test('unverified is blocked even with the tier floor lifted', () => {
  for (const tier of ['free', 'solo', 'pro', 'enterprise', 'custom', null]) {
    assert.equal(
      vendorAddonActivationAllowed({
        tier,
        verification: 'pending',
        minTier: 'pro',
        allTiersAllowed: true,
      }),
      false,
      `tier ${tier} / pending`,
    );
  }
  assert.equal(
    vendorAddonActivationAllowed({
      tier: 'enterprise',
      verification: null,
      minTier: 'pro',
      allTiersAllowed: true,
    }),
    false,
  );
});

// ── the unlifted floor still behaves exactly as before ──────────────────────

test('unlifted floor: pro+ passes, below-pro fails', () => {
  assert.equal(vendorAddonActivationAllowed({ ...base, tier: 'pro' }), true);
  assert.equal(vendorAddonActivationAllowed({ ...base, tier: 'enterprise' }), true);
  assert.equal(vendorAddonActivationAllowed({ ...base, tier: 'custom' }), true);
  assert.equal(vendorAddonActivationAllowed({ ...base, tier: 'verified' }), false);
  assert.equal(vendorAddonActivationAllowed({ ...base, tier: null }), false);
});

test('a solo-floor add-on (AI, Deep Search) is unaffected by the pro-floor change', () => {
  const solo = { minTier: 'solo' as const, verification: 'verified' };
  assert.equal(vendorAddonActivationAllowed({ ...solo, tier: 'solo' }), true);
  assert.equal(vendorAddonActivationAllowed({ ...solo, tier: 'free' }), false);
});

// ── the operator-facing reason string ───────────────────────────────────────

test('blocked reason names the real floor + the observed state', () => {
  assert.equal(
    vendorAddonActivationBlockedReason({ ...base, tier: 'free' }),
    'requires pro+ and verified (tier=free, verification=verified)',
  );
  assert.equal(
    vendorAddonActivationBlockedReason({
      tier: null,
      verification: null,
      minTier: 'pro',
      allTiersAllowed: true,
    }),
    'requires any tier and verified (tier=null, verification=null)',
  );
});
