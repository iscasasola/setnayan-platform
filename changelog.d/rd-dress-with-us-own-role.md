## 2026-10-19 · fix(dress-code): "Dress with us" shows only the guest's own role, and the Do's & Don'ts

Owner, on the guest's Invitation › Details › Dress code scene (it listed Bride, Groom and every role to every guest):
*"Dress with us should only show their role. and the do's and dont's"* (DECISION_LOG 2026-10-19 "DRESS WITH US SHOWS
ONLY THE GUEST'S OWN ROLE").

- A listed guest with a role sees ONE card — their own "You are …" panel, read by the one per-person resolver Me ›
  What to wear reads (`resolveGuestAttireWithGroups` + `readerAttire`) — plus the Do's & Don'ts. With `guests.gender`
  known, only their own column; both columns only when it is unknown — read through #6693's one path
  (`guestNamePartsOf` → `womanOrManOf`: gender, then title, then attire).
- A plain guest, a visitor not on the list, or a role whose row (and group's row) has nothing picked sees the Guests
  card + Do's & Don'ts — never a bare heading; with nothing at all the scene stays hidden.
- The couple / a host reading their own Event Hub as themselves, and the Maker canvas, still see every role. A host
  who pressed "Open as <name>" and a See as sample see that guest's card.
- `DressCodeWidget` `readerOnly`; dispatchers `dressCodeEveryRole` (replaces `dressCodeGeneral`). Prints / OG / the print Dress code page are the couple's and keep every role.
- Guard: `app/[slug]/_components/dress-with-us-is-the-readers-own.test.ts`.

SPEC IMPACT: None — implements the 2026-10-19 DECISION_LOG row (already recorded in the corpus, commit ed42138d).
