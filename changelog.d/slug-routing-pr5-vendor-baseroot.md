## 2026-07-01 · feat(routing): vendors at the bare root — setnayan.com/[slug] (PR5 of 8)

Vendors now resolve at the clean bare-root URL (the owner's original ask —
"ice.setnayan.com/... → setnayan.com/ice"), additively, without moving the
vendor route.

- `app/[slug]/page.tsx` becomes an **event-first, vendor-fallback dispatcher**:
  a bare slug that isn't a renderable event (no event, or a non-`website`-surface
  event type) now falls through to render the vendor at that `business_slug`
  (else 404). Both the page body and `generateMetadata` dispatch. The ~1,100-line
  event render block is untouched — only the two `notFound()` gates became
  vendor fallbacks.
- `app/v/[slug]/page.tsx` — the render + metadata are extracted into named
  exports (`renderVendorBySlug`, `vendorMetadataBySlug`) that the dispatcher
  reuses; a thin default/`generateMetadata` wrapper keeps `/v/[slug]` working.
  All of the page's own URLs (canonical, JSON-LD `@id`/`url`/breadcrumb,
  reviews pagination, `revalidatePath`) now point to the **bare-root** `/{slug}`
  — so bare root is the SEO canonical and `/v/[slug]` consolidates to it.

Additive & safe: `/v/[slug]` still resolves (canonical → bare root); events are
unchanged (event-first). Namespace note: if a vendor `business_slug` ever equals
a live event slug, the event wins at bare root and the vendor stays reachable at
`/v/[slug]` (0 such collisions today).

SPEC IMPACT: Vendors are now canonically at `setnayan.com/[vendor-slug]` (was `/v/[slug]`, which still resolves + points here via canonical). Completes the "vendor owns the bare root" half of the three-tier scheme.
