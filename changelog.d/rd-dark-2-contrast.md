## 2026-10-13 · feat(lint): the contrast check reads dark too — with its own ratchet (dark mode PR 2)

Owner, 2026-10-13, "approve all" (DECISION_LOG "HOW DARK MODE IS TURNED ON"): after the tokens, the
dark contrast check, before the switch.

- `lint:contrast` (`apps/web/scripts/lint-label-on-fill-contrast.mjs`, required in CI) was light-only
  by construction: it read the first definition of each token (the light one) and stripped `dark:`
  classes. It now judges every pairing **a second time, as dark resolves it** — the `html.dark` /
  `html.dark .fd` token blocks layered over the light ones, a bare `dark:bg-…` / `dark:text-…`
  replacing its base class, and an `html.dark <selector>` rule replacing that selector's own fill
  and label. The guest Event Hub (`app/[slug]`, Hub-scoped CSS) is not judged in dark — dark never
  reaches it (owner call 5).
- **Light is untouched:** the same 1,754 pairings, all ≥ 4.5:1, still blocking with no baseline;
  `label-contrast.baseline.txt` and `guest-faint-ink.baseline.json` are byte-identical.
- **Dark ratchet** `apps/web/scripts/label-contrast-dark.baseline.json`: 1,680 pairings checked, 321
  under 4.5:1 in 238 `file · pair` keys (couple dashboard 133, admin 75, supplier 43, shared 29 …) —
  the area PRs' to-do list. A new pair or a grown count fails; a fixed one fails until recorded;
  `--write-baseline` **refuses to raise any count** (only `--allow-dark-growth`, reviewed, can).
- Sabotaged: a new `bg-success-600 text-white` (passes light, 3.18 in dark) → red; `--write-baseline`
  with it → refused, nothing written; a `dark:text-ink` fix on a recorded pair → red until recorded;
  the dark `--color-ink` set to the page colour → 187 new failures, red.

SPEC IMPACT: None — implements the 2026-10-13 ruling already in the corpus DECISION_LOG.
