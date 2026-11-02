## 2026-07-02 · feat(vendor-dashboard): auto-block booked dates + waitlist-settings substrate + Locked-QR date guard (PR-A)

Foundation for the owner's calendar block/waitlist feature (2026-07). Hangs off
the existing `vendor_calendar_blocks` (what `getVendorAvailableDays` reads).

- **Migration `20270428213000`:**
  - `vendor_profiles.waitlist_enabled` (bool, default false) + `max_waitlist_acceptances`
    (int 1–3, CHECK) — the vendor's opt-in waitlist + cap.
  - `vendor_date_waitlist.accepted_at` — the vendor's "pick this couple" stamp
    (the "whitelist" pick), capped at `max_waitlist_acceptances` (enforced in app, PR-B).
  - `vendor_block_booked_date(vendor, date, label)` — idempotent org-wide "close
    this date" primitive (mirrors `addManualBlock`'s 00:00→23:30 +08 day-grain).
  - **AUTO-BLOCK trigger** on `event_vendors`: the moment a marketplace vendor's
    row reaches `deposit_paid` (Locked-QR claim, finalize/lock), their wedding
    date is closed via a `setnayan_booking` block. Unconditional (a booked date
    is taken → leaves couple availability AND blocks a second Locked QR), and it's
    exactly what surfaces the existing "Join the waitlist" CTA. SECURITY DEFINER,
    idempotent, exception-safe (a block failure never rolls back a booking).
- **Locked-QR date guard:** `issueLockedQr` now rejects a wedding date the vendor
  is no longer free on (via `getVendorAvailableDays` — the couples' own source),
  with a clear couple-facing error. Owner rule #4: a Locked QR is the primary
  booking of its date; you can't lock a second on the same day.

SPEC IMPACT: Vendor availability — booked dates now auto-close; Locked QR is
date-guarded. Logged in DECISION_LOG.md. **Migration APPLIED to prod** (per-statement
`db query` + `migration repair`, since `db push` is drift-blocked by the stray
`20270426100000`). Follow-up PR-B: waitlist enable/cap settings UI, the couple-join
gate + vendor pick-one action, and surfacing the existing block-dates form as a
button beside the calendar heatmap.
