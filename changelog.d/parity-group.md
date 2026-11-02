## 2026-06-26 · feat(seating-3d): 2D→3D parity — seat a whole guest group at a table

A "Seat a group" picker in the 3D lab build panel: tap a custom group chip
(label · member count) → tap a table → the server seats its members in order,
overflow surfaces a notice. `assignGroup` + the one-shot seat resync (no drift).

Threading: the lab page now fetches `fetchGuestGroupsByEvent` +
`fetchGroupMembershipsByEvent`; `Lab3DGuest` gains `groupId` (first membership)
and a new `Lab3DGroup` type carries label + member count. The table-tap handler
gains a placing-group branch (mirrors placing-guest).

SPEC IMPACT: 0008 Seating — 3D lab group-assign parity.
