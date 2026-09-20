## 2026-09-20 · fix(guests): one colour per roster row, not five

⚖ Owner 2026-09-20, on the desktop guest list: *"is there a better way to keep
this clean and remove the pill boxes? so it looks neater?"*

Five filled capsules per row — side, role, groups, RSVP, seat — across 77 rows
is ~385 coloured shapes and no hierarchy: the eye reads texture instead of
information. The roster now spends its colour on ONE thing, the role, which is
the identity and (since #5755) the couple's own mood-board colour.

| Column | Was | Now |
|---|---|---|
| Side | tinted capsule, every row | 2px coloured edge on the row + a plain word |
| Role | tinted capsule | coloured text, medium weight |
| Groups | tinted capsule | the group's name, plain |
| RSVP | tinted capsule | a small tone dot + text |
| Seat | mono plaque | mono text |

🔑 **The mobile card keeps its pills, and that is not an oversight.**
`SidePill`, `RoleChips`, `RsvpPill`, `SeatChip` and `GroupChipList` are SHARED
with `GuestCard` and `MobileListRow`, where one guest fills the surface and a
chip reads as a label rather than as texture. Editing them in place would have
redesigned two surfaces from a note about one — so the roster gets text variants
and the two shared components gain a `plain` prop.

Both presentations resolve their colour through `lib/role-chip-style.ts`
(`roleChipStyle` for cards, `roleTextStyle` for the roster), so a role can never
be one colour on a card and another on a row. The contrast target differs on
purpose: the chip darkens against its own 16% wash, the text against the roster
row (`accentTextOnRoster`, measured against the darker zebra of the two).

**The Side column keeps its words** even though the row now carries the colour.
The edge is for scanning; the text is what a colour-blind reader and a screen
reader actually get. Colour alone is not a label.

Reuses `SIDE_CONTROL_BORDER` for the edge rather than adding a twelfth
near-identical side map — it is already exactly "a border colour per side".

Guarded by `one-colour-per-roster-row.test.ts` (5 tests). The failure mode here
is CREEP: nobody re-adds five capsules in one commit, but somebody adds one,
reasonably, because that column "needs to stand out". The guard counts filled
capsules in the row rather than naming them, asserts both shared components are
asked for `plain`, and asserts the mobile surfaces still have their pills.
Sabotages confirmed red: one capsule creeping back (3 failures), SeatChip
dropping `plain` (1).

SPEC IMPACT: None — the table's own docblock records that "which columns exist
was never ruled on"; only that desktop is rows, not tiles (owner 2026-06-05),
which is unchanged.
