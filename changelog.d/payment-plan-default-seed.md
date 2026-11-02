## 2026-07-10 · fix(payments): lock auto-seeds a 50/50 estimated plan when the vendor set no schedule

Closes a silent quality cliff on the vendor↔couple money handshake. At booking lock, `finalizeVendor` freezes the booked service's `vendor_service_payment_schedules` into a concrete `event_vendor_payment_plan`. A marketplace vendor who quoted a price but never configured a payment schedule handed the couple an **empty plan → silent "pay the vendor directly" fallback** — a booking total with no deadlines. Couples on the largest bookings got the least payment guidance.

- `lib/vendor-service-payment-schedules.ts`: new pure `defaultPaymentScheduleRows()` — a 50% downpayment (due on lock) + 50% balance (due 14 days before event) in the `PaymentScheduleItemRow` shape, fed through the existing `computePlanInstances`. New optional `PlanProgress.isDefaultSeeded`.
- `app/dashboard/[eventId]/vendors/actions.ts` (`finalizeVendor`): when the resolved schedule is empty **and** a booking total exists, seed the default before `computePlanInstances` and stamp `is_default_seeded=true` on the upsert (always written, so a re-lock after the vendor sets a real schedule flips it back false). The `payment_info_sent` notification now says "estimated … confirm with your vendor" for seeded plans. Skipped when there's no total to estimate against (empty plan stays the honest state). Off-platform / manual vendors are untouched — they have no `service_id`, keep the manual `event_vendor_line_items` flow, and never reach this branch.
- `lib/vendor-service-payment-schedules.server.ts` (`fetchPlanProgressForCouple`): selects + returns `is_default_seeded`.
- `app/dashboard/[eventId]/vendors/[vendorId]/workspace/page.tsx`: the couple's plan card renders "Payment plan (estimated)" + a "your vendor hasn't set terms yet — confirm before paying" note when seeded.
- Migration `20270712500000_payment_plan_default_seed_flag.sql`: additive `event_vendor_payment_plan.is_default_seeded BOOLEAN NOT NULL DEFAULT FALSE` (backfill-safe).

Typecheck clean (changed files). Runtime path exercised at booking lock; no schema break (additive column, RLS unchanged).

SPEC IMPACT: DECISION_LOG.md — lock auto-seeds a 50/50 default payment plan when a marketplace vendor configured no `vendor_service_payment_schedules`; couple sees it flagged "estimated". Part of Vendor_Customer_Connection_Build_Plan_2026-07-10.md (PR 1 of 3).
