## 2026-07-22 · feat(papic-games): consent rework — per-vendor share tap + withdrawal (§4.1)

Gap-analysis fix: the §4 share consent was a single panel-level toggle stamped onto
every completion — failing RA 10173's "specific" standard, with no withdrawal path,
and writing consent rows for vendorless missions that have no one to share with.
Reworked to the spec §4.1 shape. Flag-gated (`NEXT_PUBLIC_PAPIC_GAMES_V1`, OFF).

- **Migration** `20270904328532_papic_consent_rework.sql`:
  - `papic_guest_missions` now also returns `vendor_name` (the "Share with
    <vendor>?" label) + this guest's `consent_shared` state (DROP+CREATE — the OUT
    columns changed).
  - `papic_complete_mission` forces `consent_to_share=false` on **vendorless**
    missions — no junk rows in the §4.2 consent ledger.
  - `papic_set_completion_consent(guest, mission, consent)` — anon `SECURITY
    DEFINER` — grants OR withdraws the share on one completed vendor mission
    (RA 10173 §16 withdrawal), without touching the capture.
- **`papic-challenge-panel.tsx`** — removed the global consent checkbox. A
  completed **vendor** mission now shows an explicit **"Share this photo with
  {vendor}?" → Share / Keep private** control (default private), which is also the
  withdrawal toggle. Couple/generic missions show no share tap.
- **`lib/papic-games.ts`** `setCompletionConsent` wrapper + **`guest-mission-consent`**
  route (cookie-authoritative guest_id). **`lib/papic-missions.ts`**
  `GuestMissionRow` += `vendor_name` / `consent_shared`.

SPEC IMPACT: None — brings the shipped consent flow to spec §4.1 (the spec is
unchanged). `tsc --noEmit` clean; pure tests 6/6.
