## 2026-06-29 · feat(vendor): Payday Calendar & Cash-Flow View (Wave 4)

A new vendor-scoped, READ-ONLY timeline of every installment due-date across all
the vendor's booked events — a forward "Payday" cash-flow view. Off-platform
money: it visualizes the installment plan the couple already locked in (frozen
at lock in `event_vendor_payment_plan.instances_json`). It moves no money,
charges nothing, computes no tax, and does NOT loosen the host-only RLS on
`event_vendor_payment_plan`.

- New migration `20270320749126_payday_cashflow_read.sql` — `SECURITY DEFINER`
  read fn `public.vendor_payday_installments()`. Ownership-gated by mirroring
  `confirm_vendor_payment`: rooted on `vendor_profiles.user_id = auth.uid()` →
  `event_vendors.marketplace_vendor_id`, so a caller only ever sees plans for
  bookings on a vendor profile they own (no cross-vendor leakage). Returns one
  row per `instances_json` installment: `{event_vendor_id, event_id, event_name,
  event_date, seq, label, amount_php, due_date, confirmed}` where `confirmed` =
  a `vendor_confirmed_at`-stamped `event_vendor_payments` row exists for that
  booking + seq. REVOKE public/anon; GRANT EXECUTE to authenticated.
- New `lib/vendor-cashflow.ts` — pure/typed `buildPaydayTimeline(rows, todayIso)`:
  groups by due month, computes expected/confirmed/owed/overdue totals, flags
  `overdue` (due_date < today AND NOT confirmed), sinks undated installments to
  the end. `manilaTodayIso()` helper mirrors the calendar page's Manila idiom.
- New route `app/vendor-dashboard/payday/page.tsx` (+ `_components/`) — KPI cards
  (expected / received / owed / overdue), an overdue band, and month-grouped
  installment rows with confirmed/overdue/due status pills. Matches dashboard
  card styling. Empty + error states handled. Minimal nav entry added to the
  Business group of `vendor-sidebar.tsx` (owner/admin only, like Earnings).
- Deferred: no `.ics` export (the reusable helpers are date-only / Save-the-Date
  shaped — installment due-dates didn't warrant a new feed for this PR); ADMIN
  surface deferred to a follow-up (avoided touching admin reconciliation files).
- Did NOT touch `vendor-dashboard/calendar`, `/v/[slug]`, `vendor-email-triggers.ts`,
  or `vendors/actions.ts` (parallel Booked-Out Waitlist ownership).

SPEC IMPACT: None. New read-only vendor surface over existing locked payment-plan
data; no pricing, SKU, or schema-contract change.
