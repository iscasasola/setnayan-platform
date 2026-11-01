## 2026-10-31 · fix(maker): the Event Hub editor stands above the bottom nav and under the top bar — never over either

Owner, live iPhone app, editing the Invitation's TOP LINE: *"bottom nav of event hub is not fixed"* — the app's top bar
gone with an empty band where it stood, and the bottom nav showing its labels only, its icons under the editing toolbar.
Reproduced in `/dev/maker-lab` at 390 × 844 (WebKit with touch, and Chromium with a 34-px home-indicator inset).

- **The bottom nav was covered, two ways** (`MAKER_IN_THE_APP_CSS` + `useTheAppsRoom`, slice 1 of Event Hub Pro). The
  shell ended the home indicator's height BELOW the nav's top, reasoning that the strip its tools' safe-area padding
  leaves would lie "under the nav's own padding" — but the nav's padding is at its foot, so the strip was the nav's TOP,
  its icons, under the z-40 shell (measured: all five icons covered at an inset of 34). And a `fixed` phone tool is
  placed from the screen's foot, not the shell's (the shell is no containing block), so the toolbar's rows
  (`bottom: max(10px, env(…))`) and a lower-third tool (`env(…) + 4px`) stood on the nav on every phone (measured:
  Animate's rows 624–834 over the nav at 780–844). Now the shell ends ON the nav's top (its whole measured height), and
  says `--maker-safe-b` (the home-indicator room the Maker keeps itself: 0 above the nav) for what stands in it — the
  lower third, the Studio room, the guests' bar, the scene bin, "Done · back to" — and `--maker-lift` (the nav's lift)
  for every `fixed` tool: `MAKER_LT_TOOL`, the toolbar's four FOOT rules, the scene picker. With no nav (from 701, ▶ held,
  the keyboard up) both fall back to exactly what was there.
- **The top bar rode off.** The Maker's scroll lock (`overflow:hidden`) stopped a finger, not a script: a
  `scrollIntoView` inside the Maker (the scene strip's tile on arrival) scrolled the document — taller than the screen
  by the bar's height — and the bar, sticky to a `<body>` that `overflow:hidden` made its scroller, rode up with it
  (measured: scrollY 39, the bar's foot at 12, the shell's top at 51). The document is now the screen's height while the
  Maker is open, so there is nothing to scroll; the bar stays.

Guard: `lib/the-hub-is-left-by-the-apps-nav.test.ts` 4 (the shell ends on the nav's top; no in-shell sum on the lower
third's height uses the raw inset; every fixed phone tool placed from the screen's foot lifts — count printed) and 5 (the
document is the screen's height). Sabotaged five ways, each red. Re-anchored on the new strings (logic unchanged):
the-maker-keeps-the-page-on-a-phone, the-toolbar-is-four-rows, style-is-cards-colour-and-size,
the-rsvp-tools-stand-in-the-four-rows, the-rsvp-stage-is-parts, a-scene-is-dragged-on-the-page.

Not changed: `maker-sheet.tsx`'s `fixed bottom-0` half sheet and slim bar — drawn only OUTSIDE the Maker (inside it the
same sheet returns early as a `MAKER_LT_TOOL`, which now lifts).

SPEC IMPACT: None — restores the 2026-10-30 row ("THE APP'S NAV STAYS"; tools in the lower third, above the nav) as
ruled; no new ruling.
