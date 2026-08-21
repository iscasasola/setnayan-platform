/**
 * SEC-4b · every vendor-surface hook must prove the ORDER owns its TARGET.
 *
 * Recovered from commit 9743f1f4f (the #3738 repair that never reached `main`).
 * The four `vendor_*__<id>` hooks in `lib/sku-activation.ts` read their target
 * out of the service_key and act on it; nothing asked whether the order belongs
 * to the vendor owning that target. `assertOrderOwnsVendorTarget` is that check.
 *
 * ── WHY THIS IS A SOURCE SCAN ───────────────────────────────────────────────
 * The gate and its two resolvers are module-private, and the only public entry
 * point (`activateOrderSku`) needs a live Supabase client plus vendor/branch/
 * charge fixtures. So this file asserts the WIRING — that each hook calls the
 * gate, and calls it BEFORE it provisions anything. That is the regression that
 * actually happens: a hook gets edited and quietly loses its gate.
 *
 * ⚠ What this does NOT prove: that the comparison itself rejects a mismatched
 * pair at runtime. A behavioural test through the `tests/db/` PGlite harness is
 * the honest follow-up and is NOT in this PR — see the changelog fragment. Do
 * not read a green run here as "the gate demonstrably refuses".
 *
 * ── WHY ORDER MATTERS ───────────────────────────────────────────────────────
 * The dispatcher wraps each hook in a try/catch that logs and continues, so a
 * throw ABORTS that hook without failing the approval. Gating after a write
 * would therefore leave the write in place and log a scary message — worse than
 * useless. Each assertion below pins the gate ahead of its hook's first effect.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const SRC = readFileSync(
  join(dirname(fileURLToPath(import.meta.url)), 'sku-activation.ts'),
  'utf8',
);

/** Each hook, and the first side effect it performs. */
const HOOKS = [
  {
    name: 'booking fee',
    extract: 'const chargeId = chargeIdFromBookingFeeLockServiceKey(ctx.serviceKey);',
    firstEffect: 'settleBookingFeeCharge(',
  },
  {
    name: 'additional branch',
    extract: 'const branchId = branchIdFromServiceKey(ctx.serviceKey);',
    firstEffect: "from('vendor_branches')",
  },
  {
    name: 'extra seat',
    extract: 'const vendorProfileId = vendorProfileIdFromSeatServiceKey(ctx.serviceKey);',
    firstEffect: 'recomputeVendorExtraSeats(',
  },
  {
    name: 'custom plan',
    extract: 'const vendorProfileId = vendorProfileIdFromCustomPlanServiceKey(ctx.serviceKey);',
    firstEffect: 'assertOrderOwnsVendorTarget(', // gate is this hook's first statement
  },
  {
    // Added 2026-08-21 with the ONE payment page: a plan purchase now mints an
    // order, and approving that order's payment switches the plan on. Same
    // shape as the others — the key names a purchase, the purchase names a
    // shop, and the paying order must belong to that shop.
    name: 'vendor subscription',
    extract:
      'const purchaseId = purchaseIdFromVendorSubscriptionServiceKey(ctx.serviceKey);',
    firstEffect: "rpc('approve_vendor_subscription'",
  },
] as const;

test('all five vendor-surface hooks call the ownership gate', () => {
  const calls = SRC.split('await assertOrderOwnsVendorTarget(').length - 1;
  assert.equal(
    calls,
    HOOKS.length,
    `expected ${HOOKS.length} gated hooks, found ${calls} — a hook lost its gate or a new one was added ungated`,
  );
});

for (const hook of HOOKS) {
  test(`${hook.name}: the gate runs before the hook does anything`, () => {
    const start = SRC.indexOf(hook.extract);
    assert.ok(start > 0, `${hook.name}: hook body moved — re-anchor this test`);

    const gate = SRC.indexOf('await assertOrderOwnsVendorTarget(', start);
    assert.ok(gate > 0, `${hook.name}: NO ownership gate — the key alone authorises provisioning`);

    const effect = SRC.indexOf(hook.firstEffect, start);
    assert.ok(effect > 0, `${hook.name}: first effect not found — re-anchor this test`);

    assert.ok(
      gate <= effect,
      `${hook.name}: the gate runs AFTER the first write. The dispatcher swallows hook ` +
        'throws, so the write would stand and only a log would record the problem.',
    );
  });
}

test('the gate delegates to the TESTED rule, and still throws', () => {
  // The decision moved to lib/vendor-target-ownership.ts so it could be
  // exercised rather than merely read — this module reaches `server-only`
  // transitively and cannot be imported by a test. What must stay true here is
  // that the gate calls that rule (not a second, untested copy of it) and still
  // THROWS on refusal rather than returning quietly.
  const fn = SRC.slice(
    SRC.indexOf('async function assertOrderOwnsVendorTarget('),
    SRC.indexOf('/** The vendor that owns a branch'),
  );
  assert.match(
    fn,
    /if \(!orderMayProvisionVendorTarget\(orderVendorId, targetVendorProfileId\)\)/,
    'the gate no longer delegates to the tested rule — a second copy of the ' +
      'decision here would be untested by construction',
  );
  assert.match(fn, /throw new Error\(/, 'the gate no longer throws — it must not return quietly');
  assert.match(fn, /vendorTargetRefusalMessage\(/, 'the refusal message is no longer the tested one');

  // …and the rule is imported from the pure module, not redefined locally.
  assert.match(
    SRC,
    /import \{[\s\S]{0,120}orderMayProvisionVendorTarget[\s\S]{0,120}\} from '@\/lib\/vendor-target-ownership'/,
    'the pure rule is not imported — is there a local shadow?',
  );
});

test('the resolvers read ownership from the OWNING table, not from the key', () => {
  // Deriving the owner from the service_key would be circular: the key is the
  // attacker-controlled input the gate exists to distrust.
  assert.match(SRC, /from\('vendor_branches'\)\s*\n?\s*\.select\('parent_vendor_profile_id'\)/);
  assert.match(SRC, /from\('booking_fee_charges'\)\s*\n?\s*\.select\('vendor_profile_id'\)/);
});
