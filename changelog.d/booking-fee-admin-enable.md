## 2026-07-23 · feat(admin): Booking-fee go-live from the admin panel (no redeploy)

Completes the "paste PayMongo details → it activates" ask. The fee's enforcement is
now DB-aware, so an owner activates entirely from `/admin/integrations` — paste the
keys, flip one toggle — with no redeploy.

- **Migration `20270918597693`** — `platform_settings.booking_fee_collection_enabled`
  BOOLEAN DEFAULT false (the admin go-live toggle).
- **`lib/booking-fee-charge.ts`** — new `isBookingFeeEnforcedServer(admin)`: enforces
  when ENABLED (env `NEXT_PUBLIC_BOOKING_FEE_ENABLED` OR the DB toggle) AND RAIL LIVE
  (env `NEXT_PUBLIC_BOOKING_FEE_RAIL_LIVE` OR PayMongo creds present in the DB).
  **FAIL-SAFE** — any read error → not enforced → the send proceeds (a DB hiccup
  never traps a live proposal). Short-circuits on the enabled check so the common
  (off) case is one cheap read. `bookingFeeSendGate` now uses it.
- **`proposal-send.ts` / `proposals/actions.ts`** — the send-gate call sites use the
  self-guarding async check (dropped the sync env-only guard).
- **Admin card + action** — the PayMongo card gains a **"Fee collection: ON/OFF"**
  toggle (`setBookingFeeCollectionEnabled`) + a live/keys-ready/off status pill. The
  env flags remain as a fallback.

⚠ Turning the toggle on without keys is harmless — enforcement still needs a live
rail, so it stays idle until the keys are present. `tsc` clean; migration doctor
healthy; gate rules 6/6. Stacked on the PayMongo settings PR.

SPEC IMPACT: None (admin-driven booking-fee go-live). DECISION_LOG 2026-07-23.
