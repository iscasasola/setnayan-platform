## 2026-11-28 · fix(seat-plan): L10 PR 1b — a locked seat stays on every path; the Names card matches its drawing

Controller post-merge review of #8460:
- **Every hand path refuses a locked seat on the server** (`lib/seat-lock.server.ts`):
  - the phone's Move to… and "+ New table" (`createTable`);
  - a group seated at a table (`assignGroup` — locked members stay, and the editor says so);
  - two tables trading (`swapTableOccupants`);
  - a shape that would take a locked chair (`updateTableType`);
  - the guest card's Table pick and the list's Set table ▾.

  `lib/every-seat-write-asks-the-lock.test.ts` lists every seat writer, so a new one cannot skip the check.
- **Unit trades:** a pair ⇄ pair trade that fails part-way is rolled back, and the plan re-reads.
- **Principal sponsors under "nearest":** the sponsor's +1 moves alone, and the card draws them apart.
- **Names** (drawing `prototypes/seats_names_2026-11-27/`):
  - 26 px chips: "Maria C." / "Tita Odette", a hairline and the small "+1";
  - "Ramon's +1" for a sponsor's +1 sitting apart;
  - "+N more" counts people;
  - up to 3 dotted chairs then "+N empty";
  - "Their +1s · nearest the Principal Sponsors";
  - a card without room for the lifted unit does not light.
- **Faces:** a pair draws touching, never overlapping.

SPEC IMPACT: None — builds `SEAT-PLAN-COMPLETE-2026-11-27.md` § 4.1 and the approved Names drawing as written.
