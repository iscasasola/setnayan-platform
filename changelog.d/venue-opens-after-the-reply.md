## 2026-09-20 · feat(invitation): the address, map and directions open once a guest replies

Owner ruling 2026-09-20, from the Event Hub arrival work: the precise location is for
people who have answered. Until then the invitation shows the venue NAME and one line
saying what opens it; the street address, the map embed and every directions link are
withheld.

- `lib/venue-disclosure.ts` is the whole rule, pure and executed by tests: a host always
  sees it, any real answer opens it (including a decline), and **it opens on the event day
  regardless**, so a guest who never replied is never locked out while travelling.
- **Fails closed by construction.** `app/[slug]/page.tsx` builds one props object that every
  render branch spreads, and that object now carries the withheld row. Only the guest branch,
  which knows the reply, opens it. A future branch inherits the closed state.
- The day-of hub (`app/[slug]/hub/page.tsx`) asks the same imported rule, never a copy.
- **The directions row had to close with it.** `NavLinksRow` falls back to a maps search by
  `venue_name`, so withholding the address alone would have handed out the withheld fact one
  tap later.
- The venue name stays visible throughout: an invitation that cannot say where it is reads
  as broken.

Guarded by `apps/web/lib/the-venue-opens-after-the-reply.test.ts` (8 tests). Three sabotages
each turn one red: removing the default withhold, restoring an operator-precedence bug that
let the address branch bypass the gate on the hub, and making the widget stop asking.

Not verified in prod yet: needs a test event where a guest has not replied.

SPEC IMPACT: `DECISION_LOG.md` 2026-09-20 row — the venue opens after the reply.
