## 2026-09-30 · feat(guests, profile): a linked person owns their name — the card shows their profile, one tap fills it, a first account starts filled, your own face on your own row

- **Guest card + list:** a guest row linked to an account whose profile holds a formal name (first AND last)
  wears that profile's five parts — Prefix · First · Middle · Last · Suffix — on the list and the card alike
  (`lib/linked-profile-names.ts`, overlaid once in the roster loader and in `loadGuestCard`). The card shows it
  read-only: "From their account" for the couple, "Edit on your profile ›" for the person themself. `updateGuest`
  leaves the name out of the write (`linkedNameLocked`, extends the plus-one lock; unread = locked). A linked
  account with no formal name leaves the row as the couple typed it, still editable.
- **Profile:** the Full name boxes show only what is SAVED. When a linked guest row carries parts the profile
  lacks, one line offers them — "Use 'Mr. Manuel Cortez Casasola' from Ana & Miguel's list" — and the tap fills
  only the EMPTY parts through the existing `updatePersonalInfo` (+0 server actions). Rows linked by a saved seat
  (`event_members.guest_id`) now count, not only the claimed person.
- **First account from an invitation:** `fillAccountNameFromSeat` now also fills the five name parts, only while
  all five are NULL on the account. The photo does not travel (a selfie is a face-tagging asset deleted on
  withdrawal).
- **Photos:** the viewer's own profile photo shows on their own row even with "share my photo with hosts" off —
  read as the viewer, only when they are on that list.

SPEC IMPACT: None — implements DECISION_LOG 2026-09-30 rows "A GUEST ROW LINKED TO AN ACCOUNT SHOWS THE ACCOUNT
PROFILE'S DETAILS", "THE EVENT'S FORMAL NAME FILLS THE PERSON'S OWN PROFILE — ONE TAP", "A FIRST-TIME ACCOUNT MADE
FROM AN INVITATION STARTS WITH ITS PROFILE ALREADY FILLED". Email/mobile from the profile are not shown yet.
