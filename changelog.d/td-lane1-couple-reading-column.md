## 2026-11-12 · feat(dashboard): the couple reading column from 701 — tablet/desktop lane 1

`.sn-col` is now the 48rem reading column from the `tab` line (701px), with a `.sn-col-wide` opt-out
for the 64rem wide stage (owner rule D1). Schedule, Suppliers, Details and Paperwork (and the
schedule lab) opt out, so they keep today's 64rem. Pages that already write `max-w-none` (Guests) or
`max-w-3xl` (Budget) are unchanged, because a Tailwind utility still beats the components layer.

The couple's secondary pages that never joined the large-screen system now state their width at 701:
reading `tab:max-w-3xl` for alaala, refer, guests/{new,import,quick,[guestId],send,invite,checkin,
souvenirs,tea-ceremony}, vendors/categories, vendors/packages/[bookingId], invitation and the Story
empty state; wide `tab:max-w-5xl` for galleries, memories and the Story Maker desk (which was its own
1010px cap). Below 701 nothing changes: every addition is a `tab:` utility, or the bare 64rem cap a
phone can never reach.

New guard `app/dashboard/[eventId]/secondary-pages-read.test.ts` fails if a listed page has no
system width, a phone-capped `mx-auto … max-w-*` column on it has no `tab:` width beside it, the
`.sn-col` 701 block drifts from 48rem / 64rem, or a wide-stage page loses `sn-col-wide`.

Shots (stand-in, Now beside Proposed): `build-sessions/shots-td-lane1/`.

SPEC IMPACT: None — this applies the owner's 2026-11-13 ruling ("yes to all", D1) that is already recorded.
