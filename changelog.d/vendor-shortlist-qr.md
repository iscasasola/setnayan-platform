## 2026-07-01 · feat(vendor-shop): Shortlist QR generator (pick an event + service → scan imports vendor)

Turns the My Shop **Shortlist QR** tile into a real generator. It builds ON the
shipped, deliberately tokenless slug-invite flow (`/vendor-dashboard/invite` →
`/vendor-invite/[slug]`) rather than inventing a token/binding table — the
shipped lib's own rationale is that "a vendor advertising themselves isn't a
per-recipient secret," so the source of truth stays the public `business_slug`.
**No migration.**

**Vendor side** (`/vendor-dashboard/invite`, now "Shortlist QR")
- Pick an **event** (event-type, from `getCreatableEventTypes()`) + a
  **service** (one of the categories the vendor covers, from the new
  `vendorCoverageCategories()` helper).
- The QR/URL encodes the choices as `?et=&cat=` (validated server-side; a
  hand-edited value that isn't in the roster / the vendor's coverage is ignored).
- Server-rendered GET-form pickers → the QR re-renders for the composed URL (no
  client JS).

**Couple side** (`/vendor-invite/[slug]`)
- Reads `et`/`cat`: shows the event-type in the invite context, labels the
  "Create your {event-type} event" CTA (the automate-event-generation on-ramp
  for a couple with no event), and preserves the scope across the sign-up +
  create-event round-trips.
- The vendor is imported under the **picked category** (`categoryOverride` on
  `importVendorToEventShortlist`) instead of the coarse coercion from their full
  service list; still `source='vendor_invite'`, still free.

**Files:** `lib/vendor-couple-invite.ts` (URL opts, `vendorCoverageCategories`,
`categoryOverride`), `app/vendor-dashboard/invite/page.tsx` (rewritten as the
generator), `app/vendor-invite/[slug]/page.tsx` + `actions.ts` (scope-aware
import).

Locked QR (single-use, lock + downpayment) is the follow-up PR; the generator
toggle lands with it.

SPEC IMPACT: None (implements the prototype's Shortlist QR on the existing
invite rail; no pricing/SKU/scope change). Design artifacts:
`03_Strategy/Vendor_Dashboard_Reorg_2026-07-01.html` (`shortlistqr`) +
`Vendor_MyShop_Actual_2026-07-01.html`.
