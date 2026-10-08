## 2026-10-08 · feat(ui): segmented selectors are pills that slide — one shared template

Owner, verbatim (2026-10-08, DECISION_LOG "SELECTORS ARE PILLS THAT SLIDE"),
selecting the Maker's Stages | Studio, its tool group and its
Look | Background | Arrange: *"i like this pill type instead of the rounded edges
selector"* · *"and make them animate"* · *"apply the same pill selector"* ·
*"adjust all pill selectors to this if possible"*. Rule:
`BACKGROUND_SOURCES_AMEND_2026-10-08_fable.md` § 2.E; template:
`INTERACTION_RULES.md` § 9.

- **The template — `app/_components/pill-selector.tsx`** (+ its thumb,
  `pill-thumb.tsx`): a full pill track (3 px of padding, 44 px tall on a phone),
  each choice a pill inside it, and ONE thumb that travels to the choice picked
  and resizes to its label — transform and size only, 220 ms on the house ease,
  instant under "reduce motion". Buttons or links, 2–5 choices of unequal width,
  an icon-only variant, any fill of the caller's own, an opt-out for a row of
  toggles. No Maker import, no Maker token; no timer, no dependency.
- **First paint is already right.** Until the thumb has measured, the picked
  choice paints the pill itself; the thumb then takes over in place (laid with
  no transition — it never slides in from the left) and follows a pick and a
  resize. It loads after first paint: no measuring code in a first load.
- **Keys:** ← → (↑ ↓, Home, End) move focus between the choices and wrap;
  Enter and Space press, as buttons do. `aria` is as it was (a named group of
  pressed-or-not buttons; `aria-current="page"` for links).
- **Drawn through it today (the Maker):** `ISegmented` / `ISeg`
  (Stages | Studio, Look's Background · Elements · Music, and the inspectors'
  other section switches), `Phases` (Look | Background | Arrange ·
  Build in | Action | Build out) and the Stages tool group
  (Style · Text · Animate — the dark face now travels; the hairline beside the
  picked tool fades). The fills are the ones each had. Bold · Italic · Underline
  keeps the pill look and opts out of the thumb (several may be on).
- **The watch:** in the areas listed in `PILL_WATCH_SCOPE` (the Maker today) no
  file draws a segmented track by hand; two tracks older than the template are
  named on a baseline that only shrinks.

Guard: `lib/selectors-are-pills-that-slide.test.ts` (8 tests; the thumb is RUN
against a stand-in track). 24 sabotages seen red.

SPEC IMPACT: None beyond the rule and the template above.
