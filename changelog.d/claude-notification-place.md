## 2026-11-13 · feat(notifications): every notice says which part it is from — the event, your shop, your account, HQ

Owner, 13 Nov, over the live pop-over: *"how do we identify if it is from an event they are making or an event they
are invited to or a user notification … we need to be able to easily identify to see if they will jump to an event
dashboard, or their supplier dashboard, or something"*. Built from the approved drawing
`prototypes/notifications_place_2026-11-13` — **Option A** (Option B, place headings, was rejected).

- **One rule for the PART** — new pure `lib/notification-place.ts`: `/vendor-dashboard…` → your shop · `/admin…` →
  Setnayan HQ (new branch) · an event (`event_id`, or a `/dashboard/<uuid>` link) → the event · else your account.
  Moved out of `lib/push-send.server.ts subjectFor()`, so the bell row and the phone push call the same function.
  The event's stance is `event_members.member_type` through `eventStance()`: "You organise" · "Invited" · "You help".
- **The row** (`notifications-list.tsx`, edited, not redrawn): the 38px circle is the place's own mark — the event's
  monogram tile (`EventMonogram`), the shop's `VendorAvatar`, your picture or initial, or `LogoMark` for HQ — with the
  type's icon as an 18px corner badge that keeps the type's short name. One quiet line above the title:
  **name** · stance. "Opens … ›" lives in the house ⓘ (`InfoTip`, which gains an optional `labelNode` for a bold
  name + coloured stance). Today / Earlier, the press, the swipe and "Mark all read" are unchanged.
- **One batched read** — `fetchNotificationEventPlaces` (lib/notifications.ts): `events` + this login's
  `event_members` for the rows' distinct `event_id`s, side by side; the shop and your picture come from the account
  menu's `SwitcherData` every layout already reads (`placeWhoFromSwitcher`). Never a read per row.
  `fetchOwnNotifications` now also selects `event_id`.
- **Honest reads** — the event removed (event_id SET NULL), a helper on several shops, or the read failed → the words
  "Place didn't load", the type icon kept in a dashed ivory circle. Never a blank tile, never a guessed place. A notice
  whose event was removed marks read and stays on the page instead of landing on a dead link.
- **The phone push** — `titleFor()` is now the same place line ("Maria & Jose · You organise", "SetnaProd · Your
  shop", "Setnayan HQ · Admin", "Setnayan · Your account"), under 40 characters by cutting the NAME at a word; the
  stance is never cut (`placeTitle`).
- **"View all"** (couple + supplier pages) draws the same rows; `/dev/notifications-lab` shows the mix
  (`?noplaces=1` = the places' read failed).
- 🔒 `lib/notification-place.test.ts` — the prefixes, /admin → HQ, the stance, null → "Place didn't load", the push
  title trims only the name, and a guard that a row's place line is never blank (every part × every failure).

⚠ Deviation, flagged: the event mark is the event's **monogram tile**, not the full #7540 poster cover. The poster
needs server-side presigned hero/theme resolvers per event; the pop-over reads in the browser at open time, so the
light mark the account menu and Home's cards already wear is what it can draw honestly.

SPEC IMPACT: None — the decision is already logged (the approved prototype).
