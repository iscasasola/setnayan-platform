## 2026-07-02 · feat(vendor): Locked QR — show the event date's calendar status

The Locked QR date field only flagged manual calendar blocks. Vendors need to
see the full picture at a glance (owner: *"sight if the event date is available,
whitelist, waitlist, or blocked already"*).

- **New advisory read** `resolveVendorDateStatus(dateIso)` (its own `'use server'`
  file — no overlap with the open Locked-QR validation PR #2600, which touches
  `actions.ts` + `page.tsx`). Composes four cheap, RLS-scoped reads mirroring the
  `/vendor-dashboard/calendar` model:
  - `vendor_calendar_blocks` → **blocked**
  - `vendor_calendar_day_states` → **locked** / **whitelist** (the two stored states)
  - `vendor_schedule_pool_bookings` (live) → **booked** count
  - `vendor_date_waitlist` (pending) → **waitlist** count
- **Date field now shows a status chip** with precedence blocked > locked >
  booked > whitelist > available (green available · sky whitelist · amber booked
  · rose blocked/locked), plus a separate "N couples waitlisted" line.
- **Advisory only** — never blocks issuing (the vendor is recording a deal they
  already closed). Org-wide (any schedule). Fail-soft: any read error → clean
  status, form never breaks. Replaces the old blocks-only `checkVendorDateConflict`
  usage in this form (that action is untouched for any other callers).

Verified: `tsc --noEmit` clean · ESLint clean · production build.

SPEC IMPACT: None (advisory UI over the existing calendar tables).
