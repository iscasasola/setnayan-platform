## 2026-11-14 · fix(walk): round 9 — never-fixed supplier findings (F-W1-30 · F-W1-47)

- **F-W1-30** The supplier's Booking fees page says the launch offer while it runs ("Launch offer · Setnayan's first
  N bookings are free — M still open."), read from the live `platform_settings` (`launchOfferFeesLine`); closed, unset
  or unreadable → nothing about it.
- **F-W1-47** A client whose couple named ONE candidate day files under that day in the Clients list (Group by day,
  Sort by date) instead of "No date yet" beside a row that names its day (`onlyCandidateDay`, `clientFilingDate`).
- **RW-59** (carried from round 7) A recognised guest on an event dated only by its one picked day saw "Confirm
  attendance" on the Hub, then "Replies are not open yet" on the reply page. The Hub dated the event by that day
  (`withPickedDate`); the reply page read the raw row with no date. `replyWindow` now applies `withPickedDate` itself, and
  its columns carry `date_candidates`, so every reader gives one answer.
- **Round 7 re-walk (RW-256…264, live 39d4a83)**
  - RW-64: the account switcher's OTHER accounts no longer read "Someone —" (`realNameOrNull`, as the signed-in name).
  - RW-87: before the event's day the run of show is labelled "Starts" (never "Now"), with the day's year
    (`weekdayDateWithYear`: "Fri, Dec 18, 2026").
  - The Get-together's browser tab reads "Create a Get-together", not "Create a Simple Event".
  - A Lights & Sound card is no longer "Filled for a florist": in the design family only florals, decor and styling
    take the florist's defaults (`supplierTypeForKind`); the rest fall to 'other'.
  - The couple's Suppliers row reads the shop's current name after a rename (`mk.name`, the hybrid-anonymity answer).
- **RW-265** A verified shop's logo menu offered "Replace photo", which the server then refused. It now shows the logo
  and an "Ask to change" request row, like every other locked field.
- **RW-267** The public shop listed a service twice when two stored keys meant the same service (`distinctShopServices`,
  as the Event Hub's list already does).
- **RW-268** The logo "Ask to change" had only a text box, and an admin can apply only an image key. It now carries the
  editor's own uploader; the uploaded key is what the request files.
- **RW-269** "Check a date" appeared twice on a verified shop page. The About panel keeps its line but loses its button;
  the one beside "Add to your event" stays.
- **RW-270** At 390 px the verified shop's map and Directions row ran past the right edge and the map's credit was cut.
  The calling card's text column now takes the card's width (as the sample card already did), so a long line can no
  longer widen it. Measured on a local mock: with a wide line, map right edge 582 → 356 on a 390 screen.
- **Admin › Work, Profile corrections (live walk, correction S89Z-5EMGY0V2MW)** The inline row's decline reason no
  longer arrives prefilled with "Too close to another shop's name" (a refusal sentence sitting on an approval); it
  starts empty, and a decline with it empty is refused on screen. A press on a request somebody already settled now
  says "Someone already settled this one — nothing was changed" instead of "Approved" or "Declined"
  (`redirectRefusal` reads `already_resolved`; a decline that claimed no row redirects as already resolved). The
  database log shows the Work-page press that reached the server (04:32:26) did apply that logo.
- **Group chat re-walk (RW-274…276, live befd0f7)**
  - RW-274: the composer grows in its seat. The row's field seat was a fixed 44 px pill, so the growing box was clipped
    and the second line hidden; a seat holding a textarea now grows (44 px up, ~5 lines), and the round buttons sit at
    its foot. Enter / Shift+Enter keep the house rule (`shouldSendOnEnter`): on a touch keyboard Return is a new line
    and the arrow sends, because a phone has no Shift+Enter.
  - RW-275: "Someone —" no longer names a group member — `accountPersonName` (and the stories' name read) apply
    `realNameOrNull`, the RW-64 rule.
  - RW-276: the chat opens on the newest line and stays there while it settles (the box is re-fitted and collages load
    after mount); scrolling up is left alone. The ＋ beside the composer drew blank — its bare icon was hidden by the
    row's own menu rule; it is wrapped as the row's ＋ face is.
- **Sign-in, a typed Google address (live fault, owner-seen)** A gmail address + Tab could land in the password box. The
  sign-in card (/login, the sign-in pop-up, the side pane) loads the Google-address door AFTER the card; typed before it
  arrived, nothing folded. The card now folds the password itself, on every keystroke and with no network, for an address
  Google owns by name — hidden and disabled, so Tab cannot land there — and hands over to the door once it loads
  (`earlyGoogleFold`). A door that never loads gives the password back after 4 s. Workspace domains still wait for the
  door's server check. /signup and onboarding already import the door directly. Measured in a browser with the door's
  code held back 4 s: before, the password box stayed shown and reachable; after, it is folded before Tab.
- Guard: `apps/web/lib/the-walk-round-9.test.ts`, `apps/web/lib/admin/supplier-work.test.ts`.

SPEC IMPACT: None.
