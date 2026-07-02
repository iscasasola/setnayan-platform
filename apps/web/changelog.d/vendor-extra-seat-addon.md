## 2026-07-02 · feat(vendor): Enterprise extra team seats — ₱250/28d add-on (PR-A foundation + buy flow)

Owner 2026-07-02: Enterprise's base team-seat cap is 10; extra seats are a paid
add-on at **₱250 / 28-day each**, and they **fold into the Enterprise renewal**
(owner-picked billing model) with **admin-picks-who-to-drop** on lapse. This is
**PR-A** — the substrate + the mid-cycle buy flow. The renewal-fold amount and
the downgrade/lapse reconcile land in **PR-B**.

**Structural sibling of the Additional-Branch add-on, with one deliberate
difference:** a branch is a per-item order with its own 28-day window; an extra
seat is a persistent COUNT on the vendor profile that the Enterprise renewal
re-bills. So there's no per-seat status derivation — the count is the truth.

- **Migration `20270429992907_vendor_extra_seat_addon.sql`** — extends the
  `vendor_billing_catalog` `offering_type` CHECK with `'seat'` (same drop+recreate
  pattern branch used) + seeds the admin-managed `vendor_extra_seat` SKU (₱250,
  `max_sub_seats=1`); adds `vendor_profiles.extra_agent_seats INT NOT NULL DEFAULT
  0` (+ non-negative CHECK); adds `vendor_team_members.deactivated_at TIMESTAMPTZ`
  (inert until PR-B's "admin picks who to drop"). Idempotent, additive, changes
  no behaviour on its own (default 0 ⇒ effective cap = base cap).
- **`lib/vendor-seats.ts`** (new) — the seat SKU constants + `fetchSeatFeePhp`
  (admin-managed price, ₱250 fallback) + `seatServiceKey`/
  `vendorProfileIdFromSeatServiceKey` (`vendor_extra_seat__{id}` keying) +
  `effectiveSeatCap(base, extra)` + `fetchExtraAgentSeats` (soft-probe → 0).
- **`lib/sku-activation.ts`** — new `PREFIX_HOOKS` entry: when a
  `vendor_extra_seat__{id}` order is approved, **recompute**
  `extra_agent_seats` = count of PAID seat orders for that vendor (idempotent +
  self-healing + crash-safe — not a blind increment) and stamp a
  `service_activated` ledger row.
- **`team/actions.ts`** — the invite guard now enforces the EFFECTIVE cap
  (`base agentAccounts + extra_agent_seats`); the "at cap" message is tier-aware
  (Enterprise → "Add a seat (₱250/28d)" instead of "Upgrade"). New `buyExtraSeat`
  server action: Enterprise-only, apply-then-pay `orders` + `payments` row keyed
  `vendor_extra_seat__{id}`, lands in /admin/payments.
- **`team/page.tsx`** — a seat-usage line ("X of Y seats used · founder is free")
  + an Enterprise-only "Extra seats" card (current extras, seats free, BDO/GCash
  "Add a seat (₱250)" form) + a `?bought=<ref>` confirmation banner.

`tsc --noEmit` clean. No new SKUs beyond the admin-managed catalog row; prices
stay catalog-authoritative; seat plan / couple surfaces untouched.

SPEC IMPACT: Vendor entitlement + billing catalog. As-built truth is the in-repo
`VENDOR_TIERS_AND_BENEFITS.md` §6/§10 (Solo=1 + Enterprise +₱250/seat noted in the
prior seat-ladder PR). Logged at the bottom of the corpus `DECISION_LOG.md`.
