## 2026-10-08 · feat(suppliers): Find's thumb row — expand all · search · add your own (Suppliers PR2a, part 1)

Owner 2026-10-07 evening (`SUPPLIERS_BUILD_PLAN_2026-10-07_fable.md` § PR2,
"UPDATED 2026-10-07 EVENING / LATE"; acceptance pictures 19–22): the thumb bar
in Find is **⇕ Expand all / Collapse all · Search all suppliers or add your own
· ＋ Add your own** — a floating, frosted row above the bottom bar. Stacked on
Suppliers PR1 (`rd/suppliers-shell-three-modes`).

- **The row owns nothing.** Its three controls are the bench's own (which
  categories are open, the search text, the add-your-own form); the row is only
  where they now live. Nothing new is read or written; +0 server actions.
- **Expand all** opens every category; a tap on a header then folds just that
  one; **Collapse all** closes them. (One-open-at-a-time is unchanged while not
  all are open.) The rule is `isCategoryOpen` in `lib/suppliers-shell.ts`.
- **Search** is the bench's shipped search (your suppliers by name or category;
  rows with a hit unfold by themselves; the marketplace results under it). It
  moved from a box above the folders to the thumb, runs 250 ms after the last
  keystroke, and typing never rebuilds the box.
- **＋ Add your own** opens the shipped manual-supplier form for the ONE open
  category; with none open it asks "What they do" first — one dropdown of only
  the categories on the event.
- **Universal rules:** one fit state for the row and the field keeps 60 %
  (`useFitRow`); it slides up once Find is on screen and down ~300 ms before
  the body swaps (the shell waits only when a row is up); glass — the row has
  no background, the field is frosted (`.sn-glass-row`, registered in
  `floating-rows-are-glass.test.ts`), Add keeps its terracotta.
- `SuppliersModeContext` (new, `suppliers-mode.tsx`) is how a body — a slot the
  shell cannot hand props to — learns which body is on screen and when the
  couple is leaving it.

**Not in this part (said, not dropped — next in PR2a):** the flat category rows
with their state words ("Covered N of M", "· N yours", "Booked ✓"), the pop and
unfold, the pinned header and the search scope that follows it ("Search
‹Category›…"), service cards and verbs by step, "More to compare" always on,
"＋ Add to your event" as one dropdown, `＋ Add "…"` with the typed name.

SPEC IMPACT: None — builds the plan's PR2 thumb row as written; what is
deferred to the next part is listed above and in the PR body.
