## 2026-09-26 · fix(event-hub): drop the chapter numbers, and a free background colour paints

Two owner rulings (2026-09-25, DECISION_LOG "OWNER ANSWERS — SIX CONTROLLER
QUESTIONS"):

- **"okay drop the numbers"** — the guest Event Hub sections (schedule, dress
  code, entourage, RSVP, our story, our photos, the details, the masthead)
  carried hard-coded "№ 04 / № 05 / № 08" chapter labels. Hiding a section left
  a gap in the numbered sequence. Removed the numeral from every eyebrow;
  each section keeps its title alone. `pahina-masthead.tsx` also drops its now
  unused `chapterNo` prop, and renders no eyebrow row at all (rather than a
  bare, unlabelled numeral) for the solemn register.
- **"fix it"** — a free couple's saved `site_bg_color` was painted for guests
  only when the event owned active Website Pro (`proSiteVarsFor` gated the
  whole bag on `proWatermarkHidden`). Background colour is FREE (Event Hub Pro
  feature list: "Free: … bg colour"); button colour, the couple's font, and
  (elsewhere) Candlelight/face/magic-move stay Pro-only. Text colour now also
  adapts to the couple's own background (`lib/hub-legibility.ts`'s already-
  shipped flat-colour rule, ruled free for everyone the same day) — previously
  `--color-ink` stayed a fixed espresso regardless of how dark a couple's own
  background was. `proSiteVarsFor` moved to a new, pure
  `app/[slug]/_lib/pro-site-vars.ts` module so this is directly unit-testable
  without `loaders.ts`'s own request-scoped import graph.
  - Found by screenshotting the fix at 375×812/390×844 before shipping it: once
    the page ink adapts, `.pahina-plate` (the "When/Where" box, the reply
    card) fell back to that SAME adapted ink through `color: rgb(var(
    --color-ink-on-plate, var(--color-ink)))` — but a plate keeps its own
    still-light paper regardless of the page, so its "WHEN"/"WHERE" value went
    light-on-light and vanished. Fixed two ways: `proSiteVarsFor` now pins
    `--color-ink-on-plate` to the theme's own dark ink (decoupled from the
    adapted page ink), and `.pahina-plate`/`.pahina-deckle` in `globals.css`
    now shadow `--color-ink` itself for their subtree, so the many widgets
    that paint plate content with the `text-ink` UTILITY (not by inheriting
    this rule's `color:`) pick up the pinned value too.

Guards added: `app/[slug]/_lib/no-chapter-numerals.test.ts` (sweeps
`app/[slug]` + `lib` for the № numero sign outside a comment) and
`app/[slug]/_lib/free-bg-colour-paints.test.ts` (the free/Pro colour-gating
property, the adapted body-ink contrast property, and the pinned plate-ink
property).

SPEC IMPACT: None — both are corrections to already-shipped behaviour, not a
new feature; no schema or spec-corpus change.
