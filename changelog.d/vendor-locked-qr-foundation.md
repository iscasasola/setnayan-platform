## 2026-07-01 · feat(vendor-shop): Locked QR foundation — single-use claim schema + RPC

The load-bearing, money-mutating core of the My Shop **Locked QR** feature
(the UI generator + customer claim page land in the follow-up PR). Schema-first,
verified against the live DB before merge.

**Schema** (migration `20270414692373_vendor_locked_qr_tokens.sql`)

- `public.vendor_locked_qr_tokens` — one row per issued Locked QR: vendor +
  issuer, the deal (`event_type`, `category`, `total_php`, `initial_paid_php`,
  `schedule_json` template, `proof_r2_key`), and single-use lifecycle
  (`status pending|claimed|void` + claimed_by / claimed_event / claimed_event_vendor).
  RLS enabled at create: vendor-org full (`current_vendor_profile_ids()`) +
  console-admin read. Token = high-entropy `gen_random_bytes`; `public_id` via
  `generate_public_id('Y')`.
- `public.vendor_claim_locked_qr(p_token, p_event_id) RETURNS jsonb` — SECURITY
  DEFINER, **race-safe single-use** (conditional `pending→claimed` UPDATE,
  mirrors `papic_claim_seat`). Re-gates event ownership via
  `current_event_ids()`. Atomically, in one transaction:
  1. consumes the token,
  2. upserts the `event_vendors` lock (`deposit_paid`, `source='vendor_locked_qr'`,
     `total_cost_php`),
  3. freezes `event_vendor_payment_plan.instances_json` from the schedule
     template (percent-of-total / fixed amounts; on_lock / before_event due
     dates — the SAME instance shape the couple-side lock produces),
  4. records the downpayment into `event_vendor_payments`.
  Verdicts: `unauthenticated | invalid | void | taken | already_claimed |
  not_your_event | ok`. Idempotent re-scan by the same claimer → `already_claimed`.

**Verified against prod (in a rolled-back transaction, nothing persisted):** DDL
+ function-body compile, then a full claim — lock/plan/downpayment all correct
(₱15k downpayment due on-lock, ₱35k balance due event−14d), single-use enforced
(re-claim → already_claimed, stranger → taken). This caught + fixed a real bug:
`event_vendors.category` is the `vendor_category` enum, so the insert/update cast
`::public.vendor_category`.

SPEC IMPACT: None (implements the prototype's `lockqr`; no pricing/SKU/scope
change). Design: `03_Strategy/Vendor_Dashboard_Reorg_2026-07-01.html` (`lockqr`).
Follow-up PR: the generator UI (Shortlist ↔ Locked toggle, schedule editor,
proof upload), the customer claim page, and the admin view.
