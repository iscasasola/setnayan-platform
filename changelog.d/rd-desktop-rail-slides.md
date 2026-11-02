## 2026-10-23 · feat(nav): on a desktop the side menu swaps with the bar's slide (account ↔ shop ↔ event)

Owner, 23 Oct 2026 (DECISION_LOG "OWNER ANSWERS ON THE BUILD TRACKER", Q1 of
`prototypes/desktop_layouts_2026-10-22.html`): *inside an event or a shop the side menu **swaps with a slide** — one
rule with the bottom bar.*

- **The swap was already shipped** (2026-09-21, `rail-focus.ts`): inside an event the rail is the event's menu under
  one "Events" row; inside the shop it is the shop's four under one "My Home" row. What it lacked was the motion — on
  a desktop the rail changed set instantly while the phone's bar (#6772) built out and in.
- **Now the rail moves by the bar's rule.** `BarSetSlide` (the #6772 listener, already mounted at every width because
  `<BottomDock>` is hidden by CSS, not unmounted) asks one more thing: is the side menu drawn as a column? If so, a
  press that changes the set runs the same View Transition, and globals.css names `.fd-rail` `sn-rail` for its length
  only. account → Shop: the rail's rows leave to the left and the shop's arrive from the right; account → an event:
  out to the right, in from the left; the way back mirrors it. The same keyframes, 280 ms and easing as the bar; the
  page slides with it; the top bar holds still. Inside one set nothing changes.
- **The phone is untouched by construction**: the name needs `data-sn-bar-dir` (only set during a set slide) and
  excludes the phone's open/closing drawer; a shut rail (`display: none`) is never captured. Reduced motion → no slide.
- `lib/bar-set.ts` `barSlideFor` takes `railShown` in place of `tabletUp` — a slide needs a bar OR a rail on screen.
  The old "from 701 an event change never slides" rule is gone: there the strip is the thing that slides.
- `/dev/bar-lab` now swaps the rail on its shop and event pages exactly as the layouts do (focus + the section's own
  rows), so the desktop slide can be walked without a sign-in.
- Guards: `lib/bar-set.test.ts` — the rail's direction from the press to the keyframe on the five real presses, the
  same keyframes/duration/easing as the bar (read from the stylesheet), a frozen clipped group, reduced motion, and
  the phone exclusion (name only under `data-sn-bar-dir`, never on the open/closing drawer, the listener asking the
  same question of the real rail).

SPEC IMPACT: None — implements the 2026-10-23 DECISION_LOG row (Q1) already in the corpus.
