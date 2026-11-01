## 2026-11-01 · feat(guests): Honour attendants are one group on Guests › List

Owner, 1 Nov (DECISION_LOG "GUESTS › LIST: DRAG TO CHANGE ROLE · HONOUR ATTENDANTS GET THEIR OWN GROUP"): *"there
should be a dedicated group for best woman, best man, maid of honor and matron of honor and man of honor because right
now they are on the grooms crew and brides crew"*.

- The List's Role view (`roleBucket`, `lib/guest-roster-view.ts`) puts the five honour roles in ONE section,
  **Honour attendants**, above the Groom's and Bride's crews and not split by side. A guest is still sectioned by their
  most important role (`mostImportantRole`, role-groups.ts — `importanceGroupOf` now reads it too).
- The same section in the Map's role tree, the List's role sort (`ROLE_SECTION_ORDER`), the section head's ＋ (adds one
  of the five; the crews no longer offer them) and the search (the heading's word finds them).
- A list section, NOT a new `RoleGroup`: the role groups also key the Mood Board palette, the dress code and the seating
  tiers, where the honour attendants still stand with their side. The five are `HONOUR_ATTENDANT_ROLES` (role-groups.ts),
  held equal to the dress code's `HONOUR_ROW_OF`.
- The Groomsmen and Bridesmaids views (`filterByRoleGroup`, `?view=`) stop counting the honour attendants (owner, asked:
  yes); `?view=honour_attendants` holds the five. A best man who is also a groomsman still answers to Groomsmen.
- Not built: drag-to-change-role (waits for the shared drag piece, per the ruling).

Guard: `lib/the-honour-attendants-are-one-list-group.test.ts` (runs the List's sectioning).

SPEC IMPACT: None in this PR — the ruling is already in the corpus `DECISION_LOG.md` (2026-11-01).
