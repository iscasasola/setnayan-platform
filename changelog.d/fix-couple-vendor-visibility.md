## 2026-07-01 · fix(vendors): hydrate couple's own picked (unpublished) vendor via admin client on shortlist + workspace

A couple who adds a vendor via "Add manually" and has them claim (the #2463/#2470
flow) ends up with a real but UNPUBLISHED (`is_published=false`) linked vendor.
Two couple-facing surfaces read that vendor's marketplace detail through the RLS
client, so the public-read RLS (`USING (is_published=TRUE)`) returned nothing and
the couple saw their just-connected vendor STRIPPED (no business name / logo /
rating). event-home + the saved-vendors library already read the couple's OWN
picks via the admin client for exactly this reason; the two broken surfaces are
now consistent with that pattern.

- **Vendors shortlist** (`apps/web/app/dashboard/[eventId]/vendors/page.tsx`): the
  picked-vendor `vendor_market_stats` + `vendor_profiles` enrichment (keyed on the
  couple's own `marketplace_vendor_id` list) now reads through `createAdminClient()`
  instead of the RLS client, so a claimed unpublished vendor's name / logo / rating /
  badges hydrate. The `marketplace_vendor_id` list is derived from the couple's
  RLS-scoped `event_vendors`, so the admin read is scoped to the couple's OWN picks.
  The `chat_threads` accept-gate read and the #2469-gated market-pool COUNT stay on
  the RLS client. No `verification_state` / `is_published` filter is applied to the
  couple's own picks.
- **Service workspace** (`apps/web/app/dashboard/[eventId]/vendors/[vendorId]/workspace/page.tsx`
  + `apps/web/app/dashboard/[eventId]/_components/vendor-marketplace-info.tsx`): the
  header `vendor_profiles` read + `fetchMarketplaceServices` + `fetchMarketplaceContact`
  now use an admin client (ownership already proven by the RLS-gated `event_vendors`
  row keyed on `(vendor_id, event_id)` → `notFound()` on deny), mirroring the existing
  proven-ownership direct-pay path (`fetchPublishedMethodsForCouple`). REVIEWS remain
  on the public/RLS path (no `is_published` gate). The two fetch helpers gained a
  doc note that their client param may be an admin client; signatures unchanged, so
  non-claim vendors behave identically.

Net effect: a couple's OWN connected vendor renders fully regardless of the vendor's
public `is_published` / verification state, WITHOUT widening what non-owners can see.

SPEC IMPACT: None
