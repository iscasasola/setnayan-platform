## 2026-09-18 · fix(seo): /alaala joins sitemap-static.xml

`/alaala` (the living-memory doorway landing page, shipped 2026-06-28) was
indexable but listed in no sitemap — orphaned the same way `/explore/compare`
and `/open-shop` were before their 2026-07-10 fix. Added to `STATIC_ROUTES` in
`apps/web/app/sitemap-static.xml/route.ts` with its real ship date as lastmod.

SPEC IMPACT: None.
