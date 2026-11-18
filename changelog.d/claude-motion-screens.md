## 2026-11-18 · feat(motion): the motion standard, Phase 3 — screens & bars (Slide · Push · the full-screen map · Highlight 0.7 s · Tuck)

Owner, 18 Nov: *"build it now. align it to all our designs and upcoming designs"*. Source: specs
`MOTION_STANDARD_2026-11-18.md` §§ 5, 7, 9, 11 (Phase 3) + prototype `motion_standard_2026-11-18_fable.html` Parts C, E, F.
Everything is on the shipped shared parts, read from the Phase 1 tokens (`lib/motion-table.ts` ↔ `--sn-m-*`); no new
opener, no raw timing. Stacked on `claude/motion-grow` (Phase 1).

- **Highlight — the bottom nav at 0.7 s on the Spring** (owner: *"move bottom nav to 0.7s"*). Through the bar's owner
  path: the central knob `--bn-dur` reads `--sn-m-rise` and the pill travels on `--sn-m-spring`;
  `scripts/lint-bottom-nav.mjs` now REQUIRES both. `nav-pill-travel` / `nav-press-flash` read the same knob.
- **Slide** (bottom-bar tabs): `sn-page` runs Move on Settle; the old page travels 30 % and dims
  (`sn-vt-page-out-left/right`), the new one comes the full width. The bar-set slide keeps its full-width pair.
- **Enter + Push** (the four `template.tsx` shells): `.sn-page-enter` is Move on Settle, fill `backwards` (never
  `both`). A page DEEPER in its section arrives from the right, its Back from the left: `NavSlideController` only
  notes the tap / the phone's Back (`html[data-sn-push]`, `pushDir` in `lib/nav-slide.ts`) — it never stops a link.
  First load, a tab and a sideways link keep Enter; a tab's slide and an open chat thread still switch it off.
- **The full-screen map, as named options of the ONE opener** — `RiseScreen kind=…` (`FULL_SCREEN_MAP`,
  `riseScreenMotion(…, kind)` in `lib/rise-screen.ts`; `RiseRoute` hands it through):
  `stack` (fill in / edit — slides up on the Spring) · `zoom` (a whole tool — grows from 0.92, fading) · `picture`
  (anything with a photo — the photo flies in Rise 700, the card rises 80 ms later; mark the picture
  `data-rise-photo`) · absent = the 13 Nov `grow`. Every kind keeps the 13 Nov details (page behind 0.96 + dim, three
  content steps, chrome last, close mirrored at 80 %); reduced motion is the 120 ms fade.
  Classified so far: Discover Filters, the offer maker, the bundle maker, the risen Settings page → `stack`; the risen
  YourPage → `zoom`. Every other `RiseScreen` still grows until someone names its kind.
- **Picture leads, card → its page:** a link marked `data-picture-leads` and a page picture marked
  `data-picture-hero` share one view-transition name (`sn-picture`) while the one listener runs it — Rise on Settle.
  Opt-in per link; nothing wears the mark yet.
- **Side peek** (a person's card — `InspectorSheet`): the whole panel slides in from the right, Move on the Spring;
  the strip of list stays a button; the close slides back out at 80 % before the card unmounts (`playPeekOut`),
  holding no transform.
- **Tuck** (owner: *"thumb row and compressed row stays"* · *"when bottom and top nav appears, the thumb row and
  compressed pin rows adjust as well"*): `use-hide-on-scroll.ts` is still the ONE reading (`tuckNext`, pure) and now
  writes `html[data-tuck]`. On a phone the top bar tucks away, the bottom nav SHRINKS to a small floating pill wearing
  the lit tab's icon (one tap opens the bar), the floating thumb row comes down onto the pill's row beside it
  (`data-tuck-row`), and the pinned 44-px row rides up with the bar (`CollapsingTop.ride`). Away: Move on the Spring;
  back: Quick on Settle; reduced motion: at once. Rules: near the top everything shows · the page's end brings it back ·
  a page too short to scroll never tucks · never started while a sheet, an Undo toast or a busy save is up · the
  keyboard rule is untouched.
- **Lab:** `/dev/motion-screens-lab` — every motion above on the shipped parts, no sign-in, no database.
- **Guards** (each sabotaged red once, then restored): `the-full-screen-map-is-the-standard` ·
  `the-nav-highlight-is-0-7s` · `tuck-keeps-the-rows` · `the-screens-move-by-the-standard`; re-anchored
  `one-tab-slide-everywhere` (tokens), `the-rise-screen-is-one-full-screen` (kind), `the-motion-table-is-one` (a slice
  whose end anchor was a stripped comment), `an-identity-transform-unpins-every-fixed-child` (the Enter's token).
  `scripts/motion-raw.baseline.json` shrank (front-door.css, bottom-nav.tsx, globals.css).
- **Not changed:** the couple's Event Hub motion (`lib/motion.ts`, `.sn-editorial`); Unfold and everything Phase 2
  owns (press, sheet, toasts, swipe, busy, row field, count, shake, the top-bar search); the public front door's bar,
  which stays put by its own earlier ruling.

SPEC IMPACT: None
