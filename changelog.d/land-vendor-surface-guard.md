## 2026-07-30 · fix(security): land the vendor-surface checkout guard (PR A of the recovered #3738 repair)

Recovers `lib/vendor-surface-service-keys.ts` from commit `9743f1f4f` — the #3738 repair that
reads MERGED but never reached `main` — and **wires it**, which the original never did.

### What it guards

Four SKU families encode their target object in the service key itself:
`vendor_booking_fee__<charge_id>` · `vendor_additional_branch__<branch_id>` ·
`vendor_extra_seat__<vendor_profile_id>` · `vendor_custom_plan__<vendor_profile_id>`.
`activateOrderSku`'s `PREFIX_HOOKS` provision straight off that string — e.g.
`settleBookingFeeCharge(chargeIdFromBookingFeeLockServiceKey(key))` — with no check that the
order relates to the owning vendor. **The key is the authority.**

### ⚠ This is defence in depth, NOT a live fix — verified, not assumed

The module's original rationale is **stale** and was rewritten before landing. It claimed couple
checkout would accept these keys and fall back to the browser's `original_centavos`; its own
comment admitted *"That is SEC-7 (task #50), still open."* SEC-7 has since landed. Checked on
current `origin/main`:

- `lib/order-charge-authority.ts` is total — a server-resolved total or a REFUSAL, no client
  fallback. A key with no price source is refused (`no_price_source`) before an order exists.
- The vendor-side mint paths are properly authorised: `startBranchPayment` resolves
  `vendorProfileId` **from the session** and re-reads the target filtered by
  `parent_vendor_profile_id`, so one vendor cannot mint a key naming another's object.

So **no live exploit** — and the changelog says so rather than overclaiming. The reason to land
it anyway: what currently blocks the attack is a *pricing* rule. Add one of these prefixes to
`platform_retail_catalog_v2` (a reasonable thing to do — "sell a branch from a catalog row") and
sellability becomes `sellable`, SEC-7 resolves a price, and the door reopens. This guard does not
care what the catalog says.

### Deliberately NOT landed

`assertVendorSurfaceKeyNotSoldToCouple` and `VendorSurfaceKeyRefused`. They had **zero call
sites** in the original commit (7 mentions, all in the module, its test, and a migration
comment), and checkout returns `{ ok: false, reason }` rather than throwing, so there was no
shape for them to fit. Landing an unwired guard that passes its own tests while enforcing nothing
is the exact failure mode caught twice on 2026-07-30. The predicate is landed and used; the
throwing wrapper is dropped.

### Still missing (not this PR)

`assertOrderOwnsVendorTarget` in `lib/sku-activation.ts` — the activation-time check that the
order's `vendor_profile_id` owns the object being provisioned. That is the origin-independent
gate (it holds for a comp grant, an admin-minted bespoke order, or any future minter) and it is
the load-bearing one of the pair. Still unlanded; copies in the spec corpus at
`99_Recovered_Orphaned_Work_2026-07-30/`.

### Tests

`lib/vendor-surface-service-keys.test.ts` — 8 cases: all four families covered · the list is
frozen · the prefixes are **imported not re-typed** (a rename would otherwise silently drop a
family) · every vendor-surface key is caught · real couple SKUs (`PAPIC_GUEST`, `SETNAYAN_AI_SUB`,
`save-the-date:*`, …) are **not** caught · a bare prefix counts · matching is prefix-anchored not
substring · **plus a wiring guard** asserting checkout imports it, calls it, refuses on the true
branch, and does so BEFORE `resolveServiceSellability`.

**Mutation-proved on all three wiring dimensions:** delete the call site → 1 fail; keep the call
but drop the refusal → 1 fail; move the guard after the sellability gate → 1 fail; restored 8/8.
Wider run: 137/137 across order / checkout / catalog / charge / sku tests.

SPEC IMPACT: None — no behaviour change on any reachable path today (SEC-7 already refuses these
keys upstream). `DECISION_LOG.md` row added 2026-07-30 recording that the module's original
rationale was stale and why it was landed anyway.
