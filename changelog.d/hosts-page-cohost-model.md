## 2026-09-30 · fix(hosts): the Hosts part speaks the co-host model · the Hosts menu row retires · an ACCESS column on the guest list

Three parts of one change — the Hosts page predated the co-host model (owner
2026-09-28, "CO-HOSTS COME FROM THE GUEST LIST — FINAL MODEL", migration
`20271251336140_cohosts_come_from_the_guest_list.sql`), and on 2026-09-30 the owner
found his Bride listed there as a coordinator. The colour card was fixed first
(`colour-access-lists-only-coordinators.md`); this finishes the page and puts the
Access control where the model says it lives.

**1 · The Hosts part** (`app/dashboard/[eventId]/hosts/page.tsx`, `actions.ts`):

- Live vs waiting is split on `user_id`, never `accepted_at` (the column is
  `DEFAULT now()`, stamped on seats nobody has joined — measured on prod). A seat
  picked from the guest list carries no invitation token, so it was never listed
  as "Waiting to join" under the sentence that described it; it is now, by the
  guest's name (one batched `guests` read through `ENTOURAGE_COLUMNS`), with a
  door to the card where its Access is set. Anchors: `const accepted = all.filter((r) => r.user_id)`,
  `data-waiting-guest-seat`.
- A seat is named by the guest list's Access word — new `seatAccessWord` in
  `lib/guest-access.ts` (Co-host · Limited helper; the hired planner keeps its own
  label) — never `ROLE_SUBTYPE_LABEL`'s "Viewer (read-only)" / "Bride".
- The per-area grant chips, the budget / photo toggles and the coordinator
  removal reasons ("No longer availing their services", `aria-label="Reason for
  removing this coordinator"`) are drawn for COORDINATOR seats only
  (`CoordinatorGrantChips`, `CoordinatorSeatControls`). A full co-host is a
  `couple` member with the same access as the creator: no grant applies, and
  "Budget · off" on the Groom was a lie. `CohostSeatControls` sends a guest-list
  seat to its card, says "A celebrant stays a co-host" instead of offering a
  Remove the database refuses (`a_celebrant_cohost_stays`), and keeps a plain
  Remove only for a pre-model email-invited co-host with no guest row.
  `setDelegateBudget` / `setDelegatePhotos` refuse a full co-host seat at the
  door too (`COHOST_NEEDS_NO_GRANT`).
- The empty state no longer says "Use the form below" (the form left on
  2026-09-28); dead imports of that form (`hostRolesForEventType`,
  `ROLE_SUBTYPE_HINT`, `roleChoices`) are gone.

**2 · The event menu** (`lib/customer-menu.ts`): the `hosts` row is removed from
`buildEventMenuSections` and `SECTION_ORDER.invite`; Hosts is the Guest list's
PART (`lib/pillar-parts.ts`, `/guests?gview=hosts`, and `/hosts` redirects there).
The Guests row claims `/hosts` (`alsoMatch`) so the rail and the moment strip
still light on the standalone page a helper without the guest list lands on; the
phone's Guests tab already covered it. The unused `Crown` icon and the `hosts`
icon name are gone. `reachable-without-typing-the-url.test.ts` now counts a
pillar's part as a door (`partHomes`, read from `guestListParts`, never re-typed);
`two-levels-and-the-board.test.ts` and `the-event-menu-is-one-tree.test.ts`
(19 → 18 rows) follow.

**3 · An ACCESS column on the guest list** (`guest-list-multiselect.tsx`, new
`guest-access-cell.tsx`, `guests/page.tsx`): beside Role, on the desktop row and
the phone row, one PickMenu dropdown per guest — None · Co-host · Limited helper
— reading the state the page already loads once (`loadGuestAccessMap`) and
writing through the card's own action (`setGuestAccess`): one writer, one
dropdown, one vocabulary (`ACCESS_LEVEL_LABEL`, now shared with the card, whose
"Guest only" became the owner's "None"). The creator and a celebrant co-host are
fixed words, not dropdowns; only a co-host (`viewer.isCouple`, the action's own
gate) gets one; a pick shows at once and saves in the background. One guest at a
time — the retired bulk picker stays retired. The "+Co-host" tag that trailed the
role is gone (the column says it once). `PickMenu` gains a `compact` prop for the
phone's sub-line. The roster's fixed-pixel budget rises 144 → 292 for the column
(`the-header-fits-its-own-cell.test.ts`, with the reason).

Guards: `lib/the-hosts-part-speaks-the-cohost-model.test.ts` and
`guests/_components/the-access-column-is-the-cards-access-line.test.ts` (each red
without its fix). `scripts/port-control-baseline.json` regenerated with the repo
script (the diff names the moved provider and the new cells).

SPEC IMPACT: None — the co-host model is the 2026-09-28 DECISION_LOG ruling; this brings three screens to it.
