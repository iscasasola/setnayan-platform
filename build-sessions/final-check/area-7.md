# Final check · Area 7 · Coordinator, Spaces & venue, maps

Checker 7 of 8. Report only. Pinned commit `fb3f72d`. Kit: `build-sessions/FINAL-CHECK-KIT.md`.
Phase A = code pass (`SOURCE: CODE`). Phase B = staging browser walk (`SOURCE: SEEN`), not started.
Read against the corpus `HOUSE_DESIGN_STANDARD_2026-11-20.md` (Parts C, D, F, H, K) and `DARK_MODE_STANDARD_2026-11-20.md`.

Marks on each line: **OFFLINE** = NEEDED (where signal is lost) · READ-ONLY · NOT NEEDED.
**SHAPE** = TODAY → SHOULD (PAGE · FULL-SCREEN POPUP · SMALL POPUP); `=` when they match.
Offline today: the only saved addresses are `OFFLINE_COPY_SHAPES` in `apps/web/lib/offline-copies.ts` (event Home, Check-in desk,
Schedule, the supplier's On the day + live console, a customer's Schedule tab, a guest's Me) plus `/[slug]` and `/[slug]/find-my-table`
in `public/sw.js`. No page in this area is on that list.

## BLOCKERS

None yet.

## Progress

- [x] /[slug]/venue · OFFLINE: READ-ONLY (at the venue on the day; find-my-table already holds the seat offline, the walk is not saved today) · SHAPE: PAGE =
- [x] /3d_plan/demo/[token] · OFFLINE: NOT NEEDED · SHAPE: PAGE = (opened from a QR)
- [x] /dashboard/[eventId]/plan3d · OFFLINE: READ-ONLY (at the venue on the day; agree it is saved for the day — today it is not, no Seats address is in `OFFLINE_COPY_SHAPES`) · SHAPE: PAGE = (a forward to Guests › Seats › 3D, which keeps its own address `?gview=seats&seat=3d`; its View only card and Accents sheet differ, see A7-08, A7-09)
- [x] /dashboard/[eventId]/studio/panood/setup/venue-check · OFFLINE: NOT NEEDED (it measures the signal; with none it says "We couldn't reach Setnayan from here") · SHAPE: PAGE = (opened on a phone at the venue; the place note is for the coordinator)
- [x] /dashboard/[eventId]/vendors/[vendorId]/workspace · OFFLINE: NOT NEEDED (money is never kept offline, HOUSE F2; the day's supplier contacts are on the saved Home › Today and Schedule) · SHAPE: PAGE = (its own address with `?tab=` and `#payments` doors; its sheets differ, see A7-26)
- [x] /for-coordinators · OFFLINE: NOT NEEDED · SHAPE: PAGE =
- [x] /pa3d · OFFLINE: NOT NEEDED · SHAPE: PAGE =
- [x] /pa3d/try · OFFLINE: NOT NEEDED · SHAPE: PAGE = (the link people paste)
- [x] /vendor-dashboard/clients/[eventId]/seat-plan · OFFLINE: READ-ONLY (at the venue on the day: the caterer's covers per table; agree it is saved for the day — today it is not, only the customer's `?tab=schedule` is) · SHAPE: PAGE =
- [x] /vendor-dashboard/spaces · OFFLINE: NOT NEEDED (set up at the shop, with signal) · SHAPE: PAGE = (its space sheet differs, see A7-11)

## Scope notes

- `/dashboard/[eventId]/plan3d` only forwards (`redirect(guestsViewHref(eventId, 'seats', { seat: '3d' }))`). The 3D plan now lives in
  Guests › Seats › 3D: `guests/page.tsx` streams `seating/page.tsx` (`host=guests`), which streams `seating/lab/page.tsx` (the room).
  Those host pages are Area 2's; the room's own controls (`seating/lab/_components/*`) are checked here because they ARE the 3D plan.
- `/pa3d` and `/pa3d/try` mount the same `Pa3dRoom`; findings A7-05 to A7-07 apply to both.
- Maps: no Area 7 page draws an OpenStreetMap picture (no `scene-map-tiles`, `vendor-location-map`, `venue-widget` or
  `reach-map` import under any of the ten routes), so the OSM-prefetch rule has nothing to hold here. The seeded venue's map
  pin is drawn on its shop page `/v/[slug]` (Area 1) and the Event Hub's venue plate (Area 4).
- One source: the guest walk reads `public_venue_scene`, the couple's 2D and 3D read `lib/seating.ts`, the supplier reads
  `get_vendor_seat_plan`, Spaces reads `vendor_units`. Spaces and the couple share the one editor (`SeatingEditor` in venue
  mode) and the one engine (`lib/seat-plan-engine`); the supplier's client seat plan does not (A7-16, A7-17).

## Findings

### A7-01 · The venue walk's live refresh throws away what the server joined

```
PAGE      /[slug]/venue?t=<a seated guest's personal token>   (event: any with a published plan, e.g. stg-carla-miguel)
BUTTON    none — the room's own refresh, every 60 s while visible
STEPS     1. Open the walk from a seated guest's personal link.
          2. Note "You're at <table name>", the couple's colours on the room, the booth logos, and
             "Book this supplier for your event" on a booth card.
          3. Keep the tab visible for just over a minute.
EXPECTED  The room changes only when a seat, table or booth really moved, and keeps the table's name,
          the couple's colours, guest photos, booth logos and the booth card's links.
ACTUAL    `use-live-scene.ts` re-asks `public_venue_scene` from the browser and swaps in the RPC's RAW answer.
          The first scene was built on the server with joins the raw answer lacks: `withYourTableName`
          (`you.tableName`), `rolePalette` (events.role_palette), resolved guest photo URLs, resolved booth
          logo / poster URLs, and the booth's `slug` / `bookable` / `boothAddonActive` (fetchBooths).
          `sceneSignature` hashes `you`, `photos` and `booths`, so the first poll always "differs" for a seated
          token holder or any event with booths. After ~60 s: the caption falls back to "your table", the room
          drops to the default palette, photos and logos become `r2://` refs (broken or generic), branded booths
          go generic, and the booth card loses "Book this supplier". `/api/venue-scene/[slug]` already makes most
          of these joins ("so a live refresh never puts the code back") but nothing calls it.
SHOTS     375 px light + dark, at 0 s and at 70 s
RULE      CLAUDE.md §4 (one reader per fact) · design-and-wiring C8
SEVERITY  wrong
SOURCE    CODE
```

### A7-02 · "Try again" on the venue walk forgets whose walk it was

```
PAGE      /[slug]/venue?t=<token>
BUTTON    "Try again" (on "The 3D venue didn't load")
STEPS     1. Open a guest's personal venue link when the scene read fails.  2. Press "Try again".
EXPECTED  The same walk again, with the guest's own gold seat and tablemates.
ACTUAL    The link is `/${slug}/venue` with no `?t=`. A retry that works shows the anonymous room: no
          "You're at…", no gold seat, no tablemates. Every other door to this page carries the token
          (`room-links.ts`, `site-nav.ts`: `${base}/venue?t=…`).
SHOTS     375 px light
RULE      design-and-wiring B6 (trace the control to its end)
SEVERITY  wrong
SOURCE    CODE
```

### A7-03 · The 3D demo's dead end points at a homepage tile that no longer exists

```
PAGE      /3d_plan/demo/[token]   (an old or reused token)
BUTTON    none — the card has no button
STEPS     1. Open /3d_plan/demo/<an expired token>.
EXPECTED  A way forward to where codes are made today (/pa3d/try).
ACTUAL    "This demo link expired. … open a new one from the 3D Plan tile on the Setnayan homepage." The
          homepage has had no 3D Plan tile since the cinematic homepage went (2026-08-13, noted in
          `_doorway.tsx`); codes are minted by "Tap any seated guest" in the room on /pa3d and /pa3d/try. The
          card offers no button, only the wordmark home.
          Also: `loadPlan3DDemoScene` ignores the guests read's error (`guestResult.data ?? []`), so when that
          read fails `resolvePlan3DGuestToken` finds no guest and the page says "This demo link expired." — a
          failed read told as an expiry.
SHOTS     375 px light
RULE      design-and-wiring A4 (every way in moves with it) · CLAUDE.md §5 rule 4 (honest states)
SEVERITY  wrong
SOURCE    CODE
```

### A7-04 · The 3D demo promises the walk to "every real Setnayan guest"

```
PAGE      /3d_plan/demo/[token]   (a fresh token from /pa3d/try)
BUTTON    "Where am I seated?" → the line under "You're at …"
STEPS     1. On /pa3d/try tap a seated guest, open the code.  2. Press "Where am I seated?".
EXPECTED  A true line, e.g. that guests get this when their hosts share the seat plan.
ACTUAL    "A sample guest, on a sample table — every real Setnayan guest gets this on the day." Guests only
          get the walk when the hosts publish the plan (`public_venue_scene` is published-gated) and the event
          type has seating (`/[slug]/venue` 404s otherwise).
SHOTS     375 px light
RULE      docs/brand.md (claims never made: promises about Setnayan)
SEVERITY  wrong
SOURCE    CODE
```

### A7-05 · On a phone the 3D room traps the page's scroll

```
PAGE      /pa3d  and  /pa3d/try
BUTTON    "Step inside" → the room
STEPS     1. At 375 px press "Step inside".  2. With the room loaded, put a thumb on it and swipe up to scroll on.
EXPECTED  The page scrolls; the room turns only on a deliberate gesture (or a visible tap path).
ACTUAL    The canvas sets `touchAction: 'none'` (`plan3d-scene.tsx`) and fills a 4:5 box the width of the column
          (about 335 × 420 px) in the middle of a long page. A swipe that lands on it orbits the camera; the only
          way past is the 20 px gutters.
SHOTS     375 px light (a screen recording)
RULE      HOUSE_DESIGN_STANDARD D3 ("never touch-action: none on scrolling content")
SEVERITY  look
SOURCE    CODE
```

### A7-06 · "Tap any seated guest": a failed code just vanishes

```
PAGE      /pa3d  and  /pa3d/try
BUTTON    a seated guest in the room ("Tap any seated guest to open the room from their seat")
STEPS     1. Step inside.  2. Tap a guest while the mint fails (or tap one that is no longer seated).
EXPECTED  "Couldn't make their code" with Try again.
ACTUAL    `handleGuestClick` shows "Making their code…", then `.catch(() => setQr(null))` and a `null` answer
          both end with nothing drawn. The press looks like it did nothing.
SHOTS     375 px light
RULE      CLAUDE.md §5 rule 4 · HOUSE F4 (failure gives a plain reason + Try again)
SEVERITY  wrong
SOURCE    CODE
```

### A7-07 · The demo room's controls: two filled accent pills, spinners, hand-made buttons

```
PAGE      /pa3d  and  /pa3d/try
BUTTON    "Walk around" / "Walking" · "Their colours: on/off" · "Back to my seat" · "Try again"
STEPS     1. Step inside (colours are ON by default).  2. Press "Walk around".
EXPECTED  One main button per scope; on/off choices are switches; loading is a Ghost, not a spinner.
ACTUAL    "Walking" and "Their colours: on" are both filled `--m-mulberry` pills side by side, with a neutral
          "Back to my seat" between them. Two yes/no choices drawn as accent pills (D2: a yes/no is a switch,
          one switch per drawing). "Standing up the room…" and "Making their code…" use `Loader2 animate-spin`.
          The failed state's "Try again" and all three pills are hand-made `<button>`s, not `ActionButton`.
SHOTS     375 px light + desktop
RULE      HOUSE K1 · D2 · CLAUDE.md §3 (Loading: no spinners; Button: ActionButton)
SEVERITY  look
SOURCE    CODE
```

### A7-08 · The 3D room's "View only" card is a popup with no backdrop, holding another popup

```
PAGE      /dashboard/[eventId]/plan3d → Guests › Seats › 3D   (event: stg-bea-paolo)
BUTTON    "View only" (or "Editing") in the room's bottom row → "Show ▾"
STEPS     1. Open the 3D room.  2. Press "View only".  3. Tap the room behind the card.  4. Press "Show ▾".
EXPECTED  Anything on top dims and blurs the room, the room cannot be used while it is open, a backdrop
          tap closes it (K3). One layer at a time.
ACTUAL    `room-view-tools.tsx` draws the card as a hand-made `role="dialog"` frame inside the tools row: no
          shared backdrop, no dim or blur, the room behind still orbits and takes taps, a tap outside does not
          close it (only pressing "View only" again), no Esc. "Show ▾" then opens a PickMenu list over the card —
          a popup on a popup. The card holds one line, "Take over", "Switch to 2D", "Show" and the legend: a
          SMALL POPUP (`Sheet`) by the shape tests.
SHOTS     375 px light + dark
RULE      HOUSE K3 1–4 · SHAPE (never a popup on top of a popup) · CLAUDE.md §3 (no new hand-rolled dialog)
SEVERITY  look
SOURCE    CODE
```

### A7-09 · Accents is a tall half-sheet of 22 rows; its "Add it" is accent-outlined; a failed "No thanks" is silent

```
PAGE      /dashboard/[eventId]/plan3d → Guests › Seats › 3D   (event: stg-bea-paolo)
BUTTON    "Accents" → "Add it" / "No thanks" on a booked-supplier suggestion
STEPS     1. Open the 3D room.  2. Press "Accents".  3. Scroll the sheet.  4. Press "No thanks" while offline.
EXPECTED  SHAPE: more than one short screen → FULL-SCREEN POPUP (`RiseScreen`). One main button per row,
          others neutral. A failed save says so.
ACTUAL    TODAY a `Sheet` with 22 rows (7 "In the 3D room" + 15 "For your concept and suppliers"), each a
          switch plus a style dropdown plus photos → SHOULD be a full-screen popup.
          Each suggestion's "Add it" is a hand-made button with `border-terracotta` (accent-outlined; K1.2 says a
          second-rank button is never accent-outlined, and a main one is filled), several per sheet.
          "No thanks" hides the suggestion at once; if `dismissRoomSuggestion` fails it only calls
          `trackFailure` — nothing on screen, and the suggestion is back on the next open.
SHOTS     375 px light + dark (sheet open, scrolled)
RULE      SHAPE (owner 25 Nov) · HOUSE K1 · HOUSE F4
SEVERITY  look
SOURCE    CODE
```

### A7-10 · The seat plan and the 3D room draw a failed floor-plan read as the couple's real room

```
PAGE      /dashboard/[eventId]/plan3d → Guests › Seats (2D and 3D)   (event: stg-bea-paolo)
BUTTON    "Show guests their seats early" switch; the room itself
STEPS     1. Open Seats when the `event_floor_plan` read is refused (or the scene-objects / signs reads fail).
EXPECTED  "Couldn't read your floor plan" — never a default room, never the switch drawn Off.
ACTUAL    `seating/page.tsx` and `seating/lab/page.tsx` call `fetchFloorPlan` — the form that returns
          DEFAULT_FLOOR_PLAN on an error (`fetchFloorPlanMeasured` exists for exactly this and says why) — and
          `fetchSceneObjects` / `fetchSigns`, which return `[]` on an error. So a refused read draws the default
          room size, stage, dance floor and entrance as if the couple's, drops every placed fixture and sign, and
          the switch reads `floorPlan.published_at` = null → Off, inviting a needless re-publish. The Guests page
          above it knows (`sideReads.seats` uses `floorPlanRead.measured`), the plan body below does not.
SHOTS     375 px light (with the read refused)
RULE      CLAUDE.md §5 rule 4 (honest states; copy guests-read-is-honest)
SEVERITY  wrong
SOURCE    CODE
```

### A7-11 · A space's sheet is a tall half-sheet, and it opens popups on top of itself

```
PAGE      /vendor-dashboard/spaces   (shop: Hardin ng Tagaytay Events Place, the 30 × 45 m hall)
BUTTON    the hall's tile → "Base layout" → "Open the floor plan"; the 🔒 "Your own names" row
STEPS     1. Tap the hall's tile.  2. Scroll the sheet.  3. Open "Base layout".  4. Press "Open the floor plan"
          (on a Free shop, tap the 🔒 name row instead).
EXPECTED  SHAPE: more than one short screen → FULL-SCREEN POPUP (RiseScreen). Never a popup on top of a popup.
ACTUAL    TODAY a `Sheet` (`space-sheet.tsx`). For a hall it holds What is it · Hall or room · Names · Seated ·
          Standing · Floor width · Floor length · Connects to · Base layout (the doors list, three door pickers,
          Add a door, the plan picture, every table row, then Add tables: names, type, chairs, ends) · Preview ·
          two buttons: far past one short screen. "Open the floor plan" raises the couple's editor in a
          `RiseScreen` over that sheet, and the 🔒 row raises `LockedFeature`'s own `RiseScreen` over it too.
SHOTS     375 px light + dark (sheet scrolled; editor open over it)
RULE      SHAPE (owner 25 Nov) · HOUSE K3.4 (one layer at a time)
SEVERITY  look
SOURCE    CODE
```

### A7-12 · A hall's sheet carries two filled main buttons and an accent-outlined one

```
PAGE      /vendor-dashboard/spaces   (the hall with its tables)
BUTTON    a table row's "Save" · "Add tables" · "Save hall"
STEPS     1. Open the hall.  2. Open Base layout.  3. Open one table's row.
EXPECTED  One main button in the sheet; every other button neutral.
ACTUAL    In the one sheet: the table's "Save" (`ActionButton tone="ok" main`, filled green), "Add tables"
          (`tone="brand"` without `main`, so accent-outlined) and the sheet's "Save hall" (`tone="brand" main`,
          filled). "Add a door" is neutral, as it should be.
SHOTS     375 px light + dark
RULE      HOUSE K1.1–K1.2
SEVERITY  look
SOURCE    CODE
```

### A7-13 · A failed date change keeps the old day's tiles under the new day's name, and says "Saved"

```
PAGE      /vendor-dashboard/spaces
BUTTON    the Date menu (top right)
STEPS     1. Pick another date while the read fails.
EXPECTED  The tiles say nothing about a day they could not read (the page's own rule for a refused day read), and the
          message says the day could not be read.
ACTUAL    `onPick` sets the date first (`setDate(k)`) and then runs `{op: 'read'}`. On failure `read` is untouched, so
          the tiles still show who holds each space on the OLD day (`tilesOnDay(read.day.date, …)`) under the NEW
          day's heading ("Sat 14 Feb · Tiles follow this date"). The warning is `fresh()`'s "Saved, but we couldn't
          read your spaces back. Open the page again." — nothing was saved; it was a read.
SHOTS     375 px light
RULE      CLAUDE.md §5 rule 4 (honest states)
SEVERITY  wrong
SOURCE    CODE
```

### A7-14 · The two Spaces locks never show the price

```
PAGE      /vendor-dashboard/spaces   (a Free shop)
BUTTON    🔒 "Your own names" (in a space's sheet) · 🔒 "Make it a floor plan"
STEPS     1. On a Free shop tap either lock.
EXPECTED  Problem → solution → preview → the plan's price from the catalogue → one button.
ACTUAL    `PAID_NEED` passes `price: null` (`space-sheet.tsx`), so the lock reads "Price from the price sheet when you
          tap Upgrade". The Plus price is in `vendor_billing_catalog` and other pages read it
          (`getVendorPrices` + `monthlyPlanPrice`).
SHOTS     375 px light
RULE      design-and-wiring B7 (locks are honest)
SEVERITY  wrong
SOURCE    CODE
```

### A7-15 · Spaces skips the house title, toast, Undo and empty state

```
PAGE      /vendor-dashboard/spaces
BUTTON    "Add the hall" / "Save hall" / "Remove Hall001"; the page top
STEPS     1. Open Spaces in dark.  2. Add a space.  3. Remove it.  4. Open a shop with no spaces.
EXPECTED  `PageMasthead` (and in dark the top block carries the glow); success a small toast; remove at once with
          Undo in a toast; empty as `EmptyState`.
ACTUAL    A hand-made `<h1 className="text-[22px]">` under a BackButton, no `PageMasthead`. Success shows as a
          `ShopNotice` banner at the top of the page ("Added", "Hall001 saved"). "Remove Hall001" removes with no
          Undo. Empty is a bare line, "No spaces yet. Type in the box below to add your first." Half-pixel sizes
          (`text-[12.5px]`, `text-[13.5px]`, `font-size: 12.5px` in the module CSS).
SHOTS     375 px light + dark
RULE      CLAUDE.md §3 (Page title · Toast · Empty · Type) · HOUSE D2 (Remove a row) · K2
SEVERITY  look
SOURCE    CODE
```

### A7-16 · The supplier's seat plan is a second drawing of the plan, not the shared engine

```
PAGE      /vendor-dashboard/clients/[eventId]/seat-plan   (event: stg-bea-paolo, as a booked floor supplier)
BUTTON    none — the map
STEPS     1. Open the client's Seats.  2. Compare with the hosts' 2D plan of the same event.
EXPECTED  DECISION_LOG 2026-11-20, "ONE SEAT-PLAN ENGINE FOR THE COUPLE AND THE SUPPLIER": the picture drawn by
          `lib/seat-plan-engine` (`PlanPoster` / `planTableGeometry`), as Spaces draws a hall.
ACTUAL    `seat-plan-body.tsx` hand-draws its own map: every table a fixed 9 % × 9 % square or circle
          (`isRound` on the type's name) whatever its type, chairs or size, so a long table is a small square.
          Joined tables are drawn apart under their own labels (the hosts and find-seat use the group's name). An
          unsized room is drawn 4:3 landscape while the engine's default room is 20 × 30 m (`DEFAULT_ROOM_M`),
          so the supplier's picture of an unsized plan is the hosts' stretched the other way.
SHOTS     375 px light + dark, beside the hosts' 2D plan
RULE      DECISION_LOG 2026-11-20 · design-and-wiring D11–D12 (one way to make each thing)
SEVERITY  wrong
SOURCE    CODE
```

### A7-17 · The supplier's "N of M seated" counts removed chairs, and the covers disagree with "seated"

```
PAGE      /vendor-dashboard/clients/[eventId]/seat-plan   (event: stg-bea-paolo, as the caterer)
BUTTON    none — the table rows
STEPS     1. As the hosts, remove 2 chairs from a table.  2. As the caterer, open Seats.
EXPECTED  The same "seated of seats" the hosts see; covers that add up to the seated count, or a line saying why not.
ACTUAL    `get_vendor_seat_plan` sends `capacity = event_tables.capacity`; the hosts' plan counts
          `effectiveCapacity(capacity, removed_seats)`. A table with 2 chairs removed reads "6 of 10 seated" for
          the supplier and 6 of 8 for the hosts. `seated` counts every seat at the table, but `meal_counts`
          leaves out guests not counted for this supplier, the passed away and the represented — so the caterer's
          "Covers per table" pills add up to fewer than the "seated" line beside them, with nothing saying why.
SHOTS     375 px light, beside the hosts' table
RULE      CLAUDE.md §4 (one reader per shared number) · kit check 3 (connections)
SEVERITY  wrong
SOURCE    CODE
```

### A7-18 · /for-coordinators types a price and a rating on its sample card

```
PAGE      /for-coordinators
BUTTON    none — "Your shop" part, the sample service card
STEPS     1. Scroll to "Your shop".
EXPECTED  No hand-typed price, count or rating on a public page.
ACTUAL    `price={formatPhpRounded(24999)}`, `rating={{ avg: 4.9, count: 64 }}`, `aboutKmLine(8)`, "2 coordinators,
          12 hours": the card shows ₱24,999 and 4.9 (64). The page's own guard bans `/₱\s?\d/` ("no price is
          typed — prices come from vendor_billing_catalog"); sending the number through `formatPhpRounded` slips
          past it. The fine print says "A sample card and calendar."
SHOTS     375 px light
RULE      docs/brand.md claims #1 (a hand-typed price) · CLAUDE.md §1 (never write a price into code)
SEVERITY  wrong
SOURCE    CODE
```

### A7-19 · /for-coordinators promises "No end date"

```
PAGE      /for-coordinators
BUTTON    none — the hero's fine print; the "On the day" ⓘ
STEPS     1. Open the page (the day-of tools' switch is on).
EXPECTED  "Free", with no promise about how long.
ACTUAL    "Coordinator tools are free on every plan. No end date." and "The day-of tools are free on every plan,
          with no end date." DECISION_LOG 2026-11-04 rules the tools free with no end date and says the marketing
          tag is plain "Free"; brand.md, which wins on wording, bans price promises ("always free", "free for life").
SHOTS     375 px light
RULE      docs/brand.md claims #3 (price promises)
SEVERITY  wrong
SOURCE    CODE
```

### A7-20 · Venue check: a failed event read is a 404; the bar animates its width; four equal number tiles

```
PAGE      /dashboard/[eventId]/studio/panood/setup/venue-check   (event: stg-carla-miguel)
BUTTON    "Start the check" → the result
STEPS     1. Open the page.  2. Run a check.
EXPECTED  A refused read says so; motion is transform and opacity only; one hero number.
ACTUAL    `const { data: event } = await eventRowOnce(…)` drops the error, so a refused read gives `notFound()` —
          "this page does not exist". The progress bar is `transition-[width] duration-500` (width, and 500 ms is
          not a house speed). The result is Upload · Slowest second · Delay · Stream needs as four equal tiles.
          Otherwise this page is right: idle, running, saving, result and failure each look different and every
          failure has words and Try again.
SHOTS     375 px light + dark (result screen)
RULE      CLAUDE.md §5 rule 4 · HOUSE E2.2 · HOUSE Part I.3 (one hero metric)
SEVERITY  look
SOURCE    CODE
```

> A7-21 to A7-27 cover the hosts' picked-supplier page (the shared workspace). It is ≈3,200 lines plus 30 parts; a
> helper read swept it rule by rule, and every finding below was re-read in the code before it was written here.
> Production draws it through `PickedSupplierShell` (`NEXT_PUBLIC_RELATIONSHIP_WORKSPACE_ENABLED`), tabs Details ·
> Book & Budget · Schedule · Files · Chat. Nothing dead was found: every typed route exists, no `#`, no empty handler.
> No "vendor" in any word a person reads.

### A7-21 · Details says "Booked" over a supplier who is not booked

```
PAGE      /dashboard/[eventId]/vendors/[vendorId]/workspace?tab=details   (event: stg-bea-paolo, a supplier in each state)
BUTTON    none — the green chip in the top block
STEPS     1. From Chats (or Suppliers), open a supplier who is only shortlisted, or who declined, or whose request expired.
EXPECTED  The chip names the real state; "booked" is decided by BOOKED_EVENT_VENDOR_STATUSES.
ACTUAL    `heroSection` draws "Asked" only when `lockRequestStateOf(…) === 'requested'`, and green "Booked" for every
          other state — none, declined, cancelled, expired. The colour-access card says "{category} · booked for this
          event" the same way. Two hand-written lists also decide "booked" on this page: `inferStage` (contracted ·
          deposit_paid · delivered · complete → `isBooked`, the steps, the quote schedule) and
          `const BOOKED = new Set([...])` in `promote-coordinator-card.tsx`.
SHOTS     375 px light + dark, for a declined supplier
RULE      CLAUDE.md §4 (Booked = BOOKED_EVENT_VENDOR_STATUSES) · design-and-wiring C8
SEVERITY  wrong
SOURCE    CODE
```

### A7-22 · A failed contact read shows a blank card, and "Save" then wipes the saved address

```
PAGE      /dashboard/[eventId]/vendors/[vendorId]/workspace?tab=details   (a supplier the hosts added themselves)
BUTTON    "Save their details"
STEPS     1. Open a self-added supplier while the `manual_vendors` read fails.  2. Type a phone number.  3. Save.
EXPECTED  "Couldn't load their details" and no save over data the page never read.
ACTUAL    `manualContactRes?.data ?? null` never checks the error, so the card shows empty fields and "No contact yet.
          Add one so you can reach {name}." The save always writes `address: address.value` (`actions.ts`), so the
          blank address field overwrites the stored one, and the payment note with it when the form sends it.
SHOTS     375 px light
RULE      CLAUDE.md §5 rule 4 (honest states)
SEVERITY  broken
SOURCE    CODE
```

### A7-23 · Failed reads on the workspace are drawn as "nothing there"

```
PAGE      /dashboard/[eventId]/vendors/[vendorId]/workspace   (Files · Schedule · Details · Book & Budget tabs)
BUTTON    none — the sections
STEPS     1. Open the page when each read below is refused.
EXPECTED  "Couldn't load …" with Try again, never an empty or zero state.
ACTUAL    Each read logs the error and then empties itself (`?? []`):
          · Files: `handovers = handoverRows ?? []` → `HandoverInbox` returns null — the delivered gallery with
            "Open album" / "Confirm receipt" vanishes. The code's own comment names this exact danger.
          · Schedule: `apptRows ?? []` → "No appointments yet. Propose a meeting…" — invites a duplicate booking.
          · Details: `grantRows ?? []` / `changeRows ?? []` → colour access "Off", "No changes yet", and the Reject
            buttons for changes already made are hidden.
          · Book & Budget (catering / crew meals): `eventVendorCrewRows ?? []` → "Feeding 0 crew meals … they see
            this count on their production sheet."
SHOTS     375 px light, one per tab
RULE      CLAUDE.md §5 rule 4 (copy guests-read-is-honest)
SEVERITY  wrong
SOURCE    CODE
```

### A7-24 · Money on the workspace: a failed payments read reads as nothing paid; two amounts due; its own peso formatter

```
PAGE      /dashboard/[eventId]/vendors/[vendorId]/workspace?tab=budget   (event: stg-bea-paolo, a supplier with payments)
BUTTON    none — "Paid so far", the Next step row, "Amount to pay", Costing's "Total"
STEPS     1. Open Book & Budget when the payments read is refused.  2. Open it for a supplier whose accepted quote has its
             own schedule.  3. Look at an amount with centavos (e.g. ₱837.50).
EXPECTED  A refused read says so; one amount due everywhere; pesos only through lib/php.ts.
ACTUAL    · `paidSoFarPhp` takes `vendorBudgetSummary.paidTotal`, which is 0 when `paymentsMeasured` is false; the page
            never checks that flag, so "Paid so far" disappears — the same as nothing paid. When the summary itself
            fails: "No payment milestones added yet. Add a line item or log a payment…"
          · The Next step row above Chat reads the payment plan's due step (`planProgress`), while "Amount to pay" reads
            `readBookedMoney` and can show the accepted quote's schedule — two different amounts due.
          · A page-local `formatPHP` (`maximumFractionDigits: 0`) prints ₱837.50 as ₱838 for Paid so far, Price and
            Total, while `VendorItemizationCard` on the same page prints ₱837.50. More local formatters: refunds
            (`toLocaleString`), `pesoFromCentavos`, `fmtPeso`, `peso`, `fmtPHP`. Costing's "Total" is added up on the
            page (`serviceNowNum + transportNum + foodNum`, `?? '₱0'`), not read from `resolveEventMoney`.
SHOTS     375 px light + dark
RULE      CLAUDE.md §1 (money via lib/php.ts) · §4 (resolveEventMoney) · §5 rule 4
SEVERITY  money-signin
SOURCE    CODE
```

### A7-25 · The workspace's screens each carry several main buttons

```
PAGE      /dashboard/[eventId]/vendors/[vendorId]/workspace   (Book & Budget · Details)
BUTTON    "Pay {supplier}", "Save costs", "Save crew", "Record payment", "Propose a change", "Log ₱X", "Send it again";
          "Save their details", "Save details", "Save answers", "Yes, I got everything", "Leave a review"
STEPS     1. Open Book & Budget.  2. Open Details.
EXPECTED  One filled main button per screen, sheet or card; every other button neutral or a text link.
ACTUAL    Book & Budget: "Pay {supplier}" (`tone="brand" main`) plus "Save costs" and "Save crew" (`bg-mulberry`
          fills) on one screen; "Record payment", "Propose a change", "Log ₱X" are `tone="brand"` without `main`
          (accent-outlined); after a refusal `main={declined || …}` makes "Send it again" a second main beside "Pay"
          in one card. Details: "Save their details" and "Save details" are both `tone="brand" main` (a third,
          "Move", while its confirm is open); for a Setnayan supplier, "Save answers" per form plus "Yes, I got
          everything" / "Leave a review" (`bg-mulberry`).
SHOTS     375 px light + dark, each tab
RULE      HOUSE K1
SEVERITY  look
SOURCE    CODE
```

### A7-26 · Workspace popups: a hand-made popup over the pay sheet; long sheets that should rise full screen

```
PAGE      /dashboard/[eventId]/vendors/[vendorId]/workspace?tab=budget
BUTTON    "Pay {supplier}" → "Show QR" / a method's "Pay"; "Record payment"; "Propose a change"; Photo approvals
STEPS     1. Press "Pay {supplier}", then "Show QR".  2. Press "Record payment".  3. Press "Propose a change".
EXPECTED  One layer at a time, each a shared part; more than one short screen or a photo → RiseScreen.
ACTUAL    · "Show QR" and "You're leaving Setnayan" open a hand-made `ModalShell` (`role="dialog"`, `fixed inset-0
            z-[60]`, `vendor-direct-pay.tsx`) on top of the "Direct payment" `Sheet` — a popup on a popup. Each link
            method there also draws its own filled `bg-terracotta-700` "Pay" (several mains in one sheet).
          · "Log your payment" is a half `Sheet` with amount, method, reference and a proof photo → SHOULD be a
            full-screen popup (a photo, four fields).
          · "Propose a change" is a `Sheet` with a toggle and four fields → SHOULD be full screen.
          · Photo approvals is a `Sheet` holding a list of photos with Show/Hide each → SHOULD be full screen.
SHOTS     375 px light + dark, each open
RULE      SHAPE (owner 25 Nov) · HOUSE K3.4 · CLAUDE.md §3 (no new hand-rolled dialog)
SEVERITY  look
SOURCE    CODE
```

### A7-27 · A failed "Save costs" or "Save crew" throws the whole screen away

```
PAGE      /dashboard/[eventId]/vendors/[vendorId]/workspace?tab=budget
BUTTON    "Save costs" · "Save crew"
STEPS     1. Change a cost.  2. Save while the accepted-quote read or the write fails.
EXPECTED  The row stays, with "That did not save. Nothing changed — please try again." (HOUSE F4).
ACTUAL    Both are bare `<form action={updateVendorCosts}>`; the action `throw`s (`vendors/actions.ts`) and there is no
          `error.tsx` under `/dashboard/[eventId]` except `seating/`, so the root error page replaces the screen.
          `quote-bridge.tsx` shows the same action's `err.message`, which in production is Next's generic
          server-render text. (What exactly is drawn: confirm in the browser.)
SHOTS     375 px light
RULE      HOUSE F4 · CLAUDE.md §5 rule 4
SEVERITY  broken
SOURCE    CODE
```
