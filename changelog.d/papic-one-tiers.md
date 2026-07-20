## 2026-07-21 · feat(papic): Papic One — flat per-event pass becomes three purchased point buckets

Retires the **pax curve** on `PAPIC_GUEST` and turns the flat per-event pass into three
purchased point buckets plus a repeatable top-up.

**Why.** The live row is pax-priced — floor 100 pax @ ₱2,999, +₱350 per 50 pax — reaching
₱4,399 at 300 pax and ₱5,799 at 500. Against PH rivals selling one flat number (photoshare.ph
₱999, Kuha ₱499/₱999/₱1,999) we got **more expensive exactly where they stayed flat**. That
slope is the one competitive defect both 2026-07-20 councils agreed on. The hard data gate
passed before the cut: `PAPIC_GUEST` has **one order in the platform's lifetime** across 63
events, so nothing measurable is given up.

**Ladder** (owner session 2026-07-20): `PAPIC_GUEST` 3,000 shots ₱500 · `PAPIC_GUEST_6K`
6,000 ₱1,000 · `PAPIC_GUEST_10K` 10,000 ₱1,500 · `PAPIC_GUEST_TOPUP` +10,000 ₱1,500,
repeatable and uncapped.

**Purchased buckets, not a derived fence.** Migration `20270826385580` shipped an event pool
computed as `clamp(guest_count × 150, 5000, 30000)`. That fence governs products that *promise*
unlimited — its `pass_service_codes` is `['PAPIC_UNLOCK','PAPIC_UNLOCK_LTD']`, the ₱15,000 /
₱9,000 bundles. These tiers are **self-bounding** (3,000 points is 3,000 points), so they are
deliberately absent from that list and the migration **asserts** it stays that way: adding one
would layer a guest-derived formula on top of a purchased bucket and silently hand a ₱500 buyer
up to 30,000 points. `papic_event_pool_config` is a single global row — no per-SKU formula to
tune around it.

A paid tier lands as one row in `papic_event_point_grants` (`source='topup_order'`) — the ledger
that migration explicitly left for this change: *"the top-up SKU itself is deliberately NOT
created or priced here (owner action)."* Because the pool sums grants, "uncapped and repeatable"
needs no new machinery.

**Pax is guidance, never a gate.** Papic One grants unlimited *guests*; the pool bounds
*captures*, not people. A 500-guest couple may buy the ₱500 rung — it just means ~6 points each.

- New `public.papic_pass_tiers` — the one place a pass SKU's point grant may live
  (admin-editable, RLS: public read, service-role write). Mirrors the `papic_tier_config` posture.
- New `lib/papic-pass-tiers.ts` — DB-first read with last-resort fallbacks; never a billing
  source (price always comes from `platform_retail_catalog_v2`).
- `lib/sku-activation.ts` registers the four SKUs on the existing frozen dispatcher — the seam
  whose contract says new hooks are added there, **never** by editing `approvePayment`. The grant
  is **idempotent by `order_id`** (the ledger is additive with no unique constraint, so the guard
  is an explicit pre-read) and **non-fatal** per the dispatcher contract.
- Migration carries post-conditions that RAISE rather than half-apply, including the
  `pass_service_codes` guardrail. Verified read-only against prod first: `text[]`, `&&` overlap
  correct, returns false against the live config.

**All four rows ship `is_active = FALSE`.** The doorway card is `status:'coming_soon'` and
`papicGuestPassAccess()` still has zero production callers — flipping either is the next PR.
Shipping these active would advertise a buy path that does not resolve. Data first, doorway second.

Prices verified as plain PHP `numeric`, not centavos (prod, 2026-07-20).

⏳ **Merging this file does not apply it** — the migration still needs
`supabase db push --db-url "$SUPABASE_DB_URL"`.

SPEC IMPACT: Corpus already updated — `0012_papic/Papic_Pricing_Lock_2026-07-20.md` §2.3 (the
ladder) and §11 (purchased buckets vs the guest-derived fence, and the PR-1 scope this
implements), plus two DECISION_LOG rows dated 2026-07-20.

### Reversal (follow-up in the same PR)

**No downgrade path — by design** (owner 2026-07-21: upgrades yes, downgrades no). Tiers are
additive grants in an append-only ledger, so a couple can only ever *add* points; there is no
operation that swaps a bucket for a smaller one.

The one reversal that must work is a **refunded / un-approved order** — and `deactivateOrderSku`
previously early-returned for every SKU except `SETNAYAN_AI`, so a reversed Papic One order would
have **kept its points** (buy → granted → refund → keep the pool). `reversePapicPassPoints` now
deletes grants by `order_id` (idempotent; a no-op for non-Papic SKUs since no grant carries their
`order_id`) and ledgers `order_refunded` with `points_revoked`.

If the couple already spent more than the remaining grants cover, the pool's remaining goes
non-positive and the **fail-closed** gate stops capture — the correct outcome for a reversed order,
not a bug to paper over.
