## 2026-11-25 · feat(sponsors): one list — sponsors are guests with a sponsor role (owner, brief Add 41 · final check A2-I14)

- Migration `20271363480132_sponsors_join_the_guest_list.sql`: every `event_sponsors` row is LINKED to the guest it
  already is (same email ignoring case, or the same name ignoring case and spacing, or the display name; an email match
  first, then the oldest row) or COPIED into the guest list with its sponsor role. A principal sponsor becomes
  `principal_sponsor` ("not yet specified") — never ninong or ninang from the side. A linked guest keeps their own role;
  the sponsor role joins `extra_roles`. Idempotent. `event_sponsors` is kept as a read-only record, not dropped.
- One new column, `guests.sponsor_asked_at` (when the couple asked them to be a sponsor) — not `invitation_sent_at`,
  the RSVP invitation's own, so the guest list's "N to send" never falls for a sponsor request.
- Sponsors page: reads the guest list (`lib/sponsor-guests.ts`); Add, Edit, Remove, Invite and Mark-response write
  `guests`. Removing a sponsor takes the role, not the person. A refused read is said. Home's decision cockpit and the
  AI activity count sponsors from the guest list too.
- "Who was there" (the public band) reads the guest list's sponsors too, keeping its consent gate: a sponsor is named
  only when ASKED to stand in the role (`sponsor_asked_at`) AND they ANSWERED YES THEMSELVES (attending, set by the
  guest) — never on an event RSVP alone or a host's mark (`acceptedTheNamedRole`). Its public read selects no contact
  details. Its label for a principal is the couple's own ninong / ninang on the guest, never guessed from the side.
  An answered sponsor row counts as asked in the move, so accepted sponsors keep their place on the band.

Guards: `tests/db/sponsors-join-the-guest-list.db.test.ts` (the match rule, on a replayed database) ·
`app/dashboard/[eventId]/sponsors/sponsors-come-from-the-guest-list.test.ts`.

SPEC IMPACT: Sponsors move into the guest list (owner, brief Add 41). DECISION_LOG row owed — this session cannot
write the specs corpus.
