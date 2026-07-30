## 2026-07-30 · fix(security): the order must own what it provisions (PR C of the recovered #3738 repair)

Lands `assertOrderOwnsVendorTarget` + its two resolvers in `lib/sku-activation.ts`, recovered
from commit `9743f1f4f` — the #3738 repair that reads MERGED but never reached `main`.

### The gap

The four `vendor_*__<id>` hooks in `PREFIX_HOOKS` read their target out of the service_key and
act on it:

```ts
const chargeId = chargeIdFromBookingFeeLockServiceKey(ctx.serviceKey);
await settleBookingFeeCharge(ctx.admin, chargeId, 'manual', ctx.orderId);
```

Nothing asked whether the ORDER belongs to the vendor owning that charge. **The key was the
authority.** Same shape for `vendor_additional_branch__`, `vendor_extra_seat__` and
`vendor_custom_plan__`.

The gate resolves the target's owning vendor from **the owning table** (`vendor_branches`,
`booking_fee_charges`) — never from the key, which is the attacker-controlled input it exists to
distrust — and compares it with the order's own `vendor_profile_id`. Couple checkout pins that
column to NULL, so a couple-minted row can never match.

### Why this is the load-bearing half

Its sibling — `isVendorSurfaceServiceKey` in couple checkout, landed separately — guards **one
door**, and what actually blocks that door today is SEC-7's pricing refusal rather than the guard
itself. This check is **origin-independent**: it holds for a comp grant, an admin-minted bespoke
order from `/admin/custom-plans`, or any future minter — paths with no pricing step at all.

### It throws, deliberately

The dispatcher wraps each hook in a try/catch that logs and continues, so a throw aborts that
hook without failing the approval. Money may have moved and an admin can refund — but the wrong
tenant is not provisioned. Failing open would defeat the check. That is also why the gate must
run **before** its hook's first write: gating afterwards would leave the write standing and
produce only a log line.

### Tests

`lib/activation-ownership-gate.test.ts` — 7 cases: exactly 4 gated hooks (a new ungated hook
fails this) · each of the four gates runs **before** that hook's first side effect · the
comparison fails CLOSED on a null from either side · the gate still throws rather than returning
quietly · the resolvers read from the owning table rather than from the key.

**Mutation-proved:** drop the branch hook's gate → 2 fail. Make the comparison null-tolerant, i.e.
fail OPEN → 1 fail (the subtlest and most dangerous mutation). Move the seat gate after its write
→ 1 fail. Restored → 7/7. Wider run: 186/186 across sku / activation / order / seat / branch /
booking tests.

### ⚠ What these tests do NOT prove

They are a **source scan**. The gate and its resolvers are module-private, and the only public
entry point (`activateOrderSku`) needs a live Supabase client plus vendor/branch/charge fixtures.
So this asserts the WIRING — which is the regression that actually happens, a hook being edited
and quietly losing its gate — and **not** that the comparison rejects a mismatched pair at
runtime. A behavioural test through the `tests/db/` PGlite harness is the honest follow-up and is
not in this PR. A green run here must not be read as "the gate demonstrably refuses".

SPEC IMPACT: None — no legitimate path is affected. Every real minter already stamps
`orders.vendor_profile_id` from the session (`startBranchPayment` and friends resolve it server
side and re-read the target filtered by `parent_vendor_profile_id`), so the gate is a no-op on
correct traffic. `DECISION_LOG.md` row added 2026-07-30.
