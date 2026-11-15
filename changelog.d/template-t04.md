## 2026-11-13 · style(supplier): batch T04 onto the approved design template

Owner: every supplier dashboard page onto the approved template (`Setnayan-specs/prototypes/design_template_sheet_2026-11-14_fable.html`,
15 rules), batch T04 of `design_template_full_audit_2026-11-14.md`. 44 of the batch's 51 files; the other 7 are being
edited by open PRs and were skipped (listed in the PR).

- `/vendor-dashboard/on-the-day/live/[eventId]` and its panels (floor command, song desk, sets, stage script, scanners,
  requests, reviews): cards → hairline sections with grey capitals labels; hand-made buttons → `ActionButton`
  (44 px floor, `waiting` instead of spinners); `<select>` → `PickMenu`; status chips → `Badge`; explanations →
  `InfoTip`; faded ink, 9–11 px words, typewriter money, raw palette colours and hex codes → tokens; motion → named
  `sn-*` speeds; loading → shimmer. The couple's Announce door (shared) restyled with the same behaviour.
- `/vendor-dashboard/profile`'s shop cards (public line, reach map, correction request, radius, venue match/type,
  visibility, deep search, branch pin map) and the service editor's surfaces (customization step, payment schedule,
  card checks, halls uses): same rules. Every fact and action kept; long explanations moved behind ⓘ.
- Audit scanner over the 44 files: 499 → 33 hits, each remaining one kept on purpose (map tiles, plain one-line empty
  states inside panels, live instructions) — itemised in the PR.
- Baselines regenerated, never hand-edited: `port-control-baseline.json` (the live page no longer draws the
  Console* plate/heading/eyebrow) and `label-contrast-dark.baseline.json` (5 dark pairs fixed).

SPEC IMPACT: None — implements the approved template; no decision changed.
