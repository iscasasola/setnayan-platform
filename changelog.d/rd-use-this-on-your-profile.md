## 2026-10-04 · feat(profile): a guest can use the event's formal name on their own profile in one tap (B9)

DECISION_LOG 2026-09-30 "A GUEST ROW LINKED TO AN ACCOUNT SHOWS THE ACCOUNT PROFILE'S DETAILS" + "THE EVENT'S FORMAL NAME FILLS THE PERSON'S OWN PROFILE — ONE TAP, NEVER SILENT". A linked guest row already wears the profile's name read-only on the host's card ("Edit on your profile ›"), and the profile page already offered a guest-list name for empty parts — but a person whose seat lists a fuller name ("Ms. Claire Estoras Buanhog") than their profile ("Claire Buanhog") had nothing on their own event page.

- **Me tab (guest side, `app/[slug]/_components/use-on-profile.tsx`)**: under their name, ONE quiet line — the name the event lists them as · "Use this on your profile". One tap asks "Use “…” on your profile?" · Use it · Not now. Only "Use it" writes.
- **When it is offered (`lib/seat-name-offer.ts`, pure)**: only when the names DIFFER, the seat holds a real first + last name, and no part disagrees (a part the person typed is never replaced, so nothing is offered rather than a half-merged name). The tap fills only the profile's empty parts.
- **Only a seat saved on purpose (`lib/seat-name-offer.server.ts`, read-only)**: the account must hold this seat as its guest membership (`event_members.guest_id`), per 2026-09-30 "A SEAT BECOMES AN ACCOUNT'S ONLY ON PURPOSE"; mounted only when `account.kind === 'linked'`.
- **The write (`adoptSeatNameOnProfile`, profile/actions.ts)**: takes two ids and no name; re-reads the seat on the server; writes the five name parts only, through the person's OWN client (RLS `user_owns_row`), each part matched on its own NULL.
- The host's guest card is unchanged (read-only, as shipped).

Guards: `lib/use-this-on-your-profile.test.ts` (rule executed; one write, name parts only, own client; no name from the browser; only the guest page imports the action; opening writes nothing — rendered) and `tests/db/a-host-cannot-write-a-guests-profile.db.test.ts` (the host and a stranger cannot UPDATE a linked guest's profile; a host's edit of the guest row does not travel into it).

SPEC IMPACT: None — implements the 2026-09-30 rulings as written (empty parts only).
