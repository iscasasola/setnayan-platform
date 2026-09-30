## 2026-09-30 · feat(seating): Auto Arrange seats sponsors together, both families together, then groups

Owner rulings of 2026-09-30 (DECISION_LOG "AUTO-SEAT: SPONSORS TOGETHER, BOTH
FAMILIES TOGETHER, THEN GROUPS" and "AUTO-SEAT: THE COUPLE CHOOSES, PER ROLE,
'SIT TOGETHER' OR 'SIT WITH THEIR GROUP'"), built into the existing
`computeAutoSeat` in `lib/seating.ts`. It no longer seats guests one at a time.
It seats them in units:

- **All principal sponsors (with their pairs) at ONE table.** If there are more
  of them than one table holds, they take the fewest tables that sit side by
  side. Neighbours are measured by floor distance, so they are never scattered,
  even with the group-adjacency switch off.
- **The immediate family of BOTH sides at ONE shared table**, with the same
  overflow rule.
- **Per role set, the couple chooses.** The sets are principal sponsors,
  immediate family, the crews (bridesmaids + groomsmen), secondary sponsors, and
  bearers & flower girls. Each one is either "Sit together" (the default) or
  "Sit with their group". There is one switch per set in the Auto Arrange panel,
  named in the couple's own role words ("Bride's Crew & Groom's Crew"). The
  choice is stored in the new `event_floor_plan.role_seating` jsonb column,
  beside `priority_order`. No new table.
- **Everyone else by primary group.** A group sits at one table when it fits
  (the table nearest the stage that holds all of them). It splits only across
  neighbouring tables. Plus-ones always sit beside the guest who brought them.
  Hand-seated guests never move, and a set whose members are already seated
  grows from their table. The couple and the sweetheart table are untouched.

Priority order still decides who sits nearest the stage. Every caller now passes
the setting through: `autoSeatGuests`, `autoArrange`, `lockAndFill`,
`buildSeatingDraft`, and the live reconcile in `lib/seating-reconcile.ts`.
Pure-function tests for each rule are in `lib/seating.test.ts`. Each test was
sabotaged once and went red.

Migration: `20271255964760_event_floor_plan_role_seating.sql` (additive, and
it inherits `event_floor_plan` RLS).

SPEC IMPACT: None. This implements the two 2026-09-30 DECISION_LOG rows as
written.
