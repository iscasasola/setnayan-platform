## 2026-07-31 · fix(dashboard): close the URLs behind the hidden links — route-level event-type backstops

I spent this session closing doorways — the nav, the decisions board, the Suite
grid, the About deep-link, the free-tools strip — and then checked the routes
those hidden doorways point at. **They were open.**

Verified live on prod before writing a line:

- **`/dashboard/<id>/budget`** rendered the full Budget surface on
  `simple_event` — the vendor-free type, whose profile does not enable `budget`
  — offering to track vendor payments on an event that can have no vendors.
- **`/dashboard/<id>/vendors`** rendered the entire vendor bench on the same
  type, **including a Setnayan AI upsell** ("Setnayan AI sorts every vendor by
  how well they fit your date, budget & guest count · Unlock") on the ONE type
  where the assistant is not offered at all (owner lock 2026-07-27).
- **`/studio/save-the-date`** and its `/stamp` sub-route — a wedding surface,
  open on **all 15 non-wedding types**.

Each checked auth and nothing else. #3974 arguably made this quieter rather than
closed: it removed the last visible links, so these are now reachable only by
URL, bookmark or stale link — less visible, equally open.

**Scoped by data, not by instinct.** Of the nine `ProfileSurface` values, only
THREE are ever disabled by a live profile row (`monogram`, `save_the_date`,
`budget` — checked against prod `event_type_profiles`). The other six are
enabled for all 16 types, so gating them would be dead code that reads like
diligence. `monogram` already had the guard and is the template every fix here
copied verbatim — including its `redirect(/dashboard/<id>)` rather than
`notFound()`, because the couple asked for something their event type does not
have and their own dashboard is the honest place to land.

`/vendors` gates on `profile.marketplaceEnabled`, not a surface: the marketplace
is a profile COLUMN and folding it into `enabled_surfaces` would have meant
inventing a fake surface to hang it on. Derived from the column, so a future
vendor-free type is covered without editing the file.

**Added** `lib/event-surface-routes.test.ts` — an explicit route→check map
asserting each guarded route resolves the profile, performs its check, and
redirects. A map rather than a scan, for the reason above: it lists exactly the
routes where a gate does real work, and gains a row when a new route serves a
surface or a profile starts disabling one.

SPEC IMPACT: None — enforces the existing `enabled_surfaces` + `marketplace_enabled`
contracts on routes that were never wired to them. Every type that enables a
surface is byte-identical.
