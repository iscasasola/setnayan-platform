## 2026-11-06 · feat(home): Home's lines open what moved — "N without a seat" (Guests › Seats) · "N looks on your board" (Find)

Item 4 of the event-menu reorganisation finish (`EVENT_MENU_REORG_BUILD_PLAN_2026-10-27.md` "The finished map": *Home —
status lines that open the exact item in its new home*). Stacked on the Inspiration-in-Find PR (it opens that board).

Rule 0: RSVP already reads on Home's Guests widget (coming · no reply · can't come, `rosterStats`), the Schedule has
its own card (2 Nov), Prints its line (R8). The two moved items with no line got one:

- **Seats (R4 → Guests › Seats)**: Guests widget face / desktop figure "N without a seat" — Guests › Seats' OWN
  "Unseated" (`unseatedCount`: no seat, not declined) over the plan's own tables and seats — opens Guests › Seats. No
  tables yet = no seat plan = no line. A refused read says "Couldn't load", never 0.
- **Inspiration (R5 → Suppliers › Find)**: Suppliers widget face / desktop figure "N looks on your board · N parts"
  (`readFindInspiration`) — opens Find's board. A refused read is said.
- Read only for the viewers the planning widgets are for (couple + coordinator), started ahead with the rest.
- `/dev/home-lab?moved=1|unread` draws both on fixtures. Guard `lib/home-shows-what-moved.test.ts` (4 tests, sabotaged red).

NOT changed, on purpose: the guided flow's Schedule step (Home's progress) still opens the Maker's Details › Schedule —
the Hub's Schedule PART (ruled 2026-11-01 "THE HUB'S DETAILS › SCHEDULE READS CHAPTERS"); Studio ▾ already lists only
Logo · Palette + Dress Code · Love Story (`STUDIO_MENU_KEYS`), so its "n of 3 ready" was already right.

SPEC IMPACT: None — builds the plan's "Home status lines"; no decision changed.
