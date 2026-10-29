# HANDOVER — #7028 · R4 Seats + March into Guests (branch `claude/r4-seats-march-into-guests`)

Contract: approved Guests prototype v12/v13 — https://claude.ai/artifact/6DXLnENSuU6YxmtMLLPFdc
(local: `~/Documents/Claude/Projects/setnayan-handoff-src/carry-2026-10-29/guests-proto/index.html`; its ◐ theme row is
prototype-only). Owner rule: start from the SHIPPED Guests page, apply ONLY the prototype's deltas, lose nothing.
Keep the PR DRAFT + `do-not-auto-merge`; never merge/deploy. CI is the gate (no local 10 GB tsc while the Mac is short).

## DONE (pushed)
- R4 move: Guests views List · Map · Seats · March (`lib/guests-views.ts`); Seats = `seating/page.tsx host=guests`;
  March = `MarchMaker` (`guests/_components/guests-march.tsx`); Studio tiles gone; every old door forwards
  (`lib/r4-seats-march-forwards.test.ts` 1–6).
- Round 2: Seats chrome at every width (head: Seat plan · ONE PickMenu List·2D·3D · Edit · ⋯ → count row → plan → frosted
  thumb row Rules ▾ · ＋ · phone people door); Seats › List = foldable tables of faces + blank seats
  (`seat-faces-list.tsx`); a face (List AND 2D) opens the shipped guest card with Remove · Swap (`GuestCardSheet`,
  `seats` reader); a blank → "Pick a guest ▾"; Swap uses the shipped atomic `swapSeats`; views + Seats modes switch
  client-side (`replaceState`), makers + 3D room streamed with the page, mounted on first open, kept.
- SLICE 3 (this commit): ONE fixed count row (`ViewCountRow` in `guests/_components/view-summary-cards.tsx`, height
  clamp(56px,7.4cqh,66px)) — Seats: Seated · Unseated · Tables · ✨ Auto arrange (Auto arrange left the thumb row);
  March: Walks · Walking · Not walking (opens the tray) · ▶ Preview (DISABLED + "The walk preview is coming" — no walk
  preview ships). Guard: r4 test 8 (sabotaged red twice).

- SLICE 1 (pushed): THE shared ThumbRow on every view + ONE ⇅ (`lib/guests-filter.ts`, `?gshow/ggroup/gsort` — NOT
  `?group/?sort`, the page reads those as a group id / server order). List keeps its shipped seats (⇕ · field · ⇅ which now
  opens Show · Group by · Sort then +1 · Select… · File · Add ways); Map ⇅ Show · Group by + ＋ Add guest; Seats and March
  read the lens (`guests/_components/guests-lens.tsx`) and PORTAL their ThumbRow into the screen's `.lower` seat
  (`data-guests-thumb-slot`): Seats ⇕ (List) · Search (dims faces, Enter → fold open / table highlighted) · ⇅ Show + People
  · ＋ Add ▾ (the plan's 7 placeables); March ⇕ (fold all sections) · Search (dims chips) · ⇅ Show · ＋ Add a walk ▾ (tray
  names → shipped `planMove` out→gap). Rules moved into the Seats head ⋯. `GuestsSeatThumbRow` deleted. Guard
  `lib/guests-filter.test.ts` (sabotaged 3×). OPEN: Map ＋ returns against 2026-10-25's "no ＋" — the brief + v12 say so;
  owner DECISION_LOG row still to write.

- SLICE 4 part 1 (pushed): words wrap, never cut — Seats › List table names, the count tiles' words, the move sheet's
  guest name, the seat head's title (`lib/guests-words-are-never-cut.test.ts`, sabotaged once). The rest of slice 4
  (sticky group headers · header tap = select + toolbar Rename · ＋ Add guest here · second tap folds + unselects · the
  card loses its Group row) is NOT started.

- SLICE 4 (pushed, walked 390 WebKit · 1280 · 320, light + `html.dark`): List header tap = select (ringed chip) + open +
  toolbar above the thumb row (`guests/_components/section-head-toolbar.tsx`: name · count · ✕ / ✎ Rename in place ·
  ＋ Add guest here — one role = button, several = ▾). What a header offers = `lib/guest-section-head.ts` (Rename only via
  ONE shipped word: `renameRole` / `renameSection` / `editGuestGroupInPlace`; ＋ only where the name lands; celebrants,
  letters, replies but To invite keep the fold toggle). ＋ lays the group's picks on the box (`addPicks`) and the box says
  "Add to …". Second tap on the selected header = fold + unselect. The card's `CardRename` (Rename this role / section —
  RENAMES only) is gone; Role + Group PICKS stay. Seats › List table headers sticky in their scroller; March group
  headers sticky under the row in Guests; Seats/March now PIN the full row under the bar (`data-pinned`) so there is a row
  to stick under. Guard `lib/guest-section-head.test.ts` (sabotaged 3×). Shots `shots-2026-10-29/guests-build/s4b/` +
  `SBS-s4-*.png`. Known, left for slice 2: at 320 the List's pinned summary face collides with March/counts (shipped).
  NOT built: header select on Seats tables (no prototype toolbar for it).
- SLICE 5 (pushed, walked 390/1280/320 light+dark — `shots-2026-10-29/guests-build/s5`, `SBS-s5-*`): Guests › March —
  no LEFT/RIGHT; lone walker spans (`PairBox` flex, `hideEmpty = solo && !dragging && !carried`, the side grows back
  during a move); "· empty walk removed"; header tap = select + toolbar via `lens.HeadToolbar` (Rename = `lens.renameSection`
  · ＋ Walk ▾ from the tray, this group only · Delete = `planSectionOut`, not on fixed sides); second tap folds+unselects.
  ＋ Group NOT built (owner question: march groups are role sections; no "own group" in data). Guard
  `lib/march-groups-in-guests.test.ts`.
- SLICE 6 part 1 (pushed, walked 390/1280/320 light+dark — `s6/`): Guests › Seats 2D canvas frameless (`seating-editor.tsx`
  canvas border only `!inGuests`; 3D was already frameless via `inMaker`). The rounded outline still seen is the venue
  FLOOR (`scaledBox`) — confirm with the owner whether the floor's wall line stays (prototype draws the floor edge). Guard `lib/seats-in-guests-are-frameless.test.ts`.
  ### SLICE 6 — the rest, Rule 0 done (2026-10-29), NOT built
  E = `seating/_components/seating-editor.tsx`, L = `seating/lab/_components/seating-lab-3d.tsx` (3D room = lab page `?maker=1`).
  · (a) confirm sheet: swap = `tradeSeats` (E) → `swapSeats` (`seating/actions.ts`, RPC `swap_seat_assignments`); move =
    `moveGuestId`/`doMove`/`MoveGuestSheet` (seat-plan-phone.tsx, phone only). NO undo for a manual swap/move (only Auto
    arrange's `undoAutoRun`). NO "why here" helper: build pure `lib/seat-why.ts` from `guestTier`/`roleTier`/
    `ROLE_TIER_LABELS` (lib/seating.ts), group, `event_seating_constraints` keep_apart (`solveSeatPlan` violations),
    `locked`; suggestions from `lib/seat-suggest.ts` `suggestTableFor`. `event_seat_assignments` has NO placed_by — only
    `locked` (hand-placed); "auto vs you" needs owner + column. Undo = swap again.
  · (c) 3D gestures: drei `OrbitControls` in L (enabled guards `!draggingId && !draggingZone && !camBusy && !walking`);
    smallest delta `touches={{ONE: TOUCH.PAN, TWO: TOUCH.DOLLY_ROTATE}}` + a 2-finger vertical delta → polar (tilt).
  · (d) peek: no peek card exists; face tap → `tapFace` → `faceCard` → `GuestCardSheet` directly. Reuse
    `InspectorSheetAlone` (inspector-column.tsx; bottom < 701, right panel ≥ 701 — width only, no orientation query).
    No 3D chair tap exists yet.
  · (e) palette: L still hard-codes `#11131a #0c0e14 #13151c #2b2e37 #3a3d47 #d8b45a #d9534f #6f9b6a`;
    `lib/seating-3d.ts` (18 hex) and `lib/plan3d-room.ts` (8) too — add neutral/status tokens to `resolveRoomPalette`.
  · (f) stations: `event_floor_booths` + `BOOTH_CATALOG`/`boothTypeForVendorCategory`/`fetchBooths` (lib/seating.ts),
    `saveBooths` (validates `BOOKED_VENDOR_STATUSES`). NO per-service "takes a spot" field anywhere — needs
    `pnpm migration:new` (column on `service_categories` or `canonical_service_taxonomy`) + Admin › Categories toggle +
    Ugat/admin maps + DECISION_LOG row. Pipeline only, never a direct apply.
- Slice 1 follow-up (pushed): the makers take THE row from the lens (`lens.ThumbRow`) — importing `thumb-row.tsx` into
  details-march / seating-editor pulled its CSS module into the Maker's lazy pieces and broke ~10 render tests; march hooks
  sit above its `if (!anyone)` early return (eslint rules-of-hooks). Full unit suite 28,432/0 locally; CI typecheck ·
  eslint · unit · build green on cb2993ee45. Walk shots: `shots-2026-10-29/guests-build/{base,after,after2}` + `SBS-*.png`.

### Slice 2 notes for whoever picks it up (not started)
- The first row lives in `guests-screen.tsx` (`data-first-row`, `seg()` / `pinSeg()` / `PinnedSummary`, CSS `.stick` ·
  `.pinned[data-collapsed]` · `.face/.faceAlt` in guests-screen.module.css; guard `lib/the-pinned-row-is-one-row.test.ts`).
- Seats' mode lives in the seats editor (`SeatPlanModePick` in `StudioSeatPlanHead`, `onSelectView`, `studioView`) — to
  move it into the Guests first row, give the lens a REVERSE channel (seats registers `{ mode, setMode, show3D }`), not a
  second state. 📤 round waits for #7032 (slice 8) — draw no 📤 until then.
- PageMasthead is in `guests/page.tsx` (titleNode = "N guests"); v14 wants it sr-only.

## NEXT — CONTROLLER ORDER (2026-10-29, owner "Build as many as you can on the guests page"):
slice 5 (March) → 6 (Seats) → 2 (top row) → 7 → 9 → 10, one commit + push + HANDOVER each. (Older list below.)

## NEXT — in the controller's order (older)
1. ~~SLICE 1~~ DONE (above). Original note: thumb row on every view = shared `components/thumb-row.tsx`: ⇕ · Search guests · ⇅ ONE PickMenu (Show / Group
   by / Sort) = one filter state in the URL shared by carousel cards, List and Map · ＋ (Guests: Add guest; Seats: Add ▾
   Table·Stage·Dance floor·Supplier station·Entrance·Buffet·Sign; March: Add ▾ Walk·Group). Seats today: the bespoke
   `GuestsSeatThumbRow` (seat-plan-phone.tsx) — replace with ThumbRow. Search: reuse the List's `guestMatchesSearch`.
   Prototype: `renderThumb`, `filterSheet`, `setShow`, `goToGuest`.
2. SLICE 2 top row: segmented Guests · Seats · March (sliding pill) + mode ▾ (Guests: List·Map; Seats: List·2D·3D) + ⚙;
   pinned minimized form (View ▾ · page name · mode ▾ · ⚙); `?gview=map` → Guests › Map. The Seats mode PickMenu today
   lives in the seat head (`SeatPlanModePick`) — move it into the Guests first row.
3. SLICE 4 sticky group headers (List groups, Seats tables, March groups) under the pinned row.
4. SLICE 5 March edits (drop between rows = new walk; emptied walk removes itself; solo pill spans; header menu
   Rename · ＋Walk · ＋Group · Delete) — Rule 0 on the march tables first.
5. SLICE 6 Seats swap/move confirm with "why here" + tickable suggestions; 2D/3D full-bleed, no frame; 3D gestures.
   Check whether `event_seat_assignments` records who placed a seat BEFORE any column.
6. SLICE 7 seat rules = ordered checklist in ⚙ + Auto arrange confirm (follow-up PR per controller: needs stored rules).
7. SLICE 8 📤 Share round → "Share or print" sheet on PR #7032's engine (`lib/share-pdf.ts`) — only once #7032 merges.
Also queued (earlier notes): Requests inside Guests; remove Guests ⚙ › Invitations row; Replies open/close not showing in
the iPhone app (rows render in code — suspect the sheet does not scroll in the app shell; walk with UA + Capacitor stub).

## LATER OWNER RULES (prototype v14–v19, same file — fold into the slices above)
- v14 (slice 2): ONE menu for page + mode — the segmented Guests · Seats · March; tapping the SELECTED segment (small ▾)
  opens its modes; NO separate mode pill. Pinned row = LEFT the menu ("Guests · List ▾"), RIGHT the rounds (📤 Share ·
  ⚙), NO centre name. No visible title (PageMasthead sr-only). Fits 320: segment icons hide < 420, rounds 36 < 360.
  "With support to the other parts of guests": run every existing guests guard after each slice (Requests, Replies
  window, Invitations/send, check-in, claims, import, guest card, tours, honest reads).
- v15 (all views): guest names NEVER ellipsized — wrap to 2–3 lines (line-clamp 3, overflow-wrap:anywhere); march chip
  min-height 38, radius 19. Guard: no name element carries text-overflow:ellipsis / nowrap. ⚠ `SeatPlanModePick`,
  `ViewCountRow` labels and `seat-faces-list` titles use `truncate` today — names must not.
- v16 (slice 2): entering Map / Seats 2D-3D never jumps — scroll smoothly to the pin point; full row rises + fades
  (translateY(-12px) scale(.98)) while the pinned row rises from +12px, 0.3s cubic-bezier(.2,.8,.2,1); same on scroll
  past the pin point; respect prefers-reduced-motion.
- v17: full-screen views (Map, Seats 2D/3D) have NO help line under the canvas (the floating thumb row would cover it);
  help = one-time tip inside the canvas or an ⓘ. Check: no text box sits under the thumb row.
- v18: Map has NO own "Grouped by ▾" chip — Group by only in the thumb row's ⇅ (shared with List); Map keeps the
  "‹ All households" back chip. Slice-6 walk: a SIDE-wall entrance must lie ALONG the wall, inside the floor — check the
  2D engine's entrance snap for swapped length/thickness and half-length used instead of half-thickness.
- v19 (slice 6, may follow 7): Seats 2D + 3D show a station for EVERY booked supplier whose service takes a spot at the
  venue (band, DJ, photo booth, catering, bar, coordinator desk…). Qualification from the ONE taxonomy (Admin ›
  Categories) — find an existing per-service field first; else one switch there (pnpm migration:new, pipeline only;
  Ugat + admin maps). Auto-placed in free space, movable, not deletable while booked (toast why); 3D standing tag
  facing the camera; read in the page's one batched read. DECISION_LOG row for the ruling.
- v13 slice 8: 📤 Share round → "Share or print" sheet per view, on PR #7032's engine (`lib/share-pdf.ts`) only after it
  merges; reuse Studio › Prints' table signs / place cards / entrance chart builders.

## ⚠ THE BASE IS LIVE, NOT THE PROTOTYPE (owner correction, v23) — read before ANY visual slice
The prototype REDREW the guest rows and the carousel — do NOT copy those. Keep exactly as shipped: (a) the live guest
row (every label/chip/badge, row Share + Delete); (b) the live SnapCarousel cards (incl. Invite N › and +1s) — apply only
the one-count-height rule; (c) the live List thumb row ⇕ · ☑ Select · "Search or add" (the field adds a guest) · Sort/⇅,
and Select mode (✉ Invite N · Set ▾ · Remove · Done). No extra ＋ on Guests › List. 📤 in the top row = Share/print only.
Screenshot the live lab (`/dev/guests-lab?part=screen`) before each visual slice; side-by-sides must show the live
parts unchanged.

## MORE OWNER RULES (v20–v22)
- v20: 3D colours ONLY from the room palette (`lib/room-palette.ts` resolveRoomPalette → Lab3DPalette) — already so;
  never hard-code. Tapping a guest on Map / 2D / 3D shows a PEEK card (avatar · name · role · group · seat · Open);
  Open = the full guest card with Remove / Move-or-swap. Peek AND card: from the BOTTOM on a portrait phone, a RIGHT
  side panel in landscape and ≥1024 — one shared Sheet/side-panel rule.
- Group header tap (List groups, Map circles): select + open + toolbar Rename · ＋ Add guest here (lands in that
  group), Undo. v21: tapping the SELECTED header again folds it AND unselects (toolbar drops); ⇕ still independent.
- v22: REMOVE the group/role rename row from the shipped guest card (Rule 0: check whether it renames or assigns; remove
  only the rename); renaming lives on the header toolbar; port baseline regenerated with reason "moved to the group
  header toolbar".

## SLICES 9–11 (after 8, same branch, one commit + push + HANDOVER each)
9. 2D editing on the SHIPPED engine: venue Free (floor grows) or Fixed W×H (refuse outside); stage + dance floor
   corner-resize; entrances snap to an edge, lie along it, width handles, dotted walk path to a selected/searched seat;
   ＋ Add ▾ lands in free space (spiral search, no overlap); Duplicate; Link/Unlink as one unit; Type ▾ / Seats ▾
   refuse on overlap. Extend footprintsOverlap / Link / five types — never a second engine; columns via
   pnpm migration:new.
10. Map = the prototype's mind map (≤6 hubs on a ring + "Other households · N" drill-in, "‹ All households", couple
   centre, 36 px faces, same canvas controller as 2D, hold-drag a face to another circle, circle toolbar Rename ·
   ＋ Add guest here · Sit together ▾, fit on grouping change; grouping = the shared ⇅ Group by).
11. Requests inside Guests; remove the Guests ⚙ Invitations row (sendHref / SETTINGS_ROWS / pick-who / tour ripples);
   the iPhone-app "Replies open/close not showing" — walk with UA + window.Capacitor stub and fix the real cause.
Order 1 → 11. Ship nothing yourself.

## NAMES (owner, v24–v26)
- Everywhere a guest is named in Guests (list rows, March chips, peek, search results, guest card head, swap sheet): the
  FULL name (name_prefix + first + last, from the shipped name helper) with the nickname (`guests.display_name`, no new
  column) beside it in muted quotes; search matches the nickname too. Extend the ONE helper (Rule 0: lib/guest-title /
  `guestDisplayName` / `displayPersonName`); every surface reads it. Wrap to 3 lines, never ellipsize.
- v26: March — the two pills of one walk always share one height (row align-items: stretch, pill align-self: stretch,
  content centred); same anywhere two name pills sit side by side.
- After EACH green + walked slice: tell the controller with a check card (he batches to live); #7028 goes
  ready-for-review only when he says; slice 8 waits for #7032 (skip to 9, come back); report progress every 2 slices.

## How to prove a slice
Guard per property (+ one sabotage), port/Ugat/design-rules baselines regenerated (`pnpm port:baseline`,
`pnpm ugat:screens`, `pnpm --filter @setnayan/web design-rules:baseline --write`, `pnpm root-map --baseline`), all
`scripts/lint-*.mjs` + `lint-dup-rule.ts`; walk only via the walk lane (`heavy-lock.sh acquire walk:…`), lab
`/dev/guests-lab?part=screen&gview=seats|march` with dummy Supabase env; shots → `shots-2026-10-28/r4-seats-march/`.
