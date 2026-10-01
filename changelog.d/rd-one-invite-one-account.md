## 2026-10-01 · fix(guest-account): one invitation, one account — the second account is told so

Owner rule (2026-10-01): *"save to my account. adds it to a user. if someone
tries to sync it to a different email. they cannot. we will say this event QR
is already assigned to someone."*

**The refusal was already the database's.** Every path that links a guest row
to an account was traced — "Save to my account" (cookie bind and the Google /
Apple return through `/join/{id}/connect` → confirm), the signed-in one-press
save, the plus-one door, the join door's email seed bind, a couple's Keep /
Link (`issueRequestKey`), the account auto-surface, the claims merge, and the
incoming-request YES RPC. Each either checks the holder first or relies on the
partial unique `event_members_event_guest_uniq (event_id, guest_id)`, which
refuses a second account with 23505 and never re-points the first; there is no
client-side INSERT policy on `event_members`. No path was open; no migration.
Now pinned against the replayed schema by
`apps/web/tests/db/one-invitation-one-account.db.test.ts` (every write shape,
plus a free-row control).

**What changed is what they are told.** A Google / Apple return whose seat was
already another account's used to land on an unexplained account home. The
connect route now sends it to `/join/{id}/connect/confirm`, which draws
`HeldElsewhereDoor`; the invitation's account card and the shared Save say the
same in the `held_elsewhere` state — exactly *"This event QR is already
assigned to someone."* / *"If this is your invitation, ask the hosts to
check it."* (`SEAT_HELD_ELSEWHERE`, `lib/seat-binding.ts`). The first account
keeps it; the hosts' Unlink stays the release. Words pinned by
`apps/web/app/[slug]/_components/one-invitation-one-account.test.ts`.

SPEC IMPACT: None.
