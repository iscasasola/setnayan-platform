## 2026-09-29 · feat(maker): per-letter styles in every scene, and they adapt when the words change

Two owner rulings, one mechanism.

**1 · A letter or a word in its own font · colour · size — beyond the hero.** Until
now a run (#6029) reached the hero's parts only: `HUB_ELEMENT_RUN_KEYS` left out a
scene's label · heading · words because widgets stay ignorant of the canvas
(`every-widget-is-one-section.test.ts`), so no server render could cut spans into
them. They are in now, through the SAME run data (`runs` · `of`), the SAME
segmenter (`hubTextSegments`) and the SAME `<span data-el-run>`:

- the scene's runs ride on its existing scoped `<style data-hub-els>` as
  `data-hub-runs` (`hubSceneRunsAttr`, `HubCanvasFrame`); an untouched scene's
  markup is byte-identical;
- `HubSceneRuns` (mounted by `SiteBody` only when a scene has a run) cuts them in
  after hydration (`app/[slug]/_components/part-runs.ts` — the hero preview's cutter
  moved here, one cutter for both). Fail-visible: with no script the words show
  whole, in the part's own look;
- a scene key addresses every heading/paragraph, so the runs land on the ONE part
  whose words they were made on (`hubRunsTarget`);
- the Maker canvas lays the same cut on every choice and every keystroke in the
  Content box. ⛔ Never on the RSVP form.

**2 · Styles ADAPT when the words change** (DECISION_LOG 2026-09-28 "DETAILS IS THE
ONE FILL-IN AREA…", answer 2). New pure function `adaptHubRuns`
(`lib/element-runs-adapt.ts`): diff by user-perceived character (grapheme — emoji,
flags, skin tones, decomposed ñ are one character), case- and whitespace-folded;
fewest-pieces LCS plus a stray-match cleanup, so kept letters keep their style,
inserted ones are plain (a run splits around them), deleted ones drop theirs, and
a replaced word leaves no borrowed letter styled. A run now stores the text it was
made on (`HubElementStyle.was`, ≤ 400 chars, kept only while it hashes to `of`).

- Applied at the ONE place a run meets its words — `hubRunsOn`, read by the guest
  render (hero server-side, scenes in the browser), the canvas preview and the
  sheet — so an edit from ANY writer (Details, in place, account sync) adapts.
- And at the save: `withRunChoice` / `withoutRuns` re-anchor the older runs onto
  the words the selection was measured on (the canvas now sends `whole` with a
  selection) instead of dropping them.
- A run made before `was` existed still drops on changed words, as it did.

Pro gating unchanged: a run's font is Event Hub Pro at Apply (◆, try-then-pay),
colour and size free — now for scene runs too.

Tests: `lib/element-runs-adapt.test.ts` (36 — insert/delete/replace/case/whitespace/
emoji/flags/skin tone/ñ composed+decomposed/large edits/stray letters, plus
`hubRunsOn`, the save path, the sanitizer, `hubRunsTarget`),
`app/[slug]/_components/part-runs.test.ts` (13 — the frame, a real widget, two
headings, adapted words, idempotent cuts, the canvas, wiring, Pro). Updated
`one-letter-and-its-own-motion.test.ts` (R2 adapts when `was` is known) and
`free-vs-pro-redrawn.test.ts` (`was` is structure, like `of`).

SPEC IMPACT: None — implements DECISION_LOG 2026-09-28 "DETAILS IS THE ONE FILL-IN
AREA…" answer (2) and extends the 2026-09-27 per-letter ruling to scenes; no new
decision.
