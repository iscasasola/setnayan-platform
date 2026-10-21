## 2026-10-21 · fix(guests): same-name groups say their side; no create path makes a twin

Owner, on the Guests quick-add bar's Group dropdown: *"why do i see dupes on group names"* (Bob · Bob · Loo · Loo ·
Mama · Mama · Relatives · Relatives). They were separate `guest_groups` rows of one name on two sides — the unique key is
`(event_id, lower(label), team_side)` — and no row said which.

- **The Group dropdown** (`guest-group-picker.tsx`): a row whose name another drawn row shares — an own group or a
  standard one — carries its side in the shipped off-side word style ("· both sides" / "· groom's side" /
  "· bride's side"). A name drawn once is unchanged. Rule: `sidesForNamesakes` (lib/groups-for-side.ts).
- **The other own-group lists** run the same rule on their option words: the Guests screen's Set ▾ › Group, the Quick
  add sheet's Group, the Maker card's Group.
- **One writer**: `makeGuestGroupOnce` (lib/guest-group-made-once.ts) is now the only insert into `guest_groups`. A name
  already in that side's list (same side, or either is both sides — `ownTwin`) is REUSED, never twinned. It serves
  `quickCreateGroup` (capture bar `#Group`, Quick add sheet, claims), the dropdown's in-place create, the sidebar's
  `createGuestGroup` and `mapAddGroup` — before, only the dropdown ran the 2026-10-20 name rule. The sidebar's
  `updateGuestGroup` now refuses a rename/side move that would twin.
- Guards: `lib/one-group-per-name.test.ts` (one writer across app/lib/components; the rule executed on the measured
  groups; every path calls it) and `guests/_components/same-name-groups-say-their-side.test.ts` (no two rows of a list
  read the same, every side × tick). Six sabotages, all red.
- No production row was changed. The empty twins are listed in the PR for the owner.

SPEC IMPACT: None — applies the 2026-10-20 DECISION_LOG "THE GROUP LIST FOLLOWS THE GUEST'S SIDE" one-name rule to every
create path; the side word reuses the shipped off-side style.
