## 2026-11-02 · feat(shop): a shop can show its page before it is verified, while bookings are closed

Owner 2026-11-02 ("for suppliers that are not linked to us, we offer them space to create their website … and apply for verified account"; controller: "the website can go live; verified stays a badge"). Supplier gate audit G2, publish half. Stacked on #7186 (the bookings switch).

- Migration `20271303245624`: `vendor_profiles.self_published_at` — the column, granted to `authenticated` by name (never anon; rows stay RLS-scoped) with the shop's own `vendor_profiles_self` view rebuilt — both required by `lint-vendor-profiles-column-grants`; **no policy**. The marketplace, search and every database door stay verified-only.
- `shopPageGate` (`lib/own-shop-preview.ts`) gains `selfPublishedLive`: a shop that pressed **Show my page now**, not archived, not a demo shop, opens `/v/[slug]` to strangers **only while bookings are closed**. Callers that pass no switch keep today's rule. The shop page asks the switch at its gate calls.
- Website editor: the "Not shown yet" line becomes a **Show my page now** switch while bookings are closed (saved in place; `setShopPublished`, manager only, refused when bookings are open, service-role write).
- No Verified badge for such a page (the badge still reads the documents), no Book button (#7186), not listed in Explore.
- Guard `lib/a-shop-shows-its-page-before-verified.test.ts`; two shop-page guards re-pointed to admit the switch argument.

SPEC IMPACT: Owner call flagged — when bookings OPEN, a self-published unverified page goes back to its team until verified (the gate's `!bookingsOpen` arm). Confirm, or keep such pages up but unbookable.
