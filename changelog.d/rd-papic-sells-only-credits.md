## 2026-10-23 · fix(papic): Papic sells credits only — the camera tiers, seat cards and "in your pocket" card come off; one upload door on the library; the Suppliers, per-guest and challenges lines say what is true

Owner, over his own Papic page: *"why do i have these?"* — the guest-camera tier sheet (Limited ₱100 /
Unlimited ₱200 per guest, with a live "activate 264 guest cameras · ₱6,000"), the crew-camera tier
ladder, the per-seat "Free camera 1/2/3/51" cards with links, QRs and Reset link, and "Right now · 4
camera QRs are still in your pocket". The 2026-09-16 ruling (*"we do not have papic seat. we only have
papic with credits and shared amongst everybody"*) had retired all of it; the Limited tier still priced
from `fetchCameraRates`, never asking `papic_tier_config.is_active`, so it stayed buyable.

- **Removed (couple's Papic page):** `LimitedCard` + `GuestCameraTierPicker`, `ExtraCamerasPicker` (both
  files deleted), the "Right now" card, the "Crew cameras" and "Your uploads" rows, the dead "Everything
  Papic, one price" unlock tile, the two camera-sale confirmations, "Your camera prices reflect it".
- **Refused, not deleted:** `purchasePapicCameras`, `activatePapicLimited`, `purchasePapicExtras` stay
  exported, check the couple, and redirect with one sentence (`lib/papic-sells-only-credits.ts`). No
  historical order, snapshot, seat or activation hook is touched; the paid-snapshot RSVP sync stays.
- **`/crew`** shows only "One code for everyone" (the shared join code + poster); `/crew/print` (one
  card per seat) redirects to the poster. "Free camera 51" was seat 150 — the couple's own uploads seat.
- **One upload door:** the library card's "Add the first memory" (empty) and "+ Add photos" (top bar)
  open the same `AddToLibrary` uploader in a sheet; both follow the uploads switch.
- **True lines:** the library strip's "Ways in · 5 cameras" (a seat count) is "Who shoots · Every guest +
  you"; "Suppliers · Not open yet" reads the lane control, the booked suppliers and the phase ("Book one
  to open" / "N booked" / "Waiting on privacy approval" / "Closed after your day" / "Couldn't check");
  "Allotment" is "Who shoots, and when" with an ⓘ, and "How many credits each guest gets · 319 each" is "Each guest · Up to 319 ·
  equal share" (or "Up to 50 · your limit" when the couple's typed number is what applies); the Challenges card's "3 of 8 chosen · 10 showing to guests" now says "Guests see 10:
  your 3 + 2 from suppliers + 5 suggested".
- **The seat cards' last read goes with them:** `papic_camera_points_remaining` (the "shots left" probe on
  each seat card, display only, anon-executable) lost its only caller, so the both-ends guard ranked it
  `rpc-no-caller`. Migration `20271286935967_drop_the_unread_papic_camera_points_probe.sql` drops it (not
  CASCADE). The capture gate `papic_reserve_capture_split` and `papic_seat_dedicated_points` are untouched;
  the two metering tests read the camera's bucket from the ledger instead. Exposure and anon-RPC baselines
  narrow by that one function. The Suppliers row's "N booked" goes through `formatCount`.
- **Guard:** `apps/web/lib/papic-sells-only-credits.test.ts` (property + render; sabotaged three ways).

SPEC IMPACT: `~/Documents/Claude/Projects/Setnayan/DECISION_LOG.md` — one 2026-10-23 row recording the
removal, how the 2026-09-22 "should stay" (free camera grant — server machinery, untouched) and the
2026-09-23 hand-out retirement fit, and the read-only SQL for the paid-orders count.
