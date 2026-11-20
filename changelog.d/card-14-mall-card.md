## 2026-11-20 · feat(cards): card 14, the mall card, on Find and Discover — distance, guest-count price, two across

Owner, 20 Nov 2026: *"card 14 approved"*, *"straight line, about X km"*, *"Do it"* (DECISION_LOG "CARD 14 v4 APPROVED";
drawing https://claude.ai/artifact/752FUN4BTE16bEWmpjP6r7).

- **The one face grows a `mall` layout** (`app/_components/service-face.tsx` `layout="mall"` + `MallFaceBody`): square
  photo with a "Verified shop" pill, shop line, two-line name, the warm price band, the medal-row slot (the rating sits
  there), then the date fit and the distance. The default `row` layout is unchanged (the shop page, the maker).
  Find's bench card draws `MallFaceBody` inside its own link, so Find and Discover draw one card.
- **Distance** (`lib/mall-card.ts`): "about N km from your venue" — straight line from the shop's NEAREST place (HQ or a
  live `vendor_branches` row, `lib/supplier-places.server.ts`) to the event's venue pin, through the one
  `lib/geo` haversine. No paid map service. No venue → "Set your venue to see distance"; no shop place → no line;
  never "0 km". Discover measures from the VENUE pin only, never the region centroid.
- **Guest-count price**: a per-guest card whose minimum is below `events.estimated_pax` shows the total for that count
  ("₱102,000 · for your 120 guests · ₱850 / guest"); at or under the minimum it shows "₱650 / guest · min 150 guests";
  flat and per-hour prices never change. Only the card's own stored price is used.
- **Layout**: Find's one-screen column runs two across on a phone, three on a tablet, four on a desktop; Discover
  (`/explore` service cards and the front door's Service cards shelf) runs two across on a phone, four on a desktop.
- **Buttons** (DECISION_LOG "14 + buttons"): the first verb is one full-width 44 px button, then equal seats (icon over
  word) — two on a phone, three on a wide card. On a phone, with three or more verbs left, the second seat is "More",
  which opens the rest in place. Words, order and colours are the shipped table's.
- **Save on the photo** (owner 20 Nov, "Yes, add Save"): Discover's service cards (`/explore`, and `/?browse=1`) carry
  the shipped `SaveVendorButton` top-right of the photo — a 44 px press, white bookmark on a dark scrim, filled once
  saved (`onPhoto`). Not in Find. Its shipped flow is kept exactly: signed out → sign-in opens over the page and the
  save runs after; signed in with no event → "Start an event to save" (`/dashboard`); two or more events ahead → it asks
  which. A save always lands on an event (`saveVendorToPicks`); no new action, no new table.
- **Saved suppliers first in line** (owner 20 Nov, `lib/saved-first.ts`): on Find's category rail and in the category
  search, a supplier saved to the event leads — only when the venue is in their reach AND they are free on the date
  (the shipped reach read and date fit; unknown is not true). Otherwise the normal order. The couple's own pins still
  apply after it.
- Lab: `/dev/suppliers-lab?mall=real` draws the real production cards against a real venue (`&venue=none`,
  `&perguest=1`, `&savedfirst=1`).

Not matched (said in the PR): the medal row is not drawn on Find or Discover — the badge read is per shop
(`readCardBadges`, 2 RPCs + a seals read each), so a batched read needs a new RPC (a migration). The front door's
shelf has no event context, so it shows no distance and no total.

SPEC IMPACT: None — builds the approved DECISION_LOG rows of 20 Nov (card 14) as drawn; no ruling changed.
