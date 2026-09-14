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

## 2026-09-14 · fix(guests): the page stops showing what cannot apply

**Tea-ceremony order is Chinese/Tsinoy-only now.** The owner found it on his
CATHOLIC wedding. The block's own comment said "Shown to all events — harmless
when unused", and it was not harmless: a field that cannot apply is not neutral
chrome, it is a question the host has to rule out.

Gated on the existing `isChineseWedding` predicate — which matches Chinese as
the PRIMARY rite or as the OVERLAY on another (the Tsinoy church-plus-tea case),
so the gate required widening the event read to `secondary_ceremony_type`.
Reading only the primary would have hidden the field from exactly the couples
who need it. Applied on BOTH the detail page and `/guests/new`: the two screens
edit the same column, so offering it on one and hiding it on the other is its
own bug. `relation` ("Grandparents", "Eldest Uncle") is useful at any wedding
and stays for everyone.

**Group chips follow the side lens.** Owner, verbatim: "groups will be filtered
depending on what side as well. so when i press team groom, it will only show
groups of the groom". Groups already carry `team_side`; a roster with a "Family"
and a "Relatives" on each side showed all four chips under every lens, telling
them apart only by a dot. A 'both'-sided group shows under either lens, and the
ACTIVE group is always kept — otherwise switching side hides the chip while its
filter stays applied, leaving the roster narrowed by something invisible.

SPEC IMPACT: None.
