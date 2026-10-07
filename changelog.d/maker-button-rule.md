## 2026-10-07 · feat(ui): the button rule — ActionButton · Count · Fill · tone tokens (phase 1 of the Maker sweep)

Owner, verbatim: *"add the button rule to the builds for tonight"* (corpus
`BUTTON_RULE_2026-10-07_fable.md`; this is also the Suppliers plan's "PR0 ·
Foundation", built once and shared).

- `components/action-button.tsx` — `<ActionButton tone icon label main quiet href|onClick disabled>`:
  a 40 px pill, icon + `<span class="lbl">` word, `aria-label` = the word; `tone`
  REQUIRED (`brand` · `ok` · `info` · `warn` · `danger` · `neutral`); `main` filled
  with a white word, the rest the tone on a 9% `color-mix` wash. `useFitRow(ref)`
  follows the owner's 3a/3b rulings (2026-10-07): a row changes state AS ONE —
  icon + word → word only → icon only, never a mix (the main verb keeps its word)
  — and a text field in the row keeps ≥ 60% of its width (the buttons give);
  re-runs on resize and on child changes; the row is made `min-width: 0` so the
  measure is honest.
- `components/count.tsx` — `<Count value format="peso|int|pct" id>` counts 0 → value
  on load and old → new on change (420–900 ms ease-out, formatted every frame,
  keyed by `id` so a re-render does not replay; reduced motion = at once) and
  `<Fill value id>` grows / slides a bar (700 ms, `.meter-fill`). The shipped
  `CountUp` (`app/_components/count-up.tsx`) now runs on the same engine
  (`useCountTo`) — one implementation, same behaviour.
- `globals.css` — tone rules are element + base class + tone
  (`:is(button, a).ab.ab-brand`), never a bare tone class — the specificity slip
  that turned every prototype tone ink cannot recur; `--color-ok` / `--color-warn` / `--color-danger` light + dark with
  measured AA numbers; `--color-info` REUSES `--color-link` (the doc's open owner
  call). Two of the doc's suggested hexes failed AA and were darkened: warn
  #B26B00 → #965A00 (4.20 → 5.59 on white), ok #2E7D4F → #2B744A (4.48 → 5.00 on
  its own tint). The outlined brand word uses `--color-mulberry-700` (mulberry
  itself is 4.22 on its tint).
- Guards: `lib/action-button-is-icon-and-word.test.ts`,
  `lib/count-animates-only-on-change.test.ts`, `lib/every-action-is-a-button.test.ts`
  (the Maker call-site sweep; scope grows in phase 2). In `lib/`, not `tests/`,
  because `test:unit` never runs `apps/web/tests/*.test.ts`.

No page changes in phase 1. Phase 2 (the Maker sweep) follows the Studio redraw.

SPEC IMPACT: `BUTTON_RULE_2026-10-07_fable.md` colour table — warn and ok hexes
darkened for AA, info = `--color-link` (reuse), tone name `brand` (not `primary`).
Recorded in the corpus DECISION_LOG on this date.
