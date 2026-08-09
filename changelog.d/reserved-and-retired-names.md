## 2026-08-09 · fix(slugs): our own page names can no longer be claimed, and a retired address stops going back in the pool

Two defects in the one shared web-address namespace (`setnayan.com/{word}`), where
weddings, shops and people all live.

**7 · Fourteen of our own pages were claimable.** `lib/reserved-slugs.ts` was
hand-typed, and a hand-typed list is silent about whatever nobody typed into it:
`claim` · `creators` · `demo-capture` · `dev` · `host` · `onboarding` ·
`open-shop` · `pabati` · `proposals` · `prototype` · `receipts` · `samahan` ·
`site-editor` · `vendor-invite` were all real, live pages that a shop, wedding or
person could take — `creators` and `open-shop` are in the public sitemap. The
list is now **generated from the route folders on disk**
(`scripts/gen-reserved-slugs.mjs` → `ROUTE_RESERVED_SLUGS`), with the previous
hand-authored entries kept as `DB_MIRRORED_RESERVED_SLUGS` (the half the database
mirrors). A page added tomorrow is protected the moment its folder exists.

The couple's rename form (`updateEventSlug`) checked the format regex and one
`.ilike` against `events`, then wrote — **no reserved check at all**, no shop
check, no person check. It now runs the shared `findSlugConflict`.

**8 · A retired address went straight back into the pool.** Renaming leaves a
90-day forwarding row (`slug_change_log.redirect_until`), so the old word is
still carrying printed invitations. `isSlugTaken` (the create path), the live
availability endpoint `/api/slugs/check`, its suggestion list, and the rename
form now all refuse a word that still has a live forwarding row that is not the
caller's own.

Every probe checks `error` explicitly and **fails closed** — Supabase resolves
`{ error }` rather than throwing, so a failed read had looked exactly like
"nothing found".

Guards (all mutation-tested): `lib/reserved-slugs.test.ts` re-reads
`apps/web/app` and fails naming any real page the list does not protect, in both
directions; `lib/slug-availability.test.ts` covers every conflict reason, the
self-exclusion cases, the fail-closed paths, and scans the *shipped* bodies of
the rename action and the availability route so neither can quietly stop
checking. `tests/db/vendor-business-slug-mint.db.test.ts` now compares the
hand-typed half against the database and separately fails if a **new** route
folder appears with no database cover.

⚠ KNOWN REMAINING GAP, deliberately not closed here (no migration in scope): the
database's own auto-mint (`public.business_slug_is_reserved`) still does not know
the 15 route-derived words, so a company literally named e.g. "Creators" could be
minted `creators` as its default address. Every application path refuses it. The
gap is listed explicitly in `KNOWN_DB_MINT_GAP` in that db test so it is loud
rather than silent, and closing it is a one-function migration.

SPEC IMPACT: None — no product, pricing or scope decision. The reserved-word list
is a mechanical consequence of the routes that already exist.
