## 2026-10-20 · feat(guests): the one Group list follows the guest's side, and one name is one group

Owner, on the guest card's Group list (cale-ice showed Family ×2 and Relatives ×2 — one bride's, one groom's each): *"if i pick bride's side. it should show the groups for the bride's side and the groups that also cover both … if i pick groom's side, then i only see groups that is related on the grooms or both"* · and *"also not allow to have a group name similarly written on the group already."*

- `GuestGroupPicker` (the guest card, the search box's Add card, /guests/new) lists in "Your groups" only the groups of the guest's side and both sides' (`listedOwnGroups`, lib/groups-for-side.ts); a guest on both sides sees all. Changing Side (the card's Side row, the Add card's Side pick, /guests/new's Side select) re-filters at once. A group the guest is already in stays drawn, ticked, with "· groom's side". Standard groups are not filtered; events without sides are unchanged.
- ＋ New group… makes the group on the guest's side (both → both); rename writes the name only.
- A new or renamed own group whose name — without case, spaces or punctuation — is a standard group or an own group in the same list (same side, or both) is refused in place: "You already have “Family”." with "Use “Family”" (one tap ticks it). The server's create (`editGuestGroupInPlace` op `create`, new) and rename run the same rule (`lib/group-name-clash.ts`). Existing duplicates are not rewritten.
- Guard: `guests/_components/the-group-list-follows-the-side.test.ts`. Lab: `/dev/guests-lab?part=card&sides=1&side=bride|groom|both`, `?part=screen&sides=1`.

SPEC IMPACT: None — implements DECISION_LOG 2026-10-20 "THE GROUP LIST FOLLOWS THE GUEST'S SIDE" (the name rule is the owner's addition the same day, relayed by the controller).
