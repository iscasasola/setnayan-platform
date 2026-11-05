## 2026-11-05 · fix(supplier-funnel): seven fixes so a new supplier can register by Sat 7 Nov

Each one made the supplier sign-up funnel look broken or lost the supplier. Each has a guard test.

- **/open-shop address search + pin naming work signed out.** `app/open-shop/city-actions.ts` refused without a
  session, but the wizard is signed out until its last step, so every new supplier read "Couldn't find that — drop
  your pin" / "Couldn't name that spot". The gate is now a per-IP budget through the shared limiter
  (`enforceRateLimit` + `clientIp`, 40 per 10 min across both lookups), which is what actually protects Nominatim.
  Guard: `app/open-shop/the-map-answers-a-signed-out-vendor.test.ts`.
- **"Get your invite link" on /for-suppliers reaches the invite.** A supplier with a shop goes to
  `/vendor-dashboard/invite`; everyone else to `/open-shop?next=/vendor-dashboard/invite`. `/open-shop` honours `next`
  for a person who already has a shop and on its sign-in link — Shop-console pages only (`lib/shop-console-path.ts`).
  A brand-new shop still lands on Today (first-timer fix 12).
- **A deep link into the Shop console survives sign-in.** `app/vendor-dashboard/layout.tsx` sent every signed-out
  visitor to `/login?next=/vendor-dashboard`. The middleware now stamps the requested path on the request
  (`x-sn-request-path`, always overwritten) and the layout reads it back through `shopConsolePath` (same-origin by
  `isSafeNext`, inside `/vendor-dashboard`, else Today).
- **No "Coming soon" on working or switched-off features.** Recaps' empty state loses its tag (the page works, it is
  just empty until a couple publishes). Vendor AI, 3D Booth, Papic Challenges and Instagram cards render nothing
  when their switch is off (each server action still refuses).
- **Couple claim link.** The couple's-own-link door adds "Sign in & claim" for a supplier who already has an account.
  `/finalize` refuses a customer account with no shop or seat (`users.account_type` + vendor access,
  `lib/claim-account-gate.ts`) BEFORE anything is written — the link stays unspent and the page says so. The
  retired-token claim burn (`claim_unlock_vendor_event`) is no longer called; `seatClaimedCoupleAsCustomer` →
  `unlock_vendor_event_free` already writes the supplier's unlock row. The DB function itself is left in place.
- **Inspiration uploads.** `uploadStylistAsset` returns `{ ok: false, error }` instead of throwing (production Next
  blanks thrown action messages), so "wrong trade / quota full / confirm rights" reach the supplier; only storage/DB
  faults become a generic retry line. The editor compresses with `compressImageForWeb` before sending.
- **The older service card form stops Return.** `service-wizard.tsx` (canvas-maker flag off) wires the same
  `returnMovesOn` guard as `canvas-maker.tsx`.

SPEC IMPACT: None — every change restores a decided behaviour (the signed-out wizard of 2026-09-22, the token wallet
retirement of 2026-05-11, return-never-submits of 2026-11-04). New rule worth noting for the controller: a customer
account with no shop cannot spend a supplier claim link.
