## 2026-09-14 · fix(guests): the roster shows the whole name, and the inspector stays put

Two things the owner reported after the name-parts work shipped.

**1 · The list did not show what he typed.** He set Prefix / Middle / Suffix on
four guests, they saved correctly, and the roster still read "Claire Buanhog".
The row rendered `guestDisplayName`, which is first + last by construction — the
write-with-no-render failure this branch's own commits warned about twice.

`guestFormalName` is a SECOND function, deliberately not a widening of the first:
`guestDisplayName` has 83 call sites — seating cards, QR labels, the caterer
export, the print routes, the Patiktok booth — and pushing a five-part name into
a printed place card sized for two would break them. A test asserts the two
genuinely differ when parts exist, so a later "simplification" that merges them
goes red.

**2 · The inspector panel scrolled away.** `.sn-inspector-panel` declares
`position: sticky; top: 1.25rem`, and its docblock calls it "the sticky glass
panel" three times — but `.sn-inspector-rail` set `overflow: hidden`, which makes
the rail a SCROLL CONTAINER, and a sticky child cannot stick to the viewport from
inside one. `overflow: clip` clips identically during the width animation without
creating a scroll box.

🔑 THAT IS THE SECOND INERT STICKY ON THIS PAGE — the bulk-action bar was the
first, for a different reason (a wrapper with no slack). Both were DECLARED
sticky and both scrolled away, which on screen is indistinguishable from no
sticky at all. `sticky-panels-are-not-inert.test.ts` pins both mechanisms.

🪤 That guard failed twice on itself before it was right: once on the fix's own
comment prose (it now strips comments), and once because it anchored on the
FIRST `.sn-inspector-rail` block, which is the mobile `display:none` default —
the rule carrying `overflow` is four lines later in a media query. It now scans
every block. Sabotage-verified: reverting clip→hidden turns it red.

SPEC IMPACT: None.
