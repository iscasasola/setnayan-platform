## 2026-07-05 · fix(help): stop hardcoding admin-managed prices in help articles

The Help corpus (`apps/web/lib/help.ts`) baked admin-managed prices straight
into article bodies that render at `/help/[slug]` and serialize verbatim into
FAQPage + Article JSON-LD (quoted directly by Google and AI answer engines).
Several were WRONG: they quoted the RETIRED pre-reprice vendor ladder (Pro
₱6,000 / Enterprise ₱10,000) while the live ladder is Solo ₱999 / Pro ₱2,499 /
Enterprise ₱4,999 per 28 days, and showed Setnayan AI at ₱499 without noting
that's the first-cycle rate. Since prices are admin-managed
(`platform_retail_catalog_v2` + the vendor billing catalog) and drift, a number
baked into evergreen SEO copy goes stale silently and users can act on it.

Fix (FALLBACK approach — the render path serializes bodies into module-const
JSON-LD, meta descriptions, and client search props with no async/DB context,
so token interpolation would be awkward and unresolved tokens would leak into
structured data): stripped ALL peso figures, tier-boundary rates, frozen live
launch dates, and the drift-prone market-size vendor-subcategory count from
every article body, replacing them with plain-language pointers to
`setnayan.com/pricing` (couple SKUs) and the vendor billing hub (vendor tiers).
Bumped `HELP_LASTMOD` to 2026-07-05. Added a unit regression guard
(`lib/help-no-hardcoded-prices.test.ts`) asserting no body contains a peso
figure, the retired ₱6,000/₱10,000/₱100,000 figures, or a frozen ISO date.

SPEC IMPACT: None. No spec/catalog/schema change — help copy only; the
canonical prices continue to live in the admin-managed catalogs. The corpus now
defers to `/pricing` rather than restating figures.
