## 2026-07-10 · feat(vendors): inline whole-marketplace results in the bench search

Built on the bench marketplace-search deep-link: the Shortlist bench now shows **inline top matches from the whole marketplace** as you type — a "From the whole marketplace" list of up to 8 vendors below the shortlist filter, each linking to the vendor's page — so a couple can discover a vendor they haven't shortlisted without leaving the flow. The "See all results in the marketplace" row (deep-link to `/explore?q=`) stays for the full ranked experience.

- **New action** `searchMarketplaceForBench(query)` (`_actions/bench-marketplace-search.ts`) — debounced (~280ms) server search. Reuses the SAME correctness primitives as `category-search`: the market read goes through the couple's **RLS client** (so `vendor_market_stats`'s public-read policy scopes to published vendors — no hand-rolled filter), **demo exclusion** via `fetchDemoVendorIds`, and **hybrid anonymity** via `resolveVendorDisplayName` / `isVendorNameRevealed` (Free/Verified names + logos stay hidden until first reply). Token ilike over business_name/tagline/city, popularity-ordered, top 8.
- **Client**: a cancel-guarded debounced effect drops stale responses; loading + results states.

Files: `apps/web/app/dashboard/[eventId]/vendors/_actions/bench-marketplace-search.ts`, `apps/web/app/dashboard/[eventId]/vendors/_components/shortlist-categories.tsx`.

SPEC IMPACT: None — new read-only search over existing marketplace data reusing the canonical anonymity/demo primitives; no schema, pricing, SKU, or engine change.
