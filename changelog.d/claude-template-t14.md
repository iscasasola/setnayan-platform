## 2026-11-14 · style(couple): T14 — `/dashboard`, the library tabs and the people pieces follow the design template

Batch T14 of `design_template_full_audit_2026-11-14.md` (Setnayan-specs). Every fact and action kept; shared pieces only
(`ActionButton`, `Sheet`, `EmptyState`, `InfoTip`, `PickMenu` + `PostedPick`, `Badge`, `SwitchTrack`). Two T14 files are
left to open PRs that already edit them: `library/_components/challenges-tab.tsx` (#7671) and
`(account)/_components/account-thumb-row.tsx` (#7543).

- **`/dashboard` board** — the empty shelves are one plain line (no dashed box); "Create an event" and the (+) are the
  shared pill; the put-away toggle is the house switch; clash notices are hairline rows with a gold edge; the ⋯ menu is
  44 px with 56 px rows, its confirm buttons shared pills at equal widths; year moments are hairline rows. The approved
  poster event cards stay as they are (rules 2 · 3 · 4 · 6 · 13 · 14 · 15).
- **Library** — photos, suppliers, editorials, memories, favourites, auto-surfaced events and life story: no cards,
  refused reads are one amber "not the same as none" line, empties use `EmptyState`, statuses are `Badge`s, explaining
  lines sit behind ⓘ, the Facebook share is an info pill (no brand colour code) (rules 2 · 3 · 5 · 6 · 7 · 13 · 14 · 15).
- **People** — the person card, the invite and a found person rise as the house `Sheet`; the four loved-one dropdowns
  and the godparent role are ▾ pickers posting the same field names; chips are `Badge`s; rows are hairline; Remove /
  Erase are danger pills (rules 2 · 3 · 4 · 5 · 7 · 9 · 13 · 14).
- **Type** — 12 px floor, no ink under 70 % on words, mid grey only at 13 px+, no typewriter labels, token colours and
  durations only (rules 13 · 14 · 15).
- **Kept on purpose:** the event remove frame stays a portalled native `<dialog>` + `<select>`
  (`the-remove-frame-is-on-top.test.ts`; a portalled pick list would sit under the top layer); the ⋯ popover's
  click-catcher; the permanence warning beside the typed-name box; the house ⓘ dot's own look.
- `MEMORIES_HEADING` (memories-chapters) is a 12 px label now, so `challenges-tab` — which imports it — follows without
  being edited.

SPEC IMPACT: None — implements the approved design template (Setnayan-specs `prototypes/design_template_sheet_2026-11-14_fable.html`); no decision changed.
