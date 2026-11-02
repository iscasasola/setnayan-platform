## 2026-07-25 · fix(vendor-pricing): lift the ACTIVATION tier floor in lock-step with the opened buy gates

**Money bug in the two shipped gate-opens.** #3692/#3697 (Papic Challenge) and
#3699 (3D Plan Ads) opened their BUY paths to every tier under the 2026-07-25
tiered add-on model — but `lib/sku-activation.ts` still re-asserted a hardcoded
**Pro+ floor at ACTIVATION time** (`assertVendorAddonActivationEligible(ctx, vpid,
'pro')`, the S2 defence-in-depth check).

Consequence with `NEXT_PUBLIC_VENDOR_ADDON_TIERED_PRICING` on: a verified
Free/Solo vendor buys the add-on, an apply-then-pay order is created, they pay —
and when an admin approves the payment the activation hook **throws**
(`vendor add-on activation blocked: … requires pro+`). The order sits `paid`, the
entitlement never lands. **Money taken, nothing granted.**

Not an exotic combination: verification does not set `tier_state`, so
**verified-and-Free is the ordinary shape** for a real vendor.

- `lib/vendor-addon-activation-gate.ts` (**new, pure**) — the verdict extracted
  from `sku-activation.ts` so the invariant that protects money is testable:
  `vendorAddonActivationAllowed()` + `vendorAddonActivationBlockedReason()`.
- `lib/sku-activation.ts` — `assertVendorAddonActivationEligible` gains
  `allTiersAllowed` (default `false` → byte-identical) and delegates the verdict.
  The two OPENED SKUs (`vendor_3d_booth`, `vendor_photo_challenge`) now pass
  `isVendorAddonTieredPricingEnabled()`, the same switch their buy actions read.
  `vendor_ai_addon` + `vendor_deep_search` keep their Solo+ floor untouched —
  their variant splits have not shipped yet.

**The tier half lifts; the verification half NEVER does.** That asymmetry is the
point, and 6 new tests pin it (including "unverified is blocked on every tier even
with the floor lifted"). Rationale: the price band is fixed when the order is
created, so a tier that changes during the 24-hour approval window must not
retroactively void a paid entitlement — that also quietly fixes a **pre-existing**
bug where a Pro vendor whose subscription lapsed mid-review lost a paid add-on.
Losing verification is different in kind and still blocks provisioning.

Typecheck clean · 3283/3283 unit tests pass.

SPEC IMPACT: None (restores the intent of the already-locked model).
