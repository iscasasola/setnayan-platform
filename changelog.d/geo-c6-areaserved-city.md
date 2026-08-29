## 2026-08-30 · fix(seo): vendor JSON-LD areaServed scoped to city, not country

Every vendor's `LocalBusiness` structured data declared `areaServed: Philippines`
regardless of the vendor's actual `location_city`, so local search / AI answer
engines couldn't distinguish a Cebu shop from a Manila shop. Now emits
`{ '@type': 'City', name: vendor.location_city }` when the vendor has set a
city, falling back to country-wide only when `location_city` is null.

`apps/web/app/v/[slug]/page.tsx:1533`

SPEC IMPACT: None (structured-data fidelity fix, no schema/behavior change to
the visible page).
