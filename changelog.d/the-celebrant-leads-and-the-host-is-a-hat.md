## 2026-09-20 · feat(guests): the celebrant leads the list, and the header arranges it

Three owner rulings from one session on the guest list, built together because
they are the same surface and the third would have broken the first.

**1 · The celebrant leads every list** — owner: *"on list, the first one will
always be the celebrant. for wedding that is the bride and groom."* A wedding
already obeyed this (`sortCompare` has pinned bride #1 · groom #2 under every
sort since 2026-06-05). Nothing else could, because no non-wedding role said
who the celebration was FOR — a birthday's roles are host/vip/family/helper,
and at Lola's 80th the host is her daughter. New `celebrant` guest role
(migration `20271237116021`, additive enum value, NOT a singleton — owner
2026-08-27: "single, couple, or multiple people"), offered by the generic role
set, its own `honoree` role group so a birthday is not sectioned under a
heading reading "Bride & Groom". The pin itself moved out of the server
component into `lib/role-groups.ts` (`honoreeRank`) so a test can execute it
instead of grepping it.

**2 · The column header is the arrangement control** — owner, pointing at the
ROLE header: *"when you click on this row … it will arrange everything by name,
by side … add a checkbox beside them so we can set how they are arranged"*, and
for the phone *"an icon on the header of the table … which will ask us group it
by how? then we check which ones we want."* The header label sets `?sort=`; the
checkbox beside it toggles `?by=`, and ticking a second column NESTS it under
the first, in the order ticked. Almost no new capability — one new sort key
(Seat) and multi-level grouping — but the control now sits on the thing it
arranges, where a dropdown reading "Sort: Side" never pointed at the column
headed SIDE. New pure `lib/roster-arrangement.ts`; new
`_components/arrange-controls.tsx`.

⚠ **Sort and grouping were one question and are now two.** `?sort=side` used to
ALSO section by side. Because those URLs are in people's bookmarks, an absent
`?by=` derives the old sectioning exactly; an empty `?by=` is a real answer
("no headings") and beats the derivation. Both are pinned by test.

**3 · The honoree sits outside the grouping.** Pulled out before any bucketing
and emitted as a pinned, uncollapsible first section — otherwise "always first"
would have held only until somebody ticked a box. With the default grouping
(`role`) the rendered result is unchanged from what shipped.

Tests: `lib/roster-arrangement.test.ts` (10, sabotage-checked three ways),
`lib/the-honoree-leads-every-sort.test.ts` (6, including hostile comparators
that put the honoree last if the pin is applied after the sort).

SPEC IMPACT: The `celebrant` guest role and the celebrant-first rule are a
decision-log addition (guest roles per event type, and what "first on the list"
means for a non-wedding). To apply in
`~/Documents/Claude/Projects/Setnayan/DECISION_LOG.md` alongside the existing
2026-06-05 "Bride #1 then groom" row and the 2026-08-27 host/celebrant ruling.
