## 2026-06-29 · feat(real-stories): Style-Twin Discovery — tap a story → its vendors (Soon-benefits Wave 1)

Couples who love a Real Story can now tap straight through to the marketplace
vendors who made it. Closes the last Wave-1 benefit; also lands the **P0**
reusable vendor-credit primitive (born used here).

Gap-check first: the `/[slug]` editorial "Team Behind the Day" block ALREADY
renders tappable `/v/[slug]` credits — so the only real gap was the
**`/realstories` index**, which linked to a generic `/explore` ("Browse
vendors") with no per-story tap-through.

What shipped:
- **`<VendorCreditChip>`** (`apps/web/app/_components/vendor-credit-chip.tsx`) —
  reusable, tappable vendor-credit pill (logo + name) deep-linking to `/v/[slug]`.
  Type-only import of the credit shape keeps it safe inside client components
  (no server-only leak). Designed for reuse by Wave-5 spotlight surfaces.
- **Batched credit fetch** in `loadPublishedShowcases` (`apps/web/lib/showcase-db.ts`):
  one round trip across all stories (no N+1) resolving each event's credited
  vendors, deduped + capped at 4/card. Same tier gate as the editorial credit —
  **Pro/Enterprise with a public `business_slug` only**; Free/Verified excluded.
  Best-effort: any failure leaves `vendors=[]` and the card still renders.
- **`/realstories` cards** (`gallery.tsx`): a "Team" chip row renders BELOW each
  card as a sibling of the card `<Link>` (never a nested anchor). Sample tiles
  carry no credits, so nothing renders for them.

Founder-only-marketplace note: chips only appear for real consented showcases
that credit Pro/Enterprise vendors — sparse at launch, fully wired for density.
Typecheck + lint clean; CI runs the production build.

SPEC IMPACT: None — additive discovery surface reusing the existing
`event_vendors.linked_vendor_profile_id` credit join + tier gate; no schema/SKU/
pricing change.
