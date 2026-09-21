## 2026-09-21 · feat(guests): the guest list's shell — one row of doors, one row of meters, search and add sharing one row

⚖ Owner, on the live page after the four rulings shipped: *"the whole plan did
not execute."* True: #5793 shipped the rules (celebrant first, header arranges,
Groom's side first, the host hat) and left the prototype's SHELL unbuilt. This
builds it, on DESKTOP — the owner's screenshot. The phone already has most of
it (a one-row compose bar with filter and sort sheets); its tab set is the next
PR, deliberately not this one.

**The four pieces, each harness-rendered** (the real component, the real
Tailwind config and global stylesheet, laid out in a browser at 1100/380/320px):

- `roster-tabs.tsx` — the masthead's doors become one row: Roster · Wedding
  March · Share the link, with Arrange the room at the end. Every door keeps the
  exact condition it had; the rules now live in pure `lib/roster-doors.ts`. The
  ONE removal is a duplicate: before the event "Invite guests" and the Share
  dropdown both handed out the same join link.
- `roster-meters.tsx` — two meters, one row (~115px → 38). The "Pax pool" line
  restated the space left in the target bar, so the bar carries it: solid for
  sure-attending (the owner-locked pricing basis), pale for listed-but-silent,
  and the empty tail IS the unassigned pool. Copy verbatim, "not loaded" kept.
- `filter-popover.tsx` — the five facet rows (Side · RSVP · View · Group · Tags)
  MOVED VERBATIM behind one button, plus Sort (two of its orders have no column
  to click). The panel does not clip: the Group row's rename/delete menu opens
  downward from inside it.
- `find-add-row.tsx` — search and add share one row; whichever is not in use
  folds to an icon, animated. The quick-add "…" menu became four visible doors
  (People · Full form · Import CSV · Quick add list — the fourth kept, not
  quietly dropped).

**What the harness caught that no test could** — every one of these passed the
typecheck, all 32 CI guards and the full suite:
- On a phone the over-target sentence ran off the screen.
- The add box was 77px wide on a phone ("Type a r…") with the doors beside it.
- Taking a folded side out of the flow collapsed it to 0px — and took with it
  the only buttons for switching between Find and Add.
- The three wedding tabs were 15px too wide at 380px, chopping "Share the link"
  mid-word — the same complaint as "CONTA".

🔑 **And the suite being green was itself the finding.** Moving the doors broke
nothing because NOTHING was watching them: every nearby test checks a
destination page, none checked that the guest list still had a way in.
`lib/roster-doors.test.ts` now does — sabotage-checked four ways, including
the exact case that was invisible: "Arrange the room" silently dropped.

⚠ **Surfaced, not decided:**
- This partly reverses two July sign-offs recorded in `capture-bar.tsx` — the
  retired [Add | Find] dual mode (2026-07-13) and capture-first (2026-07-11).
  The owner asked for this shape later; it does not repeat the July failure
  (that was two search boxes), and capture-first survives for an empty list.
- The loading skeleton can no longer reserve the header buttons (they are gone)
  and has no band for the new tab row, so desktop shifts ~42px on load.
- Side filter pills still read Everyone · Bride · Groom; the owner's
  Groom's-first sequence was ruled for arranging the list, and was not extended
  to the pills without asking.

SPEC IMPACT: one DECISION_LOG row — the shell, applied in the corpus.
