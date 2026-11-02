## 2026-07-01 · refactor(routing): single canonical reserved-slug list (PR2 of 8)

Consolidates three independently-drifted reserved-word lists into one source of
truth, `apps/web/lib/reserved-slugs.ts`, ahead of the bare-root routing change
(where vendor/user/event slugs all compete for the top-level namespace).

- New `lib/reserved-slugs.ts` exports `RESERVED_SLUGS` (union of the old
  `lib/slugs.ts` creation list + `app/[slug]/page.tsx` resolution list + the
  third copy in `app/[slug]/hub/page.tsx`) plus every real top-level route
  folder and the new `u` user namespace, and an `isReservedSlug()` helper.
- `lib/slugs.ts`, `app/[slug]/page.tsx`, and `app/[slug]/hub/page.tsx` now import
  the canonical set; their three local copies are deleted.
- Behavior is same-or-stricter everywhere (creation + resolution). Verified
  2026-07-01 against prod: **zero** of the 10 live event slugs and 47 vendor
  business_slugs collide with the unified set (incl. `wall`, which was reserved
  in the hub list but missing from the creation list), so no live page 404s.
- `middleware.ts`'s `RESERVED_SUBDOMAINS` is intentionally left separate — it
  governs DNS subdomains (`www`/`cdn`/`mail`/`ftp`), a different namespace from
  URL-path slugs. Alignment with the bare-root vendor slug check is deferred to
  the vendor-move PR.

SPEC IMPACT: None (internal refactor; no schema or public-contract change).
