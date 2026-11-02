## 2026-07-23 · feat(suite): grid-of-boxes layout for the service listings

Owner 2026-07-23: the Suite should read as an app-store **grid of many features**, not full-width cards stretched end to end ("we do not want to overwhelm people with a single feature").

- New `SuiteServiceCard` — a compact box tile (icon + status/price pill on top, name, two-line blurb, tags at the bottom; the whole card is one tap target, equal-height in its row).
- The **Recommended**, **Yours**, **Free to use**, and **search-results** sections now render as a responsive grid (`1 / sm:2 / lg:3 / 2xl:4` columns) of these boxes instead of full-width rows. So the wide-screen listing shows several services side by side rather than one per row.
- The **Add to your day** sellables keep their richer animated vignette cards (already a 2-column grid — the premium showcase), so the hierarchy stays: featured sellables get posters, everything else is the clean grid.
- The free "Find your date" tool is now just the first card in the free grid (dropped its full-width "featured" hero, which was itself a stretched card). `StudioAppRow` is no longer used by the Suite (the redirected `/studio` hub still uses it).

Verified: `tsc --noEmit` clean · `next lint` clean · all 2777 unit tests + the Suite doorway/tags guardrails pass. (Visual review on the Vercel preview / prod — the surface is auth-gated.)

SPEC IMPACT: None — presentation-only (layout of the same services); no pricing/SKU/schema/copy change.
