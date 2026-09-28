## 2026-09-29 · feat(pillars): the Guest list takes Hosts + Check-in, Your Team takes Budget

Lane 2 of the "four pillars" menu (DECISION_LOG 2026-09-29, "WHAT AN EVENT
NEEDS — THE EVENT MENU BECOMES FOUR PILLARS (+ HOME)"): each pillar page now
shows its parts through ONE dropdown (the shared `PickMenu`), and each part is
the SHIPPED screen rendered whole — nothing re-drawn.

- **Guest list** (`/guests`): a "Guests ▾" picker above the roster's row of
  doors offers **Hosts** (`?gview=hosts`, always) and **Check-in**
  (`?gview=checkin`, from the day of the event onward — the union of the
  day-of menu row and the after-event door). Hosts renders the shipped
  `hosts/page.tsx`; Check-in renders the shipped `guests/checkin/page.tsx`.
  Both parts return before the roster's fan-out, so neither pays for it.
- **Your Team** (`/vendors`): a "Your team ▾" picker at the top of the
  takeover offers **Budget** (`?part=budget`), which renders the shipped
  `budget/page.tsx`. The Payments lens's "Open budget" doorway and the
  accordion's "Adjust" link now open that part instead of leaving the page.
- **Old routes:** `/hosts` lands in the Guest list's Hosts part (every param
  carried, so the invite-sent banner and its link still show) for anybody who
  can see the guest list; a helper without the guest list keeps the standalone
  page. `/budget` lands in Your Team's Budget part wherever Your Team exists
  (`marketplace_enabled`); a supplier-free event type keeps the standalone
  page. `/guests/checkin` still stands on its own (the door crew's page, and
  the day-of menu row's destination).
- The after-event roster door "Check-in" now opens the part in the page body
  (`lib/roster-doors.ts`), the same rule as Share the link.
- The event menu's Hosts / Check-in / Budget rows are UNCHANGED — their removal
  is Stage D. Guarded by `apps/web/lib/pillar-parts.test.ts`.

SPEC IMPACT: None (executes the recorded 2026-09-29 placements; the menu rows
are untouched until Stage D).
