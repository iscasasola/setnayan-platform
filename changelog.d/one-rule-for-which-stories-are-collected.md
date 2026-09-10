## 2026-09-07 · fix(stories): the vendor's portfolio collected weddings only, three weeks after the shelf opened to every kind

`lib/realstories-vendor.ts` and `lib/recap-vendor.ts` each carried their own
`.eq('event_type', 'wedding')` and their own `'A Setnayan wedding'` fallback through the
2026-08-15 correction that opened the editorial to all sixteen kinds. The shelf published a
debut, reunion, graduation or wake to `/realstories`; the credited vendor's portfolio
(`/v/[slug]` "Featured in these stories") and `/vendor-dashboard/real-stories` then dropped it
on the floor. **The free tier's headline promise — the story is collected on your portfolio,
automatically — was false for fifteen of the sixteen kinds.** The recap loader had the same
defect on a surface (`/[slug]/recap`) that has been kind-aware since the occasion words shipped.

- `withEditorialEventTypes()` moves out of `showcase-db.ts` into `lib/editorial-event-types.ts`
  and is exported: **one filter, composed by every surface that lists published stories.** The
  private copy is what drifted — this is the whole cause, so the helper no longer lives inside
  one caller.
- Both loaders drop their filter, compose the shared one, and use `UNNAMED_EDITORIAL_LABEL`.
  `coupleNames` → `hostNames` on both types (a family, a celebrant and a company are not a
  couple), with the six consumers updated, plus the wedding-only share titles and empty-state
  copy that rode along. Two more `'A Setnayan wedding'` display fallbacks fixed in the admin
  studio and the account Library.
- **The guard that should have caught this was green the whole time**, because its
  `EDITORIAL_SOURCES` was a hand-written list of two files while its own docblock claimed it
  fired "the moment a seventh appears ANYWHERE in the editorial path". It now WALKS `lib/` and
  `app/`, uses the repo's one comment stripper, and admits a surviving wedding-only filter only
  via `WEDDING_ONLY_BY_DESIGN` — four entries, each with its reason — with a second test that
  fails if an exemption goes stale. Verified by sabotage: re-adding the filter fails the guard;
  removing it passes. `apps/web/lib/editorial-event-types.test.ts` also leaves the
  one-comment-stripper baseline (295 → 294).

⚠ **Deliberately NOT changed:** `editorial/data.ts`'s edition-No. count still counts weddings in
the awards cycle. What "No. 7" counts for a non-wedding story — the seventh wedding, or the
seventh story — is an owner question, recorded in the design doc, not a filter to flip quietly.
It is in the by-design list with that reason.

SPEC IMPACT: `Design_Editorial_By_The_Minute_2026-09-07/README.md` — the data-requirements table's
row "free portfolio collection for non-weddings" is now met; the LISTED tier's promise is true for
every kind. The open owner question about the edition number is unchanged.
