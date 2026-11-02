## 2026-09-20 · fix(guests): one roster, one vocabulary, every width

⚖ Owner 2026-09-20, shown the phone after the desktop redesign shipped:
*"why did mobile view did not adjust. there are still pills on the table"* —
then *"remove the grid view on guest list. make it same sa row view only."*

**Scoping mobile out of #5768 was my call, and it was wrong.** That PR shipped
text on the desktop roster and left `GuestCard` / `MobileListRow` on chips, with
a guard asserting they stayed that way. The owner disagreed, so the decision
changed and the guard changed with it — it still pins the surface against drift,
now to the answer that is correct.

- `MobileListRow` renders the same text variants as the desktop row, and asks
  `SeatChip` / `GroupChipList` for their `plain` form.
- **The grid view is removed, not hidden.** The phone had a `?density=grid|list`
  toggle defaulting to a photo-card grid. The toggle, the param read, and the
  two components it rendered (`GuestCard`, `MobileGridItem`) are all gone. A
  stale `?density=grid` link simply renders the list.
- With nothing mounting them, `SidePill`, `RsvpPill`, `RoleChips` and `RoleChip`
  are deleted rather than left defined. 🔑 A component nothing renders is a
  component somebody re-renders — leaving them beside the text variants is an
  invitation to put one back "just for this column".

Guarded in `one-colour-per-roster-row.test.ts`: the phone row uses the text
variants and holds no pill, the capsule components are absent (not merely
unmounted), and the grid is gone from both the roster and the carousel toggle.

Two traps this ran into, both recorded because both produced a file that read
correctly and did not compile: a `{/* … */}` comment cannot be the first of two
expressions in a JSX ternary branch (it happened twice, in two different
edits), and cutting a function by "to the next `function `" swallows the
`const`s between when the next one has already been removed.

SPEC IMPACT: None — desktop-is-rows (owner 2026-06-05) is unchanged; the phone
now matches it.
