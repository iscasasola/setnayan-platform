## 2026-09-05 · fix(guests): the couple's locked Role & RSVP chips answer the tap

On a Living Roster row every chip opens a picker — side, role, RSVP, groups.
Two of them do not, for the bride and groom: their role is fixed and their RSVP
is pinned to Attending, because they are the foundation of the event (owner
2026-06-03, reaffirmed 2026-09-05 — "only non bride and groom can be changed").

**The lock is unchanged and stays.** What was wrong is how it presented. Both
chips rendered as plain pills (`return <>{children}</>`) — not disabled, not
greyed, not captioned, no cursor change, visually identical to the editable chip
one column over. Tapping did nothing at all, and silence in a row where
everything else opens a popover reads as a broken cell rather than a rule about
the event. It cost a round of "the role cell doesn't work" before the cell could
be seen doing exactly what it was told.

Both locked branches now render through a new `LockedChip`: a real button that
keeps the pill's exact visual and opens one line naming the guest and their role
and saying why the field is fixed. `aria-haspopup="dialog"`, not `menu` —
nothing in the panel is choosable. Guarded by
`apps/web/app/dashboard/[eventId]/guests/_components/the-locked-chip-answers-for-itself.test.ts`,
whose first assertion is that the lock still short-circuits before any picker is
reachable (deleting that early return turns 3 tests RED).

SPEC IMPACT: None. The 2026-06-03 lock is untouched — this changes only how an
already-locked chip explains itself.
