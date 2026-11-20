## 2026-11-21 · fix(thumb-row): the search icon sits dead centre, and tapping it grows the bar from the icon to the full row

Owner, 21 Nov, on the supplier dashboard: *"Search icon is not centered properly inside the circle"* · *"When search icon
is pressed. we want the search bar to animate from just the icon to the full width search bar"* · *"use fable to design
the animation"*.

- **Centred.** At rest the ✕ takes no width but kept its −6 px pull, so the 44 px round centred 10 px of contents and the
  magnifier sat 3 px right (measured on Today at 390). At rest it now pulls nothing: 0 px off in WebKit and Chromium.
- **Icon → full row, to Fable's drawing** (`prototypes/search_icon_grows_2026-11-21_fable.html`, build table copied 1:1 into
  `app/_components/search-grows.ts`). The 18 Nov move scaled the pill (scaleX), stretching the round's radius and ring
  into an oval, and Show just vanished. Now the pill's real width grows 44 → the row on Move 320 · Spring (overshoot
  capped at 8 px), the magnifier holds its place on the pill's curve, the words wait Tap 100 then fade in, Show gives way
  (fade, 6 px, .9) and returns 100 ms into the fold; the fold is Quick 200 · Settle. Reduced motion: at once.
- It is the ONE shared row, so every list's search (Today, Clients, Guests, Find…) gets the same move.
- `/dev/thumb-row-lab?screen=today` walks the supplier's Today row with no sign-in (dev only).

Guard `lib/search-grows-is-one-shared-part.test.ts` test 1 rewritten from "transform only (scaleX)" to the new contract
(width grows, never scaleX, 8 px cap, centred at rest) — the 18 Nov drawing it pinned is replaced by the owner's 21 Nov ask.
Sabotage-checked three ways.

SPEC IMPACT: `MOTION_STANDARD_2026-11-18.md` § 4 #11 (row field) — the search grows by width, not scale; the drawing is
`prototypes/search_icon_grows_2026-11-21_fable.html`.
