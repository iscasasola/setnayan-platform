## 2026-11-16 · fix(supplier-walk): W1-B21 · B22 · B26 · B27 · B28 · B29

- **W1-B21** — "Start on Plus / Pro / Ultra" on /for-suppliers carried no plan (all bare `/open-shop`). Each paid card
  now links `/open-shop?plan=plus|pro|ultra` (`openShopWithPlanHref`, `lib/supplier-plan-offer.ts`, whitelisted by
  `parseSupplierPlan`). The plan sheet (`/vendor-dashboard/subscription?plan=…#plan-sheet-<tier>`, `planOfferPath`)
  opens that plan's row — its existing "Upgrade to …" (or 🔒 Get verified) button. No new screen. The /open-shop leg
  (carry `plan` through the wizard and land on `planOfferPath`) is the open-shop owner's edit. Guard:
  `lib/supplier-plan-offer.test.ts`; `the-plan-is-rows.test.ts` pin follows.
- **W1-B22** — the Cake category's only service read "Wedding cake" under Birthday, Christening and every other event.
  It shows as "Cake" (`serviceDisplayName`, `lib/service-display-name.ts`) in the supplier pick list
  (`lib/vendor-coverages.ts`) and the couple labels (`lib/service-labels.ts`). Display only — the key `wedding_cake`
  is untouched, and the correction applies only while the stored name is still the seed's "Wedding cake" (an admin
  rename in Admin › Categories wins). Guard: `lib/service-display-name.test.ts`.
- **W1-B26** — "What kind of venue are you" was asked of a cake shop. Your details mounts it only for a venue
  (`asksVenueType`: `services` carries `venue`, the room-size row's own rule) or a shop that already holds a value.
  Guard: `lib/vendor-venue-type.test.ts`.
- **W1-B27** — the service maker opened a cake on "Per guest": every feast-family kind took the caterer's defaults.
  Only catering kinds (meals, buffets, lechon, lauriat, stations) are a caterer now; the rest open on One price.
  Guard: `lib/a-cake-is-one-price.test.ts`.
- **W1-B28** — an unknown `/vendor-dashboard/*` answered 200 with the console's loader (the rise slot's
  `[...rest]` catch-all makes every address match). The middleware rewrites an unknown first segment to an address no
  route matches, so Next serves the root 404 at once (`lib/supplier-console-routes.ts`). Guard:
  `lib/supplier-console-routes.test.ts` holds the page list to the folders on disk, both ways.
- **W1-B29** — the picked client's Schedules cell was a hard-coded "— · none yet" for every client not booked. It now
  counts that client's meetings with the Clients tile's own rule (`OPEN_MEETING_STATUSES` + `openMeetingsWindow`,
  `customers/clients-tiles.ts`), and the tile's read uses the same helpers. Guard:
  `customers/the-schedules-count-is-the-list.test.ts`.

SPEC IMPACT: None. (No schema change, no new server action, no taxonomy key renamed.)
