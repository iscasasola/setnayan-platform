## 2026-10-04 · fix(hosts): the event's creator is their own couple row — linked, called Host; "This is me" when it can't be told

Measured read-only on prod (owner's own wedding): the account that CREATED the
event held an `event_members` row with `guest_id = NULL`, so his Groom row read
"Not linked", his card said "Co-host", and a host's card offers no Invite — there
was no way in the app to say "that row is me". The bride, who joined through her
link, was linked to hers.

- **New events** — the wedding onboarding already asks who you are (bride ·
  groom · helper). The bride/groom row it seeds for that answer is now attached
  to the creator's membership at once (`creatorCoupleRowId`,
  `app/onboarding/wedding/actions.ts`; only fills an empty `guest_id`). A helper
  or no answer holds no row — nobody is guessed.
- **Existing events** — migration `20271264924551_the_creator_is_their_couple_row`
  links a creator's unlinked membership to a bride/groom row ONLY when exactly
  one live, unlinked row matches them (row email = account email, or the row's
  person is the one the account claimed, or first+last name = profile name), no
  other creator matches that row, and its person is not another account's.
  Idempotent (fills NULL only). Read-only check against prod: exactly one event
  resolves — `cale-ice`, the Groom row ↔ the owner's account (email, person and
  name all agree); every other creator has zero matches and is left alone.
  Applied ONLY by the pipeline.
- **"This is me"** — on the CREATOR's own unlinked bride/groom row, one action
  in place on the card (in the status line under "Their ticket"), riding the
  release door (+0 server actions) into the new SECURITY DEFINER RPC
  `claim_my_couple_row(event, guest)`: the event's creator (couple member,
  `joined_via = 'created_event'`) holding no row; a live couple row of that
  event nobody holds and no other account's person owns. An invited co-host is
  refused (a co-host must never take the bride's or groom's row). A wrong pick
  is undoable: Unlink on the creator's own row clears `guest_id` and keeps the
  membership (`lib/seat-unlink.ts`).
- **The creator's row** is now the row their membership holds OR the row whose
  person they claimed (`creatorGuestIds`), in both `loadGuestAccessMap` and
  `setGuestAccess` — so a name-only row linked by "This is me" reads Host and
  its Access stays locked.
  Refusals come back as words and land on the card as sentences. `authenticated`
  only (exposure baseline +1 line, regenerated with its generator).
- **"Host", not "Co-host"** — `accessWordFor` / `CREATOR_WORD` in
  `lib/guest-access.ts`: the creator reads "Host" on the guest card (status line
  + Access line), the guest list's Access column and tag, People with access,
  and the Overview's Hosts card. A chosen co-host still reads "Co-host".

Guards: `apps/web/lib/creator-couple-row.test.ts` (rules + wiring),
`apps/web/tests/db/the-creator-is-their-couple-row.db.test.ts` (runs the
committed backfill SQL + the RPC as `authenticated`/`anon`).

SPEC IMPACT: DECISION_LOG.md — new 2026-10-04 row "THE CREATOR IS THEIR OWN
COUPLE ROW · CALLED HOST · 'THIS IS ME'" (the label and linking rule).
