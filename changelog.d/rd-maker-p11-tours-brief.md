## 2026-09-25 · fix(tours): the shared tour carousel wears the house style

Event Hub Maker Phase 11. `app/_components/guided-tour.tsx` — the generic tour
carousel every role welcome (`couple_welcome_v1`, `admin_welcome_v1`,
`guest_welcome_v1`, `vendor_welcome_v1`) and mini-tour (including the three
shipped customer tours: `customer_papic_v1`, `customer_love_story_v1`,
`customer_event_hub_maker_v1`) renders through — is restyled to match the
2026-09-24 design brief, mirroring the skin `maker-tour.tsx` already wears:

- No bordered card. Dropped `border border-ink/10 bg-cream`; the dialog is now
  `.sn-glass-bare` (borderless glass, seated by `--sn-sh-float`) + shadow.
  `lint:no-card`'s baseline for this file drops from 1 line to 0
  (`scripts/no-card.baseline.txt` regenerated — one other file,
  `website/editor/_components/editor-shell.tsx`, had also fallen below its
  baseline from an earlier change and is locked in by the same regen).
- Motion moved onto the `--sn-*` tokens: `duration-sn-control`/`duration-sn-elem`
  + `ease-sn` for every hover/press/progress transition, and the per-slide
  entrance now runs the shared `sn-peek-in` keyframe.
- `InfoTip` now carries the tour's `blurb` (already authored per-tour in
  `lib/tours.ts`, never rendered anywhere before this) behind the `(i)` beside
  the "Step N of M" label — secondary detail hidden per the brief's tooltip-
  enclosure rule, instead of a second always-on line.

No slide contract changed: `TourSlide`/`TourDefinition` in `lib/tours.ts` are
untouched, `{current.title}` still renders as text and
`dangerouslySetInnerHTML={{ __html: current.body }}` still renders the body as
HTML — both assumptions `lib/tour-titles-are-text.test.ts` pins, and it still
passes. `mini-tour.tsx` needed no change: it is a server-only loader with no
markup of its own.

SPEC IMPACT: None — visual/motion restyle of shipped chrome, no copy, schema,
or SKU change.
