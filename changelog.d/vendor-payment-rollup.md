## 2026-06-28 · feat(vendor): payment-progress roll-up on the vendor thread's plan card

The couple now sees a live payment-progress summary on their Budget page (PR #2348).
This adds the vendor-side mirror so both roles share the same glance-level read of
where a booking's money stands — the architect-mandate other half.

**What the vendor sees**

- Each per-booking "Payment plan" card on the vendor messages thread now leads with
  a roll-up: **received of total · %** (progress bar) plus a one-line status — money
  awaiting the vendor's confirmation, or the next installment owed (label · amount ·
  due date), or "Plan cleared".
- Sits above the existing installment stepper, which keeps its per-installment
  detail + the "Mark payment cleared" gate. Hidden when no installment has resolved
  to a peso amount yet (the stepper alone is clearer then).

**How it stays inside the security model**

- `event_vendor_payments` / `event_vendor_line_items` are **couple-RLS only** — a
  vendor can't read them directly. The roll-up is derived purely from the stepper
  steps already loaded server-side via the ownership-gated admin read
  (`fetchPlanProgressForVendor`); no new query, no couple-RLS access, no schema
  change. So this is NOT a live (cross-tab) card on the vendor side — it refreshes
  on the same server revalidation the rest of the vendor thread already uses
  (e.g. after the vendor confirms a payment).
- New pure helper `computePlanRollup(steps)` in
  `lib/vendor-service-payment-schedules.ts` (sibling to `computeStepper` /
  `canClearPlan`): totals + confirmed/pending split + % + the earliest non-paid
  installment.

SPEC IMPACT: Iteration 0022 (vendor_dashboard) — the vendor messages thread's
payment-plan card gains a money roll-up. Logged in corpus `DECISION_LOG.md`.

**Follow-ups requiring owner sign-off (not built here):**
- A *realtime* vendor payment card (cross-tab push like the couple's) would require
  granting vendors RLS SELECT on the couple-private payment tables — a deliberate
  security-model change. Flagged, not made.
- Auto-generating default milestones (deposit/balance) for lump-sum vendors so the
  couple's "next payments" populates without manual dated line items — a product
  decision (auto-creating financial rows), flagged, not made.
