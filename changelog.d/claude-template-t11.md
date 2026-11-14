## 2026-11-14 · style(maker): T11 — the Event Hub Maker's Details, guided flow, march, prints and sheets follow the design template

Batch T11 of `design_template_full_audit_2026-11-14.md` (Setnayan-specs). Every fact and action kept; shared pieces only
(`ActionButton`, `InfoTip`, `Badge`, `SwitchTrack`). 21 of the batch's 73 files are left to #7605 (the "Event Pro" copy
PR), which already edits them — `launch/page.tsx`, `std-media-picker.tsx`, `maker-theme-picker.tsx`, `maker-shell.tsx`,
`maker-context.tsx`, `maker-details.tsx`, `details-your-event*.tsx`, `hub-pro-offer.tsx`, `pro-quiet-line.tsx`,
`maker-made-once.tsx`, `maker-prints.tsx`, `print-save-button.tsx`, `studio-prints-{carousel,settings,six}.tsx`,
`studio-tools.tsx` and `stage-panel/{cover-words-background,stage-animate,stage-background}.tsx`.

- **Type** — no 9–11 px words (12 px floor), no ink below 70 % on words, no typewriter face on labels or the colour
  value, serif/display headings and sheet titles are the sans semibold title (rules 1 · 13).
- **Buttons** — the guided flow's Back · Skip for now · Next, the step's one way in, "All items", the unsaved-step ask,
  the date-clash confirm (equal-width Not now · Yes, ask them), the date finder's Use / Compare, the print preview's
  Try again, "Stop viewing as free", City pick's Near me / ✕ and every Maker sheet ✕ are the shared pill; 44 px floor on
  the rest (rule 3).
- **Rows, chips, empty** — the date finder's candidates are hairline rows with a `Badge` "Best match"; Plan it myself
  is plain rows with the shared switch; the answer card is the warm surface; refused reads are amber (rules 2 · 5 · 6).
- **ⓘ instead of paragraphs** — the date-change confirm, the off-platform suppliers line, the empty march and Plan it
  myself explain behind `InfoTip` (rule 7).
- **Tokens** — hand-typed durations are `--sn-*` durations; shadow colour codes are `shadow-sn-*`; the gold wash reads
  `--color-terracotta` (rules 14 · 15).
- **Kept on purpose:** the theme preview stays full screen (owner 2026-09-28, baseline-listed in
  `drawn-in-place.baseline.txt`); the march's "Not walking" list stays its own portal (it must stay mounted, invisible,
  while a name is dragged out of it); the lower third's long tool word keeps its smaller size (owner 2026-10-05: never a
  mid-word break in a 52 px column); pass-card designs keep their own colours (they are the printed card).
- Guards re-pointed, not weakened: the Exit preview / editor ✕ / date-clash checks read the `ActionButton` props; the
  maker sheet's import list adds `@/components/action-button`; hub-stage paints 3 fixed colours, not 4; the label-on-fill
  record is rewritten (3 dark pairs fixed).

SPEC IMPACT: None — implements the approved design template (Setnayan-specs `prototypes/design_template_sheet_2026-11-14_fable.html`); no decision changed.
