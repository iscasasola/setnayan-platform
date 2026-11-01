## 2026-10-30 · fix(seating-3d): full screen no longer hands the room to iOS's native full screen; the 3D room is view-only

Owner, iPhone app, after #7057: *"3d crashed again. when i tried to press the full screen icon. also the other icons are
eating up the space. the floating menus there needs fixing"* → *"let's make 3d become view only because all are plottend
on the 2d"* → on accents, *"these doesn't need placement. just activate and its there"*.

- **The crash path.** The ⤢ called `requestFullscreen` on the room's wrapper. iPhone Safari has no element Fullscreen API
  (the button did nothing there), but the installed app's web view has it ON — Capacitor 8.4.3 `CAPBridgeViewController`
  sets `preferences.isElementFullscreenEnabled = true` — so in the app the press handed the live WebGL room to WebKit's
  NATIVE element full screen (seen in a Simulator WKWebView configured the same way: "localhost is in full screen. Swipe
  down to exit."). On a phone the press is now an IN-PAGE full screen: the same element grown to the viewport, the same
  Canvas and WebGL context, the capped DPR (`canvasDpr`) and 'low' tier unchanged. Computers keep the Fullscreen API.
  The shell is hidden while it lasts (`html[data-room-fullscreen]`; the iOS web view clipped and over-painted the grown
  room until its ancestors stopped clipping — measured in the Simulator).
- **The room is view-only.** No seat-plan lock, no Build panel, no table / chair / zone gesture, no drop bubble, no
  rules/floor/publish panels (`seating-lab-3d.tsx` 6,089 → ~3,250 lines). What stays is for looking: orbit/zoom, ▶ Play
  (walk everyone in, sit down, walk around, say hi), a `Show ▾` dropdown (tablecloths, centrepieces, the colour peek), the
  booth card, an ⓘ ("Editing happens in 2D" + Switch to 2D, the legend, Print pack, Entrance seating chart) and ⤢ — one
  row in the thumb zone, as the approved Guests prototype draws its 3D (nothing over the room).
- **Accents** — a sheet (from the room's ✨ or the 2D ⋯ › 3D room › Accents…): one row per accent the room draws, a switch
  and one style dropdown; booked-supplier offers (Add it / No thanks) on top. Same `saveReceptionDesign` (with its base)
  and `dismissRoomSuggestion`, same supplier-agreed freeze.
- **The Reception Designer is retired** (`reception-design-editor.tsx` deleted — the Ugat both-ends check caught it
  mounted nowhere). Every choice it edited has a row in the Accents sheet: the room-drawn accents under "In the 3D
  room", every other reception choice (stage setup, linens, chairs, feast, program, booths, who is in the concept
  image…) under "For your concept and suppliers"; the couple's inspiration photo under its zone (reference only), the
  "The 3D room draws X" disclosure for a combination, and WHO + WHEN on a supplier-agreed zone all came along. One funnel
  (`choose()`) refuses a frozen zone, the cap and a "nothing here" collision. Guards repointed to the sheet:
  `the-3d-plan-locks-what-the-supplier-agreed`, `the-reference-photo-belongs-to-the-zone`, `the-room-offers-what-you-booked`,
  `the-room-says-what-it-is-not-showing`, `the-room-seats-your-guest-list`, `two-hosts-every-writer-sends-its-base`;
  to the 2D switch: `a-published-plan-can-be-taken-down`; to "no lock / no floor write": `the-seat-plan-moves-into-details`,
  `two-hosts-round-3-writers`; to the page's attire chain: `the-room-reads-the-resolved-board`; to the ⓘ legend:
  `the-room-draws-what-the-couple-saved`; the phone dock's handlers: `the-seat-plan-table-sheet-wears-the-templates`.
- **Moved to 2D** (controller calls under the ruling): "Swap with another table…" (table ⋯ / phone dock → confirm →
  `swapTableOccupants`); "Show supplier suggestions in 3D" (seat settings, `setGhostBoothsEnabled`, flag-gated); the
  per-category × of the ghost booths is gone.
- **Live refresh:** one Realtime topic per subscriber — the 2D plan and the (now always view-only) room both subscribe,
  and supabase-js hands back the same channel for a repeated topic, which threw and dropped Guests › Seats to the error
  screen whenever both were view-only.
- Lab: `/dev/guests-lab?part=screen&gview=seats&seat=3d&big=1` draws the shipped room on a synthetic 25-table / 230-guest
  plan. Guards: `lib/phone-gpu-budget.test.ts` test 5 (full screen = same Canvas, no API on a phone, no portal, no
  full-screen state in the Canvas key/dpr) and `seating/lab/_components/room-is-view-only.test.ts`.

SPEC IMPACT: DECISION_LOG row "3D SEAT ROOM IS VIEW-ONLY; ACCENTS ARE SWITCHED, NOT PLACED; FULL SCREEN IS IN-PAGE ON A
PHONE" (2026-10-30) in the corpus.
