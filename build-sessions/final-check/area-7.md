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
- [ ] /dashboard/[eventId]/studio/panood/setup/venue-check
- [ ] /dashboard/[eventId]/vendors/[vendorId]/workspace
- [ ] /for-coordinators
- [x] /pa3d · OFFLINE: NOT NEEDED · SHAPE: PAGE =
- [x] /pa3d/try · OFFLINE: NOT NEEDED · SHAPE: PAGE = (the link people paste)
- [ ] /vendor-dashboard/clients/[eventId]/seat-plan
- [ ] /vendor-dashboard/spaces

## Scope notes

- `/dashboard/[eventId]/plan3d` only forwards (`redirect(guestsViewHref(eventId, 'seats', { seat: '3d' }))`). The 3D plan now lives in
  Guests › Seats › 3D: `guests/page.tsx` streams `seating/page.tsx` (`host=guests`), which streams `seating/lab/page.tsx` (the room).
  Those host pages are Area 2's; the room's own controls (`seating/lab/_components/*`) are checked here because they ARE the 3D plan.
- `/pa3d` and `/pa3d/try` mount the same `Pa3dRoom`; findings A7-05 to A7-07 apply to both.

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
