## 2026-07-02 · feat(vendor): Locked QR — "Name · Date · Amount" schedule, balance-gated issue, comma formatting

Reworked the vendor Locked QR generator (My Shop → Locked → `/vendor-dashboard/invite`)
so the payment plan is complete and self-checking before a QR can be minted.

**Generator UI** (`locked-qr-generator.tsx`)

- **Thousands separators** on every peso field — Total value, Initial paid /
  downpayment, and each installment amount now display grouped (e.g. `170,000`)
  while still submitting clean numbers (hidden fields carry the raw value; the
  server also strips stray commas defensively in `toAmount`).
- **Downpayment auto-fills the schedule.** Row 1 of the schedule is always
  "Downpayment"; its amount mirrors the "Initial paid / downpayment" field
  (read-only, single source of truth) so the vendor never types it twice. The
  downpayment row is non-removable.
- **Schedule is now `Name · Date · Amount`.** Retired the abstract
  `amount_kind (% / ₱)` + `due_anchor (on_lock / before_event) + offset-days`
  controls in favour of a plain payment name, an absolute **date picker**, and a
  fixed peso amount.
- **Remaining-balance guidance + issue gate.** Each amount field's placeholder
  shows the outstanding balance still to be scheduled; a live "Remaining to
  schedule" line turns "Fully scheduled ✓" at ₱0. **Generate Locked QR** is
  disabled until the service is picked, total + downpayment are set, every row
  has a name/date/amount, and the rows sum exactly to the total.

**Schedule shape** (`lib/vendor-locked-qr.ts`) — `LockScheduleRow` is now
`{ seq, label, amount_value (fixed ₱), due_date (ISO | null) }`; `sanitizeLockSchedule`
validates the ISO date and drops the retired anchor/percent fields.

Preserves everything PR #2584 added (leaf-service picker, agreed Wedding date,
"What the couple availed" scope) — the completeness gate now also requires the
service, wedding date, and scope before "Generate" unlocks.

**Claim RPC** (migration `20270427212060_vendor_locked_qr_absolute_due_dates_and_downpayment_attribution.sql`,
`CREATE OR REPLACE FUNCTION vendor_claim_locked_qr` stacked on PR #2584's
`20270426215000`, backward-compatible)

- Keeps #2584's event-date finalization (d0) + `service_description` → notes
  scope freeze byte-for-byte.
- Freezes each installment's `due_date` from the row's **absolute date**, falling
  back to the legacy `on_lock` / `before_event` anchor resolution so
  already-issued tokens keep working. Missing `amount_kind` resolves to fixed.
- Records the off-platform downpayment attributed to **installment seq 1** and
  stamped **vendor-confirmed**, so the couple's payment stepper shows the
  downpayment as PAID instead of double-counting a separate unattributed payment.

**Couple claim page** (`app/vendor/lock/[token]/page.tsx`) — the schedule preview
renders the absolute due date (legacy anchor label as fallback).

⚠ Deploy note: this stacks on PR #2584's three still-unapplied migrations
(`20270426214000/215000/216000`). All four must be applied to prod
(`supabase db push`) — the generator already writes `service_description` /
`event_date` / `vendor_service_id`, so issuance is broken on prod until #2584's
migrations land. All are backward-compatible; apply early is safe.

SPEC IMPACT: Vendor Locked QR payment-schedule model changed from
percent/anchor-offset to absolute-date fixed-amount installments; the downpayment
is now the first schedule installment (auto-filled) and is recorded as a
vendor-confirmed payment against seq 1. No pricing/SKU change; no new table
(RPC replace + client rework only). Corpus DECISION_LOG row appended in the same
change.
