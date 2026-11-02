## 2026-10-20 · feat(guests): the guest card's ONE Group dropdown and ONE Role dropdown, each multi

Owner, verbatim: *"there are 2 groups."* · *"before we can always create a new group anytime and add or delete a group
name."* · *"Roles doesn't need also serves as. as an additional role. they can have multiple row in that Role in Wedding"* ·
*"several group, several roles"* (DECISION_LOG 2026-10-20 "GUEST CARD: ONE GROUP DROPDOWN AND ONE ROLE DROPDOWN, EACH
MULTI"; prototype `guest_group_and_fast_add_2026-10-20.html` strip A).

- Card Details: "Group" + "Groups" → ONE Group dropdown — Standard · one of these (`group_category`) → Your groups · as
  many as apply (memberships) → ＋ New group… (Quick add's strip) with ✎ rename and 🗑 delete (with the count) in place.
  `_components/guest-group-picker.tsx` is exported for the add card (#6696).
- "Role in wedding" + "Also serves as" → ONE Role dropdown, several ticked; the first is `role` (marked "main"), the rest
  `extra_roles`; unticking the main promotes the next. Pill reads "Ninang · Candle Sponsor".
- Same posted form (`group_category`, `groups_posted`, `group_ids`, `role`, `extra_roles_posted`, `extra_roles`); the
  card's golden FormData is unchanged. No migration.
- /guests/new draws the same two dropdowns; `createGuest` now writes the extra roles and the ticked own groups.
- One new server action, `editGuestGroupInPlace` (rename · delete · count — result-returning; the redirecting
  `updateGuestGroup` / `deleteGuestGroup` would navigate the card away). PickMenu takes a `doneNote`.
- Guards: `lib/guest-group-role-pick.test.ts` (one-of / multi / main-role promotion over every tap sequence) and two
  render properties in `the-card-posts-the-same-form.test.ts` (exactly one Group and one Role control, both kits, every
  state). Sabotaged six ways, each RED.

SPEC IMPACT: None — implements the 2026-10-20 DECISION_LOG row and its approved prototype; no new ruling.
