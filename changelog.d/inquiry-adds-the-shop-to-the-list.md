## 2026-09-09 · fix(marketplace): inquiring from a shop page adds that shop to the couple's list

A couple who opened an inquiry straight from a supplier's public page — without
saving the shop to their picks first — silently did not get that shop on their
supplier list, which strands the booking step later.

`event_vendors.category` is the strict Postgres enum `vendor_category` (58
labels, NOT NULL). The value written into it came raw from
`vendor_services.category`, which is plain TEXT holding a different vocabulary.
Production's two live service cards are filed under `live_band` and `host_mc`,
and **neither is an enum label** — the twins are `band_dj` and `host_emcee`.
PostgREST answered `22P02 invalid input value for enum vendor_category`
(reproduced against production by SELECT: `select 'live_band'::vendor_category`
errors, `'band_dj'::vendor_category` casts). The branch is non-fatal, so nothing
threw and the only witness was Sentry.

The action's own docblock predicted this exactly, then deferred it because
"`vendor_services` has 0 rows in production". That premise went stale: prod now
has 2 active rows, both carrying the unmappable vocabulary.

- New `lib/event-vendor-category.ts` — `eventVendorCategoryForCardKind` /
  `eventVendorCategoryKeyForCardKind`. **No new mapping table**: it reuses the
  leaf map + branch map already joined by `vendorCategoryForLeaf`, adds the rung
  for a kind that IS a tile id (`host_mc` is a branch, not a leaf, so the
  taxonomy map has no entry for it), and floors at `misc` — a real label, so the
  row always lands.
- Wired into BOTH write sites that had the defect: the public-profile inquiry
  (`app/v/[slug]/inquiry-actions.ts`) and the couple's "add a category"
  auto-add (`.../vendors/_actions/unlock-category.ts`), which swallowed the same
  rejection with a bare `continue` and reported "no vendor" for a shop the search
  had just found.
- Both failures are now LOUD: `console.error` in the runtime log alongside
  Sentry, and the inquiry reports the RAW card kind rather than the resolved one
  (the resolved value is always legal, so printing it says nothing).
- Guards: `lib/event-vendor-category.test.ts` (8 tests, incl. a source-level
  wiring check on the actual `.insert(` object literal) and
  `tests/db/inquiry-adds-the-shop.db.test.ts` (5 tests) which walks the LIVE
  replayed taxonomy — every marketplace-visible leaf AND every live tile id must
  resolve to a label the real `vendor_category` enum has. 9 mutations, occurrence
  count printed before → after, all red.

SPEC IMPACT: None. No schema change, no migration, no price, no product ruling.
The couple-side `event_vendors.category` vocabulary is unchanged — it stays on
`VENDOR_CATEGORIES`, exactly as `lib/service-card-kind.ts` requires.
