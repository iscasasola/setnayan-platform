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

## NEXT — in the controller's order (none started)
1. SLICE 1 thumb row on every view = shared `components/thumb-row.tsx`: ⇕ · Search guests · ⇅ ONE PickMenu (Show / Group
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

## How to prove a slice
Guard per property (+ one sabotage), port/Ugat/design-rules baselines regenerated (`pnpm port:baseline`,
`pnpm ugat:screens`, `pnpm --filter @setnayan/web design-rules:baseline --write`, `pnpm root-map --baseline`), all
`scripts/lint-*.mjs` + `lint-dup-rule.ts`; walk only via the walk lane (`heavy-lock.sh acquire walk:…`), lab
`/dev/guests-lab?part=screen&gview=seats|march` with dummy Supabase env; shots → `shots-2026-10-28/r4-seats-march/`.
