## 2026-09-10 · fix(services): a service card cannot go live without a name

Measured in production before anything was written:
`SELECT count(*) FILTER (WHERE title IS NULL) FROM vendor_services` returned
**2 of 2**, both `is_active = true`. Every reader falls back to the kind
(`app/v/[slug]/page.tsx`: `s.title?.trim() || displayServiceLabel(s.category)`),
so a couple browsing the only two live cards read "Wedding Bands (full
ensemble)" and a humanised `host_mc` where the shop's own name for that service
should be. The card is the middle of the two-sided test.

**Established before choosing a repair: the name was never asked for and never
written.** The auto-namer already existed and is a CLIENT-SIDE `useEffect` in
`canvas-maker.tsx` gated on `initial === null`, so it fires for a brand-new card
and for nothing else — both rows were seeded 2026-08-01 08:10:21.894705+00
(identical to the microsecond), were edited as recently as 2026-09-08, and are
still nameless because no edit path names a card: the legacy card editor's own
comment says it "does not submit or write `title`", and
`services/new/[category]/page.tsx` — the start-from-one-of-your-cards route —
mounts `<CanvasMaker>` with no `shopName` prop at all. So the repair is a FILL,
never a requirement: `title` is deliberately NOT added to `PUBLISH_REQUIREMENTS`,
because refusing a publish for a missing title would demand the one thing the
owner locked us into writing for them (2026-07-27, *"saving builds blank will
make us autocreate a name"*).

Three changes, plus the one already shipped:

* `lib/service-card-auto-title.ts` (new) — the one rule. `<kind> by <shop>`,
  clamped to 80, the shape the maker has written since 2026-07-27.
* `commitVendorService` names a blank card before the write, resolving the kind
  through the app-wide `cardKindLabeller` so a raw database key can never reach
  a card title.
* Migration `20271217522970` — `fill_blank_service_card_title()`, a
  `BEFORE INSERT OR UPDATE` trigger, the floor. Load-bearing, not
  belt-and-braces: read out of production by the object, `authenticated` holds
  UPDATE on both `title` and `is_active`, so a shop can PATCH a live card
  nameless through PostgREST; and `save_vendor_service` (SECURITY DEFINER)
  writes `title = NULLIF(p_fields->>'title', '')`, so any payload omitting the
  key blanks the column. It fires before `trg_enforce_service_publish_gate`
  (BEFORE triggers run in name order) and it FILLS — a refusal here would have
  bounced the owner's own two live cards with a raw Postgres sentence the next
  time he changed a price.

The shop name is written into a title only when hybrid anonymity would already
show it (verified — the owner's 2026-07-22 "open it up" lock — or
`name_revealed_at` stamped). A stored title is rendered raw with no anonymity
filter downstream, so baking `business_name` in unconditionally would publish an
unverified shop's real name and freeze it there.

Nothing is backfilled: the two live rows are the owner's data and gain their
names the next time either is saved. Guarded by
`apps/web/lib/a-card-cannot-go-live-nameless.test.ts` (15) and
`apps/web/tests/db/a-card-cannot-go-live-nameless.db.test.ts` (10), 21 mutations,
each measured before → after and each red.

SPEC IMPACT: None. `PUBLISH_REQUIREMENTS` is untouched, so no publish rule
changed — this only fills a column that had no writer on any edit path. The
2026-07-27 auto-name lock is honoured rather than amended.
